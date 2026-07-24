import { Canvas } from "@react-three/fiber";
import { StrictMode, useRef } from "react";
import { createRoot } from "react-dom/client";
import type * as THREE from "three";
import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useFlowProgress,
  useWheelInput
} from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowInputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500 });

  return null;
}

function FlowStatusPanel() {
  const flow = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <section data-flow-ignore>
      <p>Phase: {flow.phase}</p>
      <p>Progress: {progress.toFixed(2)}</p>
      <button type="button" onClick={flow.next}>
        Next
      </button>
    </section>
  );
}

function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = progress * Math.PI * 2;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowInputLayer />
      <FlowStatusPanel />
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.8} />
        <FlowBox />
      </Canvas>
    </FlowProvider>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
