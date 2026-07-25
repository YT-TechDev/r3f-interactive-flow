import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  sha256File
} from "./lib/packed-consumer-utils.mjs";

const fixtureRoot = join(repoRoot, "validation", "agent-public-docs");
const baseDir = join(fixtureRoot, "base");
const contractPath = join(fixtureRoot, "contracts", "agent-public-docs-v1.json");
const manifestPath = join(fixtureRoot, "public-docs-manifest.json");
const evidenceSchemaPath = join(fixtureRoot, "contracts", "agent-public-docs-evidence-v1.json");
const referenceDir = join(fixtureRoot, "reference");
const negativeDir = join(fixtureRoot, "negative");
const runsDir = join(fixtureRoot, "runs");

const EXPECTED_TASK_IDS = [
  "AGENT-FOUNDATION",
  "AGENT-CANVAS",
  "AGENT-INPUT-AND-MOTION",
  "AGENT-REPAIR-IMPORT",
  "AGENT-REPAIR-CANVAS-BOUNDARY"
];

const HARD_GATE_LABELS = [
  "build-typecheck-succeeds",
  "package-root-imports-only",
  "no-invented-api-or-export",
  "canvas-boundary-correct",
  "no-secret-or-private-repo-exposure"
];

const VIOLATION_CRITERIA_MAP = {
  "internal-subpath-import": ["3-package-root-imports"],
  "unexpected-dependency-import": ["7-no-dependency"],
  "invented-api-import": ["6-no-invented-api"],
  "canvas-boundary-violation": ["5-canvas-boundary"],
  "input-hook-inside-canvas": ["5-canvas-boundary"],
  "per-frame-state-setter": ["2-required-behavior"],
  "provider-count": ["8-scope"],
  "canvas-required-missing": ["8-scope"],
  "missing-required-behavior": ["2-required-behavior"],
  "forbidden-file-changed": ["8-scope"],
  "duplicate-output-path": ["8-scope"],
  "missing-allowed-output-file": ["8-scope"],
  "secret-exposure": []
};

