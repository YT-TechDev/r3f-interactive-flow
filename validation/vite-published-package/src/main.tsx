import { Canvas } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Mesh } from "three";
import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useFlowProgress,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";
import "./styles.css";

const phases = ["intro", "overview", "detail", "compare", "summary", "contact"] as const;
type Phase = (typeof phases)[number];

const inputIgnore = ["[data-flow-ignore]"] as const;

const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

type MotionMode = "normal" | "reduced";

const transitionMs: Record<MotionMode, number> = {
  normal: 900,
  reduced: 180
};

function FlowInputs({ useUnresolvedTarget }: { useUnresolvedTarget: boolean }) {
  const unresolvedTarget = useRef<HTMLElement>(null);
  const target = useUnresolvedTarget ? unresolvedTarget : undefined;

  useWheelInput<Phase>({
    target,
    ignore: inputIgnore,
    threshold: 48,
    cooldown: 250
  });
  useTouchInput<Phase>({
    target,
    ignore: inputIgnore,
    threshold: 44,
    cooldown: 250
  });
  useKeyboardInput<Phase>({
    target,
    keys: keyboardKeys,
    cooldown: 250,
    ignoreWhenTyping: true
  });

  return null;
}

type InputTrace = {
  type: string;
  defaultPrevented: boolean;
  target: string;
};

function InputEventTrace() {
  const [trace, setTrace] = useState<InputTrace | null>(null);

  useEffect(() => {
    const recordEvent = (event: Event): void => {
      const type = event.type;
      const target = event.target;
      const targetName = target instanceof Element ? target.tagName.toLowerCase() : "non-element";

      queueMicrotask(() => {
        setTrace({
          type,
          defaultPrevented: event.defaultPrevented,
          target: targetName
        });
      });
    };

    window.addEventListener("wheel", recordEvent);
    window.addEventListener("touchmove", recordEvent);
    window.addEventListener("touchend", recordEvent);
    window.addEventListener("keydown", recordEvent);

    return () => {
      window.removeEventListener("wheel", recordEvent);
      window.removeEventListener("touchmove", recordEvent);
      window.removeEventListener("touchend", recordEvent);
      window.removeEventListener("keydown", recordEvent);
    };
  }, []);

  return (
    <div className="trace-output" aria-live="polite">
      <strong>Last input event trace</strong>
      {trace ? (
        <dl>
          <div>
            <dt>Type</dt>
            <dd>{trace.type}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{trace.target}</dd>
          </div>
          <div>
            <dt>Final defaultPrevented</dt>
            <dd>{String(trace.defaultPrevented)}</dd>
          </div>
        </dl>
      ) : (
        <p>No wheel, touchmove, touchend, or keydown event observed yet.</p>
      )}
    </div>
  );
}

function FlowDashboard() {
  const flow = useFlow<Phase>();
  const progress = useFlowProgress();
  const atFirst = flow.phaseIndex === 0;
  const atLast = flow.phaseIndex === phases.length - 1;

  return (
    <section className="panel hero" aria-labelledby="flow-heading">
      <div>
        <p className="eyebrow">Package-root API validation</p>
        <h1 id="flow-heading">Published package usage experience</h1>
        <p>
          Wheel, touch, keyboard, buttons, and direct phase controls all drive one FlowProvider
          while DOM status and the Canvas subtree observe the same phase state.
        </p>
      </div>

      <dl className="status-grid" aria-label="Current flow status">
        <div>
          <dt>Current phase</dt>
          <dd>{flow.phase}</dd>
        </div>
        <div>
          <dt>Phase index</dt>
          <dd>
            {flow.phaseIndex + 1} / {phases.length}
          </dd>
        </div>
        <div>
          <dt>Transition progress</dt>
          <dd>{Math.round(progress * 100)}%</dd>
        </div>
        <div>
          <dt>Direction</dt>
          <dd>{flow.direction}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{flow.isTransitioning ? "transitioning" : "idle"}</dd>
        </div>
        <div>
          <dt>Locked</dt>
          <dd>{flow.isLocked ? "locked" : "unlocked"}</dd>
        </div>
      </dl>

      <div className="button-row" aria-label="Sequential navigation">
        <button type="button" onClick={flow.prev} disabled={atFirst}>
          Previous
        </button>
        <button type="button" onClick={flow.next} disabled={atLast}>
          Next
        </button>
      </div>

      <div className="phase-controls" aria-label="Direct phase navigation">
        {phases.map((phase) => (
          <button
            key={phase}
            type="button"
            onClick={() => flow.goTo(phase)}
            disabled={flow.phase === phase}
          >
            {phase}
          </button>
        ))}
      </div>
    </section>
  );
}

