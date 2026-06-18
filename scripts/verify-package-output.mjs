import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..");
const packageDir = join(repoRoot, "packages", "r3f-interactive-flow");

function fail(message) {
  console.error(`Package output verification failed: ${message}`);
  process.exitCode = 1;
}

function assertExists(path, label) {
  if (!existsSync(path)) {
    fail(`${label} is missing: ${path}`);
  }
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function assertPackageFileEntry(packageJson, entry) {
  if (!Array.isArray(packageJson.files) || !packageJson.files.includes(entry)) {
    fail(`package.json files must include ${entry}`);
  }
}

function assertPackageField(actual, expected, label) {
  if (actual !== expected) {
    fail(`package.json ${label} must be ${expected}, found ${String(actual)}`);
  }
}

function resolvePackagePath(entry, label) {
  if (typeof entry !== "string" || entry.length === 0) {
    fail(`package.json ${label} must be a non-empty path string`);
    return undefined;
  }

  const resolvedPath = resolve(packageDir, entry);
  const relativePath = relative(packageDir, resolvedPath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    fail(`package.json ${label} must resolve inside the package directory: ${entry}`);
    return undefined;
  }

  return resolvedPath;
}

function assertPackagePathExists(entry, label) {
  const resolvedPath = resolvePackagePath(entry, label);

  if (resolvedPath) {
    assertExists(resolvedPath, `package.json ${label} target`);
  }
}

function assertUseClient(path, label) {
  const firstChunk = readText(path).slice(0, 300);

  if (!firstChunk.includes('"use client"') && !firstChunk.includes("'use client'")) {
    fail(`${label} does not include "use client" near the top`);
  }
}

const packageJsonPath = join(packageDir, "package.json");
const readmePath = join(packageDir, "README.md");
const licensePath = join(packageDir, "LICENSE");
const changelogPath = join(packageDir, "CHANGELOG.md");
const distEsmPath = join(packageDir, "dist", "index.js");
const distCjsPath = join(packageDir, "dist", "index.cjs");
const distTypesPath = join(packageDir, "dist", "index.d.ts");

assertExists(packageJsonPath, "package.json");
assertExists(readmePath, "README.md");
assertExists(licensePath, "LICENSE");
assertExists(changelogPath, "CHANGELOG.md");
assertExists(distEsmPath, "dist/index.js");
assertExists(distCjsPath, "dist/index.cjs");
assertExists(distTypesPath, "dist/index.d.ts");

if (process.exitCode) {
  process.exit(process.exitCode);
}

const packageJson = JSON.parse(readText(packageJsonPath));

assertPackageFileEntry(packageJson, "dist");
assertPackageFileEntry(packageJson, "README.md");
assertPackageFileEntry(packageJson, "LICENSE");
assertPackageFileEntry(packageJson, "CHANGELOG.md");

assertPackageField(packageJson.main, "./dist/index.cjs", "main");
assertPackageField(packageJson.module, "./dist/index.js", "module");
assertPackageField(packageJson.types, "./dist/index.d.ts", "types");

const rootExport = packageJson.exports?.["."];

if (!rootExport || typeof rootExport !== "object" || Array.isArray(rootExport)) {
  fail('package.json exports["."] must exist as an object');
}

assertPackageField(rootExport?.types, "./dist/index.d.ts", 'exports["."].types');
assertPackageField(rootExport?.import, "./dist/index.js", 'exports["."].import');
assertPackageField(rootExport?.require, "./dist/index.cjs", 'exports["."].require');

assertPackagePathExists(packageJson.main, "main");
assertPackagePathExists(packageJson.module, "module");
assertPackagePathExists(packageJson.types, "types");
assertPackagePathExists(rootExport?.types, 'exports["."].types');
assertPackagePathExists(rootExport?.import, 'exports["."].import');
assertPackagePathExists(rootExport?.require, 'exports["."].require');

assertUseClient(distEsmPath, "dist/index.js");
assertUseClient(distCjsPath, "dist/index.cjs");

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Package output verification passed.");
