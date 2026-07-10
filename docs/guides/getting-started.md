# Getting started

`r3f-interactive-flow` is a small, predictable control layer for phase-based
interactive React Three Fiber websites. You describe an experience as a known
list of phases, move between them with `next`, `prev`, and `goTo`, read
transition progress in React UI, and bridge the same state into Canvas-bound
frame updates. React stays responsible for application and UI state, React Three
Fiber stays responsible for frame-based scene updates, and this library keeps
the phase transition contract between them explicit. It is not a visual effects
collection, camera preset library, shader API, animation framework, GSAP or
Framer Motion wrapper, router integration, or template system.

This guide gets you to a first working flow. For deeper topics, see
[Next steps](#next-steps).

## What you will build

A minimal app wrapped in `FlowProvider` with a known list of phases, a small set
of DOM controls that read the current phase and call `next`, `prev`, and `goTo`,
and a label that reads transition progress. This is the smallest useful flow and
the foundation for everything else in the guides.

## Install

Using `pnpm`:

```bash
pnpm add r3f-interactive-flow three @react-three/fiber react react-dom
```

`npm` and `yarn` equivalents are also fine:

```bash
npm install r3f-interactive-flow three @react-three/fiber react react-dom
yarn add r3f-interactive-flow three @react-three/fiber react react-dom
```

## Peer dependencies

`react`, `react-dom`, `three`, and `@react-three/fiber` are peer dependencies
and should be installed by your application. The package expects these ranges:

```json
{
  "@react-three/fiber": ">=8.0.0 <10.0.0",
  "react": ">=18.0.0 <20.0.0",
  "react-dom": ">=18.0.0 <20.0.0",
  "three": ">=0.150.0 <1.0.0"
}
```

The package does not add Next.js, `@react-three/drei`, GSAP, Framer Motion, or
any visual-effect library as a dependency.

## Define phases

Phases are a stable `as const` tuple defined outside your components. `as const`
keeps the phase names as a precise literal type, which gives you type-checked
`goTo` targets and phase values.

```tsx
const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];
```

Keep the tuple stable across renders. Define it at module scope, or memoize it
if it is derived at runtime.

## Add FlowProvider

Wrap the subtree that shares one flow state with `FlowProvider`. Pass the
`phases` tuple, and optionally an `initialPhase`.

```tsx
"use client";

import { FlowProvider } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

export function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <FlowControls />
    </FlowProvider>
  );
}
```

`FlowProvider` owns one phase machine. Place it above the DOM controls, status
UI, optional input helpers, and any `<Canvas>` subtree that should share the same
flow state.

## Read and control the current phase

Call `useFlow` from any component under `FlowProvider`. It returns the current
phase snapshot and the controls `next`, `prev`, and `goTo` (plus `phaseIndex`,
`isTransitioning`, `lock`, and `unlock`). Pass your `Phase` type as the generic
so `phase` and `goTo` targets are type-checked.

```tsx
"use client";

import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowControls() {
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

export function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <FlowControls />
    </FlowProvider>
  );
}
```

- `next` moves to the next phase in the tuple.
- `prev` moves to the previous phase.
- `goTo(target)` moves directly to a named phase.

Calls are ignored when they are out of bounds or blocked by an active
transition, a lock, or a cooldown, so controls stay predictable.

## Read transition progress

`useFlowProgress` returns the current transition progress as a number from `0`
to `1`. Use it for DOM UI such as labels and progress bars. While a transition
runs, the provider updates this value each animation frame, so it moves smoothly
from `0` to `1` — no Canvas required.

```tsx
import { useFlowProgress } from "r3f-interactive-flow";

function ProgressBar() {
  const progress = useFlowProgress();

  return <progress max={1} value={progress} aria-label="Flow transition progress" />;
}
```

This works in a Canvas-free app: `FlowProvider` drives the transition on its own
clock, and DOM consumers such as this `<progress>` element re-render as it
advances. Reserve `useFlowFrame` for animating a Three.js scene rather than
copying every-frame values into React state.

## Where R3F fits

For frame-driven scene updates, use `useFlowFrame`. It bridges the same flow
state into the React Three Fiber frame loop and must be called from a component
rendered inside `<Canvas>` and under `FlowProvider`. Keep high-frequency visual
values in refs and Three.js objects instead of routing them through React state.
This is covered in the [React Three Fiber usage guide](./r3f-usage.md).

## Next steps

- [Core concepts](./core-concepts.md) — phases, transitions, progress, and the
  React / R3F split.
- [React Three Fiber usage](./r3f-usage.md) — the `useFlowFrame` bridge and
  Canvas boundaries.
- [Input handling](./input-handling.md) — wheel, touch, and keyboard input
  hooks.
