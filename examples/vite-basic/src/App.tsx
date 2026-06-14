import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;

const ignore = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  "[contenteditable]",
  "[data-flow-ignore]"
] as const;

type Phase = (typeof phases)[number];

function FlowInputs() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500, ignore });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500, ignore });
  useKeyboardInput<Phase>({
    keys: {
      next: ["ArrowDown", "ArrowRight", "PageDown", " "],
      prev: ["ArrowUp", "ArrowLeft", "PageUp"]
    },
    cooldown: 500
  });

  return null;
}

function FlowControlsPanel() {
  const flow = useFlow<Phase>();

  return (
    <section className="panel">
      <p className="eyebrow">Flow state</p>
      <h1>r3f-interactive-flow</h1>
      <dl className="state-grid">
        <div>
          <dt>Current phase</dt>
          <dd>{flow.phase}</dd>
        </div>
        <div>
          <dt>Phase index</dt>
          <dd>{flow.phaseIndex}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{flow.progress.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Direction</dt>
          <dd>{flow.direction}</dd>
        </div>
        <div>
          <dt>Transitioning</dt>
          <dd>{String(flow.isTransitioning)}</dd>
        </div>
      </dl>

      <div className="button-row">
        <button type="button" onClick={flow.prev}>
          Prev
        </button>
        <button type="button" onClick={flow.next}>
          Next
        </button>
        <button type="button" onClick={() => flow.goTo("intro")}>
          Go to Intro
        </button>
        <button type="button" onClick={() => flow.goTo("work")}>
          Go to Work
        </button>
        <button type="button" onClick={() => flow.goTo("contact")}>
          Go to Contact
        </button>
      </div>

      <p className="hint">
        Try wheel scrolling, vertical touch swipes, or keyboard arrows / PageUp / PageDown / Space.
      </p>
    </section>
  );
}

function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame(({ progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = progress * Math.PI * 2;
    meshRef.current.scale.setScalar(1 + progress * 0.5);
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

function FlowCanvas() {
  return (
    <div className="canvas-shell">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 3, 3]} intensity={1.4} />
        <FlowBox />
      </Canvas>
    </div>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases} transition={{ cooldown: 500 }}>
      <FlowInputs />
      <main className="app-shell">
        <FlowControlsPanel />
        <FlowCanvas />
      </main>
    </FlowProvider>
  );
}
