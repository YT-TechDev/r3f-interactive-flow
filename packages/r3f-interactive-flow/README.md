# r3f-interactive-flow

`r3f-interactive-flow` is a small React Three Fiber utility for predictable phase-based interactive flow control in client-side React/R3F sites.

It helps an app describe a known list of phases, move between those phases with `next`, `prev`, and `goTo`, read transition progress from DOM/UI, connect optional browser input hooks, and bridge the same flow state into Canvas-bound frame updates with `useFlowFrame`.

This README describes the current stable public API ahead of v2.0.0 release preparation. It does not announce a v2.0.0 release.

## Public API

Import public APIs from the package root:

```ts
import {
  FlowProvider,
  useFlow,
  useFlowProgress,
  useFlowFrame,
  useWheelInput,
  useTouchInput,
  useKeyboardInput
} from "r3f-interactive-flow";
```

Public type exports are limited to the documented provider, frame bridge, transition, and input option types:

```ts
import type {
  FlowFrameCallback,
  FlowFrameState,
  FlowInputTarget,
  FlowTransitionBaseOptions,
  FlowTransitionOptions,
  UseKeyboardInputOptions,
  UseTouchInputOptions,
  UseWheelInputOptions
} from "r3f-interactive-flow";
```

Do not import from internal package paths such as `r3f-interactive-flow/react`, `r3f-interactive-flow/r3f`, or `r3f-interactive-flow/input`; those paths are not public package exports.

## Install

```bash
pnpm add r3f-interactive-flow three @react-three/fiber react react-dom
```

npm and yarn equivalents are also fine:

```bash
npm install r3f-interactive-flow three @react-three/fiber react react-dom
yarn add r3f-interactive-flow three @react-three/fiber react react-dom
```

## Peer dependencies

`react`, `react-dom`, `three`, and `@react-three/fiber` are peer dependencies and should be installed by the application.

```json
{
  "@react-three/fiber": ">=8.0.0 <10.0.0",
  "react": ">=18.0.0 <20.0.0",
  "react-dom": ">=18.0.0 <20.0.0",
  "three": ">=0.150.0 <1.0.0"
}
```

The package does not add Next.js, `@react-three/drei`, GSAP, Framer Motion, or any visual-effect library as a dependency.

## Minimal setup

Define phases as a stable const tuple, wrap the shared DOM and Canvas subtree with `FlowProvider`, and consume flow state from hooks under the provider.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlow, useFlowFrame, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function Controls() {
  const { phase, next, prev, goTo } = useFlow<Phase>();

  return (
    <div>
      <p>Current phase: {phase}</p>
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Contact</button>
    </div>
  );
}

function ProgressLabel() {
  const progress = useFlowProgress();

  return <span>{Math.round(progress * 100)}%</span>;
}

function SceneObject() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = progress * Math.PI;
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
      <Controls />
      <ProgressLabel />

      <Canvas>
        <ambientLight />
        <SceneObject />
      </Canvas>
    </FlowProvider>
  );
}
```

`FlowProvider` should receive stable `phases` and configuration props. Define static phase tuples outside components, or memoize derived phase lists and transition configuration.

## FlowProvider and flow controls

`FlowProvider` creates one phase machine for a known list of phases. Place it above the DOM controls, status UI, optional browser input helpers, and `<Canvas>` subtree that should share one flow state.

```tsx
const phases = ["intro", "details", "contact"] as const;
type Phase = (typeof phases)[number];

function Status() {
  const progress = useFlowProgress();
  const { phase, isTransitioning } = useFlow<Phase>();

  return (
    <p>
      {phase} · {Math.round(progress * 100)}%{isTransitioning ? " transitioning" : " ready"}
    </p>
  );
}

function Controls() {
  const { next, prev, goTo } = useFlow<Phase>();

  return (
    <div>
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Contact</button>
    </div>
  );
}

