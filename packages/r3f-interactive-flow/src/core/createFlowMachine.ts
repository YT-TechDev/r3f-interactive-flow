import type { FlowControls } from "./types";

export type CreateFlowMachineOptions<TPhase extends string> = {
  phases: readonly TPhase[];
  initialPhase?: TPhase;
};

export function createFlowMachine<TPhase extends string>(
  _options: CreateFlowMachineOptions<TPhase>
): FlowControls<TPhase> {
  throw new Error("createFlowMachine is not implemented yet.");
}
