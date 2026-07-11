import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  lstatSync,
  cpSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..");
const packageDir = join(repoRoot, "packages", "r3f-interactive-flow");
const fixturesDir = join(scriptsDir, "fixtures", "peer-compatibility-consumer");
const isWindows = process.platform === "win32";

const EXPECTED_RUNTIME_EXPORTS = [
  "FlowProvider",
  "useFlow",
  "useFlowProgress",
  "useFlowFrame",
  "useWheelInput",
  "useTouchInput",
  "useKeyboardInput"
];

// @react-three/fiber's own declarations carry `/// <reference types="offscreencanvas" />`
// (used by both the 8.x and 9.x lines). skipLibCheck is intentionally false for this
// check, so that ambient reference must resolve to a real installed package.
const OFFSCREENCANVAS_TYPES_VERSION = "2019.7.3";

// Two representative, exactly-pinned peer combinations (see #349). Versions are pinned
// to specific patch releases -- never a range, tag, or major-only version -- so this
// check cannot silently start passing or failing because a new upstream release shipped.
const compatibilityCases = [
  {
    name: "react-18-r3f-8-three-lower",
    // Newest published patch on the React 18 line, paired with the newest R3F 8.x release
    // (whose peer range is "react/react-dom >=18 <19"). three@0.150.1 is the newest patch
    // on the package's declared peer floor ("three": ">=0.150.0 <1.0.0"), which also clears
    // R3F 8.18.0's own floor of "three": ">=0.133".
    react: "18.3.1",
    reactDom: "18.3.1",
    reactTypes: "18.3.31",
    reactDomTypes: "18.3.7",
    fiber: "8.18.0",
    three: "0.150.1",
    threeTypes: "0.150.1"
  },
  {
    name: "react-19-r3f-9-three-current",
    // Matches the workspace's own resolved devDependency versions exactly (see
    // `pnpm list --depth 0` at the repo root), i.e. the combination this repository is
    // actually built and tested against day-to-day.
    react: "19.2.7",
    reactDom: "19.2.7",
    reactTypes: "19.2.17",
    reactDomTypes: "19.2.3",
    fiber: "9.6.1",
    three: "0.185.1",
    threeTypes: "0.185.1"
  }
];

class CompatibilityError extends Error {}

function runCommand(command, args, options) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: isWindows,
    ...options
  });

  if (result.error) {
    throw new CompatibilityError(
      `Failed to run ${command} ${args.join(" ")}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    throw new CompatibilityError(
      `Command "${command} ${args.join(" ")}" exited with code ${result.status}.\n` +
        `--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
    );
  }

  return result;
}

function assertBuildOutputExists() {
  const requiredFiles = ["dist/index.js", "dist/index.cjs", "dist/index.d.ts", "dist/index.d.cts"];

  for (const relativePath of requiredFiles) {
    if (!existsSync(join(packageDir, relativePath))) {
      throw new CompatibilityError(
        `Expected build output "${relativePath}" is missing. Run "pnpm build" before "pnpm package:compat".`
      );
    }
  }
}

function packTarball(tmpDir) {
  const result = runCommand("npm", ["pack", "--json", "--pack-destination", tmpDir], {
    cwd: packageDir
  });

  let packInfo;
  try {
    packInfo = JSON.parse(result.stdout)[0];
  } catch (err) {
    throw new CompatibilityError(
      `Failed to parse "npm pack --json" output: ${err.message}\n${result.stdout}`
    );
  }

  return join(tmpDir, packInfo.filename);
}

function createCaseConsumer(baseDir, testCase) {
  const consumerDir = join(baseDir, testCase.name);
  mkdirSync(consumerDir, { recursive: true });

  writeConsumerPackageJson(consumerDir, testCase.name);

  return consumerDir;
}

function writeConsumerPackageJson(consumerDir, caseName) {
  const packageJsonPath = join(consumerDir, "package.json");
  const content = JSON.stringify(
    { name: `peer-compat-${caseName}`, version: "0.0.0", private: true },
    null,
    2
  );

  writeFileSync(packageJsonPath, content);
}

