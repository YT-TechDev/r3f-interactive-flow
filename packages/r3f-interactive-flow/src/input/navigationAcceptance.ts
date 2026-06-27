import type { FlowDirection, FlowMachine, FlowSnapshot } from "../core/types";

type NavigationDirection = Exclude<FlowDirection, "none">;

function snapshotsMatch<TPhase extends string>(
  before: FlowSnapshot<TPhase>,
  after: FlowSnapshot<TPhase>
): boolean {
  return (
    before.phase === after.phase &&
    before.phaseIndex === after.phaseIndex &&
    before.progress === after.progress &&
    before.direction === after.direction &&
    before.isTransitioning === after.isTransitioning &&
    before.isLocked === after.isLocked
  );
}

export function navigateAndSyncIfAccepted<TPhase extends string>(
  machine: FlowMachine<TPhase>,
  syncSnapshot: () => void,
  direction: NavigationDirection
): boolean {
  const before = machine.getSnapshot();

  if (direction === "next") {
    machine.next();
  } else {
    machine.prev();
  }

  const after = machine.getSnapshot();
  syncSnapshot();

  return !snapshotsMatch(before, after);
}
