import { cpSync, copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
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

const fixtureSourceDir = join(repoRoot, "validation", "vite-packed-package");

const EXPECTED_PEER_VERSIONS = {
  react: "19.2.8",
  "react-dom": "19.2.8",
  "@react-three/fiber": "9.6.1",
  three: "0.185.1",
  "@types/react": "19.2.17",
  "@types/react-dom": "19.2.3",
  "@types/three": "0.185.1",
  "@vitejs/plugin-react": "6.0.4",
  typescript: "6.0.3",
  vite: "8.1.5"
};

const EXPECTED_PRIVATE_SPECIFIER = "r3f-interactive-flow/react";
const EXPECTED_DIAGNOSTIC_CODE = "TS2307";

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

async function asyncStep(label, fn) {
  try {
    const value = await fn();
    console.log(`✔ ${label}`);
    return value;
  } catch (err) {
    throw new PackedConsumerError(
      `Stage failed: ${label}\n${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function extractDiagnosticLines(diagnosticText) {
  return diagnosticText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /error TS\d{4,5}:/.test(line));
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

  for (const [name, expectedVersion] of Object.entries(EXPECTED_PEER_VERSIONS)) {
    const declaredVersion = versionEntries[name];

    if (declaredVersion !== expectedVersion) {
      throw new PackedConsumerError(
        `Fixture package.json must declare "${name}" as exact version "${expectedVersion}", found ${String(declaredVersion)}.`
      );
    }
  }

  for (const tsconfigName of ["tsconfig.json", "tsconfig.private-subpath.json"]) {
    const tsconfigPath = join(fixtureSourceDir, tsconfigName);
    const tsconfig = readJsonFile(tsconfigPath);

    if (tsconfig.compilerOptions?.paths) {
      throw new PackedConsumerError(`${tsconfigPath} must not declare "paths".`);
    }

    if (tsconfig.compilerOptions?.baseUrl) {
      throw new PackedConsumerError(`${tsconfigPath} must not declare "baseUrl".`);
    }
  }

  const positiveSourceFiles = [
    join(fixtureSourceDir, "src", "main.tsx"),
    join(fixtureSourceDir, "src", "runtime-entry.ts")
  ];

  for (const filePath of positiveSourceFiles) {
    const contents = readFileSync(filePath, "utf8");

    if (/r3f-interactive-flow\/\S+/.test(contents)) {
      throw new PackedConsumerError(
        `Positive fixture file must import only the package root, found an internal-subpath import in ${filePath}.`
      );
    }
  }

  const negativeFilePath = join(fixtureSourceDir, "negative", "private-subpath.ts");
  const negativeContents = readFileSync(negativeFilePath, "utf8");

  if (!negativeContents.includes(EXPECTED_PRIVATE_SPECIFIER)) {
    throw new PackedConsumerError(
      `Negative fixture must import the private specifier "${EXPECTED_PRIVATE_SPECIFIER}".`
    );
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
  const result = runCommand("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts"], {
    cwd: consumerDir
  });

  assertCommandSucceeded(
    result,
    "npm install",
    "npm install --no-audit --no-fund --ignore-scripts"
  );
  return result;
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

  return installedDir;
}

function assertInstalledPeers(consumerDir, tempRoot) {
  for (const [name, expectedVersion] of Object.entries(EXPECTED_PEER_VERSIONS)) {
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
  const commandText = "npm ls --json --all";
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

  assertCommandSucceeded(result, '"npm ls" dependency graph', commandText);

  return parsed;
}

function runPositiveTypecheck(consumerDir) {
  const tscPath = join(consumerDir, "node_modules", "typescript", "lib", "tsc.js");
  const result = runCommand(process.execPath, [tscPath, "-p", "tsconfig.json"], {
    cwd: consumerDir
  });

  assertCommandSucceeded(result, "positive TypeScript typecheck", "tsc -p tsconfig.json");
  return result;
}

function runProductionBuild(consumerDir) {
  const vitePath = join(consumerDir, "node_modules", "vite", "bin", "vite.js");
  const result = runCommand(process.execPath, [vitePath, "build"], { cwd: consumerDir });

  assertCommandSucceeded(result, "production Vite build", "vite build");
  return result;
}

function assertBrowserBuildArtifacts(consumerDir) {
  const distDir = join(consumerDir, "dist");
  const indexHtmlPath = join(distDir, "index.html");

  if (!existsSync(indexHtmlPath)) {
    throw new PackedConsumerError(`Expected generated "dist/index.html" under ${distDir}.`);
  }

  const assetsDir = join(distDir, "assets");
  const jsAssetName = existsSync(assetsDir)
    ? readdirSync(assetsDir).find((name) => name.endsWith(".js"))
    : undefined;

  if (!jsAssetName) {
    throw new PackedConsumerError(
      `Expected at least one generated JavaScript asset under ${assetsDir}.`
    );
  }

  return {
    indexHtmlRelative: "dist/index.html",
    jsAssetRelative: `dist/assets/${jsAssetName}`
  };
}

function runRuntimeBuild(consumerDir) {
  const vitePath = join(consumerDir, "node_modules", "vite", "bin", "vite.js");
  const result = runCommand(
    process.execPath,
    [vitePath, "build", "--ssr", "src/runtime-entry.ts", "--outDir", "dist-runtime"],
    { cwd: consumerDir }
  );

  assertCommandSucceeded(
    result,
    "Vite runtime/SSR build",
    "vite build --ssr src/runtime-entry.ts --outDir dist-runtime"
  );
  return result;
}

function locateRuntimeEntryOutput(consumerDir) {
  const runtimeDir = join(consumerDir, "dist-runtime");
  const entries = readdirSync(runtimeDir).filter(
    (name) => name.startsWith("runtime-entry") && name.endsWith(".js")
  );

  if (entries.length === 0) {
    throw new PackedConsumerError(`No generated runtime entry file found under ${runtimeDir}.`);
  }

  return join(runtimeDir, entries[0]);
}

async function runRuntimeImportCheck(runtimeEntryPath) {
  const moduleUrl = pathToFileURL(runtimeEntryPath).href;
  const imported = await import(moduleUrl);

  if (typeof imported.verifyRuntimeBindings !== "function") {
    throw new PackedConsumerError(
      `Generated runtime entry "${runtimeEntryPath}" does not export "verifyRuntimeBindings".`
    );
  }

  const result = imported.verifyRuntimeBindings();

  if (result !== true) {
    throw new PackedConsumerError(
      `"verifyRuntimeBindings" returned ${JSON.stringify(result)}, expected true.`
    );
  }
}

function runPrivateSubpathCheck(consumerDir) {
  const tscPath = join(consumerDir, "node_modules", "typescript", "lib", "tsc.js");
  const result = runCommand(process.execPath, [tscPath, "-p", "tsconfig.private-subpath.json"], {
    cwd: consumerDir
  });

  if (result.status === 0) {
    throw new PackedConsumerError(
      "Expected the private-subpath TypeScript check to fail, but it succeeded.\n" +
        `--- stdout ---\n${result.stdout}`
    );
  }

  const diagnosticText = `${result.stdout}\n${result.stderr}`;

  if (!diagnosticText.includes(EXPECTED_DIAGNOSTIC_CODE)) {
    throw new PackedConsumerError(
      `Expected diagnostic "${EXPECTED_DIAGNOSTIC_CODE}" not found in private-subpath check output:\n${diagnosticText}`
    );
  }

  if (!diagnosticText.includes(EXPECTED_PRIVATE_SPECIFIER)) {
    throw new PackedConsumerError(
      `Expected the exact private path "${EXPECTED_PRIVATE_SPECIFIER}" in private-subpath check output:\n${diagnosticText}`
    );
  }

  const diagnosticCodes = new Set(
    [...diagnosticText.matchAll(/\bTS\d{4,5}\b/g)].map((match) => match[0])
  );

  const unexpectedCodes = [...diagnosticCodes].filter((code) => code !== EXPECTED_DIAGNOSTIC_CODE);

  if (unexpectedCodes.length > 0) {
    throw new PackedConsumerError(
      `Unexpected TypeScript diagnostic code(s) present: ${unexpectedCodes.join(", ")}.\n${diagnosticText}`
    );
  }

  const diagnosticLines = extractDiagnosticLines(diagnosticText);

  if (diagnosticLines.length !== 1) {
    throw new PackedConsumerError(
      `Expected exactly one TypeScript diagnostic line in the private-subpath check, found ${diagnosticLines.length}:\n${diagnosticText}`
    );
  }

  return { exitCode: result.status, diagnosticLine: diagnosticLines[0] };
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
  const tempRoot = createTempRoot("r3f-packed-vite-consumer-");

  try {
    const tarballInfo = step("pack tarball with npm pack", () => packTarball(packageDir, tempRoot));

    const consumerDir = step("create isolated consumer environment", () =>
      createConsumer(tempRoot)
    );

    step("copy generated tarball into consumer", () =>
      copyTarballIntoConsumer(consumerDir, tarballInfo.tarballPath)
    );

    step("install fixture dependencies from the packed tarball", () =>
      installConsumerDependencies(consumerDir)
    );

    const installedDir = step("assert installed package is a real tarball copy", () =>
      assertInstalledPackage(consumerDir, tempRoot, workspacePackageJson.version)
    );

    step("assert consumer-installed peers", () => assertInstalledPeers(consumerDir, tempRoot));

    step('"npm ls" reports a valid dependency graph', () => runDependencyGraphCheck(consumerDir));

    step("positive Bundler-mode TypeScript typecheck", () => runPositiveTypecheck(consumerDir));

    step("production Vite build", () => runProductionBuild(consumerDir));

    const browserBuildArtifacts = step("assert generated browser build artifacts", () =>
      assertBrowserBuildArtifacts(consumerDir)
    );

    step("Vite runtime/SSR build", () => runRuntimeBuild(consumerDir));

    const runtimeEntryPath = step("locate generated runtime entry output", () =>
      locateRuntimeEntryOutput(consumerDir)
    );
    const runtimeEntryRelative = relative(consumerDir, runtimeEntryPath);

    await asyncStep("import and execute the Vite-produced runtime entry", () =>
      runRuntimeImportCheck(runtimeEntryPath)
    );

    const negativeResult = step(
      "VITE-PACKED-PRIVATE-REJECTION: private-subpath TypeScript check",
      () => runPrivateSubpathCheck(consumerDir)
    );

    const repositoryCheckoutCommit = getRepositoryCheckoutCommit();

    console.log("\n--- Evidence summary ---");
    console.log("scenario: VITE-PACKED-CURRENT, VITE-PACKED-PRIVATE-REJECTION");
    console.log(`repository checkout commit: ${repositoryCheckoutCommit}`);
    console.log(`source package: ${tarballInfo.packageName}@${tarballInfo.packageVersion}`);
    console.log(`tarball filename: ${tarballInfo.filename}`);
    console.log(`tarball SHA-256: ${tarballInfo.sha256}`);
    console.log(`tarball packed file count: ${tarballInfo.fileCount}`);
    console.log("installed package classification: real tarball copy, no workspace resolution");
    console.log(
      `installed package directory (temp-consumer): ${installedDir.replace(tempRoot, "<temp-consumer>")}`
    );
    console.log("peer tuple:");
    for (const [name, version] of Object.entries(EXPECTED_PEER_VERSIONS)) {
      console.log(`  ${name}@${version}`);
    }
    console.log("positive typecheck: PASSED");
    console.log("production build: PASSED");
    console.log(`browser build entry: ${browserBuildArtifacts.indexHtmlRelative}`);
    console.log(`browser JS artifact: ${browserBuildArtifacts.jsAssetRelative}`);
    console.log(`runtime entry: ${runtimeEntryRelative}`);
    console.log("runtime entry execution: PASSED");
    console.log("dependency graph (npm ls): PASSED");
    console.log(`private path tested: ${EXPECTED_PRIVATE_SPECIFIER}`);
    console.log(
      `expected diagnostic class: ${EXPECTED_DIAGNOSTIC_CODE} (exit code ${negativeResult.exitCode})`
    );
    console.log(`negative diagnostic: ${negativeResult.diagnosticLine}`);
    console.log("final classification: VERIFIED");
  } finally {
    removeTempRoot(tempRoot);
  }

  console.log("\nPacked Vite consumer verification passed.");
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