const CRITERIA_HARD_GATE_MAP = {
  "1-build-typecheck": "build-typecheck-succeeds",
  "3-package-root-imports": "package-root-imports-only",
  "6-no-invented-api": "no-invented-api-or-export",
  "5-canvas-boundary": "canvas-boundary-correct"
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

function loadWorkspaceTypeScript() {
  const require = createRequire(join(repoRoot, "package.json"));
  return require("typescript");
}

// ---------------------------------------------------------------------------
// Stage 2: public-doc manifest verification
// ---------------------------------------------------------------------------

function canonicalizeManifestForHash(manifest) {
  const files = [...manifest.files]
    .map((entry) => ({ path: entry.path, byteLength: entry.byteLength, sha256: entry.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    manifestId: manifest.manifestId,
    contractVersion: manifest.contractVersion,
    baselineCommit: manifest.baselineCommit,
    files
  };
}

function computeManifestContentHash(manifest) {
  const canonical = canonicalizeManifestForHash(manifest);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function verifyPublicDocManifest() {
  const manifest = readJsonFile(manifestPath);

  if (manifest.contractVersion !== "agent-public-docs-v1") {
    throw new PackedConsumerError(
      `Manifest contractVersion must be "agent-public-docs-v1", found "${manifest.contractVersion}".`
    );
  }

  const commitCheck = runCommand("git", ["cat-file", "-e", `${manifest.baselineCommit}^{commit}`], {
    cwd: repoRoot
  });

  if (commitCheck.status !== 0) {
    throw new PackedConsumerError(
      `Manifest baselineCommit "${manifest.baselineCommit}" does not resolve to a real commit in this repository.`
    );
  }

  for (const entry of manifest.files) {
    const absolutePath = join(repoRoot, entry.path);

    if (!existsSync(absolutePath)) {
      throw new PackedConsumerError(`Public doc manifest entry missing on disk: ${entry.path}`);
    }

    const buffer = readFileSync(absolutePath);

    if (buffer.length !== entry.byteLength) {
      throw new PackedConsumerError(
        `Public doc "${entry.path}" byte length mismatch: manifest says ${entry.byteLength}, found ${buffer.length}.`
      );
    }

    const sha256 = createHash("sha256").update(buffer).digest("hex");

    if (sha256 !== entry.sha256) {
      throw new PackedConsumerError(
        `Public doc "${entry.path}" SHA-256 mismatch: manifest says ${entry.sha256}, found ${sha256}.`
      );
    }
  }

  const computedHash = computeManifestContentHash(manifest);

  if (
    typeof manifest.manifestContentSha256 !== "string" ||
    manifest.manifestContentSha256.length === 0
  ) {
    throw new PackedConsumerError('Manifest is missing "manifestContentSha256".');
  }

  if (computedHash !== manifest.manifestContentSha256) {
    throw new PackedConsumerError(
      `Manifest canonical content SHA-256 mismatch: manifest says ${manifest.manifestContentSha256}, computed ${computedHash}.`
    );
  }

  return { manifest, manifestHash: computedHash };
}

// ---------------------------------------------------------------------------
// Stage 3: contract shape verification
// ---------------------------------------------------------------------------

function verifyContractShape() {
  const contract = readJsonFile(contractPath);

  if (contract.contractVersion !== "agent-public-docs-v1") {
    throw new PackedConsumerError(
      `Contract contractVersion must be "agent-public-docs-v1", found "${contract.contractVersion}".`
    );
  }

  const actualIds = contract.tasks.map((task) => task.taskId);

  if (
    actualIds.length !== EXPECTED_TASK_IDS.length ||
    !EXPECTED_TASK_IDS.every((id, index) => actualIds[index] === id)
  ) {
    throw new PackedConsumerError(
      `Contract task IDs must be exactly ${JSON.stringify(EXPECTED_TASK_IDS)}, found ${JSON.stringify(actualIds)}.`
    );
  }

  if (
    contract.taskIds.length !== EXPECTED_TASK_IDS.length ||
    !EXPECTED_TASK_IDS.every((id) => contract.taskIds.includes(id))
  ) {
    throw new PackedConsumerError("Contract taskIds field does not match the fixed five task IDs.");
  }

  return contract;
}

// ---------------------------------------------------------------------------
// Stage 4: task input immutability
// ---------------------------------------------------------------------------

function verifyTaskInputImmutability(contract) {
  for (const task of contract.tasks) {
    const fixturePath = join(repoRoot, task.immutableInputFixture.path);

    if (!existsSync(fixturePath)) {
      throw new PackedConsumerError(
        `Task input fixture missing: ${task.immutableInputFixture.path}`
      );
    }

    const buffer = readFileSync(fixturePath);

    if (buffer.length !== task.immutableInputFixture.byteLength) {
      throw new PackedConsumerError(
        `Task "${task.taskId}" input fixture byte length mismatch: contract says ${task.immutableInputFixture.byteLength}, found ${buffer.length}.`
      );
    }

    const sha256 = createHash("sha256").update(buffer).digest("hex");

    if (sha256 !== task.immutableInputFixture.sha256) {
      throw new PackedConsumerError(
        `Task "${task.taskId}" input fixture SHA-256 mismatch: contract says ${task.immutableInputFixture.sha256}, found ${sha256}.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 5: allowed output-file sets and forbidden changes
// ---------------------------------------------------------------------------

function walkFilesRecursive(rootDir, currentRelative = "") {
  const currentAbsolute = currentRelative ? join(rootDir, currentRelative) : rootDir;
  const entries = readdirSync(currentAbsolute, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryRelative = currentRelative ? `${currentRelative}/${entry.name}` : entry.name;

    if (entry.isSymbolicLink()) {
      throw new PackedConsumerError(
        `Symlink is not allowed in a fixture/output tree: ${entryRelative}`
      );
    }

    if (entry.isDirectory()) {
      results.push(...walkFilesRecursive(rootDir, entryRelative));
      continue;
    }

    if (entry.isFile()) {
      results.push(entryRelative);
    }
  }

  return results;
}

function mapLegacyOverlayEntryToTargetFile(entryRelativePath) {
  if (entryRelativePath === "App.tsx") {
    return "src/App.tsx";
  }

  return entryRelativePath;
}

function computeFileHashList(rootDir) {
  return walkFilesRecursive(rootDir)
    .map((relativePath) => ({
      path: relativePath,
      sha256: sha256File(join(rootDir, relativePath))
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function checkOutputFileScope(task, overlayDir, options = {}) {
  const { legacyFlatMapping = true, requireAllAllowedPresent = false } = options;
  const violations = [];
  const relativeFiles = walkFilesRecursive(overlayDir);
  const seenTargets = new Set();

  for (const relativePath of relativeFiles) {
    const targetFile = legacyFlatMapping
      ? mapLegacyOverlayEntryToTargetFile(relativePath)
      : relativePath;

    if (seenTargets.has(targetFile)) {
      violations.push({ code: "duplicate-output-path", detail: targetFile });
      continue;
    }

    seenTargets.add(targetFile);

    if (!task.allowedOutputFiles.includes(targetFile)) {
      violations.push({ code: "forbidden-file-changed", detail: targetFile });
    }
  }

  if (requireAllAllowedPresent) {
    for (const allowedFile of task.allowedOutputFiles) {
      if (!seenTargets.has(allowedFile)) {
        violations.push({ code: "missing-allowed-output-file", detail: allowedFile });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Static assertion engine (bounded, task-specific; uses the workspace
// TypeScript parser only for local source inspection, never for the
// candidate's actual typecheck/build).
// ---------------------------------------------------------------------------

function getEnclosingFunctionInfo(ts, node) {
  let current = node.parent;

  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return { name: current.name.text, node: current };
    }

    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.initializer &&
      (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))
    ) {
      return { name: current.name.text, node: current.initializer };
    }

    current = current.parent;
  }

  return undefined;
}

function collectStateSetterCalls(ts, functionNode, results) {
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      /^set[A-Z]/.test(node.expression.text)
    ) {
      results.push(node.expression.text);
    }

    ts.forEachChild(node, visit);
  }

  if (functionNode.body) {
    visit(functionNode.body);
  }
}

function analyzeSource(ts, sourceText, fileName = "App.tsx") {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const moduleSpecifiers = new Set();
  const packageRootImportNames = new Set();
  const violations = [];
  let flowProviderJsxCount = 0;
  let canvasJsxCount = 0;
  let canvasElementNode;
  const useFlowFrameCallers = new Map();
  const inputHookCallers = new Map();
  const stateSetterCallsInFrameCallbacks = [];

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      moduleSpecifiers.add(specifier);

      if (specifier.startsWith("r3f-interactive-flow/")) {
        violations.push({ code: "internal-subpath-import", detail: specifier });
      }

      if (
        specifier === "r3f-interactive-flow" &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const element of node.importClause.namedBindings.elements) {
          packageRootImportNames.add(element.name.text);
        }
      }
    }

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? node.openingElement.tagName.getText(sourceFile)
        : node.tagName.getText(sourceFile);

      if (tagName === "FlowProvider") {
        flowProviderJsxCount += 1;
      }

      if (tagName === "Canvas") {
        canvasJsxCount += 1;

        if (!canvasElementNode) {
          canvasElementNode = node;
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const calleeName = node.expression.text;

      if (calleeName === "useFlowFrame") {
        const owner = getEnclosingFunctionInfo(ts, node);

        if (owner) {
          useFlowFrameCallers.set(owner.name, owner.node);
        }

        const callbackArg = node.arguments[0];

        if (
          callbackArg &&
          (ts.isArrowFunction(callbackArg) || ts.isFunctionExpression(callbackArg))
        ) {
          collectStateSetterCalls(ts, callbackArg, stateSetterCallsInFrameCallbacks);
        }
      }

      if (
        calleeName === "useWheelInput" ||
        calleeName === "useTouchInput" ||
        calleeName === "useKeyboardInput"
      ) {
        const owner = getEnclosingFunctionInfo(ts, node);

        if (owner) {
          inputHookCallers.set(owner.name, owner.node);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (stateSetterCallsInFrameCallbacks.length > 0) {
    violations.push({
      code: "per-frame-state-setter",
      detail: stateSetterCallsInFrameCallbacks.join(", ")
    });
  }

  return {
    sourceFile,
    sourceText,
    moduleSpecifiers,
    packageRootImportNames,
    flowProviderJsxCount,
    canvasJsxCount,
    canvasElementNode,
    useFlowFrameCallers,
    inputHookCallers,
    violations
  };
}

function isComponentUsageWithinCanvas(analysis, componentName) {
  if (!analysis.canvasElementNode) {
    return false;
  }

  const start = analysis.canvasElementNode.getStart(analysis.sourceFile);
  const end = analysis.canvasElementNode.getEnd();
  const spanText = analysis.sourceText.slice(start, end);
  const pattern = new RegExp(`<${componentName}[\\s/>]`);

  return pattern.test(spanText);
}

function runSharedChecks(contract, task, analysis) {
  const violations = [...analysis.violations];

  for (const specifier of analysis.moduleSpecifiers) {
    if (specifier.startsWith("r3f-interactive-flow/")) {
      continue;
    }

    if (!contract.allowedModuleSpecifiers.includes(specifier)) {
      violations.push({ code: "unexpected-dependency-import", detail: specifier });
    }
  }

  const knownNames = new Set([...contract.knownPublicApi.values, ...contract.knownPublicApi.types]);

  for (const name of analysis.packageRootImportNames) {
    if (!knownNames.has(name)) {
      violations.push({ code: "invented-api-import", detail: name });
    }
  }

  if (analysis.flowProviderJsxCount !== 1) {
    violations.push({ code: "provider-count", detail: String(analysis.flowProviderJsxCount) });
  }

  const secretPattern = /\b(sk-[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{12,})\b/;

  if (secretPattern.test(analysis.sourceText)) {
    violations.push({ code: "secret-exposure", detail: "pattern-matched token" });
  }

  for (const [name] of analysis.useFlowFrameCallers) {
    if (!isComponentUsageWithinCanvas(analysis, name)) {
      violations.push({ code: "canvas-boundary-violation", detail: `useFlowFrame in ${name}` });
    }
  }

  for (const [name] of analysis.inputHookCallers) {
    if (isComponentUsageWithinCanvas(analysis, name)) {
      violations.push({ code: "input-hook-inside-canvas", detail: name });
    }
  }

  return violations;
}

function requireBehavior(condition, violations, detail) {
  if (!condition) {
    violations.push({ code: "missing-required-behavior", detail });
  }
}

function assertFoundationBehavior(analysis, violations) {
  requireBehavior(/\bas const\b/.test(analysis.sourceText), violations, "as-const-phase-tuple");
  requireBehavior(/\buseFlow\s*[<(]/.test(analysis.sourceText), violations, "useFlow-call");
  requireBehavior(
    /\buseFlowProgress\s*\(/.test(analysis.sourceText),
    violations,
    "useFlowProgress-call"
  );
  requireBehavior(
    /<progress[\s>]/.test(analysis.sourceText) ||
      /role=["']progressbar["']/.test(analysis.sourceText),
    violations,
    "progress-indicator"
  );
  requireBehavior(/goTo\(\s*["'`]/.test(analysis.sourceText), violations, "typed-goTo-call");
  requireBehavior(/\bnext\b/.test(analysis.sourceText), violations, "next-control");
  requireBehavior(/\bprev\b/.test(analysis.sourceText), violations, "prev-control");

  if (analysis.canvasJsxCount !== 0) {
    violations.push({
      code: "canvas-required-missing",
      detail: "Canvas not required for AGENT-FOUNDATION"
    });
  }
}

function assertCanvasBehavior(analysis, violations) {
  assertFoundationBehaviorWithoutCanvasBan(analysis, violations);
  requireBehavior(analysis.canvasJsxCount === 1, violations, "single-canvas");
  requireBehavior(analysis.useFlowFrameCallers.size >= 1, violations, "useFlowFrame-call");
  requireBehavior(
    /\.current\.[A-Za-z]/.test(analysis.sourceText),
    violations,
    "ref-mutation-in-frame"
  );
}

function assertFoundationBehaviorWithoutCanvasBan(analysis, violations) {
  requireBehavior(/\bas const\b/.test(analysis.sourceText), violations, "as-const-phase-tuple");
  requireBehavior(/\buseFlow\s*[<(]/.test(analysis.sourceText), violations, "useFlow-call");
  requireBehavior(
    /\buseFlowProgress\s*\(/.test(analysis.sourceText),
    violations,
    "useFlowProgress-call"
  );
  requireBehavior(
    /<progress[\s>]/.test(analysis.sourceText) ||
      /role=["']progressbar["']/.test(analysis.sourceText),
    violations,
    "progress-indicator"
  );
  requireBehavior(/goTo\(\s*["'`]/.test(analysis.sourceText), violations, "typed-goTo-call");
  requireBehavior(/\bnext\b/.test(analysis.sourceText), violations, "next-control");
  requireBehavior(/\bprev\b/.test(analysis.sourceText), violations, "prev-control");
}

function assertInputAndMotionBehavior(analysis, violations) {
  assertCanvasBehavior(analysis, violations);

  requireBehavior(
    analysis.packageRootImportNames.has("useWheelInput"),
    violations,
    "useWheelInput-import"
  );
  requireBehavior(
    analysis.packageRootImportNames.has("useTouchInput"),
    violations,
    "useTouchInput-import"
  );
  requireBehavior(
    analysis.packageRootImportNames.has("useKeyboardInput"),
    violations,
    "useKeyboardInput-import"
  );
  requireBehavior(analysis.inputHookCallers.size >= 1, violations, "input-hook-call");

  const providerTagMatch = analysis.sourceText.match(/<FlowProvider\b[^>]*>/);
  requireBehavior(
    Boolean(providerTagMatch && /\bkey\s*=/.test(providerTagMatch[0])),
    violations,
    "provider-key-remount"
  );

  requireBehavior(
    /["'`]normal["'`]/.test(analysis.sourceText) && /["'`]reduced["'`]/.test(analysis.sourceText),
    violations,
    "motion-mode-state"
  );

  let sceneMotionReduced = false;

  for (const [, node] of analysis.useFlowFrameCallers) {
    if (/motion/i.test(node.getText(analysis.sourceFile))) {
      sceneMotionReduced = true;
    }
  }

  requireBehavior(sceneMotionReduced, violations, "scene-motion-reduced-separately");
}

function assertRepairImportBehavior(analysis, violations) {
  requireBehavior(
    !/r3f-interactive-flow\//.test(analysis.sourceText),
    violations,
    "no-internal-subpath-remaining"
  );
  requireBehavior(
    analysis.packageRootImportNames.has("useFlow"),
    violations,
    "useFlow-package-root-import"
  );
  requireBehavior(/\bnext\b/.test(analysis.sourceText), violations, "next-control");
  requireBehavior(/\bprev\b/.test(analysis.sourceText), violations, "prev-control");
}

function assertRepairCanvasBoundaryBehavior(analysis, violations) {
  requireBehavior(analysis.canvasJsxCount === 1, violations, "single-canvas");
  requireBehavior(analysis.useFlowFrameCallers.size >= 1, violations, "useFlowFrame-call");
  requireBehavior(
    /\.current\.[A-Za-z]/.test(analysis.sourceText),
    violations,
    "ref-mutation-in-frame"
  );
}

const TASK_BEHAVIOR_CHECKS = {
  "AGENT-FOUNDATION": assertFoundationBehavior,
  "AGENT-CANVAS": assertCanvasBehavior,
  "AGENT-INPUT-AND-MOTION": assertInputAndMotionBehavior,
  "AGENT-REPAIR-IMPORT": assertRepairImportBehavior,
  "AGENT-REPAIR-CANVAS-BOUNDARY": assertRepairCanvasBoundaryBehavior
};

function evaluateCandidateSource(contract, task, sourceText) {
  const ts = loadWorkspaceTypeScript();
  const analysis = analyzeSource(ts, sourceText);
  const violations = runSharedChecks(contract, task, analysis);

  TASK_BEHAVIOR_CHECKS[task.taskId](analysis, violations);

  return violations;
}

function computeScoring(task, violations, buildTypecheckPass) {
  const criteria = {};

  for (const [criterionId, spec] of Object.entries(task.scoringCriteria)) {
    if (!spec.applicable) {
      criteria[criterionId] = { applicable: false, pass: null, reason: spec.reason };
      continue;
    }

    if (criterionId === "1-build-typecheck") {
      criteria[criterionId] = { applicable: true, pass: buildTypecheckPass };
      continue;
    }

    const failingCodes = Object.entries(VIOLATION_CRITERIA_MAP)
      .filter(([, mappedCriteria]) => mappedCriteria.includes(criterionId))
      .map(([code]) => code);

    const failed = violations.some((violation) => failingCodes.includes(violation.code));
    criteria[criterionId] = { applicable: true, pass: !failed };
  }

  const hardGates = {};

  for (const gateLabel of HARD_GATE_LABELS) {
    if (!task.hardGates.includes(gateLabel)) {
      hardGates[gateLabel] = { applicable: false, pass: null };
      continue;
    }

    if (gateLabel === "no-secret-or-private-repo-exposure") {
      hardGates[gateLabel] = {
        applicable: true,
        pass: !violations.some((violation) => violation.code === "secret-exposure")
      };
      continue;
    }

    const criterionId = Object.entries(CRITERIA_HARD_GATE_MAP).find(
      ([, mappedGate]) => mappedGate === gateLabel
    )?.[0];

    if (!criterionId) {
      hardGates[gateLabel] = { applicable: true, pass: true };
      continue;
    }

    hardGates[gateLabel] = { applicable: true, pass: criteria[criterionId]?.pass !== false };
  }

  const allHardGatesPass = Object.values(hardGates).every((gate) => gate.pass !== false);
  const allApplicableCriteriaPass = Object.values(criteria).every((c) => c.pass !== false);

  return { criteria, hardGates, fullPass: allHardGatesPass && allApplicableCriteriaPass };
}

// ---------------------------------------------------------------------------
// Consumer helpers
// ---------------------------------------------------------------------------

function createBaseConsumer(tempRoot) {
  const consumerDir = join(tempRoot, "consumer");
  cpSync(baseDir, consumerDir, { recursive: true });
  return consumerDir;
}

function writeAppSource(consumerDir, sourceText) {
  writeFileSync(join(consumerDir, "src", "App.tsx"), sourceText, "utf8");
}

function runTypecheckInConsumer(consumerDir) {
  const tscPath = join(consumerDir, "node_modules", "typescript", "lib", "tsc.js");
  return runCommand(process.execPath, [tscPath, "--noEmit"], { cwd: consumerDir });
}

function runBuildInConsumer(consumerDir) {
  const vitePath = join(consumerDir, "node_modules", "vite", "bin", "vite.js");
  return runCommand(process.execPath, [vitePath, "build"], { cwd: consumerDir });
}

const DIRECT_DEPENDENCIES = {
  react: "19.2.8",
  "react-dom": "19.2.8",
  "@react-three/fiber": "9.6.1",
  three: "0.185.1"
};

function assertInstalledPackageAndPeers(consumerDir, tempRoot, expectedVersion) {
  const installedDir = join(consumerDir, "node_modules", "r3f-interactive-flow");

  assertRealInstalledCopy({
    installedDir,
    tempRoot,
    excludedSourceDir: packageDir,
    label: "r3f-interactive-flow"
  });
  assertNotUnderRepoNodeModules(installedDir, "r3f-interactive-flow");

  const installedPackageJson = readJsonFile(join(installedDir, "package.json"));

  if (installedPackageJson.version !== expectedVersion) {
    throw new PackedConsumerError(
      `Installed package version must match the live workspace package version "${expectedVersion}", found ${installedPackageJson.version}.`
    );
  }

  for (const [name, expectedDepVersion] of Object.entries(DIRECT_DEPENDENCIES)) {
    const depInstalledDir = join(consumerDir, "node_modules", ...name.split("/"));

    assertRealInstalledCopy({
      installedDir: depInstalledDir,
      tempRoot,
      excludedSourceDir: join(repoRoot, "node_modules"),
      label: name
    });
    assertNotUnderRepoNodeModules(depInstalledDir, name);

    const depPackageJson = readJsonFile(join(depInstalledDir, "package.json"));

    if (depPackageJson.version !== expectedDepVersion) {
      throw new PackedConsumerError(
        `Expected "${name}" to resolve to exactly ${expectedDepVersion}, but found ${depPackageJson.version}.`
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

// ---------------------------------------------------------------------------
// Stage 11: reference outputs
// ---------------------------------------------------------------------------

function evaluateReferenceTask(contract, task, consumerDir) {
  const overlayDir = join(referenceDir, task.taskId, "output");
  const scopeViolations = checkOutputFileScope(task, overlayDir, {
    legacyFlatMapping: true,
    requireAllAllowedPresent: true
  });

  if (scopeViolations.length > 0) {
    throw new PackedConsumerError(
      `REFERENCE fixture "${task.taskId}" changed a forbidden file: ${JSON.stringify(scopeViolations)}`
    );
  }

  const sourceText = readFileSync(join(overlayDir, "App.tsx"), "utf8");
  writeAppSource(consumerDir, sourceText);

  const behaviorViolations = evaluateCandidateSource(contract, task, sourceText);

  if (behaviorViolations.length > 0) {
    throw new PackedConsumerError(
      `REFERENCE fixture "${task.taskId}" produced unexpected violations: ${JSON.stringify(behaviorViolations)}`
    );
  }

  const typecheckResult = runTypecheckInConsumer(consumerDir);
  assertCommandSucceeded(typecheckResult, `REFERENCE ${task.taskId} typecheck`, "tsc --noEmit");

  const buildResult = runBuildInConsumer(consumerDir);
  assertCommandSucceeded(buildResult, `REFERENCE ${task.taskId} vite build`, "vite build");

  const scoring = computeScoring(task, [], true);

  if (!scoring.fullPass) {
    throw new PackedConsumerError(
      `REFERENCE fixture "${task.taskId}" did not achieve a full pass: ${JSON.stringify(scoring)}`
    );
  }

  return {
    taskId: task.taskId,
    label: "REFERENCE",
    scoring,
    buildExitCode: buildResult.status,
    typecheckExitCode: typecheckResult.status
  };
}

// ---------------------------------------------------------------------------
// Stage 12-13: negative fixtures
// ---------------------------------------------------------------------------

function evaluateNegativeFixture(contract, fixture, consumerDir) {
  const task = contract.tasks.find((candidate) => candidate.taskId === fixture.basedOnTaskId);
  const overlayDir = join(negativeDir, fixture.fixtureId);
  const scopeViolations = checkOutputFileScope(task, overlayDir, {
    legacyFlatMapping: true,
    requireAllAllowedPresent: false
  });

  if (scopeViolations.some((violation) => violation.code === fixture.expectedViolation)) {
    return {
      fixtureId: fixture.fixtureId,
      label: "HARNESS_NEGATIVE",
      matchedExpectedViolation: true,
      violations: scopeViolations
    };
  }

  const sourceText = readFileSync(join(overlayDir, "App.tsx"), "utf8");
  writeAppSource(consumerDir, sourceText);

  const behaviorViolations = [
    ...scopeViolations,
    ...evaluateCandidateSource(contract, task, sourceText)
  ];
  const matchedExpectedViolation = behaviorViolations.some(
    (violation) => violation.code === fixture.expectedViolation
  );

  if (!matchedExpectedViolation) {
    throw new PackedConsumerError(
      `Negative fixture "${fixture.fixtureId}" did not fail for its expected reason "${fixture.expectedViolation}". Observed: ${JSON.stringify(behaviorViolations)}`
    );
  }

  return {
    fixtureId: fixture.fixtureId,
    label: "HARNESS_NEGATIVE",
    matchedExpectedViolation,
    violations: behaviorViolations
  };
}

// ---------------------------------------------------------------------------
// Stage 14 helpers: evidence schema, replay comparison, classification rules
// ---------------------------------------------------------------------------

function getCurrentHarnessCommit() {
  const result = runCommand("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

function assertNonEmptyString(value, fieldName, context) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PackedConsumerError(`${context}: "${fieldName}" must be a non-empty string.`);
  }
}

function assertFieldsEqual(observedValue, expectedValue, fieldName, context) {
  const observedJson = JSON.stringify(observedValue);
  const expectedJson = JSON.stringify(expectedValue);

  if (observedJson !== expectedJson) {
    throw new PackedConsumerError(
      `${context}: field "${fieldName}" does not match deterministic observation.\n  observed:  ${observedJson}\n  committed: ${expectedJson}`
    );
  }
}

function deriveFindingGroups(violations) {
  return {
    unnecessaryDependencies: violations.filter(
      (violation) => violation.code === "unexpected-dependency-import"
    ),
    inventedApiFindings: violations.filter((violation) => violation.code === "invented-api-import"),
    boundaryFindings: violations.filter(
      (violation) =>
        violation.code === "canvas-boundary-violation" ||
        violation.code === "input-hook-inside-canvas"
    ),
    scopeFindings: violations.filter((violation) =>
      [
        "forbidden-file-changed",
        "duplicate-output-path",
        "missing-allowed-output-file",
        "provider-count",
        "canvas-required-missing",
        "missing-required-behavior"
      ].includes(violation.code)
    )
  };
}

function loadEvidenceSchema() {
  return readJsonFile(evidenceSchemaPath);
}

function validateEvidenceSchema(evidence, context) {
  const schema = loadEvidenceSchema();

  if (evidence.evidenceSchemaId !== schema.schemaId) {
    throw new PackedConsumerError(
      `${context}: evidenceSchemaId must be "${schema.schemaId}", found "${evidence.evidenceSchemaId}".`
    );
  }

  for (const field of schema.requiredFields) {
    if (!(field in evidence) || evidence[field] === undefined) {
      throw new PackedConsumerError(
        `${context}: evidence is missing required field "${field}" (schema ${schema.schemaId}).`
      );
    }

    if (evidence[field] === null && !schema.nullableFields.includes(field)) {
      throw new PackedConsumerError(`${context}: evidence field "${field}" must not be null.`);
    }
  }

  if (!schema.classification.allowedValues.includes(evidence.classification)) {
    throw new PackedConsumerError(
      `${context}: classification "${evidence.classification}" is not one of the allowed values.`
    );
  }

  const conditionalFields = schema.conditionalFields[evidence.classification];

  if (conditionalFields) {
    for (const field of conditionalFields) {
      if (evidence[field] === undefined || evidence[field] === null) {
        throw new PackedConsumerError(
          `${context}: classification "${evidence.classification}" requires field "${field}".`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Classification consistency rules
// ---------------------------------------------------------------------------

function assertClassificationConsistency(evidence, observedFullPass, context) {
  const classification = evidence.classification;

  if (observedFullPass) {
    if (classification !== "VERIFIED") {
      throw new PackedConsumerError(
        `${context}: raw output achieved a full pass but classification is "${classification}"; expected "VERIFIED".`
      );
    }

    if (evidence.humanCorrectionCount !== 0) {
      throw new PackedConsumerError(
        `${context}: VERIFIED raw output must have humanCorrectionCount 0.`
      );
    }

    if (evidence.correctedOutput !== null) {
      throw new PackedConsumerError(
        `${context}: VERIFIED raw output must not carry a corrected output.`
      );
    }

    return;
  }

  if (classification === "VERIFIED") {
    throw new PackedConsumerError(
      `${context}: raw output did not achieve a full pass; classification must not be VERIFIED.`
    );
  }

  if (classification === "HARNESS_FAILURE") {
    throw new PackedConsumerError(
      `${context}: HARNESS_FAILURE is inconsistent with a successful reference/negative harness self-check in this run and cannot be committed.`
    );
  }

  if (classification === "AGENT_FAILURE") {
    if (evidence.packageFailureIndependentReproduction) {
      throw new PackedConsumerError(
        `${context}: AGENT_FAILURE must not carry independent package-failure reproduction evidence.`
      );
    }

    if (evidence.documentationGap) {
      throw new PackedConsumerError(
        `${context}: AGENT_FAILURE must not carry a documentation-gap record.`
      );
    }

    if (evidence.humanCorrectionCount > 0 && !evidence.correctedOutput) {
      throw new PackedConsumerError(
        `${context}: AGENT_FAILURE with human corrections requires a corrected output record.`
      );
    }
  }

  if (classification === "DOCUMENTATION_FAILURE") {
    const gap = evidence.documentationGap;

    if (
      !gap ||
      !Array.isArray(gap.suppliedDocPaths) ||
      gap.suppliedDocPaths.length === 0 ||
      typeof gap.missingOrAmbiguousGuidance !== "string" ||
      gap.missingOrAmbiguousGuidance.trim().length === 0
    ) {
      throw new PackedConsumerError(
        `${context}: DOCUMENTATION_FAILURE requires a documentationGap record with non-empty suppliedDocPaths and missingOrAmbiguousGuidance.`
      );
    }

    if (evidence.followUpIssue !== "#407") {
      throw new PackedConsumerError(
        `${context}: DOCUMENTATION_FAILURE requires followUpIssue to be exactly "#407".`
      );
    }

    if (!evidence.correctedOutput) {
      throw new PackedConsumerError(
        `${context}: DOCUMENTATION_FAILURE requires a corrected output that deterministically passes.`
      );
    }
  }

  if (classification === "PACKAGE_FAILURE") {
    const reproduction = evidence.packageFailureIndependentReproduction;

    if (
      !reproduction ||
      typeof reproduction.stage !== "string" ||
      typeof reproduction.command !== "string" ||
      reproduction.reproducedWithoutAgent !== true
    ) {
      throw new PackedConsumerError(
        `${context}: PACKAGE_FAILURE requires a packageFailureIndependentReproduction record (stage, command, reproducedWithoutAgent: true). Stop for reviewer handling if this evidence does not exist yet.`
      );
    }
  }

  if (classification === "ENVIRONMENT_FAILURE") {
    const failure = evidence.environmentFailure;

    if (
      !failure ||
      typeof failure.stage !== "string" ||
      typeof failure.sanitizedError !== "string" ||
      failure.sanitizedError.trim().length === 0
    ) {
      throw new PackedConsumerError(
        `${context}: ENVIRONMENT_FAILURE requires an environmentFailure record with stage and sanitizedError.`
      );
    }
  }

  if (classification === "MIXED_OR_UNRESOLVED") {
    if (
      typeof evidence.reviewerRationale !== "string" ||
      evidence.reviewerRationale.trim().length === 0
    ) {
      throw new PackedConsumerError(
        `${context}: MIXED_OR_UNRESOLVED requires a non-empty reviewerRationale.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Run-manifest / approval-record validation
// ---------------------------------------------------------------------------

function validateRunManifest(runManifestData, runId, contract, manifest) {
  const context = `Committed run "${runId}" run-manifest.json`;

  assertFieldsEqual(runManifestData.runId, runId, "runId", context);
  assertFieldsEqual(
    runManifestData.contractVersion,
    contract.contractVersion,
    "contractVersion",
    context
  );
  assertNonEmptyString(
    runManifestData.repositoryBaselineCommit,
    "repositoryBaselineCommit",
    context
  );
  assertNonEmptyString(runManifestData.phaseAHarnessCommit, "phaseAHarnessCommit", context);
  assertFieldsEqual(
    runManifestData.publicDocManifestId,
    manifest.manifestId,
    "publicDocManifestId",
    context
  );

  const approval = runManifestData.approval;

  if (!approval || typeof approval !== "object") {
    throw new PackedConsumerError(`${context} is missing an "approval" record.`);
  }

  assertNonEmptyString(approval.approverRole, "approval.approverRole", context);
  assertNonEmptyString(approval.approvalTimestamp, "approval.approvalTimestamp", context);
  assertNonEmptyString(approval.approvedService, "approval.approvedService", context);
  assertNonEmptyString(approval.approvedModel, "approval.approvedModel", context);

  if (
    !Number.isInteger(approval.maxRunCount) ||
    approval.maxRunCount < 1 ||
    approval.maxRunCount > 5
  ) {
    throw new PackedConsumerError(
      `${context}: approval.maxRunCount must be an integer between 1 and 5.`
    );
  }

  if (!Array.isArray(approval.approvedTaskIds) || approval.approvedTaskIds.length === 0) {
    throw new PackedConsumerError(
      `${context}: approval.approvedTaskIds must be a non-empty array.`
    );
  }

  if (new Set(approval.approvedTaskIds).size !== approval.approvedTaskIds.length) {
    throw new PackedConsumerError(
      `${context}: approval.approvedTaskIds contains duplicate task IDs.`
    );
  }

  for (const taskId of approval.approvedTaskIds) {
    if (!EXPECTED_TASK_IDS.includes(taskId)) {
      throw new PackedConsumerError(
        `${context}: approval.approvedTaskIds contains unknown task ID "${taskId}".`
      );
    }
  }

  if (approval.retryCount !== 0) {
    throw new PackedConsumerError(`${context}: approval.retryCount must be exactly 0.`);
  }

  if (approval.iterativeFeedback !== "none" && approval.iterativeFeedback !== false) {
    throw new PackedConsumerError(
      `${context}: approval.iterativeFeedback must be "none" or false.`
    );
  }

  assertNonEmptyString(approval.suppliedDataBoundary, "approval.suppliedDataBoundary", context);

  if (approval.privateRepositoryDataBoundary !== "none") {
    throw new PackedConsumerError(
      `${context}: approval.privateRepositoryDataBoundary must be "none".`
    );
  }

  if (approval.secretsBoundary !== "none") {
    throw new PackedConsumerError(`${context}: approval.secretsBoundary must be "none".`);
  }

  assertNonEmptyString(approval.spendBoundary, "approval.spendBoundary", context);
  assertNonEmptyString(approval.retentionBoundary, "approval.retentionBoundary", context);

  if (!Number.isInteger(approval.actualRunCount) || approval.actualRunCount < 0) {
    throw new PackedConsumerError(
      `${context}: approval.actualRunCount must be a non-negative integer.`
    );
  }

  if (approval.actualRunCount > approval.maxRunCount) {
    throw new PackedConsumerError(
      `${context}: approval.actualRunCount (${approval.actualRunCount}) exceeds approval.maxRunCount (${approval.maxRunCount}).`
    );
  }

  return approval;
}

// ---------------------------------------------------------------------------
// Raw/corrected evidence replay
// ---------------------------------------------------------------------------

function buildObservedEvidence({
  contract,
  task,
  manifest,
  manifestHash,
  tarballInfo,
  consumerDir,
  rawDir
}) {
  const rawScopeViolations = checkOutputFileScope(task, rawDir, {
    legacyFlatMapping: false,
    requireAllAllowedPresent: true
  });

  if (rawScopeViolations.length > 0) {
    throw new PackedConsumerError(
      `Raw output changed a forbidden file or is missing a required file: ${JSON.stringify(rawScopeViolations)}`
    );
  }

  const rawAppPath = join(rawDir, "src", "App.tsx");
  const sourceText = readFileSync(rawAppPath, "utf8");
  writeAppSource(consumerDir, sourceText);

  const violations = evaluateCandidateSource(contract, task, sourceText);

  const typecheckResult = runTypecheckInConsumer(consumerDir);
  let buildExitCode = "not-run";

  if (typecheckResult.status === 0) {
    const buildResult = runBuildInConsumer(consumerDir);
    buildExitCode = buildResult.status;
  }

  const buildTypecheckPass = typecheckResult.status === 0 && buildExitCode === 0;
  const scoring = computeScoring(task, violations, buildTypecheckPass);

  const ts = loadWorkspaceTypeScript();
  const analysis = analyzeSource(ts, sourceText);

  const passedApplicable = Object.values(scoring.criteria).filter(
    (criterion) => criterion.applicable && criterion.pass === true
  ).length;
  const totalApplicable = Object.values(scoring.criteria).filter(
    (criterion) => criterion.applicable
  ).length;

  return {
    taskId: task.taskId,
    contractVersion: contract.contractVersion,
    repositoryBaselineCommit: manifest.baselineCommit,
    packageName: tarballInfo.packageName,
    packageVersion: tarballInfo.packageVersion,
    tarballFilename: tarballInfo.filename,
    tarballSha256: tarballInfo.sha256,
    publicDocManifestId: manifest.manifestId,
    publicDocManifestHash: manifestHash,
    rawFiles: computeFileHashList(rawDir),
    publicApisUsed: [...analysis.packageRootImportNames].sort(),
    moduleSpecifiersUsed: [...analysis.moduleSpecifiers].sort(),
    violations,
    typecheckExitCode: typecheckResult.status,
    buildExitCode,
    criteria: scoring.criteria,
    hardGates: scoring.hardGates,
    score: { passedApplicableCriteria: passedApplicable, totalApplicableCriteria: totalApplicable },
    fullPass: scoring.fullPass,
    ...deriveFindingGroups(violations)
  };
}

function assertHumanCorrectionConsistency(
  evidence,
  taskRunDir,
  task,
  contract,
  consumerDir,
  context
) {
  const count = evidence.humanCorrectionCount;
  const corrections = evidence.humanCorrections;

  if (!Number.isInteger(count) || count < 0) {
    throw new PackedConsumerError(
      `${context}: humanCorrectionCount must be a non-negative integer.`
    );
  }

  if (!Array.isArray(corrections) || corrections.length !== count) {
    throw new PackedConsumerError(
      `${context}: humanCorrections array length must equal humanCorrectionCount (${count}).`
    );
  }

  for (const [index, correction] of corrections.entries()) {
    if (
      !correction ||
      typeof correction.description !== "string" ||
      correction.description.trim().length === 0
    ) {
      throw new PackedConsumerError(
        `${context}: humanCorrections[${index}] must have a non-empty description.`
      );
    }
  }

  const correctedDir = join(taskRunDir, "corrected");
  const correctedDirExists = existsSync(correctedDir);

  if (count === 0) {
    if (evidence.correctedOutput !== null) {
      throw new PackedConsumerError(
        `${context}: humanCorrectionCount is 0 but a correctedOutput claim is present.`
      );
    }

    if (correctedDirExists) {
      throw new PackedConsumerError(
        `${context}: humanCorrectionCount is 0 but a "corrected" directory exists.`
      );
    }

    return;
  }

  if (!correctedDirExists) {
    throw new PackedConsumerError(
      `${context}: humanCorrectionCount is ${count} but no "corrected" output directory exists.`
    );
  }

  if (!evidence.correctedOutput || !Array.isArray(evidence.correctedOutput.files)) {
    throw new PackedConsumerError(`${context}: correctedOutput record is missing or malformed.`);
  }

  const scopeViolations = checkOutputFileScope(task, correctedDir, {
    legacyFlatMapping: false,
    requireAllAllowedPresent: true
  });

  if (scopeViolations.length > 0) {
    throw new PackedConsumerError(
      `${context}: corrected output scope violation: ${JSON.stringify(scopeViolations)}`
    );
  }

  const correctedAppPath = join(correctedDir, "src", "App.tsx");
  const correctedSourceText = readFileSync(correctedAppPath, "utf8");
  writeAppSource(consumerDir, correctedSourceText);

  const correctedViolations = evaluateCandidateSource(contract, task, correctedSourceText);
  const correctedTypecheck = runTypecheckInConsumer(consumerDir);
  let correctedBuildExitCode = "not-run";

  if (correctedTypecheck.status === 0) {
    const correctedBuild = runBuildInConsumer(consumerDir);
    correctedBuildExitCode = correctedBuild.status;
  }

  const correctedBuildTypecheckPass =
    correctedTypecheck.status === 0 && correctedBuildExitCode === 0;
  const correctedScoring = computeScoring(task, correctedViolations, correctedBuildTypecheckPass);

  if (!correctedScoring.fullPass) {
    throw new PackedConsumerError(
      `${context}: corrected output does not achieve a deterministic full pass.`
    );
  }

  assertFieldsEqual(
    evidence.correctedOutput.files,
    computeFileHashList(correctedDir),
    "correctedOutput.files",
    context
  );
}

function replayTaskEvidence({
  contract,
  manifest,
  manifestHash,
  tarballInfo,
  consumerDir,
  runId,
  taskId,
  taskRunDir
}) {
  const context = `Committed run "${runId}" task "${taskId}"`;
  const evidencePath = join(taskRunDir, "evidence.json");

  if (!existsSync(evidencePath)) {
    throw new PackedConsumerError(`${context} is missing evidence.json.`);
  }

  const evidence = readJsonFile(evidencePath);
  validateEvidenceSchema(evidence, context);

  const rawDir = join(taskRunDir, "raw");

  if (!existsSync(rawDir)) {
    throw new PackedConsumerError(`${context} is missing a "raw" output directory.`);
  }

  const task = contract.tasks.find((candidate) => candidate.taskId === taskId);
  const observed = buildObservedEvidence({
    contract,
    task,
    manifest,
    manifestHash,
    tarballInfo,
    consumerDir,
    rawDir
  });

  assertFieldsEqual(evidence.runId, runId, "runId", context);
  assertFieldsEqual(evidence.taskId, taskId, "taskId", context);

  const comparedFields = [
    "contractVersion",
    "repositoryBaselineCommit",
    "packageName",
    "packageVersion",
    "tarballFilename",
    "tarballSha256",
    "publicDocManifestId",
    "publicDocManifestHash",
    "rawFiles",
    "publicApisUsed",
    "moduleSpecifiersUsed",
    "violations",
    "typecheckExitCode",
    "buildExitCode",
    "criteria",
    "hardGates",
    "score",
    "fullPass",
    "unnecessaryDependencies",
    "inventedApiFindings",
    "boundaryFindings",
    "scopeFindings"
  ];

  for (const field of comparedFields) {
    assertFieldsEqual(evidence[field], observed[field], field, context);
  }

  if (!Array.isArray(evidence.warnings)) {
    throw new PackedConsumerError(`${context}: "warnings" must be an array.`);
  }

  assertHumanCorrectionConsistency(evidence, taskRunDir, task, contract, consumerDir, context);
  assertClassificationConsistency(evidence, observed.fullPass, context);
  assertNonEmptyString(evidence.reviewer, "reviewer", context);

  return { runId, taskId, evidence, observed };
}

// ---------------------------------------------------------------------------
// Stage 14: committed approved runs
// ---------------------------------------------------------------------------

function evaluateCommittedRuns(
  contract,
  manifest,
  manifestHash,
  tarballInfo,
  consumerDir,
  runsDirOverride
) {
  const targetRunsDir = runsDirOverride ?? runsDir;

  if (!existsSync(targetRunsDir)) {
    return [];
  }

  const runDirNames = readdirSync(targetRunsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (runDirNames.length === 0) {
    console.log("  (no committed approved runs found — Phase B has not been recorded yet)");
    return [];
  }

  const results = [];

  for (const runId of runDirNames) {
    const runDir = join(targetRunsDir, runId);
    const runManifestPath = join(runDir, "run-manifest.json");

    if (!existsSync(runManifestPath)) {
      throw new PackedConsumerError(`Committed run "${runId}" is missing run-manifest.json.`);
    }

    const runManifestData = readJsonFile(runManifestPath);
    const approval = validateRunManifest(runManifestData, runId, contract, manifest);

    assertFieldsEqual(
      runManifestData.publicDocManifestHash,
      manifestHash,
      "publicDocManifestHash",
      `Committed run "${runId}" run-manifest.json`
    );

    const commitCheck = runCommand(
      "git",
      ["cat-file", "-e", `${runManifestData.repositoryBaselineCommit}^{commit}`],
      { cwd: repoRoot }
    );

    if (commitCheck.status !== 0) {
      throw new PackedConsumerError(
        `Committed run "${runId}" repositoryBaselineCommit does not resolve to a real commit.`
      );
    }

    const taskDirNames = readdirSync(runDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const dirName of taskDirNames) {
      if (!EXPECTED_TASK_IDS.includes(dirName)) {
        throw new PackedConsumerError(
          `Committed run "${runId}" contains unknown task directory "${dirName}".`
        );
      }

      if (!approval.approvedTaskIds.includes(dirName)) {
        throw new PackedConsumerError(
          `Committed run "${runId}" contains unapproved task directory "${dirName}".`
        );
      }
    }

    if (taskDirNames.length !== approval.actualRunCount) {
      throw new PackedConsumerError(
        `Committed run "${runId}" has ${taskDirNames.length} task directories on disk, but approval.actualRunCount declares ${approval.actualRunCount}.`
      );
    }

    for (const taskId of taskDirNames) {
      const taskRunDir = join(runDir, taskId);
      const replay = replayTaskEvidence({
        contract,
        manifest,
        manifestHash,
        tarballInfo,
        consumerDir,
        runId,
        taskId,
        taskRunDir
      });

      assertFieldsEqual(
        replay.evidence.phaseAHarnessCommit,
        runManifestData.phaseAHarnessCommit,
        "phaseAHarnessCommit",
        `Committed run "${runId}" task "${taskId}"`
      );

      results.push({
        runId,
        taskId,
        classification: replay.evidence.classification,
        fullPass: replay.observed.fullPass
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// --prepare-run helper mode
// ---------------------------------------------------------------------------

function prepareRunBundle(outputDir, taskId) {
  if (!EXPECTED_TASK_IDS.includes(taskId)) {
    throw new PackedConsumerError(
      `--task must be one of ${JSON.stringify(EXPECTED_TASK_IDS)}, got "${taskId}".`
    );
  }

  const contract = readJsonFile(contractPath);
  const manifest = readJsonFile(manifestPath);
  const task = contract.tasks.find((candidate) => candidate.taskId === taskId);

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(outputDir, "docs"), { recursive: true });
  mkdirSync(join(outputDir, "input", "src"), { recursive: true });

  for (const entry of manifest.files) {
    const sourcePath = join(repoRoot, entry.path);
    const destPath = join(outputDir, "docs", entry.path);
    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(sourcePath, destPath);
  }

  writeFileSync(join(outputDir, "public-docs-manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outputDir, "task-contract.json"), JSON.stringify(task, null, 2));

  for (const name of ["package.json", "tsconfig.json", "vite.config.ts", "index.html"]) {
    cpSync(join(baseDir, name), join(outputDir, "input", name));
  }
  cpSync(join(baseDir, "src", "main.tsx"), join(outputDir, "input", "src", "main.tsx"));
  cpSync(
    join(repoRoot, task.immutableInputFixture.path),
    join(outputDir, "input", "src", "App.tsx")
  );

  const instructions = `# Task ${taskId} (contract ${contract.contractVersion})

You are working inside an isolated, offline evaluation bundle. Read the files
under "docs/" (the package's public README and user guides) and the starting
project under "input/".

## Rules

- You may edit only these output files: ${task.allowedOutputFiles.join(", ")}.
- Do not browse the repository or the internet.
- Do not install any dependency.
- Do not run any hidden repository tool or script.
- Do not ask for another model or a second attempt.
- Return code only in the requested output file(s) listed above.
- You will not receive iterative compiler or build feedback.
- You get exactly one attempt for this task.

## Task

${task.startingPoint}

### Required behavior

${task.requiredBehavior.map((line) => `- ${line}`).join("\n")}
`;

  writeFileSync(join(outputDir, "INSTRUCTIONS.md"), instructions);

  console.log(`Prepared sanitized evaluation bundle for ${taskId} at ${outputDir}`);

  auditBundle(outputDir);
}

// ---------------------------------------------------------------------------
// Sanitized bundle self-audit
// ---------------------------------------------------------------------------

function auditBundle(bundleDir) {
  const manifest = readJsonFile(manifestPath);
  const expectedDocPaths = new Set(manifest.files.map((entry) => `docs/${entry.path}`));
  const expectedTopLevel = new Set([
    "public-docs-manifest.json",
    "task-contract.json",
    "INSTRUCTIONS.md",
    "input/package.json",
    "input/tsconfig.json",
    "input/vite.config.ts",
    "input/index.html",
    "input/src/main.tsx",
    "input/src/App.tsx"
  ]);

  const allFiles = walkFilesRecursive(bundleDir);
  const unexpected = allFiles.filter(
    (relativePath) => !expectedDocPaths.has(relativePath) && !expectedTopLevel.has(relativePath)
  );

  if (unexpected.length > 0) {
    throw new PackedConsumerError(
      `Bundle audit failed for ${bundleDir}: unexpected file(s) present:\n${unexpected.join("\n")}`
    );
  }

  const missing = [...expectedDocPaths, ...expectedTopLevel].filter(
    (expectedPath) => !allFiles.includes(expectedPath)
  );

  if (missing.length > 0) {
    throw new PackedConsumerError(
      `Bundle audit failed for ${bundleDir}: expected file(s) missing:\n${missing.join("\n")}`
    );
  }

  const fileHashes = computeFileHashList(bundleDir);
  const bundleHash = createHash("sha256").update(JSON.stringify(fileHashes)).digest("hex");

  console.log(`Bundle audit passed for ${bundleDir}`);
  console.log(`Sanitized file inventory (${allFiles.length} files):`);
  for (const relativePath of [...allFiles].sort()) {
    console.log(`  ${relativePath}`);
  }
  console.log(`Bundle content SHA-256: ${bundleHash}`);

  return { bundleHash, fileCount: allFiles.length };
}

// ---------------------------------------------------------------------------
// Temporary local self-test mode (--self-test)
//
// Proves that the evidence-replay logic in evaluateCommittedRuns() actually
// rejects tampered/falsified committed evidence. Builds one valid synthetic
// run entirely under the OS temp directory (never under validation/
// agent-public-docs/runs/), then clones and tampers it per scenario.
// ---------------------------------------------------------------------------

function buildBaselineSyntheticRun({ contract, runsRoot, runId }) {
  const task = contract.tasks.find((candidate) => candidate.taskId === "AGENT-FOUNDATION");
  const sourceText = readFileSync(
    join(referenceDir, "AGENT-FOUNDATION", "output", "App.tsx"),
    "utf8"
  );

  const runDir = join(runsRoot, runId);
  const taskRunDir = join(runDir, "AGENT-FOUNDATION");
  mkdirSync(join(taskRunDir, "raw", "src"), { recursive: true });
  writeFileSync(join(taskRunDir, "raw", "src", "App.tsx"), sourceText, "utf8");

  return { runDir, taskRunDir, task, sourceText };
}

function finalizeBaselineEvidence({
  contract,
  task,
  manifest,
  manifestHash,
  tarballInfo,
  consumerDir,
  taskRunDir,
  runId,
  harnessCommit
}) {
  const rawDir = join(taskRunDir, "raw");
  const observed = buildObservedEvidence({
    contract,
    task,
    manifest,
    manifestHash,
    tarballInfo,
    consumerDir,
    rawDir
  });

  if (!observed.fullPass) {
    throw new PackedConsumerError(
      "Self-test baseline synthetic run (AGENT-FOUNDATION reference output) did not achieve a full pass; cannot build a valid baseline."
    );
  }

  const evidence = {
    evidenceSchemaId: "agent-public-docs-evidence-v1",
    runId,
    ...observed,
    warnings: [],
    humanCorrectionCount: 0,
    humanCorrections: [],
    correctedOutput: null,
    classification: "VERIFIED",
    reviewer: "self-test",
    followUpIssue: null,
    phaseAHarnessCommit: harnessCommit
  };

  writeFileSync(join(taskRunDir, "evidence.json"), JSON.stringify(evidence, null, 2));

  return evidence;
}

function writeBaselineRunManifest({
  runDir,
  runId,
  contract,
  manifest,
  manifestHash,
  harnessCommit
}) {
  const runManifestData = {
    runId,
    contractVersion: contract.contractVersion,
    repositoryBaselineCommit: manifest.baselineCommit,
    phaseAHarnessCommit: harnessCommit,
    publicDocManifestId: manifest.manifestId,
    publicDocManifestHash: manifestHash,
    approval: {
      approverRole: "repository owner",
      approvalTimestamp: "2026-01-01T00:00:00Z",
      approvedService: "self-test",
      approvedModel: "self-test-model",
      maxRunCount: 5,
      approvedTaskIds: ["AGENT-FOUNDATION"],
      retryCount: 0,
      iterativeFeedback: "none",
      suppliedDataBoundary: "self-test synthetic bundle only",
      privateRepositoryDataBoundary: "none",
      secretsBoundary: "none",
      spendBoundary: "none (self-test)",
      retentionBoundary: "self-test, discarded after this process exits",
      actualRunCount: 1
    }
  };

  writeFileSync(join(runDir, "run-manifest.json"), JSON.stringify(runManifestData, null, 2));

  return runManifestData;
}

function expectRejected(scenarioName, fn) {
  try {
    fn();
    return { scenarioName, rejected: false, message: "(no error thrown)" };
  } catch (err) {
    return {
      scenarioName,
      rejected: true,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}

function expectAccepted(scenarioName, fn) {
  try {
    fn();
    return { scenarioName, accepted: true, message: "(passed as expected)" };
  } catch (err) {
    return {
      scenarioName,
      accepted: false,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}

async function runSelfTest() {
  console.log("Running temporary local self-test (--self-test)...\n");

  const { manifest, manifestHash } = verifyPublicDocManifest();
  const contract = verifyContractShape();
  const harnessCommit = getCurrentHarnessCommit();
  const tempRoot = createTempRoot("r3f-agent-self-test-");

  const outcomes = [];

  try {
    const tarballInfo = packTarball(packageDir, tempRoot);
    const consumerDir = createBaseConsumer(tempRoot);
    cpSync(tarballInfo.tarballPath, join(consumerDir, "r3f-interactive-flow.tgz"));

    const installResult = runCommand(
      "npm",
      ["install", "--no-audit", "--no-fund", "--ignore-scripts"],
      {
        cwd: consumerDir
      }
    );
    assertCommandSucceeded(installResult, "self-test npm install", "npm install ...");

    const runsRoot = join(tempRoot, "runs-scratch");
    const runId = "self-test-run";

    const { runDir, taskRunDir, task } = buildBaselineSyntheticRun({
      contract,
      runsRoot,
      runId
    });

    finalizeBaselineEvidence({
      contract,
      task,
      manifest,
      manifestHash,
      tarballInfo,
      consumerDir,
      taskRunDir,
      runId,
      harnessCommit
    });
    writeBaselineRunManifest({ runDir, runId, contract, manifest, manifestHash, harnessCommit });

    function evaluateScenarioRoot(scenarioRoot) {
      evaluateCommittedRuns(
        contract,
        manifest,
        manifestHash,
        tarballInfo,
        consumerDir,
        scenarioRoot
      );
    }

    function cloneBaselineInto(scenarioName) {
      const scenarioRoot = join(tempRoot, `scenario-${scenarioName}`);
      cpSync(runsRoot, scenarioRoot, { recursive: true });
      return {
        scenarioRoot,
        scenarioRunDir: join(scenarioRoot, runId),
        scenarioTaskDir: join(scenarioRoot, runId, "AGENT-FOUNDATION")
      };
    }

    function readEvidence(scenarioTaskDir) {
      return readJsonFile(join(scenarioTaskDir, "evidence.json"));
    }

    function writeEvidence(scenarioTaskDir, evidence) {
      writeFileSync(join(scenarioTaskDir, "evidence.json"), JSON.stringify(evidence, null, 2));
    }

    function readRunManifest(scenarioRunDir) {
      return readJsonFile(join(scenarioRunDir, "run-manifest.json"));
    }

    function writeRunManifest(scenarioRunDir, data) {
      writeFileSync(join(scenarioRunDir, "run-manifest.json"), JSON.stringify(data, null, 2));
    }

    // Baseline sanity: the unmodified synthetic run must be ACCEPTED.
    outcomes.push({
      kind: "baseline",
      ...expectAccepted("baseline-valid-run-is-accepted", () => evaluateScenarioRoot(runsRoot))
    });

    // Scenario 1: changed classification (while fullPass stays true).
    outcomes.push({
      kind: "rejection",
      ...expectRejected("changed-classification-is-rejected", () => {
        const { scenarioRoot, scenarioTaskDir } = cloneBaselineInto("classification");
        const evidence = readEvidence(scenarioTaskDir);
        evidence.classification = "AGENT_FAILURE";
        writeEvidence(scenarioTaskDir, evidence);
        evaluateScenarioRoot(scenarioRoot);
      })
    });

    // Scenario 2: changed criteria value.
    outcomes.push({
      kind: "rejection",
      ...expectRejected("changed-criteria-value-is-rejected", () => {
        const { scenarioRoot, scenarioTaskDir } = cloneBaselineInto("criteria");
        const evidence = readEvidence(scenarioTaskDir);
        const firstKey = Object.keys(evidence.criteria)[0];
        evidence.criteria[firstKey] = { ...evidence.criteria[firstKey], pass: false };
        writeEvidence(scenarioTaskDir, evidence);
        evaluateScenarioRoot(scenarioRoot);
      })
    });

    // Scenario 3: changed build/typecheck exit code.
    outcomes.push({
      kind: "rejection",
      ...expectRejected("changed-exit-code-is-rejected", () => {
        const { scenarioRoot, scenarioTaskDir } = cloneBaselineInto("exit-code");
        const evidence = readEvidence(scenarioTaskDir);
        evidence.typecheckExitCode = 1;
        writeEvidence(scenarioTaskDir, evidence);
        evaluateScenarioRoot(scenarioRoot);
      })
    });

    // Scenario 4: changed human-correction count without a matching corrections array.
    outcomes.push({
      kind: "rejection",
      ...expectRejected("changed-human-correction-count-is-rejected", () => {
        const { scenarioRoot, scenarioTaskDir } = cloneBaselineInto("correction-count");
        const evidence = readEvidence(scenarioTaskDir);
        evidence.humanCorrectionCount = 1;
        writeEvidence(scenarioTaskDir, evidence);
        evaluateScenarioRoot(scenarioRoot);
      })
    });

    // Scenario 5: corrected-output claim without corrected files on disk.
    outcomes.push({
      kind: "rejection",
      ...expectRejected("corrected-output-claim-without-files-is-rejected", () => {
        const { scenarioRoot, scenarioTaskDir } = cloneBaselineInto("corrected-without-files");
        const evidence = readEvidence(scenarioTaskDir);
        evidence.humanCorrectionCount = 1;
        evidence.humanCorrections = [{ description: "claimed fix" }];
        evidence.correctedOutput = { files: [{ path: "src/App.tsx", sha256: "0".repeat(64) }] };
        evidence.classification = "AGENT_FAILURE";
        writeEvidence(scenarioTaskDir, evidence);
        evaluateScenarioRoot(scenarioRoot);
      })
    });

    // Scenario 6: a nested unexpected file is rejected (reuses the committed
    // HARNESS_NEGATIVE fixture directly, not the run-replay mechanism).
    {
      const fixture = contract.negativeFixtures.find(
        (f) => f.fixtureId === "nested-forbidden-file"
      );
      const fixtureTask = contract.tasks.find((t) => t.taskId === fixture.basedOnTaskId);
      const violations = checkOutputFileScope(fixtureTask, join(negativeDir, fixture.fixtureId), {
        legacyFlatMapping: true,
        requireAllAllowedPresent: false
      });
      const matched = violations.some(
        (violation) =>
          violation.code === fixture.expectedViolation && violation.detail === "src/helper.ts"
      );

      outcomes.push({
        kind: "rejection",
        scenarioName: "nested-unexpected-file-is-rejected",
        rejected: matched,
        message: matched
          ? "nested src/helper.ts correctly flagged as forbidden-file-changed"
          : `nested-forbidden-file fixture did not produce the expected violation. Observed: ${JSON.stringify(violations)}`
      });
    }

    // Scenario 7: an unapproved task directory is rejected.
    outcomes.push({
      kind: "rejection",
      ...expectRejected("unapproved-task-directory-is-rejected", () => {
        const { scenarioRoot, scenarioRunDir, scenarioTaskDir } =
          cloneBaselineInto("unapproved-task");
        const extraTaskDir = join(scenarioRunDir, "AGENT-CANVAS");
        cpSync(scenarioTaskDir, extraTaskDir, { recursive: true });
        evaluateScenarioRoot(scenarioRoot);
      })
    });

    // Scenario 8: a run count above approval is rejected (actualRunCount
    // exceeding the approved maxRunCount).
    outcomes.push({
      kind: "rejection",
      ...expectRejected("run-count-above-approval-is-rejected", () => {
        const { scenarioRoot, scenarioRunDir } = cloneBaselineInto("run-count");
        const runManifestData = readRunManifest(scenarioRunDir);
        runManifestData.approval.actualRunCount = 6;
        writeRunManifest(scenarioRunDir, runManifestData);
        evaluateScenarioRoot(scenarioRoot);
      })
    });

    // Scenario 9: a manifest hash mismatch is rejected.
    outcomes.push({
      kind: "rejection",
      ...expectRejected("manifest-hash-mismatch-is-rejected", () => {
        const { scenarioRoot, scenarioTaskDir } = cloneBaselineInto("manifest-hash");
        const evidence = readEvidence(scenarioTaskDir);
        evidence.publicDocManifestHash = "0".repeat(64);
        writeEvidence(scenarioTaskDir, evidence);
        evaluateScenarioRoot(scenarioRoot);
      })
    });
  } finally {
    removeTempRoot(tempRoot);
  }

  console.log("--- Self-test results ---");
  let allGood = true;

  for (const outcome of outcomes) {
    if (outcome.kind === "baseline") {
      const ok = outcome.accepted === true;
      allGood = allGood && ok;
      console.log(
        `${ok ? "✔" : "✘"} ${outcome.scenarioName}: ${ok ? "accepted as expected" : "FAILED — " + outcome.message}`
      );
      continue;
    }

    const ok = outcome.rejected === true;
    allGood = allGood && ok;
    console.log(
      `${ok ? "✔" : "✘"} ${outcome.scenarioName}: ${ok ? "rejected as expected" : "FAILED — evidence was NOT rejected"}`
    );
  }

  if (!allGood) {
    throw new PackedConsumerError(
      "Self-test failed: one or more scenarios did not behave as expected."
    );
  }

  console.log(
    "\nSelf-test passed: all tamper scenarios were rejected and the valid baseline was accepted."
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--self-test")) {
    await runSelfTest();
    return;
  }

  const auditBundleIndex = args.indexOf("--audit-bundle");

  if (auditBundleIndex !== -1) {
    const bundleDir = args[auditBundleIndex + 1];

    if (!bundleDir) {
      throw new PackedConsumerError(
        "Usage: node scripts/verify-agent-public-docs.mjs --audit-bundle <bundle-directory>"
      );
    }

    auditBundle(bundleDir);
    return;
  }

  const prepareRunIndex = args.indexOf("--prepare-run");

  if (prepareRunIndex !== -1) {
    const outputDir = args[prepareRunIndex + 1];
    const taskIndex = args.indexOf("--task");
    const taskId = taskIndex !== -1 ? args[taskIndex + 1] : undefined;

    if (!outputDir || !taskId) {
      throw new PackedConsumerError(
        "Usage: node scripts/verify-agent-public-docs.mjs --prepare-run <output-directory> --task <TASK-ID>"
      );
    }

    prepareRunBundle(outputDir, taskId);
    return;
  }

  step("build output exists", () =>
    assertBuildOutputExists(packageDir, [
      "dist/index.js",
      "dist/index.cjs",
      "dist/index.d.ts",
      "dist/index.d.cts"
    ])
  );

  const { manifest, manifestHash } = step("verify public-doc manifest", verifyPublicDocManifest);
  const contract = step("verify contract version and task IDs", verifyContractShape);
  step("verify task input fixtures are immutable", () => verifyTaskInputImmutability(contract));

  const workspacePackageJson = readJsonFile(join(packageDir, "package.json"));
  const tempRoot = createTempRoot("r3f-agent-public-docs-");

  try {
    const tarballInfo = step("pack tarball with npm pack", () => packTarball(packageDir, tempRoot));

    const consumerDir = step("create isolated consumer environment", () =>
      createBaseConsumer(tempRoot)
    );

    cpSync(tarballInfo.tarballPath, join(consumerDir, "r3f-interactive-flow.tgz"));

    step("install fixture dependencies from the packed tarball", () => {
      const result = runCommand("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts"], {
        cwd: consumerDir
      });
      assertCommandSucceeded(
        result,
        "npm install",
        "npm install --no-audit --no-fund --ignore-scripts"
      );
    });

    step("assert installed package and direct dependencies are real copies", () =>
      assertInstalledPackageAndPeers(consumerDir, tempRoot, workspacePackageJson.version)
    );

    step('"npm ls" reports a valid dependency graph', () => runDependencyGraphCheck(consumerDir));

    console.log("\n--- Reference fixtures (REFERENCE) ---");
    const referenceResults = [];
    for (const task of contract.tasks) {
      referenceResults.push(
        step(`reference fixture ${task.taskId}`, () =>
          evaluateReferenceTask(contract, task, consumerDir)
        )
      );
    }

    console.log("\n--- Negative fixtures (HARNESS_NEGATIVE) ---");
    const negativeResults = [];
    for (const fixture of contract.negativeFixtures) {
      negativeResults.push(
        step(`negative fixture ${fixture.fixtureId}`, () =>
          evaluateNegativeFixture(contract, fixture, consumerDir)
        )
      );
    }

    console.log("\n--- Committed approved runs (Phase B evidence) ---");
    const committedRunResults = step("evaluate committed approved runs", () =>
      evaluateCommittedRuns(contract, manifest, manifestHash, tarballInfo, consumerDir)
    );

    console.log("\n--- Evidence summary ---");
    console.log(`contract version: ${contract.contractVersion}`);
    console.log(`public-doc manifest ID: ${manifest.manifestId}`);
    console.log(`public-doc manifest content SHA-256: ${manifestHash}`);
    console.log(`repository baseline commit: ${manifest.baselineCommit}`);
    console.log(`Phase A harness commit (current checkout): ${getCurrentHarnessCommit()}`);
    console.log(`source package: ${tarballInfo.packageName}@${tarballInfo.packageVersion}`);
    console.log(`tarball filename: ${tarballInfo.filename}`);
    console.log(`tarball SHA-256: ${tarballInfo.sha256}`);
    console.log("reference fixtures:");
    for (const result of referenceResults) {
      console.log(`  ${result.taskId}: ${result.label}, fullPass=${result.scoring.fullPass}`);
    }
    console.log("negative fixtures:");
    for (const result of negativeResults) {
      console.log(
        `  ${result.fixtureId}: ${result.label}, matchedExpectedViolation=${result.matchedExpectedViolation}`
      );
    }
    console.log(`committed approved runs evaluated: ${committedRunResults.length}`);
    console.log("final classification: VERIFIED (harness self-check)");
  } finally {
    removeTempRoot(tempRoot);
  }

  console.log("\nAgent public-docs harness verification passed.");
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
