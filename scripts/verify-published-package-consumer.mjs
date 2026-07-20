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

function assertNotLocalResolution(resolvedPackagePath, manifest) {
  const normalized = resolvedPackagePath.replaceAll("\\\\", "/");
  const disallowedHints = ["workspace:", "file:", "link:", "git+", ".tgz"];

  if (resolvedPackagePath.startsWith(workspacePackage)) {
    throw new Error(`resolved package points at local workspace package: ${resolvedPackagePath}`);
  }

  if (
    normalized.includes("/packages/r3f-interactive-flow/") ||
    normalized.endsWith("/packages/r3f-interactive-flow")
  ) {
    throw new Error(`resolved package path resembles repository source: ${resolvedPackagePath}`);
  }

  if (normalized.includes("/dist/") && normalized.includes("r3f-interactive-flow")) {
    throw new Error(
      `resolved package path resembles a local dist directory: ${resolvedPackagePath}`
    );
  }

  for (const hint of disallowedHints) {
    if (normalized.includes(hint) || JSON.stringify(manifest).includes(hint)) {
      throw new Error(
        `resolved package contains local or non-registry hint ${hint}: ${resolvedPackagePath}`
      );
    }
  }
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), "r3f-flow-published-consumer-"));
  const tempConsumer = join(tempRoot, "vite-published-package");

  try {
    await cp(consumerSource, tempConsumer, { recursive: true });
    await run("pnpm", ["install"], { cwd: tempConsumer });
    await run("pnpm", ["install", `r3f-interactive-flow@${expectedVersion}`, "--save-exact"], {
      cwd: tempConsumer
    });

    const requireFromConsumer = createRequire(pathToFileURL(join(tempConsumer, "package.json")));
    const resolvedEntrypoint = requireFromConsumer.resolve("r3f-interactive-flow");
    const resolvedPackagePath = await realpath(resolve(dirname(resolvedEntrypoint), ".."));
    const resolvedManifestPath = join(resolvedPackagePath, "package.json");
    const installedManifest = JSON.parse(await readFile(resolvedManifestPath, "utf8"));

    if (installedManifest.version !== expectedVersion) {
      throw new Error(
        `expected r3f-interactive-flow ${expectedVersion}, found ${installedManifest.version}`
      );
    }

    assertNotLocalResolution(resolvedPackagePath, installedManifest);
    await run("pnpm", ["build"], { cwd: tempConsumer });

    console.log(`installed package version: ${installedManifest.version}`);
    console.log(`resolved package path: ${resolvedPackagePath}`);
    console.log("build result: passed");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
