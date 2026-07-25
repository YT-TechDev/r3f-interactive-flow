import { FlowProvider, useFlow } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowControls() {
  const { phase, next, prev } = useFlow<Phase>();

  return (
    <div>
      <p>Current phase: {phase}</p>
      <button type="button" onClick={prev}>
        Previous
      </button>
      <button type="button" onClick={next}>
        Next
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
