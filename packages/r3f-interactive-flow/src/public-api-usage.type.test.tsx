import { describe, expect, it } from "vitest";

import type * as PublicApi from "r3f-interactive-flow";

declare const FlowProvider: typeof PublicApi.FlowProvider;
declare const useFlow: typeof PublicApi.useFlow;
declare const useFlowFrame: typeof PublicApi.useFlowFrame;
declare const useFlowProgress: typeof PublicApi.useFlowProgress;

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function Controls() {
  const flow = useFlow<Phase>();
  const progress = useFlowProgress();

  flow.next();
  flow.prev();
  flow.goTo("work");

  // @ts-expect-error unknown phase should not be accepted
  flow.goTo("missing");

  flow.phase satisfies Phase;
  progress.toFixed(2);

  return null;
}

function SceneObject() {
  useFlowFrame<Phase>(({ phase, phaseIndex, progress, direction, isTransitioning }, delta) => {
    phase satisfies Phase;
    phaseIndex satisfies number;
    progress satisfies number;
    direction satisfies "next" | "prev" | "none";
    isTransitioning satisfies boolean;
    delta satisfies number;
  });

  return null;
}

function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <Controls />
      <SceneObject />
    </FlowProvider>
  );
}

describe("public API type usage", () => {
  it("type-checks stable root package imports and common phase usage", () => {
    expect(App).toBeTypeOf("function");
  });
});
