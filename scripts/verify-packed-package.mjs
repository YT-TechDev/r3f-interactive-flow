import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  cpSync,
  realpathSync,
  lstatSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const isWindows = process.platform === "win32";
const symlinkType = isWindows ? "junction" : "dir";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..");
const packageDir = join(repoRoot, "packages", "r3f-interactive-flow");
const fixturesDir = join(scriptsDir, "fixtures", "packed-package-consumer");

const EXPECTED_RUNTIME_EXPORTS = [
  "FlowProvider",
  "useFlow",
  "useFlowProgress",
  "useFlowFrame",
  "useWheelInput",
  "useTouchInput",
  "useKeyboardInput"
];

const PEER_PACKAGES = [
  "react",
  "react-dom",
  "three",
  "@react-three/fiber",
  "@types/react",
  "@types/react-dom"
];

const REQUIRED_TARBALL_FILES = [
  "package.json",
  "dist/index.js",
  "dist/index.cjs",
  "dist/index.d.ts",
  "dist/index.d.cts"
];

class SmokeTestError extends Error {}

function runCommand(command, args, options) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: isWindows,
    ...options
  });

  if (result.error) {
    throw new SmokeTestError(`Failed to run ${command} ${args.join(" ")}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new SmokeTestError(
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
      throw new SmokeTestError(
        `Expected build output "${relativePath}" is missing. Run "pnpm build" before "pnpm package:smoke".`
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
    throw new SmokeTestError(
      `Failed to parse "npm pack --json" output: ${err.message}\n${result.stdout}`
    );
  }

  const tarballFiles = new Set(packInfo.files.map((entry) => entry.path));

  for (const requiredFile of REQUIRED_TARBALL_FILES) {
    if (!tarballFiles.has(requiredFile)) {
      throw new SmokeTestError(`Packed tarball is missing required file "${requiredFile}".`);
    }
  }

  return join(tmpDir, packInfo.filename);
}

function createConsumer(tmpDir) {
  const consumerDir = join(tmpDir, "consumer");
  mkdirSync(consumerDir, { recursive: true });

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify({ name: "packed-package-consumer", version: "0.0.0", private: true }, null, 2)
  );

  return consumerDir;
}

function installTarball(consumerDir, tarballPath) {
  runCommand(
    "npm",
    [
      "install",
      tarballPath,
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--ignore-scripts",
      "--legacy-peer-deps",
      "--offline"
    ],
    { cwd: consumerDir }
  );
}

function linkPeerDependencies(consumerDir) {
  const consumerNodeModules = join(consumerDir, "node_modules");

  for (const name of PEER_PACKAGES) {
    const source = join(repoRoot, "node_modules", name);

    if (!existsSync(source)) {
      throw new SmokeTestError(
        `Expected workspace dependency "${name}" to be installed at ${source}.`
      );
    }

    const realSource = realpathSync(source);
    const dest = join(consumerNodeModules, name);
    mkdirSync(dirname(dest), { recursive: true });
    symlinkSync(realSource, dest, symlinkType);
  }
}

function assertInstalledFromTarball(consumerDir, tmpDir) {
  const installedDir = join(consumerDir, "node_modules", "r3f-interactive-flow");

  if (!existsSync(installedDir)) {
    throw new SmokeTestError(`Expected "r3f-interactive-flow" to be installed at ${installedDir}.`);
  }

  if (lstatSync(installedDir).isSymbolicLink()) {
    throw new SmokeTestError(
      `Expected "r3f-interactive-flow" to be a real installed copy from the tarball, but found a symlink at ${installedDir}.`
    );
  }

  const realInstalledDir = realpathSync(installedDir);
  const realTmpDir = realpathSync(tmpDir);
  const realPackageDir = realpathSync(packageDir);

  if (!realInstalledDir.startsWith(realTmpDir)) {
    throw new SmokeTestError(
      `Expected installed package to live under the isolated temp directory, but resolved to ${realInstalledDir}.`
    );
  }

  if (realInstalledDir.startsWith(realPackageDir)) {
    throw new SmokeTestError(
      `Installed package resolved back into the workspace source directory (${realInstalledDir}). ` +
        "This test must exercise the packed tarball, not the workspace."
    );
  }

  for (const relativePath of [
    "dist/index.js",
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.d.cts",
    "package.json"
  ]) {
    if (!existsSync(join(installedDir, relativePath))) {
      throw new SmokeTestError(`Installed package is missing "${relativePath}".`);
    }
  }

  const installedPackageJson = JSON.parse(readFileSync(join(installedDir, "package.json"), "utf8"));

  if (installedPackageJson.main !== "./dist/index.cjs") {
    throw new SmokeTestError(
      `Installed package.json "main" must be "./dist/index.cjs", found ${installedPackageJson.main}`
    );
  }

  if (installedPackageJson.module !== "./dist/index.js") {
    throw new SmokeTestError(
      `Installed package.json "module" must be "./dist/index.js", found ${installedPackageJson.module}`
    );
  }

  if (installedPackageJson.types !== "./dist/index.d.ts") {
    throw new SmokeTestError(
      `Installed package.json "types" must be "./dist/index.d.ts", found ${installedPackageJson.types}`
    );
  }

  const rootExport = installedPackageJson.exports?.["."];
  const importCondition = rootExport?.import;
  const requireCondition = rootExport?.require;

  if (
    importCondition?.types !== "./dist/index.d.ts" ||
    importCondition?.default !== "./dist/index.js"
  ) {
    throw new SmokeTestError(
      'Installed package.json exports["."].import must route "types" to "./dist/index.d.ts" and "default" to "./dist/index.js".'
    );
  }

  if (
    requireCondition?.types !== "./dist/index.d.cts" ||
    requireCondition?.default !== "./dist/index.cjs"
  ) {
    throw new SmokeTestError(
      'Installed package.json exports["."].require must route "types" to "./dist/index.d.cts" and "default" to "./dist/index.cjs".'
    );
  }

  return installedDir;
}

// Anchored directive-prologue check: leading whitespace is allowed, but no comment,
// import, or other statement may precede the "use client" directive.
const USE_CLIENT_DIRECTIVE_PATTERN = /^(["'])use client\1;?/;

function assertUseClientDirective(installedDir) {
  for (const relativePath of ["dist/index.js", "dist/index.cjs"]) {
    const filePath = join(installedDir, relativePath);
    const firstChunk = readFileSync(filePath, "utf8").slice(0, 300);
    const trimmed = firstChunk.replace(/^\s+/, "");

    if (!USE_CLIENT_DIRECTIVE_PATTERN.test(trimmed)) {
      throw new SmokeTestError(
        `Installed "${relativePath}" does not begin with a "use client" directive prologue ` +
          "(leading whitespace is allowed, but no comment, import, or other statement may precede it)."
      );
    }
  }
}

function copyFixtures(consumerDir) {
  cpSync(fixturesDir, consumerDir, { recursive: true });
}

function runNodeFixture(consumerDir, relativeFixturePath, env) {
  const result = spawnSync(process.execPath, [join(consumerDir, relativeFixturePath)], {
    cwd: consumerDir,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });

  if (result.status !== 0) {
    throw new SmokeTestError(
      `Fixture "${relativeFixturePath}" failed.\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
    );
  }
}

