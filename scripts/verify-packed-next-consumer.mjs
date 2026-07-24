import { cpSync, copyFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  PackedConsumerError,
  assertBuildOutputExists,
  assertCommandSucceeded,
  assertNotUnderRepoNodeModules,
  assertRealInstalledCopy,
  createTempRoot,
  packTarball,
  packageDir,
  readJsonFile,
  removeTempRoot,
  repoRoot,
  runCommand
} from "./lib/packed-consumer-utils.mjs";

const fixtureSourceDir = join(repoRoot, "validation", "next-packed-package");

const EXPECTED_VERSIONS = {
  next: "16.2.11",
  react: "19.2.8",
  "react-dom": "19.2.8",
  "@react-three/fiber": "9.6.1",
  three: "0.185.1",
  typescript: "6.0.3",
  "@types/node": "22.20.1",
  "@types/react": "19.2.17",
  "@types/react-dom": "19.2.3",
  "@types/three": "0.185.1"
};

function step(label, fn) {
  try {
    const value = fn();
    console.log(`✔ ${label}`);
    return value;
  } catch (err) {
    throw new PackedConsumerError(
      `Stage failed: ${label}\n${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function getRepositoryCheckoutCommit() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  const result = runCommand("git", ["rev-parse", "HEAD"], { cwd: repoRoot });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  return "unavailable";
}

function startsWithUseClientDirective(contents) {
  const firstStatement = contents.trimStart().slice(0, 40);
  return firstStatement.startsWith('"use client"') || firstStatement.startsWith("'use client'");
}

function readAppFile(name) {
  return readFileSync(join(fixtureSourceDir, "app", name), "utf8");
}

function validateFixtureContract() {
  const packageJsonPath = join(fixtureSourceDir, "package.json");
  const packageJsonText = readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonText);

  if (packageJsonText.includes("workspace:")) {
    throw new PackedConsumerError(
      `Fixture package.json must not reference "workspace:": ${packageJsonPath}`
    );
  }

  if (packageJson.dependencies?.["r3f-interactive-flow"] !== "file:./r3f-interactive-flow.tgz") {
    throw new PackedConsumerError(
      'Fixture package.json dependencies["r3f-interactive-flow"] must be exactly "file:./r3f-interactive-flow.tgz".'
    );
  }

  const versionEntries = { ...packageJson.dependencies, ...packageJson.devDependencies };

  for (const [name, expectedVersion] of Object.entries(EXPECTED_VERSIONS)) {
    const declaredVersion = versionEntries[name];

    if (declaredVersion !== expectedVersion) {
      throw new PackedConsumerError(
        `Fixture package.json must declare "${name}" as exact version "${expectedVersion}", found ${String(declaredVersion)}.`
      );
    }
  }

  const tsconfig = readJsonFile(join(fixtureSourceDir, "tsconfig.json"));

  if (tsconfig.compilerOptions?.paths) {
    throw new PackedConsumerError('Fixture tsconfig.json must not declare "paths".');
  }

  if (tsconfig.compilerOptions?.baseUrl) {
    throw new PackedConsumerError('Fixture tsconfig.json must not declare "baseUrl".');
  }

  const layoutContents = readAppFile("layout.tsx");
  const pageContents = readAppFile("page.tsx");
  const flowClientContents = readAppFile("flow-client.tsx");
  const flowCanvasContents = readAppFile("flow-canvas.tsx");
  const flowContractContents = readAppFile("flow-contract.ts");

  const appFiles = {
    "layout.tsx": layoutContents,
    "page.tsx": pageContents,
    "flow-client.tsx": flowClientContents,
    "flow-canvas.tsx": flowCanvasContents,
    "flow-contract.ts": flowContractContents
  };

  for (const [name, contents] of Object.entries(appFiles)) {
    if (contents.includes("next/navigation") || contents.includes("useRouter")) {
      throw new PackedConsumerError(`${name} must not reference router integration.`);
    }

    if (contents.includes('"use server"') || contents.includes("'use server'")) {
      throw new PackedConsumerError(`${name} must not declare a Server Action.`);
    }
  }

  if (
    /r3f-interactive-flow\/\S+/.test(
      layoutContents + pageContents + flowClientContents + flowCanvasContents
    )
  ) {
    throw new PackedConsumerError(
      "Fixture source must import only the package root, found an internal-subpath import."
    );
  }

  if (startsWithUseClientDirective(layoutContents) || startsWithUseClientDirective(pageContents)) {
    throw new PackedConsumerError(
      '"layout.tsx" and "page.tsx" must remain Server Components without a "use client" directive.'
    );
  }

  if (pageContents.includes("r3f-interactive-flow")) {
    throw new PackedConsumerError(
      '"page.tsx" (Server Component) must not import "r3f-interactive-flow".'
    );
  }

  if (!pageContents.includes("PHASES") || !/title=["']/.test(pageContents)) {
    throw new PackedConsumerError(
      '"page.tsx" must pass the serializable phase tuple and a string prop into the Client Component wrapper.'
    );
  }

  if (!startsWithUseClientDirective(flowClientContents)) {
    throw new PackedConsumerError('"flow-client.tsx" must begin with a "use client" directive.');
  }

  for (const symbol of ["FlowProvider", "useFlow", "useFlowProgress"]) {
    if (!flowClientContents.includes(symbol)) {
      throw new PackedConsumerError(
        `"flow-client.tsx" must use "${symbol}" from the package root.`
      );
    }
  }

  if (!startsWithUseClientDirective(flowCanvasContents)) {
    throw new PackedConsumerError('"flow-canvas.tsx" must begin with a "use client" directive.');
  }

  if (!flowCanvasContents.includes("useFlowFrame")) {
    throw new PackedConsumerError(
      '"flow-canvas.tsx" must call "useFlowFrame" from the package root.'
    );
  }

  if (!flowCanvasContents.includes("<Canvas")) {
    throw new PackedConsumerError('"flow-canvas.tsx" must render "<Canvas>".');
  }

  if (
    layoutContents.includes("useFlowFrame") ||
    pageContents.includes("useFlowFrame") ||
    flowClientContents.includes("useFlowFrame")
  ) {
    throw new PackedConsumerError('"useFlowFrame" must appear only in "flow-canvas.tsx".');
  }

  if (flowContractContents.includes("r3f-interactive-flow")) {
    throw new PackedConsumerError('"flow-contract.ts" must not import "r3f-interactive-flow".');
  }
}

function createConsumer(tempRoot) {
  const consumerDir = join(tempRoot, "consumer");
  cpSync(fixtureSourceDir, consumerDir, { recursive: true });
  return consumerDir;
}

function copyTarballIntoConsumer(consumerDir, tarballPath) {
  copyFileSync(tarballPath, join(consumerDir, "r3f-interactive-flow.tgz"));
}

function installConsumerDependencies(consumerDir) {
  let result = runCommand("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts"], {
    cwd: consumerDir
  });

  if (result.status === 0) {
    return { result, ignoredScripts: true };
  }

  const fallback = runCommand("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: consumerDir
  });

  assertCommandSucceeded(fallback, "npm install", "npm install --no-audit --no-fund");

  return { result: fallback, ignoredScripts: false };
}

function assertInstalledPackage(consumerDir, tempRoot, expectedVersion) {
  const installedDir = join(consumerDir, "node_modules", "r3f-interactive-flow");

  assertRealInstalledCopy({
    installedDir,
    tempRoot,
    excludedSourceDir: packageDir,
    label: "r3f-interactive-flow"
  });
  assertNotUnderRepoNodeModules(installedDir, "r3f-interactive-flow");

  for (const relativePath of [
    "dist/index.js",
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.d.cts"
  ]) {
    if (!existsSync(join(installedDir, relativePath))) {
      throw new PackedConsumerError(`Installed package is missing "${relativePath}".`);
    }
  }

  const installedPackageJson = readJsonFile(join(installedDir, "package.json"));

  if (installedPackageJson.version !== expectedVersion) {
    throw new PackedConsumerError(
      `Installed package version must match the live workspace package version "${expectedVersion}", found ${installedPackageJson.version}.`
    );
  }

  return { installedDir, installedPackageJson };
}

function assertInstalledPackageManifestBoundary(installedPackageJson) {
  for (const field of ["dependencies", "peerDependencies", "devDependencies"]) {
    const entries = installedPackageJson[field] ?? {};

    if (Object.prototype.hasOwnProperty.call(entries, "next")) {
      throw new PackedConsumerError(
        `Installed package manifest must not list "next" in "${field}".`
      );
    }
  }

  const exportKeys = Object.keys(installedPackageJson.exports ?? {});

  if (exportKeys.length !== 1 || exportKeys[0] !== ".") {
    throw new PackedConsumerError(
      `Installed package must keep a root-only export, found: ${exportKeys.join(", ")}`
    );
  }
}

function assertInstalledDirectDependencies(consumerDir, tempRoot) {
  for (const [name, expectedVersion] of Object.entries(EXPECTED_VERSIONS)) {
    const installedDir = join(consumerDir, "node_modules", ...name.split("/"));

    assertRealInstalledCopy({
      installedDir,
      tempRoot,
      excludedSourceDir: join(repoRoot, "node_modules"),
      label: name
    });
    assertNotUnderRepoNodeModules(installedDir, name);

    const installedPackageJson = readJsonFile(join(installedDir, "package.json"));

    if (installedPackageJson.version !== expectedVersion) {
      throw new PackedConsumerError(
        `Expected "${name}" to resolve to exactly ${expectedVersion}, but found ${installedPackageJson.version}.`
      );
    }
  }
}

function runDependencyGraphCheck(consumerDir) {
  const result = runCommand("npm", ["ls", "--json", "--all"], { cwd: consumerDir });

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    throw new PackedConsumerError(
      `Failed to parse "npm ls --json" output: ${err.message}\n${result.stdout}`
    );
  }

  const problems = parsed.problems ?? [];

  if (problems.length > 0) {
    throw new PackedConsumerError(
      `"npm ls" reported an invalid dependency graph:\n${problems.join("\n")}`
    );
  }

  assertCommandSucceeded(result, '"npm ls" dependency graph', "npm ls --json --all");

  return parsed;
}

function assertInstalledClientDirective(installedDir) {
  const results = {};

  for (const relativePath of ["dist/index.js", "dist/index.cjs"]) {
    const firstChunk = readFileSync(join(installedDir, relativePath), "utf8").slice(0, 300);

    if (!firstChunk.includes('"use client"') && !firstChunk.includes("'use client'")) {
      throw new PackedConsumerError(
        `Installed "${relativePath}" does not include "use client" near the top.`
      );
    }

    results[relativePath] = "verified";
  }

  return results;
}

function runStandaloneTypecheck(consumerDir) {
  const tscPath = join(consumerDir, "node_modules", "typescript", "lib", "tsc.js");
  const result = runCommand(process.execPath, [tscPath, "--noEmit"], { cwd: consumerDir });

  assertCommandSucceeded(result, "standalone TypeScript typecheck", "tsc --noEmit");
  return result;
}

function runProductionBuild(consumerDir) {
  const nextCliPath = join(consumerDir, "node_modules", "next", "dist", "bin", "next");
  const result = runCommand(process.execPath, [nextCliPath, "build"], {
    cwd: consumerDir,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      CI: "1"
    }
  });

  assertCommandSucceeded(result, "production Next.js build", "next build");
  return result;
}

function findFirstFileRecursive(rootDir, predicate) {
  if (!existsSync(rootDir)) {
    return undefined;
  }

  // Sort so Next's internal reserved routes (e.g. "_global-error") are
  // considered only after the app's own route output, giving clearer evidence.
  const entries = readdirSync(rootDir).sort((a, b) => {
    const aReserved = a.startsWith("_");
    const bReserved = b.startsWith("_");

    if (aReserved !== bReserved) {
      return aReserved ? 1 : -1;
    }

    return a.localeCompare(b);
  });

  for (const entry of entries) {
    const entryPath = join(rootDir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      const found = findFirstFileRecursive(entryPath, predicate);

      if (found) {
        return found;
      }

      continue;
    }

    if (predicate(entry)) {
      return entryPath;
    }
  }

  return undefined;
}

function assertBuildArtifacts(consumerDir) {
  const nextDir = join(consumerDir, ".next");
  const buildIdPath = join(nextDir, "BUILD_ID");

  if (!existsSync(buildIdPath)) {
    throw new PackedConsumerError('Expected ".next/BUILD_ID" after a successful production build.');
  }

  const serverAppDir = join(nextDir, "server", "app");
  const serverArtifact = findFirstFileRecursive(serverAppDir, (name) => name.endsWith(".js"));

  if (!serverArtifact) {
    throw new PackedConsumerError(
      'Expected at least one generated server App Router artifact under ".next/server/app".'
    );
  }

  const staticChunksDir = join(nextDir, "static", "chunks");
  const clientChunk = findFirstFileRecursive(staticChunksDir, (name) => name.endsWith(".js"));

  if (!clientChunk) {
    throw new PackedConsumerError(
      'Expected at least one generated client JavaScript chunk under ".next/static/chunks".'
    );
  }

  return {
    buildIdRelative: "next-packed-package/.next/BUILD_ID",
    serverArtifactRelative: `next-packed-package/${relative(consumerDir, serverArtifact)}`,
    clientChunkRelative: `next-packed-package/${relative(consumerDir, clientChunk)}`
  };
}

async function main() {
  step("build output exists", () =>
    assertBuildOutputExists(packageDir, [
      "dist/index.js",
      "dist/index.cjs",
      "dist/index.d.ts",
      "dist/index.d.cts"
    ])
  );

  step("validate committed fixture manifest and source contract", validateFixtureContract);

  const workspacePackageJson = readJsonFile(join(packageDir, "package.json"));
  const tempRoot = createTempRoot("r3f-packed-next-consumer-");

  try {
    const tarballInfo = step("pack tarball with npm pack", () => packTarball(packageDir, tempRoot));

    const consumerDir = step("create isolated consumer environment", () =>
      createConsumer(tempRoot)
    );

    step("copy generated tarball into consumer", () =>
      copyTarballIntoConsumer(consumerDir, tarballInfo.tarballPath)
    );

    const installOutcome = step("install fixture dependencies from the packed tarball", () =>
      installConsumerDependencies(consumerDir)
    );

    const { installedDir, installedPackageJson } = step(
      "assert installed package is a real tarball copy",
      () => assertInstalledPackage(consumerDir, tempRoot, workspacePackageJson.version)
    );

    step("assert installed package manifest boundary (no Next.js, root-only export)", () =>
      assertInstalledPackageManifestBoundary(installedPackageJson)
    );

    step("assert consumer-installed direct dependencies", () =>
      assertInstalledDirectDependencies(consumerDir, tempRoot)
    );

    step('"npm ls" reports a valid dependency graph', () => runDependencyGraphCheck(consumerDir));

    const clientDirectiveResult = step("assert installed package client directives", () =>
      assertInstalledClientDirective(installedDir)
    );

    step("standalone TypeScript typecheck", () => runStandaloneTypecheck(consumerDir));

    step("production Next.js build", () => runProductionBuild(consumerDir));

    const buildArtifacts = step("assert generated build artifacts", () =>
      assertBuildArtifacts(consumerDir)
    );

    const repositoryCheckoutCommit = getRepositoryCheckoutCommit();

    console.log("\n--- Evidence summary ---");
    console.log("scenario: NEXT-APP-ROUTER-CLIENT");
    console.log(`repository checkout commit: ${repositoryCheckoutCommit}`);
    console.log(`source package: ${tarballInfo.packageName}@${tarballInfo.packageVersion}`);
    console.log(`tarball filename: ${tarballInfo.filename}`);
    console.log(`tarball SHA-256: ${tarballInfo.sha256}`);
    console.log(`tarball packed file count: ${tarballInfo.fileCount}`);
    console.log("installed package classification: real tarball copy, no workspace resolution");
    console.log("consumer dependency tuple:");
    for (const [name, version] of Object.entries(EXPECTED_VERSIONS)) {
      console.log(`  ${name}@${version}`);
    }
    console.log(
      `install lifecycle scripts: ${installOutcome.ignoredScripts ? "ignored (--ignore-scripts)" : "enabled (public Next.js toolchain requirement)"}`
    );
    console.log("Server Component boundary: app/page.tsx (no package import, no hook)");
    console.log(
      "Client Component boundary: app/flow-client.tsx (FlowProvider, useFlow, useFlowProgress)"
    );
    console.log("Canvas client boundary: app/flow-canvas.tsx (useFlowFrame inside <Canvas>)");
    console.log(
      "serializable props: PHASES tuple + title string, passed from page.tsx into FlowClient"
    );
    console.log("package-root imports: verified (no internal subpath)");
    console.log("router integration: absent");
    console.log("Server Action: absent");
    console.log("Next.js in published package metadata: absent");
    console.log(
      `installed ESM client directive (dist/index.js): ${clientDirectiveResult["dist/index.js"]}`
    );
    console.log(
      `installed CJS client directive (dist/index.cjs): ${clientDirectiveResult["dist/index.cjs"]}`
    );
    console.log("standalone typecheck: PASSED");
    console.log("production Next.js build: PASSED");
    console.log(`BUILD_ID evidence: ${buildArtifacts.buildIdRelative}`);
    console.log(`server App Router artifact: ${buildArtifacts.serverArtifactRelative}`);
    console.log(`client JavaScript chunk: ${buildArtifacts.clientChunkRelative}`);
    console.log("dependency graph: PASSED");
    console.log("final classification: VERIFIED");
  } finally {
    removeTempRoot(tempRoot);
  }

  console.log("\nPacked Next.js consumer verification passed.");
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
