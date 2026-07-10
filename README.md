# r3f-interactive-flow

`r3f-interactive-flow` is a small, predictable control layer for phase-based interactive React Three Fiber websites.

It helps you describe an experience as a known list of phases, move between those phases with `next`, `prev`, and `goTo`, read transition progress in React UI, connect optional browser input hooks, and bridge the same flow state into Canvas-bound frame updates with `useFlowFrame`. React remains responsible for application and UI state, React Three Fiber remains responsible for frame-based scene updates, and this library keeps the phase transition contract between them explicit.

This README describes the current stable public API for r3f-interactive-flow. For release history, see [packages/r3f-interactive-flow/CHANGELOG.md](packages/r3f-interactive-flow/CHANGELOG.md).

For step-by-step usage guides aimed at users and AI coding agents, see [docs/guides/README.md](docs/guides/README.md). For complete package usage, see [packages/r3f-interactive-flow/README.md](packages/r3f-interactive-flow/README.md).

## What it provides

- phase-based flow state for a known list of phases
- `next`, `prev`, and `goTo` controls
- transition progress and transition direction
- lock and cooldown behavior for predictable navigation
- optional wheel, touch, and keyboard input hooks
- DOM/UI to Canvas coordination through one shared provider
- an R3F frame bridge through `useFlowFrame`
- a small public API imported from the package root

## Mental model

- `FlowProvider` owns one phase machine and the single transition clock that advances it, one step per animation frame while a transition settles.
- `useFlow` reads the current phase snapshot and controls phase changes with `next`, `prev`, `goTo`, `lock`, and `unlock`. Its `progress` advances continuously during a transition.
- `useFlowProgress` reads that same transition progress for DOM/client UI such as labels and progress bars, and updates every frame while a transition runs.
- `useFlowFrame` is a read-only R3F observer for scene animation: it reads the same machine inside the Canvas frame loop without advancing it, and belongs inside Canvas-bound components.
- `useWheelInput`, `useTouchInput`, and `useKeyboardInput` are optional browser input helpers that call the existing flow controls from components mounted under `FlowProvider`.

React manages application and UI state. React Three Fiber manages frame-based scene updates. This package keeps phase transitions, input, DOM/UI coordination, and the Canvas frame bridge explicit.

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

Do not import from internal package paths such as `r3f-interactive-flow/react`, `r3f-interactive-flow/r3f`, or `r3f-interactive-flow/input`; those paths are not public package exports.

Supported imports are package-root imports only. Internal source, build, or responsibility-specific paths are not public API, including `r3f-interactive-flow/src/*`, `r3f-interactive-flow/dist/*`, `r3f-interactive-flow/react`, `r3f-interactive-flow/r3f`, and `r3f-interactive-flow/input`.

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

The package does not add Next.js, `@react-three/drei`, GSAP, Framer Motion, or visual-effect libraries as dependencies.

## Basic usage

Define phases as a stable const tuple, pass them to `FlowProvider`, and use hooks inside the provider.

```tsx
"use client";

import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowControls() {
  const { phase, next, prev, goTo } = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <div>
      <p>Current phase: {phase}</p>
      <p>Progress: {Math.round(progress * 100)}%</p>
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Contact</button>
    </div>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases} transition={{ duration: 700, cooldown: 250 }}>
      <FlowControls />
    </FlowProvider>
  );
}
```

`FlowProvider` should receive stable `phases` and configuration props. Define phase tuples outside components or memoize derived configuration.

## Focused usage recipes

These recipes use package root imports only. Keep DOM controls and input layers under `FlowProvider`; keep R3F frame work inside Canvas-bound components.

### Minimal phase navigation

```tsx
import { FlowProvider, useFlow } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function Navigation() {
  const { phase, next, prev, goTo } = useFlow<Phase>();

  return (
    <nav>
      <p>Phase: {phase}</p>
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Contact</button>
    </nav>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <Navigation />
    </FlowProvider>
  );
}
```

### DOM controls with flow state

```tsx
function PhaseControls() {
  const { phase, phaseIndex, next, prev, goTo } = useFlow<Phase>();

  return (
    <section>
      <p>
        {phaseIndex + 1} / {phases.length}: {phase}
      </p>
      <button onClick={prev} disabled={phaseIndex === 0}>
        Previous
      </button>
      <button onClick={next} disabled={phaseIndex === phases.length - 1}>
        Next
      </button>
      <button onClick={() => goTo("work")}>Work</button>
    </section>
  );
}
```

Use DOM controls outside `<Canvas>` when they are regular page UI. They can still share the same flow state as the Canvas subtree through one `FlowProvider`.

### Reading transition progress

```tsx
import { useFlowProgress } from "r3f-interactive-flow";

function ProgressBar() {
  const progress = useFlowProgress();

  return <progress max={1} value={progress} aria-label="Flow transition progress" />;
}
```

`useFlowProgress` is for DOM UI such as labels and progress bars. Navigation and this progress readout are fully Canvas-free: the provider drives each transition on its own clock, and this value updates every animation frame, so the `<progress>` element moves smoothly from `0` to `1` even with no `<Canvas>` mounted. Reserve `useFlowFrame` for animating an R3F scene instead of copying every-frame values into React state.

### Driving R3F frame updates

