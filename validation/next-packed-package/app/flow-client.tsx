"use client";

import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";
import { FlowCanvas } from "./flow-canvas";
import type { Phase } from "./flow-contract";

interface FlowClientProps {
  phases: readonly Phase[];
  title: string;
}

function FlowStatusPanel() {
  const flow = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <section>
      <p>Phase: {flow.phase}</p>
      <p>Progress: {progress.toFixed(2)}</p>
      <button type="button" onClick={flow.next}>
        Next
      </button>
    </section>
  );
}

export function FlowClient({ phases, title }: FlowClientProps) {
  return (
    <FlowProvider phases={phases}>
      <h1>{title}</h1>
      <FlowStatusPanel />
      <FlowCanvas />
    </FlowProvider>
  );
}