function FlowLockControls() {
  const flow = useFlow<Phase>();

  return (
    <>
      <button type="button" onClick={flow.lock} disabled={flow.isLocked}>
        Lock
      </button>
      <button type="button" onClick={flow.unlock} disabled={!flow.isLocked}>
        Unlock
      </button>
    </>
  );
}

function NativeControls() {
  return (
    <section className="panel" aria-labelledby="native-heading">
      <h2 id="native-heading">Native actionable controls</h2>
      <p>
        This area is intentionally not marked with data-flow-ignore so browser validation can
        confirm the library preserves native actionable behavior.
      </p>
      <div className="form-grid">
        <label>
          Text input
          <input placeholder="Type without changing phase" />
        </label>
        <label>
          Textarea
          <textarea rows={3} defaultValue="Editable content" />
        </label>
        <label>
          Select
          <select defaultValue="overview">
            {phases.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-control">
          <input type="checkbox" /> Toggle option
        </label>
        <button type="button">Regular button</button>
        <a href="https://github.com/YT-TechDev/r3f-interactive-flow">Regular anchor</a>
        <div className="editable-region" contentEditable suppressContentEditableWarning>
          Contenteditable region: edit this text without changing phase.
        </div>
      </div>
    </section>
  );
}

function IgnoredScrollRegion() {
  return (
    <section className="panel" aria-labelledby="ignored-heading">
      <h2 id="ignored-heading">Explicit ignored nested scroll region</h2>
      <div className="nested-scroll" data-flow-ignore tabIndex={0}>
        {Array.from({ length: 14 }, (_, index) => (
          <p key={index}>Nested scroll item {index + 1}: wheel and touch gestures stay here.</p>
        ))}
      </div>
    </section>
  );
}

function PhaseCube({ motionMode }: { motionMode: MotionMode }) {
  const meshRef = useRef<Mesh>(null);

  useFlowFrame<Phase>(({ phaseIndex, progress, direction }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const motionScale = motionMode === "reduced" ? 0.15 : 1;
    mesh.rotation.x += delta * 0.35 * motionScale;
    mesh.rotation.y = phaseIndex * 0.35 + progress * (direction === "prev" ? -0.3 : 0.3);
    mesh.position.x = (phaseIndex - 2.5) * 0.22 * motionScale;
  });

  return (
    <mesh ref={meshRef} position={[-0.8, 0, 0]}>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial color="#7dd3fc" />
    </mesh>
  );
}

function PhaseSphere({ motionMode }: { motionMode: MotionMode }) {
  const meshRef = useRef<Mesh>(null);

  useFlowFrame<Phase>(({ progress, direction, isTransitioning }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const directionOffset = direction === "prev" ? -1 : direction === "next" ? 1 : 0;
    const motionScale = motionMode === "reduced" ? 0.25 : 1;
    const scale = 0.7 + (isTransitioning ? progress * 0.45 * motionScale : 0);
    mesh.scale.setScalar(scale);
    mesh.position.y = directionOffset * progress * 0.35 * motionScale;
  });

  return (
    <mesh ref={meshRef} position={[0.85, 0, 0]}>
      <sphereGeometry args={[0.45, 32, 24]} />
      <meshStandardMaterial color="#fca5a5" />
    </mesh>
  );
}

function FrameObserverBridge({ id }: { id: string }) {
  useFlowFrame<Phase>(({ phase, phaseIndex, progress, direction, isTransitioning }, delta) => {
    const output = document.querySelector<HTMLOutputElement>(`[data-observer-output="${id}"]`);
    if (!output) return;

    output.value = JSON.stringify({
      observer: id,
      phase,
      phaseIndex,
      progress: Number(progress.toFixed(3)),
      direction,
      isTransitioning,
      delta: Number(delta.toFixed(4))
    });
  });

  return null;
}

function Scene({ motionMode }: { motionMode: MotionMode }) {
  return (
    <Canvas className="canvas" camera={{ position: [0, 0, 4], fov: 50 }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 2, 3]} intensity={1.2} />
      <PhaseCube motionMode={motionMode} />
      <PhaseSphere motionMode={motionMode} />
      <FrameObserverBridge id="observer-a" />
      <FrameObserverBridge id="observer-b" />
    </Canvas>
  );
}

