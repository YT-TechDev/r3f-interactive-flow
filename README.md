# r3f-interactive-flow

`r3f-interactive-flow` is a small React Three Fiber utility for building phase-based interactive 3D websites.

It connects user input, scene phases, transition progress, React state, and React Three Fiber frame updates through a predictable control layer.

The goal is not to provide visual effects. The goal is to make interactive R3F scenes easier to control, test, and maintain.

## Project status

Current package version on `main`: `0.3.0`.

The `v0.3.0` work is complete on `main`, with the package focused on a small, stable set of phase flow primitives for React Three Fiber. The next planned release is `v0.4.0 - Input, transition, and test hardening`; see [docs/roadmap-v0.4.0.md](docs/roadmap-v0.4.0.md) for the stabilization roadmap. For the v0.3.0 design baseline, see [docs/v0.3.0-spec.md](docs/v0.3.0-spec.md). For release notes, see [packages/r3f-interactive-flow/CHANGELOG.md](packages/r3f-interactive-flow/CHANGELOG.md).

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
import { FlowProvider, useFlow, useFlowProgress, useFlowFrame } from "r3f-interactive-flow";
```

Input hooks are also exported as convenience hooks for connecting common browser input to the flow controls:

```ts
import { useWheelInput, useTouchInput, useKeyboardInput } from "r3f-interactive-flow";

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
    <FlowProvider phases={phases} transition={{ cooldown: 600 }}>
      <FlowInputLayer />
      <FlowControlsPanel />
    </FlowProvider>
  );
}
```

`FlowProvider` should receive stable `phases` and configuration props. Define phase tuples outside components or memoize derived configuration.

## FlowProvider transition options

`transition` is the preferred timing API for `FlowProvider`. It supports global defaults and source-phase overrides:

```tsx
<FlowProvider
  phases={["intro", "skills", "projects", "contact"] as const}
  transition={{
    duration: 1000,
    cooldown: 500,
    byPhase: {
      intro: {
        duration: 1600,
        cooldown: 800
      },
      skills: {
        duration: 800
      }
    }
  }}
>
  <App />
</FlowProvider>
```

- `transition.duration` sets transition duration in milliseconds.
- `transition.cooldown` sets accepted-navigation cooldown in milliseconds.
- `transition.easing` sets the easing function.
- `transition.byPhase` overrides any of those fields for transitions that start from a specific source phase. For example, `byPhase.intro` is used when leaving `intro`, regardless of the target phase.
- Fallback is per field: a phase override with only `duration` still uses global, legacy, or default cooldown/easing.
- `transition` wins over legacy `transitionDurationMs`, `cooldownMs`, and `easing` when both are provided. The legacy props still work for compatibility.
- `lockDuringTransition` is intentionally not part of this API yet; transitions still ignore new navigation while active.

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

This shape is useful for DOM UI, labels, buttons, and phase-aware React components. Treat the returned `progress` as part of the public React snapshot: it is useful for coarse UI status, but it is not intended to be a frame-perfect animation value.

## Transition progress

`useFlowProgress` returns the current transition progress from the active `FlowProvider` snapshot. Use it for DOM labels, status displays, and phase-aware UI that can follow React state updates.

```tsx
import { useFlowProgress } from "r3f-interactive-flow";

function ProgressLabel() {
  const progress = useFlowProgress();

  return <p>Progress: {progress.toFixed(2)}</p>;
}
```

`useFlowProgress` is intentionally DOM-facing. Do not rely on React state from `useFlow` or `useFlowProgress` to update every frame. For frame-driven R3F scene updates, use `useFlowFrame` inside Canvas-bound components instead of pushing every frame into React state.

## DOM state and frame state

DOM/UI components and R3F scene components can share the same `FlowProvider`, but they should read progress at different layers:

```tsx
function PhaseStatus() {
  const flow = useFlow<Phase>();

  return (
    <div>
      <p>Phase: {flow.phase}</p>
      <p>Status progress: {flow.progress.toFixed(2)}</p>
      <button onClick={flow.next}>Next</button>
    </div>
  );
}

function FlowMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame(({ progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.position.x = progress * 2;
  });

  return <mesh ref={meshRef} />;
}
```

Use `useFlow` and `useFlowProgress` for DOM state, controls, labels, and coarse transition status. Use `useFlowFrame` for per-frame R3F visuals that mutate refs or other Canvas-local frame state.

## R3F usage with useFlowFrame

Use `useFlowFrame` inside a Canvas-bound component to receive frame-driven transition progress. `useFlowFrame` advances transition progress by calling the core flow machine update from the R3F frame loop.

```tsx
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";
import type * as THREE from "three";

const phases = ["intro", "work", "contact"] as const;

function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame(({ progress }, delta) => {
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

### v0.3.0 `useFlowFrame` migration

`useFlowFrame` now passes a typed frame state object as the first callback argument.

Before:

```tsx
useFlowFrame((progress, delta) => {
  // ...
});
```

After:

```tsx
useFlowFrame(({ progress }, delta) => {
  // ...
});
```

The frame state also includes `phase`, `phaseIndex`, `direction`, and `isTransitioning`.

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
