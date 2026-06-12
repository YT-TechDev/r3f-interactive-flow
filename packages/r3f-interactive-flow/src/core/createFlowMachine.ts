import { clamp01, linear } from "./easing";
import type { EasingFunction } from "./easing";
import type { FlowDirection, FlowMachine, FlowSnapshot } from "./types";

const DEFAULT_TRANSITION_DURATION_MS = 1000;
const DEFAULT_COOLDOWN_MS = 0;

export type CreateFlowMachineOptions<TPhase extends string> = {
  phases: readonly TPhase[];
  initialPhase?: TPhase;
  transitionDurationMs?: number;
  cooldownMs?: number;
  easing?: EasingFunction;
};

function assertPhases<TPhase extends string>(
  phases: readonly TPhase[]
): asserts phases is readonly [TPhase, ...TPhase[]] {
  if (phases.length === 0) {
    throw new Error("createFlowMachine requires at least one phase.");
  }

  const seen = new Set<TPhase>();

  for (const phase of phases) {
    if (seen.has(phase)) {
      throw new Error(`createFlowMachine received a duplicate phase: ${phase}.`);
    }

    seen.add(phase);
  }
}

function resolveTransitionDurationMs(transitionDurationMs?: number): number {
  if (transitionDurationMs === undefined) {
    return DEFAULT_TRANSITION_DURATION_MS;
  }

  if (!Number.isFinite(transitionDurationMs) || transitionDurationMs <= 0) {
    throw new Error("transitionDurationMs must be a finite positive number.");
  }

  return transitionDurationMs;
}

function resolveCooldownMs(cooldownMs?: number): number {
  if (cooldownMs === undefined) {
    return DEFAULT_COOLDOWN_MS;
  }

  if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
    throw new Error("cooldownMs must be a finite number greater than or equal to 0.");
  }

  return cooldownMs;
}

export function createFlowMachine<TPhase extends string>(
  options: CreateFlowMachineOptions<TPhase>
): FlowMachine<TPhase> {
  const { phases } = options;

  assertPhases(phases);

  const transitionDurationMs = resolveTransitionDurationMs(options.transitionDurationMs);
  const cooldownMs = resolveCooldownMs(options.cooldownMs);
  const easing = options.easing ?? linear;
  const initialPhase = options.initialPhase ?? phases[0];
  const initialPhaseIndex = phases.indexOf(initialPhase);

  if (initialPhaseIndex === -1) {
    throw new Error(`initialPhase must be included in phases: ${initialPhase}.`);
  }

  let phaseIndex = initialPhaseIndex;
  let progress = 0;
  let direction: FlowDirection = "none";
  let isTransitioning = false;
  let isLocked = false;
  let elapsedMs = 0;
  let cooldownRemainingMs = 0;

  const getCurrentPhase = (): TPhase => {
    const phase = phases[phaseIndex];

    if (phase === undefined) {
      throw new Error(`Invalid internal phase index: ${phaseIndex}.`);
    }

    return phase;
  };

  const getSnapshot = (): FlowSnapshot<TPhase> => ({
    phase: getCurrentPhase(),
    phaseIndex,
    progress,
    direction,
    isTransitioning,
    isLocked
  });

  const navigateToIndex = (targetPhaseIndex: number): void => {
    if (targetPhaseIndex < 0 || targetPhaseIndex >= phases.length) {
      return;
    }

    if (isLocked || isTransitioning || cooldownRemainingMs > 0 || targetPhaseIndex === phaseIndex) {
      return;
    }

    direction = targetPhaseIndex > phaseIndex ? "next" : "prev";
    phaseIndex = targetPhaseIndex;
    progress = 0;
    elapsedMs = 0;
    cooldownRemainingMs = cooldownMs;
    isTransitioning = true;
  };

  const update = (deltaMs: number): void => {
    if (!Number.isFinite(deltaMs)) {
      throw new Error("deltaMs must be a finite number.");
    }

    const elapsedDeltaMs = Math.max(0, deltaMs);

    if (cooldownRemainingMs > 0) {
      cooldownRemainingMs = Math.max(0, cooldownRemainingMs - elapsedDeltaMs);
    }

    if (!isTransitioning) {
      return;
    }

    elapsedMs += elapsedDeltaMs;

    const rawProgress = clamp01(elapsedMs / transitionDurationMs);
    progress = rawProgress >= 1 ? 1 : clamp01(easing(rawProgress));

    if (rawProgress >= 1) {
      elapsedMs = transitionDurationMs;
      direction = "none";
      isTransitioning = false;
    }
  };

  return {
    get phase() {
      return getCurrentPhase();
    },
    get phaseIndex() {
      return phaseIndex;
    },
    get progress() {
      return progress;
    },
    get direction() {
      return direction;
    },
    get isTransitioning() {
      return isTransitioning;
    },
    get isLocked() {
      return isLocked;
    },
    next() {
      navigateToIndex(phaseIndex + 1);
    },
    prev() {
      navigateToIndex(phaseIndex - 1);
    },
    goTo(phase) {
      const targetPhaseIndex = phases.indexOf(phase);

      if (targetPhaseIndex === -1) {
        throw new Error(`Unknown phase: ${phase}.`);
      }

      navigateToIndex(targetPhaseIndex);
    },
    lock() {
      isLocked = true;
    },
    unlock() {
      isLocked = false;
    },
    update,
    getSnapshot
  };
}
