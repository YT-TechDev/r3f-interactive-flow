import { FlowProvider, useFlow, useFlowProgress, useReducedMotion } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowControls() {
  const { phase, phaseIndex, next, prev, goTo } = useFlow<Phase>();
  const progress = useFlowProgress();
  const reducedMotion = useReducedMotion();

  return (
    <div>
      <p>Current phase: {phase}</p>
      <p>Reduced motion: {String(reducedMotion)}</p>
      <progress max={1} value={progress} aria-label="Flow transition progress" />
      <button type="button" onClick={prev} disabled={phaseIndex === 0}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={phaseIndex === phases.length - 1}>
        Next
      </button>
      <button type="button" onClick={() => goTo("contact")}>
        Contact
      </button>
    </div>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowControls />
    </FlowProvider>
  );
}
