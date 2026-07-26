import type { FlowDirection, FlowMachine } from "../core/types";

type NavigationDirection = Exclude<FlowDirection, "none">;

export function navigateAndSyncIfAccepted<TPhase extends string>(
  machine: FlowMachine<TPhase>,
  syncSnapshot: () => void,
  direction: NavigationDirection
): boolean {
  const accepted = direction === "next" ? machine.next() : machine.prev();

  syncSnapshot();

  return accepted;
}
