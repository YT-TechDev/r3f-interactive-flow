import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
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
  runCommand,
  scriptsDir
} from "./lib/packed-consumer-utils.mjs";

const fixturesDir = join(scriptsDir, "fixtures", "peer-compatibility-consumer");
const tsFixtureDir = join(fixturesDir, "ts");

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

// Two representative, exactly-pinned peer combinations (see #349, refined by #405).
// Versions are pinned to specific patch releases -- never a range, tag, or major-only
// version -- so this check cannot silently start passing or failing because a new
// upstream release shipped.
const PEER_TUPLES = {
  lower: {
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
  current: {
    // Matches the workspace's own resolved devDependency versions exactly (see
    // `package.json` at the repo root), i.e. the combination this repository is
    // actually built and tested against day-to-day.
    react: "19.2.8",
    reactDom: "19.2.8",
    reactTypes: "19.2.17",
    reactDomTypes: "19.2.3",
    fiber: "9.6.1",
    three: "0.185.1",
    threeTypes: "0.185.1"
  }
};

// TypeScript declaration-route lanes. Each lane pairs a standalone tsconfig with the
// consumer source file it exercises, and the exact package-root declaration route it
// must (and must not) resolve to.
const TS_LANES = {
  bundler: {
    tsconfig: "tsconfig.bundler.json",
    expectedDeclaration: "index.d.ts",
    forbiddenDeclaration: "index.d.cts"
  },
  "nodenext-esm": {
    tsconfig: "tsconfig.nodenext-esm.json",
    expectedDeclaration: "index.d.ts",
    forbiddenDeclaration: "index.d.cts"
  },
  "nodenext-cjs": {
    tsconfig: "tsconfig.nodenext-cjs.json",
    expectedDeclaration: "index.d.cts",
    forbiddenDeclaration: "index.d.ts"
  }
};

// Bounded three-case matrix (see docs/releases/v2.9.0-consumer-ai-validation-matrix.md).
// Deliberately not a Cartesian product across peers x TypeScript modes.
const compatibilityCases = [
  {
    name: "react-18-r3f-8-three-lower",
    scenarioIds: ["PEER-MINIMUM-SAMPLE"],
    peers: PEER_TUPLES.lower,
    typescript: "6.0.3",
    runtimeImportCheck: true,
    tsLanes: ["nodenext-esm", "nodenext-cjs"]
  },
  {
    name: "react-19-r3f-9-three-current",
    scenarioIds: ["PEER-CURRENT-SAMPLE", "TS-CURRENT-BUNDLER", "TS-CURRENT-NODENEXT"],
    peers: PEER_TUPLES.current,
    typescript: "6.0.3",
    runtimeImportCheck: true,
    tsLanes: ["bundler", "nodenext-esm", "nodenext-cjs"]
  },
  {
    name: "typescript-5.9.3-bundler-current-peers",
    scenarioIds: ["TS-LOWER-REPRESENTATIVE"],
    peers: PEER_TUPLES.current,
    typescript: "5.9.3",
    runtimeImportCheck: false,
    tsLanes: ["bundler"]
  }
];

const PEER_PACKAGES = ["react", "react-dom", "three", "@react-three/fiber"];

function createCaseConsumer(tempRoot, testCase) {
  const consumerDir = join(tempRoot, testCase.name);
  mkdirSync(consumerDir, { recursive: true });

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      { name: `peer-compat-${testCase.name}`, version: "0.0.0", private: true, type: "module" },
      null,
      2
    )
  );

  return consumerDir;
}

