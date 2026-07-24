import { Canvas } from "@react-three/fiber";
import { useRef, useState } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlow, useFlowFrame, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowControls() {
  const { phase, phaseIndex, next, prev, goTo } = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <div>
      <p>Current phase: {phase}</p>
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

function SceneObject() {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [framedProgress, setFramedProgress] = useState(0);

  useFlowFrame<Phase>(({ progress }) => {
    setFramedProgress(progress);

    if (!meshRef.current) {
      return;
    }

    meshRef.current.position.x = progress * 2;
  });

  return (
    <mesh ref={meshRef} scale={1 + framedProgress}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowControls />

      <Canvas>
        <ambientLight />
        <SceneObject />
      </Canvas>
    </FlowProvider>
  );
}
