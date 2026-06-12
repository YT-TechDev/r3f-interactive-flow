# r3f-interactive-flow

`r3f-interactive-flow` is a small React Three Fiber utility for building phase-based interactive 3D websites.

It connects user input, phase state, transition progress, and React Three Fiber frame updates without becoming a visual effect library or animation framework.

## What it is

`r3f-interactive-flow` provides a small control layer for interactive R3F experiences:

- phase-based flow control
- `next`, `prev`, and `goTo`
- transition progress
- input hooks for wheel, touch, and keyboard navigation
- an R3F frame bridge through `useFlowFrame`
- a small and predictable public API

## What it is not

This library intentionally keeps a narrow scope. It is not:

- a visual effects collection
- a replacement for `@react-three/drei`
- a particle library
- a camera preset library
- a shader effect library
- a GSAP or Framer Motion wrapper
- a full animation framework

## Public API

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

Input hooks must be used inside `FlowProvider`.

## FlowProvider options

`FlowProvider` accepts an optional `cooldownMs` prop for input pacing. When set, accepted `next`, `prev`, and valid `goTo` calls are gated for that many milliseconds to prevent rapid repeated navigation. Omitting `cooldownMs` preserves the default behavior, while `cooldownMs={0}` disables cooldown behavior.

Keep `phases` and configuration props passed to `FlowProvider` stable between renders, for example by defining phase tuples outside components or memoizing derived configuration.

## R3F usage

Use `useFlowFrame` inside a Canvas-bound component to receive frame-driven transition progress.

```tsx
import { useRef } from "react";
import { useFlowFrame } from "r3f-interactive-flow";
import type * as THREE from "three";

function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame((progress) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = progress * Math.PI * 2;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

`useFlowFrame` uses React Three Fiber's `useFrame`, so it must be called inside a Canvas-bound component. DOM-facing `flow.progress` is useful for stateful UI, but it is not intended as a frame-perfect animated value; use `useFlowFrame` for frame-driven scene updates.

## Input hooks

The input hooks connect browser input to `next` and `prev`.

- `useWheelInput`
  - wheel down -> `next`
  - wheel up -> `prev`
- `useTouchInput`
  - swipe up -> `next`
  - swipe down -> `prev`
- `useKeyboardInput`
  - `ArrowDown`, `ArrowRight`, `PageDown`, Space -> `next`
  - `ArrowUp`, `ArrowLeft`, `PageUp` -> `prev`

Each input hook supports a small options object for configuration such as `enabled`, `target`, `preventDefault`, and hook-specific thresholds or key mappings.

Input hooks must be used inside `FlowProvider`.

## Example

Run the basic Vite example:

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

## Development

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

For the v0.2.0 implementation plan, see [docs/roadmap-v0.2.0.md](docs/roadmap-v0.2.0.md). For the behavior audit and intended v0.2.0 rules, see [docs/behavior-v0.2.0.md](docs/behavior-v0.2.0.md).

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
