import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
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
  runCommand
} from "./lib/packed-consumer-utils.mjs";

const fixtureRoot = join(repoRoot, "validation", "agent-public-docs");
const baseDir = join(fixtureRoot, "base");
const contractPath = join(fixtureRoot, "contracts", "agent-public-docs-v1.json");
const manifestPath = join(fixtureRoot, "public-docs-manifest.json");
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

  return manifest;
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

function mapOverlayEntryToTargetFile(entryName) {
  if (entryName === "App.tsx") {
    return "src/App.tsx";
  }

  return entryName;
}

function checkOutputFileScope(task, overlayDir) {
  const violations = [];
  const entries = readdirSync(overlayDir).filter((name) =>
    statSync(join(overlayDir, name)).isFile()
  );

  for (const entry of entries) {
    const targetFile = mapOverlayEntryToTargetFile(entry);

    if (!task.allowedOutputFiles.includes(targetFile)) {
      violations.push({ code: "forbidden-file-changed", detail: targetFile });
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
  const scopeViolations = checkOutputFileScope(task, overlayDir);

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
  const scopeViolations = checkOutputFileScope(task, overlayDir);

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
// Stage 14: committed approved runs
// ---------------------------------------------------------------------------

function evaluateCommittedRuns(contract, consumerDir) {
  if (!existsSync(runsDir)) {
    return [];
  }

  const runDirs = readdirSync(runsDir).filter((name) =>
    statSync(join(runsDir, name)).isDirectory()
  );

  if (runDirs.length === 0) {
    console.log("  (no committed approved runs found — Phase B has not been recorded yet)");
    return [];
  }

  const results = [];

  for (const runId of runDirs) {
    const runDir = join(runsDir, runId);
    const runManifestPath = join(runDir, "run-manifest.json");

    if (!existsSync(runManifestPath)) {
      throw new PackedConsumerError(`Committed run "${runId}" is missing run-manifest.json.`);
    }

    const runManifest = readJsonFile(runManifestPath);

    if (runManifest.contractVersion !== contract.contractVersion) {
      throw new PackedConsumerError(
        `Committed run "${runId}" run-manifest.json contractVersion "${runManifest.contractVersion}" does not match "${contract.contractVersion}".`
      );
    }

    if (!runManifest.approval || typeof runManifest.approval !== "object") {
      throw new PackedConsumerError(
        `Committed run "${runId}" run-manifest.json is missing an "approval" record.`
      );
    }

    for (const taskId of EXPECTED_TASK_IDS) {
      const taskRunDir = join(runDir, taskId);

      if (!existsSync(taskRunDir)) {
        continue;
      }

      const evidencePath = join(taskRunDir, "evidence.json");
      const rawAppPath = join(taskRunDir, "raw", "App.tsx");

      if (!existsSync(evidencePath) || !existsSync(rawAppPath)) {
        throw new PackedConsumerError(
          `Committed run "${runId}" task "${taskId}" is missing evidence.json or raw/App.tsx.`
        );
      }

      const evidence = readJsonFile(evidencePath);
      const task = contract.tasks.find((candidate) => candidate.taskId === taskId);
      const sourceText = readFileSync(rawAppPath, "utf8");

      writeAppSource(consumerDir, sourceText);

      const typecheckResult = runTypecheckInConsumer(consumerDir);
      const buildResult =
        typecheckResult.status === 0 ? runBuildInConsumer(consumerDir) : { status: null };
      const violations = evaluateCandidateSource(contract, task, sourceText);
      const buildTypecheckPass = typecheckResult.status === 0 && buildResult.status === 0;
      const scoring = computeScoring(task, violations, buildTypecheckPass);

      if (JSON.stringify(scoring.criteria) !== JSON.stringify(evidence.criteria)) {
        throw new PackedConsumerError(
          `Committed evidence for "${runId}/${taskId}" does not match deterministic observation (criteria mismatch).`
        );
      }

      if (JSON.stringify(scoring.hardGates) !== JSON.stringify(evidence.hardGates)) {
        throw new PackedConsumerError(
          `Committed evidence for "${runId}/${taskId}" does not match deterministic observation (hard gate mismatch).`
        );
      }

      results.push({ runId, taskId, scoring, classification: evidence.classification });
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
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
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

  const manifest = step("verify public-doc manifest", verifyPublicDocManifest);
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
      evaluateCommittedRuns(contract, consumerDir)
    );

    console.log("\n--- Evidence summary ---");
    console.log(`contract version: ${contract.contractVersion}`);
    console.log(`public-doc manifest ID: ${manifest.manifestId}`);
    console.log(`repository baseline commit: ${manifest.baselineCommit}`);
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
