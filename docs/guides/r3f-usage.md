# React Three Fiber usage

`r3f-interactive-flow` is a small, predictable control layer for phase-based
interactive React Three Fiber websites. This guide explains how to use it with
React Three Fiber safely: where the provider sits, which hooks belong to the DOM
and which belong to the Canvas, and how to drive scene visuals from transition
progress without fighting either library.

It assumes you have read [Getting started](./getting-started.md) and
[Core concepts](./core-concepts.md). All examples use package-root imports only:

```tsx
import { FlowProvider, useFlow, useFlowProgress, useFlowFrame } from "r3f-interactive-flow";
```

This is a guide to safe R3F usage, not a catalog of visual effects. The library
is a control layer, not an animation framework, camera preset library, shader
API, or particle system.

## Mental model

Two systems are involved, and each keeps its own job:

- **React manages phase state.** Which phase you are on, whether a transition is
  running, and any coarse UI derived from that state are React's responsibility.
  React re-renders when that state changes — for example, when a phase settles.
- **React Three Fiber manages frame-based visual updates.** A scene updates many
  times per second inside the Canvas frame loop, mutating Three.js objects
  directly rather than through React re-renders.
- **`r3f-interactive-flow` bridges both** through predictable phase transitions.
  It exposes the same transition snapshot to the React side (`useFlow`,
  `useFlowProgress`) and to the Canvas frame loop (`useFlowFrame`), so both read
  one shared machine instead of drifting out of sync.

The library decides _when_ you are moving, _where_ you are moving, and _how far_
you have moved. Your React code decides what the UI looks like, and your Three.js
code decides what the scene does with that progress.

## Recommended component split

A clean R3F app tends to fall into four layers. Keeping them separate is what
keeps DOM input logic and Canvas scene logic from tangling together.

- **App / provider layer** — renders `FlowProvider` with a stable `phases`
  tuple, and holds both the DOM controls and the `<Canvas>` subtree beneath it.
- **DOM controls layer** — regular page UI rendered _outside_ `<Canvas>`. Uses
  `useFlow` for navigation and `useFlowProgress` for coarse progress display.
- **Canvas layer** — the `<Canvas>` element and its lights, camera, and scene
  objects.
- **Scene object layer** — individual meshes and groups rendered _inside_
  `<Canvas>`. These are the only components that call `useFlowFrame`.

The DOM controls layer and the scene object layer never call each other's hooks.
They only share state through the one `FlowProvider` above them.

## Provider and Canvas placement

`FlowProvider` owns one phase machine. Place it above everything that should
share the same flow state — the DOM controls, any status UI, optional input
helpers, and the `<Canvas>` subtree.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { FlowProvider } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

export function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <Controls />

      <Canvas>
        <ambientLight />
        <SceneObject />
      </Canvas>
    </FlowProvider>
  );
}
```

Note that `<Canvas>` sits _under_ `FlowProvider`, not the other way around.
`<Canvas>` renders a separate React reconciler for the Three.js scene, so a
component inside it can only reach the flow machine when the provider is an
ancestor of the `<Canvas>` element itself. DOM controls and Canvas objects then
share one machine while living in different parts of the tree.

Keep the `phases` tuple stable across renders. Define it at module scope, or
memoize it if it is derived at runtime.

## DOM/UI controls

DOM controls are ordinary React components rendered outside `<Canvas>`. Use
`useFlow` to read the current phase and move between phases, and `useFlowProgress`
for a coarse progress readout.

```tsx
import { useFlow, useFlowProgress } from "r3f-interactive-flow";

function Controls() {
  const { phase, phaseIndex, next, prev, goTo } = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <div>
      <p>
        Phase {phaseIndex + 1}: {phase}
      </p>
      <p>Progress: {Math.round(progress * 100)}%</p>
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Contact</button>
    </div>
  );
}
```

`useFlow` and `useFlowProgress` are DOM/React hooks. They work anywhere under
`FlowProvider` and do not require a Canvas. `next`, `prev`, and `goTo` are safe to
call unconditionally — out-of-bounds or blocked calls are ignored — so you can
wire them straight to buttons.

## Canvas-bound scene updates

For per-frame scene work, use `useFlowFrame`. It delivers the same transition
snapshot inside the React Three Fiber frame loop, alongside the frame `delta`.

`useFlowFrame` follows the React Three Fiber `useFrame` rule: it must only be
called from a component that is rendered inside `<Canvas>`. It also requires
`FlowProvider` as an ancestor. Calling it from a DOM component outside `<Canvas>`
is not supported — it is a Canvas-bound hook, exactly like `useFrame`.

The callback receives the flow state and the frame delta:

```tsx
import { useRef } from "react";
import type * as THREE from "three";
import { useFlowFrame } from "r3f-interactive-flow";

