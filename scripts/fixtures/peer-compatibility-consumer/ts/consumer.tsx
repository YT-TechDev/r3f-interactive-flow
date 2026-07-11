import { Canvas } from "@react-three/fiber";
import { FlowProvider, useFlow, useFlowProgress, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work"] as const;

function Scene() {
  useFlowFrame(() => undefined);
  return null;
}

function Controls() {
  const { next } = useFlow<(typeof phases)[number]>();
  const progress = useFlowProgress();

  return (
    <button onClick={next} data-progress={progress}>
      Next
    </button>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <Controls />
      <Canvas>
        <Scene />
      </Canvas>
    </FlowProvider>
  );
}
