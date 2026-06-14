import { clamp01, linear } from "./easing";
import type { EasingFunction } from "./easing";
import type {
  FlowDirection,
  FlowMachine,
  FlowSnapshot,
  FlowTransitionBaseOptions,
  FlowTransitionOptions
} from "./types";

const DEFAULT_TRANSITION_DURATION_MS = 1000;
const DEFAULT_COOLDOWN_MS = 0;

export type CreateFlowMachineOptions<TPhase extends string> = {
  phases: readonly TPhase[];
  initialPhase?: TPhase;
  transitionDurationMs?: number;
  cooldownMs?: number;
  easing?: EasingFunction;
  transition?: FlowTransitionOptions<TPhase>;
};

type ResolvedTransition = {
  duration: number;
  cooldown: number;
  easing: EasingFunction;
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

function assertEasing(easing: EasingFunction | undefined, label: string): void {
  if (easing !== undefined && typeof easing !== "function") {
    throw new Error(`${label} must be a function.`);
  }
}

function validateTransitionDuration(duration: number | undefined, label: string): void {
  if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) {
    throw new Error(`${label} must be a finite positive number.`);
  }
}

function validateTransitionCooldown(cooldown: number | undefined, label: string): void {
  if (cooldown !== undefined && (!Number.isFinite(cooldown) || cooldown < 0)) {
    throw new Error(`${label} must be a finite number greater than or equal to 0.`);
  }
}

function validateTransitionOptions<TPhase extends string>(
  transition: FlowTransitionOptions<TPhase> | undefined
): void {
  if (transition === undefined) {
    return;
  }

  validateTransitionDuration(transition.duration, "transition.duration");
  validateTransitionCooldown(transition.cooldown, "transition.cooldown");
  assertEasing(transition.easing, "transition.easing");

  for (const [phase, options] of Object.entries(transition.byPhase ?? {}) as Array<
    [TPhase, FlowTransitionBaseOptions | undefined]
  >) {
    if (options === undefined) {
      continue;
    }

    validateTransitionDuration(options.duration, `transition.byPhase.${phase}.duration`);
    validateTransitionCooldown(options.cooldown, `transition.byPhase.${phase}.cooldown`);
    assertEasing(options.easing, `transition.byPhase.${phase}.easing`);
  }
}

export function createFlowMachine<TPhase extends string>(
  options: CreateFlowMachineOptions<TPhase>
): FlowMachine<TPhase> {
  const { phases } = options;

  assertPhases(phases);

  const legacyTransitionDurationMs = resolveTransitionDurationMs(options.transitionDurationMs);
  const legacyCooldownMs = resolveCooldownMs(options.cooldownMs);
  assertEasing(options.easing, "easing");
  validateTransitionOptions(options.transition);
  const legacyEasing = options.easing ?? linear;
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
  let activeTransitionDurationMs = legacyTransitionDurationMs;
  let activeCooldownMs = legacyCooldownMs;
  let activeEasing = legacyEasing;

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

  const resolveTransitionForPhase = (sourcePhase: TPhase): ResolvedTransition => {
    const phaseTransition = options.transition?.byPhase?.[sourcePhase];

    return {
      duration:
        phaseTransition?.duration ??
        options.transition?.duration ??
        options.transitionDurationMs ??
        DEFAULT_TRANSITION_DURATION_MS,
      cooldown:
        phaseTransition?.cooldown ??
        options.transition?.cooldown ??
        options.cooldownMs ??
        DEFAULT_COOLDOWN_MS,
      easing: phaseTransition?.easing ?? options.transition?.easing ?? options.easing ?? linear
    };
  };

  const navigateToIndex = (targetPhaseIndex: number): void => {
    if (targetPhaseIndex < 0 || targetPhaseIndex >= phases.length) {
      return;
    }

    if (isLocked || isTransitioning || cooldownRemainingMs > 0 || targetPhaseIndex === phaseIndex) {
      return;
    }

    const sourcePhase = getCurrentPhase();
    const resolvedTransition = resolveTransitionForPhase(sourcePhase);

    activeTransitionDurationMs = resolvedTransition.duration;
    activeCooldownMs = resolvedTransition.cooldown;
    activeEasing = resolvedTransition.easing;
    direction = targetPhaseIndex > phaseIndex ? "next" : "prev";
    phaseIndex = targetPhaseIndex;
    progress = 0;
    elapsedMs = 0;
    cooldownRemainingMs = activeCooldownMs;
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

    const rawProgress = clamp01(elapsedMs / activeTransitionDurationMs);
    progress = rawProgress >= 1 ? 1 : clamp01(activeEasing(rawProgress));

    if (rawProgress >= 1) {
      elapsedMs = activeTransitionDurationMs;
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