function SceneObject() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.visible = phase !== "contact";
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

The state object gives you `phase`, `phaseIndex`, `progress`, `direction`, and
`isTransitioning`. Read whatever you need and mutate refs or Three.js objects
directly. The `delta` argument is the seconds elapsed since the previous frame,
useful for frame-rate-independent motion.

## Using transition progress in a scene

`progress` is a normalized value from `0` (transition just started) to `1`
(transition complete). Inside `useFlowFrame` it is the natural driver for
continuous scene changes: map it onto a position, rotation, opacity, or any other
Three.js value.

```tsx
function FlowMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.position.x = phase === "work" ? progress * 2 : 0;
    meshRef.current.rotation.y = progress * Math.PI;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

Because the callback runs every frame, `progress` is always current without any
React re-render. The library reads the same machine on the DOM and Canvas sides,
so a DOM progress label and a Canvas mesh driven by the same transition stay in
agreement.

## What not to put in React state

A running transition changes `progress` continuously — potentially 60 or more
times per second. Do not copy that value into React state each frame to animate
the scene.

```tsx
// Do not do this: a state write every frame forces a React re-render every frame.
function Broken() {
  const [progress, setProgress] = useState(0);
  useFlowFrame(({ progress }) => setProgress(progress));
  // ...
}
```

Writing to React state every frame triggers a re-render every frame, which is
wasteful and works against how both libraries are designed. React is built around
discrete state changes; R3F is built to mutate the scene imperatively inside its
own loop. So:

- Use **React state** (`useFlow`, `useFlowProgress`) for discrete, low-frequency
  values and coarse UI — labels, buttons, progress bars, status text.
- Use the **frame loop** (`useFlowFrame`) for continuous, per-frame visual work —
  positions, rotations, material values. Keep those values in refs and Three.js
  objects, not in React state.

`useFlowProgress` is intentionally suited to UI snapshots. It is not the tool for
animating a scene frame by frame — that is what `useFlowFrame` is for.

## Troubleshooting

**`useFlowFrame` throws or the scene never updates.** `useFlowFrame` must be
called from a component rendered inside `<Canvas>` and under `FlowProvider`. If
the component lives outside `<Canvas>`, move it into the Canvas subtree. If it is
outside `FlowProvider`, move the provider up so it wraps the `<Canvas>`.

**Cannot read flow state inside a Canvas component.** `<Canvas>` starts a
separate reconciler, so a `FlowProvider` rendered _inside_ `<Canvas>` will not be
visible to DOM controls, and one rendered such that it is not an ancestor of
`<Canvas>` will not be visible to scene objects. Place a single `FlowProvider`
above the `<Canvas>` so both sides share it.

**The scene stutters or re-renders constantly.** You are probably writing
frame values into React state. Move that work into `useFlowFrame` and mutate refs
or Three.js objects instead of calling a state setter each frame.

**DOM controls and the scene disagree.** Make sure they share one
`FlowProvider`. Two providers create two independent machines; consolidate to a
single provider above both layers.

**`goTo`, `next`, or `prev` seem to do nothing.** Calls are ignored when they are
out of bounds, or blocked by an active transition, a lock, or a cooldown. This is
expected — see [Core concepts](./core-concepts.md) for locks and cooldowns.

## Next steps

- [Input handling](./input-handling.md) — wheel, touch, and keyboard input hooks,
  and how they respect locks and cooldowns.
- [Common mistakes](./common-mistakes.md) — anti-patterns to avoid and how to fix
  them.
- [Next.js usage](./nextjs-usage.md) — safe Client Component usage in the App
  Router.
