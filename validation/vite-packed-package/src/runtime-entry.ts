import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useFlowProgress,
  useWheelInput
} from "r3f-interactive-flow";

const expectedRuntimeBindings = [
  FlowProvider,
  useFlow,
  useFlowProgress,
  useFlowFrame,
  useWheelInput
];

export function verifyRuntimeBindings(): boolean {
  return expectedRuntimeBindings.every((binding) => typeof binding === "function");
}
