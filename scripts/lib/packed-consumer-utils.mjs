import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const libDir = dirname(fileURLToPath(import.meta.url));
export const scriptsDir = join(libDir, "..");
export const repoRoot = join(scriptsDir, "..");
export const packageDir = join(repoRoot, "packages", "r3f-interactive-flow");

const isWindows = process.platform === "win32";

export class PackedConsumerError extends Error {}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: isWindows,
    ...options
  });

  if (result.error) {
    throw new PackedConsumerError(
      `Failed to run ${command} ${args.join(" ")}: ${result.error.message}`
    );
  }

  return result;
}

export function assertCommandSucceeded(result, label, commandText) {
  if (result.status !== 0) {
    throw new PackedConsumerError(
      `${label} failed.\n` +
        `command: ${commandText}\n` +
        `exit code: ${result.status}\n` +
        `--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
    );
  }
}

export function assertBuildOutputExists(targetPackageDir, requiredFiles) {
  for (const relativePath of requiredFiles) {
    if (!existsSync(join(targetPackageDir, relativePath))) {
      throw new PackedConsumerError(
        `Expected build output "${relativePath}" is missing under ${targetPackageDir}. Run "pnpm build" first.`
      );
    }
  }
}

export function createTempRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeTempRoot(path) {
  rmSync(path, { recursive: true, force: true });
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function packTarball(sourcePackageDir, destinationDir) {
  const result = runCommand("npm", ["pack", "--json", "--pack-destination", destinationDir], {
    cwd: sourcePackageDir
  });

  assertCommandSucceeded(
    result,
    "npm pack",
    `npm pack --json --pack-destination ${destinationDir}`
  );

  let packInfo;
  try {
    packInfo = JSON.parse(result.stdout)[0];
  } catch (err) {
    throw new PackedConsumerError(
      `Failed to parse "npm pack --json" output: ${err.message}\n${result.stdout}`
    );
  }

  const tarballPath = join(destinationDir, packInfo.filename);

  return {
    tarballPath,
    filename: packInfo.filename,
    packageName: packInfo.name,
    packageVersion: packInfo.version,
    fileCount: Array.isArray(packInfo.files) ? packInfo.files.length : undefined,
    sha256: sha256File(tarballPath)
  };
}

/**
 * Asserts that `installedDir` is a real (non-symlinked) directory that
 * resolves under the isolated temp consumer, and not back into `excludedSourceDir`
 * (typically the repository's own package source directory).
 */
export function assertRealInstalledCopy({ installedDir, tempRoot, excludedSourceDir, label }) {
  if (!existsSync(installedDir)) {
    throw new PackedConsumerError(`Expected "${label}" to be installed at ${installedDir}.`);
  }

  if (lstatSync(installedDir).isSymbolicLink()) {
    throw new PackedConsumerError(
      `Expected "${label}" to be a real installed copy, but found a symlink at ${installedDir}.`
    );
  }

  const realInstalledDir = realpathSync(installedDir);
  const realTempRoot = realpathSync(tempRoot);

  if (!realInstalledDir.startsWith(realTempRoot)) {
    throw new PackedConsumerError(
      `Expected "${label}" to live under the isolated temp consumer, but resolved to ${realInstalledDir}.`
    );
  }

  if (excludedSourceDir) {
    const realExcluded = realpathSync(excludedSourceDir);

    if (realInstalledDir.startsWith(realExcluded)) {
      throw new PackedConsumerError(
        `"${label}" resolved back into repository source (${realInstalledDir}). ` +
          "This check must exercise a real installed copy, not workspace/repository source."
      );
    }
  }

  return realInstalledDir;
}

export function assertNotUnderRepoNodeModules(installedDir, label) {
  const realInstalledDir = realpathSync(installedDir);
  const realRepoNodeModules = realpathSync(join(repoRoot, "node_modules"));

  if (realInstalledDir.startsWith(realRepoNodeModules)) {
    throw new PackedConsumerError(
      `"${label}" resolved into the repository's node_modules (${realInstalledDir}) ` +
        "instead of the isolated consumer's own install."
    );
  }
}