function installCase(consumerDir, tarballPath, testCase) {
  const specs = [
    tarballPath,
    `react@${testCase.react}`,
    `react-dom@${testCase.reactDom}`,
    `three@${testCase.three}`,
    `@react-three/fiber@${testCase.fiber}`,
    `@types/react@${testCase.reactTypes}`,
    `@types/react-dom@${testCase.reactDomTypes}`,
    `@types/three@${testCase.threeTypes}`,
    `@types/offscreencanvas@${OFFSCREENCANVAS_TYPES_VERSION}`
  ];

  return runCommand(
    "npm",
    ["install", ...specs, "--no-audit", "--no-fund", "--ignore-scripts", "--save-exact"],
    { cwd: consumerDir }
  );
}

function reviewNpmWarnings(installResult) {
  const combined = `${installResult.stdout}\n${installResult.stderr}`;
  return combined
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /npm warn/i.test(line));
}

function installedPackageJson(consumerDir, packageName) {
  const packageJsonPath = join(consumerDir, "node_modules", packageName, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new CompatibilityError(
      `Expected "${packageName}" to be installed at ${packageJsonPath}.`
    );
  }

  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

function assertExactInstalledVersions(consumerDir, testCase) {
  const expectedVersions = {
    react: testCase.react,
    "react-dom": testCase.reactDom,
    three: testCase.three,
    "@react-three/fiber": testCase.fiber,
    "@types/react": testCase.reactTypes,
    "@types/react-dom": testCase.reactDomTypes,
    "@types/three": testCase.threeTypes
  };

  for (const [packageName, expectedVersion] of Object.entries(expectedVersions)) {
    const installed = installedPackageJson(consumerDir, packageName);

    if (installed.version !== expectedVersion) {
      throw new CompatibilityError(
        `Expected "${packageName}" to resolve to exactly ${expectedVersion}, but found ${installed.version}.`
      );
    }
  }
}

function assertInstalledFromTarball(consumerDir, baseDir) {
  const installedDir = join(consumerDir, "node_modules", "r3f-interactive-flow");

  if (!existsSync(installedDir)) {
    throw new CompatibilityError(
      `Expected "r3f-interactive-flow" to be installed at ${installedDir}.`
    );
  }

  if (lstatSync(installedDir).isSymbolicLink()) {
    throw new CompatibilityError(
      `Expected "r3f-interactive-flow" to be a real installed copy from the tarball, but found a symlink at ${installedDir}.`
    );
  }

  const realInstalledDir = realpathSync(installedDir);
  const realBaseDir = realpathSync(baseDir);
  const realPackageDir = realpathSync(packageDir);

  if (!realInstalledDir.startsWith(realBaseDir)) {
    throw new CompatibilityError(
      `Expected installed package to live under the isolated temp directory, but resolved to ${realInstalledDir}.`
    );
  }

  if (realInstalledDir.startsWith(realPackageDir)) {
    throw new CompatibilityError(
      `Installed package resolved back into the workspace source directory (${realInstalledDir}). ` +
        "This check must exercise the packed tarball, not the workspace."
    );
  }
}

function assertPeersAreNotWorkspaceSymlinks(consumerDir, testCase) {
  const peerPackages = ["react", "react-dom", "three", "@react-three/fiber"];
  const realRepoNodeModules = realpathSync(join(repoRoot, "node_modules"));

  for (const packageName of peerPackages) {
    const installedDir = join(consumerDir, "node_modules", packageName);

    if (lstatSync(installedDir).isSymbolicLink()) {
      throw new CompatibilityError(
        `Expected "${packageName}" to be a real installed package for case "${testCase.name}", ` +
          `but found a symlink at ${installedDir}. Compatibility cases must not reuse workspace peers.`
      );
    }

    const realInstalledDir = realpathSync(installedDir);

    if (realInstalledDir.startsWith(realRepoNodeModules)) {
      throw new CompatibilityError(
        `"${packageName}" resolved back into the workspace's node_modules (${realInstalledDir}) ` +
          `for case "${testCase.name}". Each case must install its own exact peer versions.`
      );
    }
  }
}

function collectInstalledVersions(nodeModulesRoot, packageName, visited = new Set(), depth = 0) {
  const versions = new Set();

  if (depth > 8 || !existsSync(nodeModulesRoot)) {
    return versions;
  }

  const realRoot = realpathSync(nodeModulesRoot);
  if (visited.has(realRoot)) {
    return versions;
  }
  visited.add(realRoot);

  const candidate = join(nodeModulesRoot, packageName);
  if (existsSync(join(candidate, "package.json"))) {
    const pkg = JSON.parse(readFileSync(join(candidate, "package.json"), "utf8"));
    versions.add(pkg.version);
  }

  for (const entry of readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === ".bin") continue;

    const entryPath = join(nodeModulesRoot, entry.name);
    const scopedDirs = entry.name.startsWith("@")
      ? readdirSync(entryPath, { withFileTypes: true })
          .filter((scopedEntry) => scopedEntry.isDirectory())
          .map((scopedEntry) => join(entryPath, scopedEntry.name))
      : [entryPath];

    for (const dir of scopedDirs) {
      const nestedNodeModules = join(dir, "node_modules");
      for (const version of collectInstalledVersions(
        nestedNodeModules,
        packageName,
        visited,
        depth + 1
      )) {
        versions.add(version);
      }
    }
  }

  return versions;
}

