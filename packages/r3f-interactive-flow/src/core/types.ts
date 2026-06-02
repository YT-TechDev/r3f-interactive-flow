export type FlowDirection = "next" | "prev" | "none";

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
  update: (deltaMs: number) => void;
  getSnapshot: () => FlowSnapshot<TPhase>;
};
