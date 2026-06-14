import type { EasingFunction } from "./easing";

export type FlowDirection = "next" | "prev" | "none";

export type FlowTransitionBaseOptions = {
  duration?: number;
  cooldown?: number;
  easing?: EasingFunction;
};

export type FlowTransitionOptions<TPhase extends string> = FlowTransitionBaseOptions & {
  byPhase?: Partial<Record<TPhase, FlowTransitionBaseOptions>>;
};

export type FlowSnapshot<TPhase extends string> = {
  phase: TPhase;
  phaseIndex: number;
  progress: number;
  direction: FlowDirection;
  isTransitioning: boolean;
  isLocked: boolean;
};

export type FlowControls<TPhase extends string> = FlowSnapshot<TPhase> & {
  next: () => void;
  prev: () => void;
  goTo: (phase: TPhase) => void;
  lock: () => void;
  unlock: () => void;
};

export type FlowMachine<TPhase extends string> = FlowControls<TPhase> & {
  update: (deltaMs: number) => void;
  getSnapshot: () => FlowSnapshot<TPhase>;
};
