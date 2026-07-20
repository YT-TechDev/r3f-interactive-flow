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

async function assertLockfileRegistryEvidence(tempConsumer) {
  const lockfile = await readFile(join(tempConsumer, "pnpm-lock.yaml"), "utf8");
  const lines = lockfile.split(/\r?\n/);
  const dependencyLineIndex = lines.findIndex((line) =>
    /^\s{4}r3f-interactive-flow:\s*$/.test(line)
  );

  if (dependencyLineIndex === -1) {
    throw new Error("pnpm lockfile is missing the r3f-interactive-flow dependency entry.");
  }

  const dependencyBlock = [];

  for (const line of lines.slice(dependencyLineIndex + 1)) {
    if (/^\s{4}\S/.test(line)) {
      break;
    }

    dependencyBlock.push(line);
  }

  const hasExactSpecifier = dependencyBlock.some((line) =>
    /^\s{6}specifier:\s+2\.4\.0\s*$/.test(line)
  );
  const versionLine = dependencyBlock.find((line) => /^\s{6}version:\s+/.test(line));

  if (!hasExactSpecifier) {
    throw new Error("pnpm lockfile does not record specifier: 2.4.0 for r3f-interactive-flow.");
  }

  if (versionLine === undefined || !/^\s{6}version:\s+2\.4\.0(?:\(|\s*$)/.test(versionLine)) {
    throw new Error("pnpm lockfile does not record version: 2.4.0 for r3f-interactive-flow.");
  }

  if (/\b(?:link|file|workspace):/.test(dependencyBlock.join("\n"))) {
    throw new Error("pnpm lockfile resolved r3f-interactive-flow from a local dependency source.");
  }
}

async function main() {
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