function installCase(consumerDir, tarballPath, testCase) {
  const specs = [
    tarballPath,
    `react@${testCase.peers.react}`,
    `react-dom@${testCase.peers.reactDom}`,
    `three@${testCase.peers.three}`,
    `@react-three/fiber@${testCase.peers.fiber}`,
    `@types/react@${testCase.peers.reactTypes}`,
    `@types/react-dom@${testCase.peers.reactDomTypes}`,
    `@types/three@${testCase.peers.threeTypes}`,
    `@types/offscreencanvas@${OFFSCREENCANVAS_TYPES_VERSION}`,
    `typescript@${testCase.typescript}`
  ];

  const commandArgs = [
    "install",
    ...specs,
    "--no-audit",
    "--no-fund",
    "--ignore-scripts",
    "--save-exact"
  ];
  const result = runCommand("npm", commandArgs, { cwd: consumerDir });

  assertCommandSucceeded(result, "npm install", `npm ${commandArgs.join(" ")}`);
  return result;
}

function reviewNpmWarnings(installResult, testCase) {
  const combined = `${installResult.stdout}\n${installResult.stderr}`;
  const warnings = combined
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /npm warn/i.test(line));

  if (warnings.length > 0) {
    throw new PackedConsumerError(
      `Case "${testCase.name}": expected zero npm warnings, found ${warnings.length}:\n` +
        warnings.join("\n")
    );
  }

  return warnings;
}

function installedPackageJson(consumerDir, packageName) {
  const packageJsonPath = join(consumerDir, "node_modules", packageName, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new PackedConsumerError(
      `Expected "${packageName}" to be installed at ${packageJsonPath}.`
    );
  }

  return readJsonFile(packageJsonPath);
}

function assertPeersAreRealInstalledCopies(consumerDir, tempRoot, testCase) {
  for (const packageName of PEER_PACKAGES) {
    const installedDir = join(consumerDir, "node_modules", ...packageName.split("/"));

    assertRealInstalledCopy({
      installedDir,
      tempRoot,
      excludedSourceDir: join(repoRoot, "node_modules"),
      label: `${packageName} (case ${testCase.name})`
    });
    assertNotUnderRepoNodeModules(installedDir, `${packageName} (case ${testCase.name})`);
  }
}

function assertExactInstalledVersions(consumerDir, testCase) {
  const expectedVersions = {
    react: testCase.peers.react,
    "react-dom": testCase.peers.reactDom,
    three: testCase.peers.three,
    "@react-three/fiber": testCase.peers.fiber,
    "@types/react": testCase.peers.reactTypes,
    "@types/react-dom": testCase.peers.reactDomTypes,
    "@types/three": testCase.peers.threeTypes
  };

  for (const [packageName, expectedVersion] of Object.entries(expectedVersions)) {
    const installed = installedPackageJson(consumerDir, packageName);

    if (installed.version !== expectedVersion) {
      throw new PackedConsumerError(
        `Expected "${packageName}" to resolve to exactly ${expectedVersion}, but found ${installed.version}.`
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
    const pkg = readJsonFile(join(candidate, "package.json"));
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
    ["react", testCase.peers.react],
    ["react-dom", testCase.peers.reactDom]
  ]) {
    const versions = collectInstalledVersions(nodeModulesRoot, packageName);

    if (versions.size !== 1 || !versions.has(expectedVersion)) {
      throw new PackedConsumerError(
        `Case "${testCase.name}" expected exactly one installed "${packageName}" version ` +
          `(${expectedVersion}), but found: ${[...versions].join(", ") || "none"}.`
      );
    }
  }
}

function runNpmLsCheck(consumerDir, testCase) {
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
      `Case "${testCase.name}": "npm ls" reported an invalid dependency graph:\n${problems.join("\n")}`
    );
  }

  assertCommandSucceeded(result, `"npm ls" dependency graph (case ${testCase.name})`, commandText);

  return parsed;
}

function copyRuntimeFixture(consumerDir) {
  const source = join(fixturesDir, "runtime-check.mjs");
  const destination = join(consumerDir, "runtime-check.mjs");
  writeFileSync(destination, readFileSync(source, "utf8"));
}