function assertSingleReactGraph(consumerDir, testCase) {
  const nodeModulesRoot = join(consumerDir, "node_modules");

  for (const [packageName, expectedVersion] of [
    ["react", testCase.react],
    ["react-dom", testCase.reactDom]
  ]) {
    const versions = collectInstalledVersions(nodeModulesRoot, packageName);

    if (versions.size !== 1 || !versions.has(expectedVersion)) {
      throw new CompatibilityError(
        `Case "${testCase.name}" expected exactly one installed "${packageName}" version ` +
          `(${expectedVersion}), but found: ${[...versions].join(", ") || "none"}.`
      );
    }
  }
}

function runNpmLsCheck(consumerDir) {
  const result = spawnSync("npm", ["ls", "--json", "--all"], {
    encoding: "utf8",
    shell: isWindows,
    cwd: consumerDir
  });

  if (result.error) {
    throw new CompatibilityError(`Failed to run "npm ls": ${result.error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    throw new CompatibilityError(
      `Failed to parse "npm ls --json" output: ${err.message}\n${result.stdout}`
    );
  }

  const problems = parsed.problems ?? [];

  if (problems.length > 0) {
    throw new CompatibilityError(
      `"npm ls" reported an invalid dependency graph:\n${problems.join("\n")}`
    );
  }

  return problems;
}

function copyRuntimeFixture(consumerDir) {
  cpSync(join(fixturesDir, "runtime-check.mjs"), join(consumerDir, "runtime-check.mjs"));
}

function runRuntimeImportCheck(consumerDir) {
  const result = spawnSync(process.execPath, [join(consumerDir, "runtime-check.mjs")], {
    cwd: consumerDir,
    encoding: "utf8",
    env: { ...process.env, EXPECTED_RUNTIME_EXPORTS: JSON.stringify(EXPECTED_RUNTIME_EXPORTS) }
  });

  if (result.status !== 0) {
    throw new CompatibilityError(
      `Bare runtime import failed.\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
    );
  }
}

function copyTypeScriptFixture(consumerDir) {
  const tsDir = join(consumerDir, "ts");
  cpSync(join(fixturesDir, "ts"), tsDir, { recursive: true });
  return tsDir;
}

function runTypeScriptCheck(consumerDir, testCase) {
  const tsDir = copyTypeScriptFixture(consumerDir);
  const tsconfigPath = join(tsDir, "tsconfig.json");
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (configFile.error) {
    throw new CompatibilityError(
      `Case "${testCase.name}": failed to read tsconfig.json: ` +
        ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")
    );
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, tsDir);

  if (parsed.errors.length > 0) {
    const formatted = parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
      .join("\n");
    throw new CompatibilityError(`Case "${testCase.name}": invalid tsconfig.json:\n${formatted}`);
  }

  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => tsDir,
      getNewLine: () => ts.sys.newLine
    });
    throw new CompatibilityError(`Case "${testCase.name}": type errors found:\n${formatted}`);
  }

  assertConsumerRootedTypeResolution(program, consumerDir, testCase);
}

