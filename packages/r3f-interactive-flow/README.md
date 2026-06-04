# r3f-interactive-flow

`r3f-interactive-flow` is a small React Three Fiber utility for predictable phase-based interactive flow control.

It connects user input, scene phases, transition progress, and React Three Fiber frame updates without becoming a visual effects collection or a full animation framework.

## What it is

`r3f-interactive-flow` provides a small control layer for interactive R3F experiences:

- phase-based flow control
- `next`, `prev`, and `goTo`
- transition progress
- input hooks for wheel, touch, and keyboard navigation
- an R3F frame bridge through `useFlowFrame`
- a small and predictable public API

React owns the application state. React Three Fiber owns frame-based scene updates. This package connects both through predictable phase transitions.

## What it is not

This library intentionally keeps a narrow scope. It is not:

- a visual effects collection
- a replacement for `@react-three/drei`
- a full animation framework
- a GSAP or Framer Motion wrapper
- a portfolio template or demo kit

## Installation

```bash
pnpm add r3f-interactive-flow three @react-three/fiber react react-dom
```

`react`, `react-dom`, `three`, and `@react-three/fiber` are peer dependencies. Install them in your application.

npm and yarn equivalents are also fine:

```bash
npm install r3f-interactive-flow three @react-three/fiber react react-dom
yarn add r3f-interactive-flow three @react-three/fiber react react-dom
```

## Peer dependencies

```json
{
  "@react-three/fiber": ">=8.0.0 <10.0.0",
  "react": ">=18.0.0 <20.0.0",
  "react-dom": ">=18.0.0 <20.0.0",
  "three": ">=0.150.0 <1.0.0"
}
```

## Public API

The core public API is intentionally small. Input hooks are also exported as convenience public hooks for connecting common browser input to the flow controls.

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

import type {
  UseWheelInputOptions,
  UseTouchInputOptions,
  UseKeyboardInputOptions
} from "r3f-interactive-flow";
```

Current public exports:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`
- `UseWheelInputOptions`
- `UseTouchInputOptions`
- `UseKeyboardInputOptions`

## Basic usage

Define phases as a const tuple, pass them to `FlowProvider`, and use hooks inside the provider.

```tsx
"use client";

import {
  FlowProvider,
  useFlow,
  useWheelInput,
  useTouchInput,
  useKeyboardInput
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
    <FlowProvider phases={phases}>
      <FlowInputLayer />
      <FlowControlsPanel />
    </FlowProvider>
  );
}
```

Input hooks and flow hooks must be used inside `FlowProvider`.

## R3F usage with useFlowFrame

Use `useFlowFrame` inside a Canvas-bound component to receive frame-driven transition progress.

`useFlowFrame` uses React Three Fiber's `useFrame` internally, so it must be called inside a component rendered within `<Canvas>`. Do not call R3F hooks outside Canvas-bound components.

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

Example:

```tsx
"use client";

import { useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

export function InputLayer() {
  useWheelInput<Phase>({ threshold: 40 });
  useTouchInput<Phase>({ threshold: 50 });
  useKeyboardInput<Phase>({
    nextKeys: ["ArrowDown", "ArrowRight"],
    prevKeys: ["ArrowUp", "ArrowLeft"]
  });

  return null;
}
```

Input hooks only attach browser event listeners inside React effects and are guarded for non-browser environments.

## Example commands

From the repository root, run the basic Vite example:

```bash
pnpm install
pnpm --filter vite-basic dev
```

Build the example:

```bash
pnpm --filter vite-basic build
```

## Architecture summary

The package is split by responsibility:

```txt
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

## Next.js compatibility

This package is designed to be usable from Next.js App Router Client Components.

- Use `FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and input hooks from Client Components.
- The package entry is marked as a client entry for Next.js App Router compatibility.
- The package does not add Next.js as a dependency.
- Browser APIs are used inside hooks/effects, not at module import time.
- No Next.js router integration is included in v0.1.0.
- `useFlowFrame` still follows React Three Fiber rules and must be used inside a Canvas-bound component.

## Development commands

From the repository root:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm --filter vite-basic build
pnpm pack:dry-run
```

Package-only dry run:

```bash
pnpm --filter r3f-interactive-flow pack:dry-run
```

## License

MIT
