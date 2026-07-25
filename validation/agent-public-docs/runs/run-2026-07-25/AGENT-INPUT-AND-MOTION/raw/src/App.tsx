import { Canvas } from "@react-three/fiber";
import { useRef, useState } from "react";
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

type MotionMode = "normal" | "reduced";

const transitionByMotionMode = {
  normal: { duration: 700, cooldown: 250 },
  reduced: { duration: 0, cooldown: 250 }
} as const;

const inputIgnore = ["[data-flow-ignore]"] as const;

const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

function FlowInputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500, ignore: inputIgnore });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500, ignore: inputIgnore });
  useKeyboardInput<Phase>({ cooldown: 300, keys: keyboardKeys });

  return null;
}

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

function MotionToggle({
  motionMode,
  onChange
}: {
  motionMode: MotionMode;
  onChange: (motionMode: MotionMode) => void;
}) {
  return (
    <fieldset>
      <legend>Motion</legend>
      <label>
        <input
          type="checkbox"
          checked={motionMode === "reduced"}
          onChange={(event) => onChange(event.currentTarget.checked ? "reduced" : "normal")}
        />
        Reduce flow transition motion
      </label>
    </fieldset>
  );
}

function SceneObject({ motionMode }: { motionMode: MotionMode }) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const motionScale = motionMode === "reduced" ? 0.15 : 1;

  useFlowFrame<Phase>(({ progress }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta * motionScale;
    meshRef.current.position.x = progress * 2 * motionScale;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export function App() {
  const [motionMode, setMotionMode] = useState<MotionMode>("normal");

  return (
    <>
      <MotionToggle motionMode={motionMode} onChange={setMotionMode} />

      <FlowProvider key={motionMode} phases={phases} transition={transitionByMotionMode[motionMode]}>
        <FlowControls />
        <FlowInputLayer />

        <Canvas>
          <ambientLight />
          <SceneObject motionMode={motionMode} />
        </Canvas>
      </FlowProvider>
    </>
  );
}
