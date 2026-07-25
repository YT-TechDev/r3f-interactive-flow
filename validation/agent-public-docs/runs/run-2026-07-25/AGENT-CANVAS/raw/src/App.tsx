import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
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

  useFlowFrame<Phase>(({ phase, progress }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.position.x = phase === "work" ? progress * 2 : 0;
    meshRef.current.visible = phase !== "contact";
  });

  return (
    <mesh ref={meshRef}>
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
