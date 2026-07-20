import { cp, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const consumerSource = join(repoRoot, "validation", "vite-published-package");
const workspacePackage = join(repoRoot, "packages", "r3f-interactive-flow");
const expectedVersion = "2.4.0";

function run(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`));
    });
  });
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function assertRegistryResolution({ resolvedPackagePath, tempConsumer, installedManifest }) {
  const normalizedResolved = normalizePath(resolvedPackagePath);
  const normalizedWorkspace = normalizePath(workspacePackage);
  const normalizedConsumer = normalizePath(tempConsumer);

  if (installedManifest.version !== expectedVersion) {
    throw new Error(
      `expected r3f-interactive-flow ${expectedVersion}, found ${installedManifest.version}`
    );
  }

  if (
    normalizedResolved === normalizedWorkspace ||
    normalizedResolved.startsWith(`${normalizedWorkspace}/`)
  ) {
    throw new Error(`resolved package points at local workspace package: ${resolvedPackagePath}`);
  }

  if (!normalizedResolved.startsWith(`${normalizedConsumer}/node_modules/`)) {
    throw new Error(
      `resolved package is outside the standalone consumer node_modules: ${resolvedPackagePath}`
    );
  }

  if (
    normalizedResolved.includes("/packages/r3f-interactive-flow/") ||
    normalizedResolved.endsWith("/packages/r3f-interactive-flow")
  ) {
    throw new Error(`resolved package path resembles repository source: ${resolvedPackagePath}`);
  }
}

function getLockfileImporterDependencyBlock(lockfile) {
  const lines = lockfile.split(/\r?\n/);
  const importersIndex = lines.findIndex((line) => line.trim() === "importers:");

  if (importersIndex === -1) {
    throw new Error("pnpm lockfile is missing the importers section.");
  }

  const nextTopLevelSectionIndex = lines.findIndex(
    (line, index) => index > importersIndex && /^\S[^:]*:\s*$/.test(line)
  );
  const importerLines = lines.slice(
    importersIndex + 1,
    nextTopLevelSectionIndex === -1 ? lines.length : nextTopLevelSectionIndex
  );
  const dependencyLineIndex = importerLines.findIndex(
    (line) => line.trim() === "r3f-interactive-flow:"
  );

  if (dependencyLineIndex === -1) {
    throw new Error("pnpm lockfile is missing the r3f-interactive-flow importer dependency entry.");
  }

  const dependencyLine = importerLines[dependencyLineIndex];
  const dependencyIndent = dependencyLine.match(/^\s*/)?.[0].length ?? 0;
  const dependencyBlock = [];

  for (const line of importerLines.slice(dependencyLineIndex + 1)) {
    if (line.trim() === "") {
      dependencyBlock.push(line);
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;

    if (indent <= dependencyIndent) {
      break;
    }

    dependencyBlock.push(line);
  }

  return dependencyBlock;
}

function assertLockfileRegistryEvidenceText(lockfile) {
  const dependencyBlock = getLockfileImporterDependencyBlock(lockfile);
  const normalizedBlock = dependencyBlock.map((line) => line.trim());
  const hasExactSpecifier = normalizedBlock.includes("specifier: 2.4.0");
  const versionLine = normalizedBlock.find((line) => line.startsWith("version:"));

  if (!hasExactSpecifier) {
    throw new Error("pnpm lockfile does not record specifier: 2.4.0 for r3f-interactive-flow.");
  }

  if (versionLine === undefined || !/^version:\s+2\.4\.0(?:\(|\s*$)/.test(versionLine)) {
    throw new Error("pnpm lockfile does not record version: 2.4.0 for r3f-interactive-flow.");
  }

  if (/\b(?:link|file|workspace):/.test(dependencyBlock.join("\n"))) {
    throw new Error("pnpm lockfile resolved r3f-interactive-flow from a local dependency source.");
  }
}

function runLockfileParserSelfCheck() {
  const validRegistryImporter = `importers:

  .:
    dependencies:
      r3f-interactive-flow:
        specifier: 2.4.0
        version: 2.4.0(@react-three/fiber@9.6.1)
`;
  const workspaceImporter = `importers:

  .:
    dependencies:
      r3f-interactive-flow:
        specifier: workspace:*
        version: link:../../packages/r3f-interactive-flow
`;
  const boundedImporter = `importers:

  .:
    dependencies:
      r3f-interactive-flow:
        specifier: 2.4.0
        version: 2.4.0

packages:
  unrelated:
    resolution:
      tarball: file:../not-the-importer.tgz
    repository: git+https://example.invalid/unrelated.git
`;

  assertLockfileRegistryEvidenceText(validRegistryImporter);
  assertLockfileRegistryEvidenceText(boundedImporter);

  try {
    assertLockfileRegistryEvidenceText(workspaceImporter);
  } catch {
    console.log("published consumer: lockfile parser self-check passed");
    return;
  }

  throw new Error("pnpm lockfile parser accepted a local workspace dependency fixture.");
}

async function assertLockfileRegistryEvidence(tempConsumer) {
  const lockfile = await readFile(join(tempConsumer, "pnpm-lock.yaml"), "utf8");

  assertLockfileRegistryEvidenceText(lockfile);
}

async function main() {
  runLockfileParserSelfCheck();

  const tempRoot = await mkdtemp(join(tmpdir(), "r3f-flow-published-consumer-"));
  const tempConsumer = join(tempRoot, "vite-published-package");

  try {
    await cp(consumerSource, tempConsumer, { recursive: true });

    console.log("published consumer: validating manifest");

    const consumerManifestPath = join(tempConsumer, "package.json");
    const consumerManifest = JSON.parse(await readFile(consumerManifestPath, "utf8"));
    const dependencySpec = consumerManifest.dependencies?.["r3f-interactive-flow"];

    if (dependencySpec !== expectedVersion) {
      throw new Error(
        `expected consumer dependency r3f-interactive-flow ${expectedVersion}, found ${dependencySpec ?? "missing"}`
      );
    }

    console.log("published consumer: installing standalone dependencies");
    await run("pnpm", ["install"], { cwd: tempConsumer });

    console.log("published consumer: verifying registry package resolution");

    const requireFromConsumer = createRequire(pathToFileURL(consumerManifestPath));
    const resolvedEntrypoint = requireFromConsumer.resolve("r3f-interactive-flow");
    const resolvedPackagePath = await realpath(resolve(dirname(resolvedEntrypoint), ".."));
    const resolvedConsumerPath = await realpath(tempConsumer);
    const resolvedManifestPath = join(resolvedPackagePath, "package.json");
    const installedManifest = JSON.parse(await readFile(resolvedManifestPath, "utf8"));

    assertRegistryResolution({
      resolvedPackagePath,
      tempConsumer: resolvedConsumerPath,
      installedManifest
    });
    await assertLockfileRegistryEvidence(tempConsumer);

    console.log(`declared package version: ${dependencySpec}`);
    console.log(`installed package version: ${installedManifest.version}`);
    console.log(`resolved package path: ${resolvedPackagePath}`);

    console.log("published consumer: building standalone consumer");
    await run("pnpm", ["build"], { cwd: tempConsumer });

    console.log("build result: passed");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