function runRuntimeImportCheck(consumerDir) {
  copyRuntimeFixture(consumerDir);

  const result = runCommand(process.execPath, [join(consumerDir, "runtime-check.mjs")], {
    cwd: consumerDir,
    env: { ...process.env, EXPECTED_RUNTIME_EXPORTS: JSON.stringify(EXPECTED_RUNTIME_EXPORTS) }
  });

  assertCommandSucceeded(result, "bare ESM runtime import", "node runtime-check.mjs");
}

function loadInstalledTypeScript(consumerDir, tempRoot, testCase) {
  const installedDir = join(consumerDir, "node_modules", "typescript");

  assertRealInstalledCopy({
    installedDir,
    tempRoot,
    excludedSourceDir: join(repoRoot, "node_modules"),
    label: `typescript (case ${testCase.name})`
  });
  assertNotUnderRepoNodeModules(installedDir, `typescript (case ${testCase.name})`);

  const require = createRequire(join(consumerDir, "package.json"));
  const ts = require("typescript");

  if (ts.version !== testCase.typescript) {
    throw new PackedConsumerError(
      `Case "${testCase.name}": expected the consumer-installed compiler to report version ` +
        `${testCase.typescript}, but it reported ${ts.version}.`
    );
  }

  return ts;
}

function copyTypeScriptFixture(consumerDir) {
  const tsDir = join(consumerDir, "ts");
  mkdirSync(tsDir, { recursive: true });

  for (const fileName of readdirSync(tsFixtureDir)) {
    writeFileSync(join(tsDir, fileName), readFileSync(join(tsFixtureDir, fileName), "utf8"));
  }

  return tsDir;
}

function assertDeclarationRoute(program, consumerDir, testCase, laneName, laneConfig) {
  const installedPackageDistDir = join(consumerDir, "node_modules", "r3f-interactive-flow", "dist");
  const realExpectedDeclaration = realpathSync(
    join(installedPackageDistDir, laneConfig.expectedDeclaration)
  );
  const realConsumerDir = realpathSync(consumerDir);
  const realRepoNodeModules = realpathSync(join(repoRoot, "node_modules"));
  const realPackageDir = realpathSync(packageDir);

  const sourceFileNames = program.getSourceFiles().map((sourceFile) => sourceFile.fileName);
  const realSourceFileNames = sourceFileNames.map((fileName) => {
    try {
      return realpathSync(fileName);
    } catch {
      return fileName;
    }
  });

  const resolvesExpected = realSourceFileNames.includes(realExpectedDeclaration);

  if (!resolvesExpected) {
    throw new PackedConsumerError(
      `Case "${testCase.name}" lane "${laneName}": expected the program to resolve ` +
        `"dist/${laneConfig.expectedDeclaration}", but it did not appear in the program.`
    );
  }

  const forbiddenSuffix = `r3f-interactive-flow/dist/${laneConfig.forbiddenDeclaration}`;
  const resolvesForbidden = sourceFileNames.some((fileName) => fileName.includes(forbiddenSuffix));

  if (resolvesForbidden) {
    throw new PackedConsumerError(
      `Case "${testCase.name}" lane "${laneName}": did not expect the program to resolve ` +
        `"dist/${laneConfig.forbiddenDeclaration}", but it did.`
    );
  }

  const peerModuleMarkers = [
    "node_modules/react/",
    "node_modules/@types/react/",
    "node_modules/react-dom/",
    "node_modules/@types/react-dom/",
    "node_modules/three/",
    "node_modules/@types/three/",
    "node_modules/@react-three/fiber/"
  ];

  const peerDeclarationFiles = sourceFileNames.filter((fileName) =>
    peerModuleMarkers.some((marker) => fileName.includes(marker))
  );

  if (peerDeclarationFiles.length === 0) {
    throw new PackedConsumerError(
      `Case "${testCase.name}" lane "${laneName}": expected peer package declarations to resolve, found none.`
    );
  }

  for (const fileName of peerDeclarationFiles) {
    const realFileName = realpathSync(fileName);

    if (!realFileName.startsWith(realConsumerDir)) {
      throw new PackedConsumerError(
        `Case "${testCase.name}" lane "${laneName}": expected "${fileName}" to resolve inside ` +
          "the isolated consumer, but it resolved outside of it."
      );
    }

    if (realFileName.startsWith(realRepoNodeModules)) {
      throw new PackedConsumerError(
        `Case "${testCase.name}" lane "${laneName}": TypeScript resolved "${fileName}" back into ` +
          "the workspace's node_modules instead of the isolated consumer's installed peers."
      );
    }
  }

  for (const realFileName of realSourceFileNames) {
    if (realFileName.startsWith(realPackageDir)) {
      throw new PackedConsumerError(
        `Case "${testCase.name}" lane "${laneName}": TypeScript resolved "${realFileName}" back ` +
          "into the workspace package source instead of the installed tarball."
      );
    }
  }

  return `dist/${laneConfig.expectedDeclaration}`;
}

