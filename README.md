# r3f-interactive-flow

`r3f-interactive-flow` is a small React Three Fiber utility for building phase-based interactive 3D websites.

It connects user input, scene phases, transition progress, React state, and React Three Fiber frame updates through a predictable control layer.

The goal is not to provide visual effects. The goal is to make interactive R3F scenes easier to control, test, and maintain.

## Project status

Current published package version: `0.1.0`.

The project is currently moving toward `v0.2.0`, with a focus on stabilizing the existing foundation:

- clearer phase transition behavior
- more reliable wheel, touch, and keyboard input handling
- better transition locking and cooldown behavior
- safer TypeScript types
- tests for core behavior
- clearer examples and documentation

## Why this exists

Interactive 3D websites often need the same control flow in several places:

- DOM or UI input decides when the experience should move
- React stores the current phase and UI state
- React Three Fiber updates visual objects every frame
- scene transitions need progress values that remain predictable

React is good at application state. React Three Fiber is good at frame-based scene updates. `r3f-interactive-flow` provides a small bridge between those two responsibilities.

## What it provides

`r3f-interactive-flow` provides focused primitives for interactive R3F experiences:

- phase-based flow control
- `next`, `prev`, and `goTo`
- transition progress
- transition direction
- input locking and cooldown support
- wheel, touch, and keyboard input hooks
- an R3F frame bridge through `useFlowFrame`
- a small public API designed to stay predictable

## What it intentionally does not provide

This library intentionally keeps a narrow scope. It is not:

- a visual effects collection
- a replacement for `@react-three/drei`
- a particle library
- a camera preset library
- a shader effect library
- a portfolio template
- a full animation framework
- a GSAP or Framer Motion wrapper
- a Next.js router integration package

## Installation

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

## Public API

The main public primitives are intentionally small:

```ts
import {
  FlowProvider,
  useFlow,
  useFlowProgress,
  useFlowFrame
} from "r3f-interactive-flow";
```

Input hooks are also exported as convenience hooks for connecting common browser input to the flow controls:

```ts
import {
  useWheelInput,
  useTouchInput,
  useKeyboardInput
} from "r3f-interactive-flow";

import type {
  UseWheelInputOptions,
  UseTouchInputOptions,
  UseKeyboardInputOptions
} from "r3f-interactive-flow";
```

## Basic usage

Define phases as a const tuple, pass them to `FlowProvider`, and use hooks inside the provider.

```tsx
"use client";

import {
  FlowProvider,
  useFlow,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;

type Phase = (typeof phases)[number];

function FlowInputLayer() {
  useWheelInput<Phase>();
  useTouchInput<Phase>();
  useKeyboardInput<Phase>();

  return null;
}

function FlowControlsPanel() {
  const flow = useFlow<Phase>();

  return (
    <div>
      <p>Current phase: {flow.phase}</p>
      <p>Progress: {flow.progress}</p>
      <button onClick={flow.prev}>Prev</button>
      <button onClick={flow.next}>Next</button>
      <button onClick={() => flow.goTo("contact")}>Go to Contact</button>
    </div>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases} cooldownMs={600}>
      <FlowInputLayer />
      <FlowControlsPanel />
    </FlowProvider>
  );
}
```

`FlowProvider` should receive stable `phases` and configuration props. Define phase tuples outside components or memoize derived configuration.

## Flow controls

`useFlow` returns the current flow snapshot and control functions.

```ts
type FlowDirection = "next" | "prev" | "none";

type FlowControls<TPhase extends string> = {
  phase: TPhase;
  phaseIndex: number;
  progress: number;
  direction: FlowDirection;
  isTransitioning: boolean;
  isLocked: boolean;
  next: () => void;
  prev: () => void;
  goTo: (phase: TPhase) => void;
  lock: () => void;
  unlock: () => void;
};
```

This shape is useful for DOM UI, labels, buttons, and phase-aware React components.

## Transition progress

`useFlowProgress` returns the current transition progress from the active `FlowProvider`.

```tsx
import { useFlowProgress } from "r3f-interactive-flow";

function ProgressLabel() {
  const progress = useFlowProgress();

  return <p>Progress: {progress.toFixed(2)}</p>;
}
```

For frame-driven R3F scene updates, prefer `useFlowFrame` instead of pushing every frame into React state.

## R3F usage with useFlowFrame

Use `useFlowFrame` inside a Canvas-bound component to receive frame-driven transition progress.

```tsx
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";
import type * as THREE from "three";

const phases = ["intro", "work", "contact"] as const;

function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame((progress, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.position.x = progress * 2;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export function Scene() {
  return (
    <FlowProvider phases={phases}>
      <Canvas>
        <FlowBox />
      </Canvas>
    </FlowProvider>
  );
}
```

`useFlowFrame` uses React Three Fiber's `useFrame` internally, so it must be called inside a component rendered within `<Canvas>`.

## Input hooks

The input hooks connect browser input to `next` and `prev`.

- `useWheelInput`
  - wheel down -> `next`
  - wheel up -> `prev`
  - options: `target`, `threshold`, `enabled`, `preventDefault`
- `useTouchInput`
  - swipe up -> `next`
  - swipe down -> `prev`
  - options: `target`, `threshold`, `enabled`, `preventDefault`
- `useKeyboardInput`
  - `ArrowDown`, `ArrowRight`, `PageDown`, Space -> `next`
  - `ArrowUp`, `ArrowLeft`, `PageUp` -> `prev`
  - options: `target`, `enabled`, `preventDefault`, `nextKeys`, `prevKeys`

Input hooks only attach browser event listeners inside React effects and are guarded for non-browser environments.

## Next.js compatibility

This package is designed to be usable from Next.js App Router Client Components.

- Use `FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and input hooks from Client Components.
- Browser APIs are used inside hooks and effects, not at module import time.
- `useFlowFrame` still follows React Three Fiber rules and must be used inside a Canvas-bound component.
- Next.js is not a dependency.
- Next.js-specific router integration is intentionally out of scope for now.

## Example

Run the basic Vite example from the repository root:

```bash
pnpm install
pnpm --filter vite-basic dev
```

Build the example:

```bash
pnpm --filter vite-basic build
```

## Architecture

The package is split by responsibility:

```txt
packages/r3f-interactive-flow/src/
  core/
    React-independent phase machine, easing, and types
  react/
    FlowProvider, context, and React hooks
  r3f/
    React Three Fiber bridge hooks
  input/
    browser input hooks for wheel, touch, and keyboard
```

Architecture rules:

- `core/` does not import React.
- DOM input logic does not live in R3F scene logic.
- R3F hooks are only used in Canvas-bound components.
- Frame-driven values should not be pushed into React state every frame.
- The public API should stay small and predictable.

## Development

From the repository root:

```bash
pnpm install
pnpm build
pnpm package:verify
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm --filter vite-basic build
pnpm pack:dry-run
```

## Release readiness

Before publishing, run:

```bash
pnpm release:check
```

For the full maintainer checklist, see [docs/release.md](docs/release.md).

For the v0.2.0 implementation plan, see [docs/roadmap-v0.2.0.md](docs/roadmap-v0.2.0.md).

For the behavior audit and intended v0.2.0 rules, see [docs/behavior-v0.2.0.md](docs/behavior-v0.2.0.md).

To publish with Changesets after checks pass:

```bash
pnpm release
```

`pnpm release` publishes to npm, so only run it when you intentionally want to publish.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

For bugs or feature suggestions, please use the GitHub issue templates.

## License

MIT
