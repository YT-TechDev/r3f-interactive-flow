# Common mistakes

This guide covers common integration mistakes when using
`r3f-interactive-flow` in React and React Three Fiber apps. It is written for
both people and AI coding agents: keep hook placement clear, import only from the
package root, and use the library as a small predictable control layer rather
than a full application framework.

If you are new to the package, start with [Getting started](./getting-started.md)
and [Core concepts](./core-concepts.md). For more placement details, see
[React Three Fiber usage](./r3f-usage.md), [Input handling](./input-handling.md),
and [Next.js usage](./nextjs-usage.md).

## Calling `useFlowFrame` outside `<Canvas>`

`useFlowFrame` is Canvas-bound. It follows the same placement rule as React Three
Fiber's `useFrame`: call it only from a component rendered inside `<Canvas>`.
The component must also be under the same `FlowProvider` that owns the phase
machine.

### Mistake

```tsx
import { Canvas } from "@react-three/fiber";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;

function PageShell() {
  useFlowFrame(({ progress }) => {
    console.log(progress);
  });

  return <Canvas>{/* scene */}</Canvas>;
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <PageShell />
    </FlowProvider>
  );
}
```

`PageShell` renders outside the Canvas scene tree, so it is the wrong place for a
Canvas-bound frame hook.

### Better

```tsx
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = progress * Math.PI;
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
      <Canvas>
        <FlowMesh />
      </Canvas>
    </FlowProvider>
  );
}
```

Keep per-frame scene work inside scene components. Use `useFlow` and
`useFlowProgress` for regular React UI outside Canvas.

## Calling React or R3F hooks in the wrong tree

React hooks, R3F hooks, and browser input hooks each belong to different parts of
the app.

- `useFlow` and `useFlowProgress` are regular React hooks. Call them under
  `FlowProvider`; they do not need Canvas.
- `useFlowFrame` is an R3F frame hook. Call it from Canvas-rendered components.
- `useWheelInput`, `useTouchInput`, and `useKeyboardInput` are browser input
  hooks. Mount them from a client-side DOM/input layer under `FlowProvider` by
  default.

### Mistake

```tsx
import { useThree } from "@react-three/fiber";
import { useFlow } from "r3f-interactive-flow";

function Header() {
  const { camera } = useThree();
  const { phase } = useFlow();

  return <p>{phase}</p>;
}
```

`Header` is regular DOM UI, so it should not call R3F hooks such as `useThree`.
The same rule applies to `useFrame` and to any hook that expects the Canvas
reconciler.

### Better

```tsx
import { useFlow } from "r3f-interactive-flow";

function Header() {
  const { phase } = useFlow();

  return <p>{phase}</p>;
}
```

If a scene object needs camera or frame-loop access, keep that logic in a
component rendered inside `<Canvas>`. If a DOM component needs flow state, read it
through `useFlow` or `useFlowProgress` under `FlowProvider`.

## Importing from internal paths

The public API is exported from the package root. Do not import from internal
entry points, build output, or source files. Internal paths can change without
being treated as public API.

### Mistake

Do not import from internal paths such as:

- `r3f-interactive-flow/react`
- `r3f-interactive-flow/r3f`
- `r3f-interactive-flow/input`
- `r3f-interactive-flow/src/*`
- `r3f-interactive-flow/dist/*`

Also avoid local imports that reach into this package's `src/` or `dist/`
folders.

### Better

```tsx
import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";
```

Package-root imports keep examples portable and keep your app aligned with the
supported public surface.

## Creating phase arrays inline on every render

A phase list is usually intended to be a stable ordered tuple. Creating it inline
inside a component makes a new array on every render, which can reset or churn
provider setup in ways you did not intend.

### Mistake

```tsx
import { FlowProvider } from "r3f-interactive-flow";

export function App() {
  return (
    <FlowProvider phases={["intro", "work", "contact"]}>
      <Experience />
    </FlowProvider>
  );
}
```

### Better

```tsx
import { FlowProvider } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

export function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <Experience />
    </FlowProvider>
  );
}
```

Define static phases at module scope. If phases are derived from runtime data,
use normal React memoization so the array identity changes only when the actual
phase set changes.

## Copying high-frequency frame values into React state

Transition progress changes frequently during a transition. Copying every frame
into React state forces React to re-render at frame-loop speed and works against
React Three Fiber's imperative scene update model.

### Mistake

```tsx
import { useState } from "react";
import { useFlowFrame } from "r3f-interactive-flow";

function FlowMesh() {
  const [progress, setProgress] = useState(0);

  useFlowFrame((state) => {
    setProgress(state.progress);
  });

  return (
    <mesh scale={1 + progress}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

### Better

```tsx
import { useRef } from "react";
import type * as THREE from "three";
import { useFlowFrame } from "r3f-interactive-flow";

function FlowMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame(({ progress }) => {
    if (!meshRef.current) {
      return;
    }

    const scale = 1 + progress;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

Use React state for stable UI snapshots and discrete UI changes. Use
`useFlowFrame` with refs for per-frame scene values.

## Mounting input hooks inside mesh or scene components by default

Wheel, touch, and keyboard hooks attach browser input behavior. They should
usually live in a small DOM/input layer under `FlowProvider`, not inside every
mesh or scene object.

### Mistake

```tsx
import { useWheelInput } from "r3f-interactive-flow";

function ProductMesh() {
  useWheelInput();

  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

Mounting input hooks inside scene objects makes input behavior harder to audit
and can accidentally duplicate listeners when scene objects mount more than once.

### Better

```tsx
import { FlowProvider, useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";

const phases = ["intro", "details", "outro"] as const;

function FlowInputLayer() {
  useWheelInput();
  useTouchInput();
  useKeyboardInput();

  return null;
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowInputLayer />
      <Experience />
    </FlowProvider>
  );
}
```

See [Input handling](./input-handling.md) for thresholds, cooldowns, ignore
selectors, and enabled flags.

## Treating the package as a larger framework

`r3f-interactive-flow` is intentionally small. It coordinates named phases,
transitions, progress, and optional input helpers. It is not a complete animation
framework, router, visual effects library, camera preset library, shader library,
particle library, GSAP wrapper, Framer Motion wrapper, or template system.

### Mistake

```tsx
import { useFlow } from "r3f-interactive-flow";

function RouteLikePage() {
  const { goTo } = useFlow();

  return <button onClick={() => goTo("/pricing")}>Open pricing route</button>;
}
```

Flow phases are app-defined states, not route URLs. The package does not replace
your framework router, your animation library, or your scene architecture.

### Better

```tsx
import { useFlow } from "r3f-interactive-flow";

function SectionControls() {
  const { goTo } = useFlow<"intro" | "features" | "contact">();

  return <button onClick={() => goTo("contact")}>Show contact section</button>;
}
```

Use the package to keep a small interactive flow predictable. Compose it with
your own routing, animation choices, camera logic, shaders, particles, effects,
and templates only where those concerns belong in your app.

## Quick checklist

- Import only from `"r3f-interactive-flow"`.
- Put `FlowProvider` above the DOM controls and the `<Canvas>` that share one
  phase machine.
- Call `useFlowFrame` only inside Canvas-rendered components.
- Keep R3F hooks out of DOM components.
- Keep browser input hooks in a DOM/input layer by default.
- Keep phase arrays stable when they represent a fixed ordered tuple.
- Avoid React state writes for per-frame values.
- Keep the library's role focused: predictable phase flow, not a full framework.
