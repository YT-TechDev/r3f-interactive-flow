import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowControls() {
  const { phase, phaseIndex, next, prev, goTo } = useFlow<Phase>();

  return (
    <nav>
      <p>
        Phase {phaseIndex + 1} / {phases.length}: {phase}
      </p>
      <button type="button" onClick={prev} disabled={phaseIndex === 0}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={phaseIndex === phases.length - 1}>
        Next
      </button>
      <button type="button" onClick={() => goTo("contact")}>
        Contact
      </button>
    </nav>
  );
}

function FlowProgressBar() {
  const progress = useFlowProgress();

  return <progress max={1} value={progress} aria-label="Flow transition progress" />;
}

export function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <h1>Experience</h1>
      <FlowControls />
      <FlowProgressBar />
    </FlowProvider>
  );
}
