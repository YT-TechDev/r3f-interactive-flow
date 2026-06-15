import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useFlowProgress,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

const flowTransition = { cooldown: 500 } as const;

const inputIgnore = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "form",
  "[contenteditable='true']",
  "[data-flow-ignore]"
] as const;

const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

function FlowInputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500, ignore: inputIgnore });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500, ignore: inputIgnore });
  useKeyboardInput<Phase>({ keys: keyboardKeys, cooldown: 500 });

  return null;
}

function FlowControlsPanel() {
  const flow = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <section className="panel" data-flow-ignore>
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
          <dd>{progress.toFixed(2)}</dd>
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
          Intro
        </button>
        <button type="button" onClick={() => flow.goTo("work")}>
          Work
        </button>
        <button type="button" onClick={() => flow.goTo("contact")}>
          Contact
        </button>
      </div>

      <p className="hint">
        Try wheel scrolling, vertical touch swipes, arrow keys, or PageUp / PageDown.
      </p>
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
    <FlowProvider phases={phases} transition={flowTransition}>
      <FlowInputLayer />
      <main className="app-shell">
        <FlowControlsPanel />
        <FlowCanvas />
      </main>
    </FlowProvider>
  );
}