function Experience({ motionMode }: { motionMode: MotionMode }) {
  const [canvasMounted, setCanvasMounted] = useState(true);
  const [useUnresolvedTarget, setUseUnresolvedTarget] = useState(false);

  return (
    <FlowProvider
      key={motionMode}
      phases={phases}
      transitionDurationMs={transitionMs[motionMode]}
      cooldownMs={240}
    >
      <FlowInputs useUnresolvedTarget={useUnresolvedTarget} />
      <InputEventTrace />
      <main className="app-shell">
        <FlowDashboard />
        <section className="panel controls-panel" aria-labelledby="runtime-heading">
          <h2 id="runtime-heading">Runtime validation controls</h2>
          <div className="button-row">
            <button type="button" onClick={() => setCanvasMounted((mounted) => !mounted)}>
              {canvasMounted ? "Unmount Canvas" : "Remount Canvas"}
            </button>
            <FlowLockControls />
            <button
              type="button"
              aria-pressed={useUnresolvedTarget}
              onClick={() => setUseUnresolvedTarget((enabled) => !enabled)}
            >
              {useUnresolvedTarget ? "Use normal window input" : "Use unresolved explicit ref"}
            </button>
          </div>
          <p>Input target mode: {useUnresolvedTarget ? "unresolved explicit ref" : "window"}</p>
          <p>
            Canvas can unmount without unmounting FlowProvider; DOM phase state and useFlowProgress
            remain visible while no useFlowFrame consumer is mounted.
          </p>
          <p>
            Reduced motion is configured outside the provider and intentionally remounts this keyed
            provider instance, resetting flow state.
          </p>
        </section>
        <NativeControls />
        <IgnoredScrollRegion />
        <section className="panel observer-panel" aria-labelledby="observer-heading">
          <h2 id="observer-heading">Read-only Canvas observer samples</h2>
          <output
            data-observer-output="observer-a"
            className="observer-output"
            aria-label="observer-a frame sample"
          />
          <output
            data-observer-output="observer-b"
            className="observer-output"
            aria-label="observer-b frame sample"
          />
        </section>
        <section className="scene-panel" aria-label="Canvas validation surface">
          {canvasMounted ? (
            <Scene motionMode={motionMode} />
          ) : (
            <div className="canvas-empty">Canvas unmounted</div>
          )}
        </section>
      </main>
    </FlowProvider>
  );
}

function App() {
  const [motionMode, setMotionMode] = useState<MotionMode>("normal");

  return (
    <>
      <div className="mode-toggle">
        <button
          type="button"
          aria-pressed={motionMode === "reduced"}
          onClick={() => setMotionMode((mode) => (mode === "normal" ? "reduced" : "normal"))}
        >
          {motionMode === "normal" ? "Switch to reduced motion" : "Switch to normal motion"}
        </button>
      </div>
      <Experience motionMode={motionMode} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