```tsx
import { useRef } from "react";
import type * as THREE from "three";
import { useFlowFrame } from "r3f-interactive-flow";

function FlowMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.position.x = phase === "work" ? progress * 2 : 0;
  });

  return <mesh ref={meshRef} />;
}
```

Call `useFlowFrame` only from components rendered inside `<Canvas>` and under `FlowProvider`. Update refs or Three.js objects in the frame callback instead of routing high-frequency scene values through React state.

### Basic input hooks

```tsx
import { useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";

function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500, ignore: ["[data-flow-ignore]"] });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500, ignore: ["[data-flow-ignore]"] });
  useKeyboardInput<Phase>({
    cooldown: 250,
    keys: {
      next: ["ArrowDown", "ArrowRight", "PageDown"],
      prev: ["ArrowUp", "ArrowLeft", "PageUp"]
    }
  });

  return null;
}
```

Mount input hooks from a client-side input layer under `FlowProvider`, outside the R3F scene tree by default. Use `ignore` selectors for wheel and touch regions that should not trigger flow navigation, such as `<div data-flow-ignore />`. Keyboard input ignores typing targets by default.

### Lock and cooldown notes

Use the existing `lock`, `unlock`, provider transition cooldown, and input hook cooldown options to prevent repeated accidental phase changes. Input hooks respect active transitions, locks, phase boundaries, and cooldowns; they drive the same `next` and `prev` controls rather than bypassing flow state.

## DOM/UI to Canvas coordination

Use one `FlowProvider` around the DOM controls, optional input helpers, status UI, and `<Canvas>` subtree that should share one flow state. Use `useFlow` and `useFlowProgress` for DOM/client UI. Use `useFlowFrame` only from components rendered inside `<Canvas>`.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlowFrame, useWheelInput } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500 });
  return null;
}

function SceneObject() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.position.x = progress * 2;
    meshRef.current.visible = phase !== "contact";
  });

  return <mesh ref={meshRef} />;
}

export function Experience() {
  return (
    <FlowProvider phases={phases}>
      <InputLayer />
      <Canvas>
        <SceneObject />
      </Canvas>
    </FlowProvider>
  );
}
```

Input hooks attach browser listeners from effects and drive the existing `next` and `prev` controls. They do not access browser APIs at module import time, do not provide a full gesture system, and do not belong inside R3F scene objects by default.

## Client usage and Next.js App Router boundary

`FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and input hooks are client-side React APIs. In Next.js App Router projects, use them from Client Components and add `"use client"` to files that render the provider or call these hooks.

- Server Components can pass serializable data into a Client Component wrapper, but this package does not claim Server Component support.
- Do not render `FlowProvider` or call flow hooks directly from Server Components.
- Do not access `window`, `document`, or browser event APIs at module import time. Browser input hooks attach listeners only from client-side runtime effects.
- `useFlowFrame` still follows React Three Fiber rules and must be used inside a Canvas-bound component.
- The package is Next.js compatible, but not Next.js integrated. Next.js is not a dependency.
- Next.js router integration is intentionally out of scope.

## Do / do not

Do:

- Import supported APIs from the package root.
- Keep phase names explicit with `as const` tuples.
- Put `FlowProvider` above the DOM controls, input layer, and Canvas subtree that share flow state.
- Mount browser input hooks under `FlowProvider`, outside the R3F scene tree by default.
- Use refs or Three.js objects inside `useFlowFrame` for frame-driven scene updates.
- Keep examples small and phase-focused.

Do not:

- Import from internal source, build, or responsibility-specific paths.
- Use React state for every-frame scene animation values.
- Put browser input listener logic inside R3F scene components unless there is a clear scene-specific reason.
- Treat this package as a router, animation timeline, camera preset, shader, particle, visual-effects, template, CLI, or codegen library.
- Add Next.js router integration or Server Component support claims to examples.
- Add dependencies or public API surface for convenience.

## Agent-readable boundaries

When editing this project or writing examples, keep changes within phase management, transition progress, input handling, DOM/UI to Canvas coordination, and the R3F frame bridge. Prefer small examples over full templates, preserve package-root imports, and avoid adding runtime dependencies, package exports, or public APIs for convenience.

## Non-goals

Do not use this package when you need a rendering abstraction, design system, route manager, full animation engine, or collection of ready-made visual effects. This library is intentionally not:

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

For scene animation, visual effects, camera behavior, shaders, particles, routes, templates, or application-specific interaction design, use scene-specific R3F / Three.js code or focused tools built for those jobs.

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
  core/   React-independent phase machine, easing, and types
  react/  FlowProvider, context, and React hooks
  r3f/    React Three Fiber bridge hooks
  input/  browser input hooks for wheel, touch, and keyboard
```

Architecture rules:

- `core/` stays React-independent.
- `react/` owns provider, context, and hooks.
- `r3f/` owns Canvas-bound frame bridge hooks.
- `input/` owns browser input handling.
- DOM input logic does not live in R3F scene logic.
- R3F hooks are only used in Canvas-bound components.
- Frame-driven values should not be pushed into React state every frame.
- The public API should stay small and predictable.

## Development

From the repository root:

```bash
pnpm install
```

Common validation commands:

```bash
pnpm format
pnpm lint
```

Documentation-only PRs usually do not need release checks. Maintainers can run `pnpm release:check` during release validation when they intentionally need the full release-prep check set.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

For bugs or feature suggestions, please use the GitHub issue templates.

## License

MIT