export function ExperienceShell() {
  return (
    <FlowProvider
      phases={phases}
      initialPhase="intro"
      transition={{ duration: 700, cooldown: 250 }}
    >
      <Status />
      <Controls />
    </FlowProvider>
  );
}
```

`useFlow` returns the current phase snapshot and controls such as `next`, `prev`, `goTo`, `lock`, and `unlock`. Use it for DOM/client controls, labels, and phase-aware UI.

`useFlowProgress` returns the current transition progress from the active provider snapshot. Use it for DOM progress labels, status displays, and coarse UI. For frame-driven scene updates, use `useFlowFrame` inside Canvas-bound components instead of pushing every-frame values through React state.

## R3F frame bridge

`useFlowFrame` bridges flow state into the React Three Fiber frame loop. It must be called from a component rendered inside `<Canvas>` and under `FlowProvider`.

```tsx
function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ progress }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.position.x = progress * 2;
  });

  return <mesh ref={meshRef} />;
}
```

Keep high-frequency visual values in refs, mutable Three.js objects, or Canvas-local frame state. Do not push every-frame mesh positions, material values, camera movement, or transition interpolation through React state unless you are intentionally synchronizing a stable UI snapshot.

## Input hooks

The input hooks are optional DOM/browser helpers. Mount them from client-side React components under `FlowProvider`, outside the R3F scene tree by default.

```tsx
function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500 });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500 });
  useKeyboardInput<Phase>({
    keys: {
      next: ["ArrowDown", "ArrowRight", "PageDown"],
      prev: ["ArrowUp", "ArrowLeft", "PageUp"]
    }
  });

  return null;
}
```

- `useWheelInput` maps wheel movement to `next` and `prev`.
- `useTouchInput` maps swipe gestures to `next` and `prev`.
- `useKeyboardInput` maps configured keys to `next` and `prev`.

The hooks attach browser event listeners from effects, support `enabled: false`, and do not access browser APIs at module import time. They drive the existing flow controls; they are not a full gesture system and do not bypass locks, active transitions, boundaries, or cooldown behavior.

## Next.js App Router boundary

Use public React, input, and R3F hooks from Client Components in Next.js App Router projects.

- Server Components can pass serializable data into a Client Component wrapper.
- Do not render `FlowProvider` or call flow hooks directly from Server Components.
- Do not access `window`, `document`, or browser event APIs at module import time.
- `useFlowFrame` still belongs only in Canvas-bound components.
- The package does not add Next.js as a dependency.
- The package does not provide Next.js router integration.

## Hook boundary summary

| Hook or component                                    | Where it belongs                                                         | Use it for                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `FlowProvider`                                       | Client-side React tree around the UI and Canvas integration area         | One shared phase machine for DOM controls, status UI, optional input helpers, and the `<Canvas>` subtree |
| `useFlow`                                            | Client-side React components rendered under `FlowProvider`               | Phase state, labels, navigation controls, locks, and DOM/client UI wiring                                |
| `useFlowProgress`                                    | Client-side React components rendered under `FlowProvider`               | Coarse DOM progress labels, status text, progress bars, and UI snapshots                                 |
| `useFlowFrame`                                       | R3F scene components rendered inside `<Canvas>` and under `FlowProvider` | Bridging flow state into the R3F frame loop for refs and Canvas-local objects                            |
| `useWheelInput`, `useTouchInput`, `useKeyboardInput` | Client-side React input layer components rendered under `FlowProvider`   | Browser wheel, touch, and keyboard listeners that drive existing flow controls                           |

## Non-goals

This package is intentionally narrow. It is not:

- a visual effects collection
- an `@react-three/drei` replacement
- a particle library
- a camera preset library
- a shader or effect library
- a portfolio template
- a full animation framework
- a GSAP wrapper
- a Framer Motion wrapper
- a router integration
- a CLI or codegen system

Scene animation, effects, camera movement, routing, templates, and application-specific interaction design stay in your application or in focused tools built for those jobs.
