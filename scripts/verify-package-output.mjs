import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

assertUseClient(distEsmPath, "dist/index.js");
assertUseClient(distCjsPath, "dist/index.cjs");

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Package output verification passed.");