function runDeclarationLane(ts, tsDir, consumerDir, testCase, laneName) {
  const laneConfig = TS_LANES[laneName];
  const tsconfigPath = join(tsDir, laneConfig.tsconfig);
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (configFile.error) {
    throw new PackedConsumerError(
      `Case "${testCase.name}" lane "${laneName}": failed to read ${laneConfig.tsconfig}: ` +
        ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")
    );
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, tsDir);

  if (parsed.errors.length > 0) {
    const formatted = parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
      .join("\n");
    throw new PackedConsumerError(
      `Case "${testCase.name}" lane "${laneName}": invalid ${laneConfig.tsconfig}:\n${formatted}`
    );
  }

  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => tsDir,
      getNewLine: () => ts.sys.newLine
    });
    throw new PackedConsumerError(
      `Case "${testCase.name}" lane "${laneName}": type errors found:\n${formatted}`
    );
  }

  const declarationRoute = assertDeclarationRoute(
    program,
    consumerDir,
    testCase,
    laneName,
    laneConfig
  );

  return { lane: laneName, mode: laneConfig.tsconfig, declarationRoute };
}

function step(label, fn) {
  try {
    const value = fn();
    console.log(`  ✔ ${label}`);
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

function runCompatibilityCase(tempRoot, tarballPath, testCase) {
  console.log(`\n=== ${testCase.name} (${testCase.scenarioIds.join(", ")}) ===`);
  console.log(
    `react@${testCase.peers.react} react-dom@${testCase.peers.reactDom} ` +
      `@react-three/fiber@${testCase.peers.fiber} three@${testCase.peers.three} ` +
      `typescript@${testCase.typescript}`
  );

  const consumerDir = createCaseConsumer(tempRoot, testCase);

  try {
    const installResult = step("install packed tarball + exact peers + exact typescript", () =>
      installCase(consumerDir, tarballPath, testCase)
    );

    const warnings = step("zero npm warnings", () => reviewNpmWarnings(installResult, testCase));

    step("installed package is the packed tarball copy, not the workspace", () =>
      assertRealInstalledCopy({
        installedDir: join(consumerDir, "node_modules", "r3f-interactive-flow"),
        tempRoot,
        excludedSourceDir: packageDir,
        label: `r3f-interactive-flow (case ${testCase.name})`
      })
    );
    step("installed package does not resolve into repository node_modules", () =>
      assertNotUnderRepoNodeModules(
        join(consumerDir, "node_modules", "r3f-interactive-flow"),
        `r3f-interactive-flow (case ${testCase.name})`
      )
    );

    step("installed peers are real packages, not workspace symlinks", () =>
      assertPeersAreRealInstalledCopies(consumerDir, tempRoot, testCase)
    );

    step("exact pinned peer versions are installed", () =>
      assertExactInstalledVersions(consumerDir, testCase)
    );

    step("exactly one react and one react-dom version in the graph", () =>
      assertSingleReactGraph(consumerDir, testCase)
    );

    step('"npm ls" reports a valid dependency graph', () => runNpmLsCheck(consumerDir, testCase));

    if (testCase.runtimeImportCheck) {
      step("bare ESM runtime import resolves the public API", () =>
        runRuntimeImportCheck(consumerDir)
      );
    }

    const ts = step("load the exact consumer-installed TypeScript compiler", () =>
      loadInstalledTypeScript(consumerDir, tempRoot, testCase)
    );

    const tsDir = step("copy TypeScript fixture into isolated consumer", () =>
      copyTypeScriptFixture(consumerDir)
    );

    const laneResults = testCase.tsLanes.map((laneName) =>
      step(`TypeScript lane "${laneName}" declaration-route resolution`, () =>
        runDeclarationLane(ts, tsDir, consumerDir, testCase, laneName)
      )
    );

    return {
      name: testCase.name,
      scenarioIds: testCase.scenarioIds,
      peers: testCase.peers,
      typescript: testCase.typescript,
      runtimeImportCheck: testCase.runtimeImportCheck,
      warnings,
      laneResults,
      status: "passed"
    };
  } finally {
    removeTempRoot(consumerDir);
  }
}

function main() {
  console.log("Supported peer and TypeScript compatibility check\n");
  step("build output exists", () =>
    assertBuildOutputExists(packageDir, [
      "dist/index.js",
      "dist/index.cjs",
      "dist/index.d.ts",
      "dist/index.d.cts"
    ])
  );

  const tempRoot = createTempRoot("r3f-peer-compat-");
  const reports = [];

  let tarballInfo;

  try {
    tarballInfo = step("pack tarball with npm pack", () => packTarball(packageDir, tempRoot));

    for (const testCase of compatibilityCases) {
      reports.push(runCompatibilityCase(tempRoot, tarballInfo.tarballPath, testCase));
    }
  } finally {
    removeTempRoot(tempRoot);
  }

  const workspacePackageJson = readJsonFile(join(packageDir, "package.json"));
  const repositoryCheckoutCommit = getRepositoryCheckoutCommit();

  console.log("\n--- Evidence summary ---");
  console.log(`repository checkout commit: ${repositoryCheckoutCommit}`);
  console.log(`package: ${workspacePackageJson.name}@${workspacePackageJson.version}`);
  console.log(`tarball filename: ${tarballInfo.filename}`);
  console.log(`tarball SHA-256: ${tarballInfo.sha256}`);
  console.log(`tarball packed file count: ${tarballInfo.fileCount}`);

  for (const report of reports) {
    console.log(`\ncase: ${report.name}`);
    console.log(`  scenario IDs: ${report.scenarioIds.join(", ")}`);
    console.log(
      `  peers: react@${report.peers.react}, react-dom@${report.peers.reactDom}, ` +
        `@react-three/fiber@${report.peers.fiber}, three@${report.peers.three}`
    );
    console.log(
      `  type packages: @types/react@${report.peers.reactTypes}, ` +
        `@types/react-dom@${report.peers.reactDomTypes}, @types/three@${report.peers.threeTypes}, ` +
        `@types/offscreencanvas@${OFFSCREENCANVAS_TYPES_VERSION}`
    );
    console.log(`  typescript: ${report.typescript} (consumer-installed, exact)`);
    console.log("  installed package classification: real tarball copy, no workspace resolution");
    console.log(`  npm warnings: ${report.warnings.length}`);
    console.log("  dependency graph (npm ls): passed");
    if (report.runtimeImportCheck) {
      console.log("  bare ESM runtime import: passed");
    }
    for (const laneResult of report.laneResults) {
      console.log(
        `  TypeScript lane "${laneResult.lane}": mode=${laneResult.mode}, ` +
          `declaration route=${laneResult.declarationRoute}, peer declarations resolved inside isolated consumer`
      );
    }
    console.log(`  status: ${report.status}`);
  }

  console.log("\nfinal classification: VERIFIED");
  console.log("\nSupported peer and TypeScript compatibility check passed.");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
