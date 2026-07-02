# r3f-interactive-flow

`r3f-interactive-flow` is a small React Three Fiber utility for building phase-based interactive 3D websites.

It connects user input, scene phases, transition progress, React state, and React Three Fiber frame updates through a predictable control layer. React manages application and UI state, React Three Fiber manages frame-based visual updates, and this library bridges them through predictable phase transitions.

The goal is not to provide visual effects, camera presets, shader APIs, animation timelines, router integration, or GSAP / Framer Motion wrappers. The goal is to make interactive R3F scenes easier to control, test, and maintain.

## Project status

Current forward-looking planning is tracked in [docs/roadmap-v1.2.5-to-v2.0.0.md](docs/roadmap-v1.2.5-to-v2.0.0.md). It treats v1.2.5 through v1.5.0 as preparation, documentation, tests, examples, and behavior hardening, and treats v2.0.0 as stabilization and cleanup rather than a rewrite.

Historical planning and release references remain available in [docs/roadmap-v1.0.0.md](docs/roadmap-v1.0.0.md), [docs/releases/v1.0.0-readiness.md](docs/releases/v1.0.0-readiness.md), [docs/releases/v0.9.0-readiness.md](docs/releases/v0.9.0-readiness.md), [docs/releases/v0.8.0-readiness.md](docs/releases/v0.8.0-readiness.md), [docs/roadmap-v0.7.0.md](docs/roadmap-v0.7.0.md), [docs/releases/v0.6.0.md](docs/releases/v0.6.0.md), [docs/roadmap-v0.6.0.md](docs/roadmap-v0.6.0.md), [docs/releases/v0.5.0.md](docs/releases/v0.5.0.md), [docs/roadmap-v0.5.0.md](docs/roadmap-v0.5.0.md), [docs/releases/v0.4.0.md](docs/releases/v0.4.0.md), and [docs/roadmap-v0.4.0.md](docs/roadmap-v0.4.0.md).

For the v0.3.0 design baseline, see [docs/v0.3.0-spec.md](docs/v0.3.0-spec.md). For real-world DOM UI and Canvas wiring, see [docs/dom-ui-to-canvas-guide.md](docs/dom-ui-to-canvas-guide.md).

## Why this exists

Interactive 3D websites often need the same control flow in several places:

- DOM or UI input decides when the experience should move
- React stores the current phase and UI state
- React Three Fiber updates visual objects every frame
- scene transitions need progress values that remain predictable

React manages application and UI state. React Three Fiber manages frame-based scene updates. `r3f-interactive-flow` provides a small bridge between those two responsibilities through predictable phase transitions.

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
- an animation timeline system
- a full animation framework
- a GSAP or Framer Motion wrapper
- a router integration package

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

The current public runtime primitives are intentionally small:

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

The package also exports the public types used by the documented provider, frame bridge, transition options, and input hooks:

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

Current public exports:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`
- `FlowFrameState`
- `FlowFrameCallback`
- `FlowInputTarget`
- `FlowTransitionBaseOptions`
- `FlowTransitionOptions`
- `UseWheelInputOptions`
- `UseTouchInputOptions`
- `UseKeyboardInputOptions`

## Basic usage

Define phases as a const tuple, pass them to `FlowProvider`, and use hooks inside the provider.

```tsx
"use client";

import { FlowProvider, useFlow } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowControlsPanel() {
  const { phase, next, prev, goTo } = useFlow<Phase>();

  return (
    <div>
      <p>Current phase: {phase}</p>
      <button onClick={prev}>Prev</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Go to Contact</button>
    </div>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowControlsPanel />
    </FlowProvider>
  );
}
```

`FlowProvider` should receive stable `phases` and configuration props. Define phase tuples outside components or memoize derived configuration. Input hooks are optional browser input helpers; add them only where wheel, touch, or keyboard navigation should drive the flow.

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

## Tested navigation guards and cooldown behavior

Current tested navigation behavior is intentionally narrow and predictable:

- `next()`, `prev()`, and `goTo(phase)` start transitions only when the request is valid.
- Navigation requested while a transition is already active is ignored. Ignored navigation does not restart, reset, or extend the active transition or its cooldown.
- `lock()` blocks otherwise valid navigation requests. `unlock()` allows navigation again. Locking does not cancel a transition that has already started.
- Core transition cooldown starts from accepted navigation only. Boundary no-ops, same-phase `goTo`, locked navigation, and active-transition navigation do not start, reset, or extend that cooldown.
- Input hook cooldown and core transition cooldown are separate concepts. Hook cooldown throttles repeated browser input before it reaches the flow controls; core cooldown guards accepted phase navigation in the flow machine.
- Input hook cooldown is recorded only when browser input produces an accepted navigation. Rejected boundary input, disabled input, ignored targets, locked flow, and active-transition input do not consume or extend hook-local cooldown.
- Input hooks support `enabled: false` and can be re-enabled later; disabled hooks do not navigate, and re-enabled hooks resume listener behavior.

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
  - wheel up -> `prev` on the default `y` axis
  - options: `target`, `threshold`, `axis`, `cooldown`, `enabled`, `preventDefault`, `ignore`
- `useTouchInput`
  - swipe up -> `next`
  - swipe down -> `prev` on the default `y` axis
  - options: `target`, `threshold`, `axis`, `cooldown`, `enabled`, `preventDefault`, `ignore`

Wheel and touch `threshold` values must be finite and non-negative. `threshold: 0` is allowed; values below `0`, `NaN`, and infinities are invalid.

- `useKeyboardInput`
  - `ArrowDown`, `ArrowRight`, `PageDown`, Space -> `next` by default
  - `ArrowUp`, `ArrowLeft`, `PageUp` -> `prev` by default
  - options: `target`, `enabled`, `preventDefault`, `keys`, `cooldown`, `ignoreWhenTyping`
  - `keys.next` and `keys.prev` are the current keyboard configuration API. `nextKeys` and `prevKeys` still work as deprecated compatibility aliases.

When a page has focused buttons or links, consider passing a `keys` object that omits Space so native Space activation still belongs to the focused control.

Input hooks only attach browser event listeners inside React effects and are guarded for non-browser environments. They do not access browser APIs at module import time.

`enabled: false` disables listener behavior. `target` accepts a direct `Window` or element target, or a React ref object pointing to an element. If `target` is omitted, or a ref is currently empty, the hooks fall back to `window`. When a target changes, the hooks clean up listeners from the old target before attaching to the new one.

## Next.js compatibility

This package is designed to be usable from Next.js App Router Client Components.

- Use `FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and input hooks from Client Components.
- The package entry is marked as a client entry for Next.js App Router compatibility.
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
```

### Common validation sets

Choose the smallest validation set that matches the PR. Documentation-only PRs usually do not need release checks.

| PR type                                    | Commands                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Documentation-only PRs                     | `pnpm format`<br>`pnpm lint`                                                                                                    |
| Example documentation or example usage PRs | `pnpm format`<br>`pnpm lint`<br>`pnpm --filter vite-basic build`                                                                |
| Library code or type changes               | `pnpm build`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm lint`<br>`pnpm format`                                                 |
| Package output or export-related changes   | `pnpm build`<br>`pnpm package:verify`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm lint`<br>`pnpm format`<br>`pnpm pack:dry-run` |
| Release-prep review                        | `pnpm release:check`                                                                                                            |

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

`pnpm release` publishes to npm, so only maintainers should run it when they intentionally want to publish. Do not run publish, tag, or GitHub Release commands for normal stabilization PRs.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

For bugs or feature suggestions, please use the GitHub issue templates.

## License

MIT