function assertConsumerRootedTypeResolution(program, consumerDir, testCase) {
  const realConsumerDir = realpathSync(consumerDir);
  const realRepoNodeModules = realpathSync(join(repoRoot, "node_modules"));
  const peerModuleMarkers = [
    "node_modules/react/",
    "node_modules/react-dom/",
    "node_modules/three/",
    "node_modules/@react-three/fiber/"
  ];

  const peerDeclarationFiles = program
    .getSourceFiles()
    .map((sourceFile) => sourceFile.fileName)
    .filter((fileName) => peerModuleMarkers.some((marker) => fileName.includes(marker)));

  if (peerDeclarationFiles.length === 0) {
    throw new CompatibilityError(
      `Case "${testCase.name}": expected the TypeScript program to resolve peer package declarations, found none.`
    );
  }

  for (const fileName of peerDeclarationFiles) {
    const realFileName = realpathSync(fileName);

    if (!realFileName.startsWith(realConsumerDir)) {
      throw new CompatibilityError(
        `Case "${testCase.name}": expected "${fileName}" to resolve inside the isolated consumer, ` +
          `but it resolved outside of it.`
      );
    }

    if (realFileName.startsWith(realRepoNodeModules)) {
      throw new CompatibilityError(
        `Case "${testCase.name}": TypeScript resolved "${fileName}" back into the workspace's ` +
          "node_modules instead of the isolated consumer's installed peers."
      );
    }
  }
}

function step(label, fn) {
  try {
    const value = fn();
    console.log(`  ✔ ${label}`);
    return value;
  } catch (err) {
    throw new CompatibilityError(
      `Stage failed: ${label}\n${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function runCompatibilityCase(baseDir, tarballPath, testCase) {
  console.log(`\n=== ${testCase.name} ===`);
  console.log(
    `react@${testCase.react} react-dom@${testCase.reactDom} @react-three/fiber@${testCase.fiber} ` +
      `three@${testCase.three}`
  );

  const consumerDir = createCaseConsumer(baseDir, testCase);
  const report = { name: testCase.name, warnings: [] };

  try {
    const installResult = step("install packed tarball + exact peers", () =>
      installCase(consumerDir, tarballPath, testCase)
    );
    report.warnings = reviewNpmWarnings(installResult);

    step("installed package is the packed tarball copy, not the workspace", () =>
      assertInstalledFromTarball(consumerDir, baseDir)
    );

    step("installed peers are real packages, not workspace symlinks", () =>
      assertPeersAreNotWorkspaceSymlinks(consumerDir, testCase)
    );

    step("exact pinned peer versions are installed", () =>
      assertExactInstalledVersions(consumerDir, testCase)
    );

    step("exactly one react and one react-dom version in the graph", () =>
      assertSingleReactGraph(consumerDir, testCase)
    );

    step('"npm ls" reports a valid dependency graph', () => runNpmLsCheck(consumerDir));

    step("bare ESM runtime import resolves the public API", () => {
      copyRuntimeFixture(consumerDir);
      runRuntimeImportCheck(consumerDir);
    });

    step("NodeNext TypeScript check resolves consumer-installed peers", () =>
      runTypeScriptCheck(consumerDir, testCase)
    );

    report.status = "passed";
  } finally {
    rmSync(consumerDir, { recursive: true, force: true });
  }

  if (report.warnings.length > 0) {
    console.log(`  npm warnings (${report.warnings.length}), reviewed and non-blocking:`);
    for (const warning of report.warnings) {
      console.log(`    ${warning}`);
    }
  } else {
    console.log("  no npm warnings reported");
  }

  return report;
}

function main() {
  console.log("Supported peer compatibility check\n");
  step("build output exists", assertBuildOutputExists);

  const baseDir = mkdtempSync(join(tmpdir(), "r3f-peer-compat-"));
  const reports = [];

  try {
    let tarballPath;
    step("pack tarball with npm pack", () => {
      tarballPath = packTarball(baseDir);
    });

    for (const testCase of compatibilityCases) {
      reports.push(runCompatibilityCase(baseDir, tarballPath, testCase));
    }
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }

  console.log("\nSummary:");
  for (const report of reports) {
    console.log(`  ${report.name}: ${report.status} (${report.warnings.length} npm warning(s))`);
  }

  console.log("\nSupported peer compatibility check passed.");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