function typeCheckFixture(tsconfigDir, label) {
  const tsconfigPath = join(tsconfigDir, "tsconfig.json");
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (configFile.error) {
    throw new SmokeTestError(
      `${label}: failed to read tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`
    );
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, tsconfigDir);

  if (parsed.errors.length > 0) {
    const formatted = parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
      .join("\n");
    throw new SmokeTestError(`${label}: invalid tsconfig.json:\n${formatted}`);
  }

  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => tsconfigDir,
      getNewLine: () => ts.sys.newLine
    });
    throw new SmokeTestError(`${label}: type errors found:\n${formatted}`);
  }
}

function step(label, fn) {
  try {
    fn();
    console.log(`✔ ${label}`);
  } catch (err) {
    throw new SmokeTestError(
      `Stage failed: ${label}\n${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function main() {
  step("build output exists", assertBuildOutputExists);

  const tmpDir = mkdtempSync(join(tmpdir(), "r3f-packed-smoke-"));

  try {
    let tarballPath;
    step("pack tarball with npm pack", () => {
      tarballPath = packTarball(tmpDir);
    });

    let consumerDir;
    step("create isolated consumer environment", () => {
      consumerDir = createConsumer(tmpDir);
    });

    step("install packed tarball into consumer", () => installTarball(consumerDir, tarballPath));

    let installedDir;
    step("assert installed package is the packed tarball copy", () => {
      installedDir = assertInstalledFromTarball(consumerDir, tmpDir);
    });

    step('"use client" directive present in installed output', () =>
      assertUseClientDirective(installedDir)
    );

    step("link workspace peer dependencies into consumer", () => linkPeerDependencies(consumerDir));

    step("copy consumer fixtures", () => copyFixtures(consumerDir));

    step("ESM runtime import exposes exact expected exports", () =>
      runNodeFixture(consumerDir, "esm-runtime-check.mjs", {
        EXPECTED_RUNTIME_EXPORTS: JSON.stringify(EXPECTED_RUNTIME_EXPORTS)
      })
    );

    step("CommonJS runtime require exposes exact expected exports", () =>
      runNodeFixture(consumerDir, "cjs-runtime-check.cjs", {
        EXPECTED_RUNTIME_EXPORTS: JSON.stringify(EXPECTED_RUNTIME_EXPORTS)
      })
    );

    step("ESM internal paths are rejected by package exports", () =>
      runNodeFixture(consumerDir, "esm-internal-path-check.mjs")
    );

    step("CommonJS internal paths are rejected by package exports", () =>
      runNodeFixture(consumerDir, "cjs-internal-path-check.cjs")
    );

    step("ESM TypeScript (NodeNext) declaration resolution", () =>
      typeCheckFixture(join(consumerDir, "ts-esm"), "ESM TypeScript declaration resolution")
    );

    step("CommonJS TypeScript (NodeNext) declaration resolution", () =>
      typeCheckFixture(join(consumerDir, "ts-cjs"), "CommonJS TypeScript declaration resolution")
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log("Packed package consumer smoke test passed.");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
