# r3f-interactive-flow

## Overview

`r3f-interactive-flow` is a small React Three Fiber utility for predictable phase, input, transition, and frame control in interactive R3F websites.

It gives your app a typed phase machine, DOM-friendly controls, browser input hooks, transition progress, and a Canvas-bound `useFlowFrame` bridge. React owns normal application and UI state. React Three Fiber owns frame-driven scene updates.

## What this library is not

This library intentionally keeps a narrow scope. It does not provide:

- visual effects, shaders, camera presets, or animation timelines
- scene templates, portfolio templates, or demo kits
- router integration
- GSAP or Framer Motion integration
- replacements for `@react-three/fiber`, `three`, or `@react-three/drei`

Users own animation, effects, camera, and scene logic. `r3f-interactive-flow` only coordinates predictable phase/input/frame state.

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

`react`, `react-dom`, `three`, and `@react-three/fiber` are peer dependencies. Install them in your application.

```json
{
  "@react-three/fiber": ">=8.0.0 <10.0.0",
  "react": ">=18.0.0 <20.0.0",
  "react-dom": ">=18.0.0 <20.0.0",
  "three": ">=0.150.0 <1.0.0"
}
```

## Minimal setup

Define phases as a const tuple, pass them to `FlowProvider`, and render flow hooks inside the provider.

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

`FlowProvider` props should stay stable between renders. Define phase tuples outside components, or memoize derived configuration.

## Flow controls with `useFlow`

`useFlow` returns the current snapshot plus imperative controls:

- `phase`
- `phaseIndex`
- `progress`
- `direction`
- `isTransitioning`
- `isLocked`
- `next()`
- `prev()`
- `goTo(phase)`
- `lock()`
- `unlock()`

Use `useFlow` for DOM UI such as navigation buttons, labels, debug panels, or accessibility-friendly controls.

```tsx
function FlowNav() {
  const { phase, phaseIndex, next, prev, goTo, isTransitioning } = useFlow<Phase>();

  return (
    <nav>
      <p>
        Current phase: {phase} / {phaseIndex}
      </p>
      <button onClick={prev} disabled={isTransitioning}>
        Prev
      </button>
      <button onClick={next} disabled={isTransitioning}>
        Next
      </button>
      <button onClick={() => goTo("contact")} disabled={isTransitioning}>
        Go to Contact
      </button>
    </nav>
  );
}
```

## DOM UI to Canvas pattern

Recommended architecture:

- DOM React UI controls the current phase with `useFlow`.
- DOM/stateful UI can read coarse progress with `useFlowProgress` or `useFlow`.
- R3F Canvas components read phase/progress/frame state with `useFlowFrame`.
- Values that change every frame should not be pushed through React state.
- Frame-driven visual updates should live in Canvas-bound components.
- `useFlowFrame` must run inside a component rendered within `<Canvas>`.

```tsx
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlow, useFlowFrame, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "skills", "projects", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowNav() {
  const { phase, phaseIndex, next, prev, goTo, isTransitioning } = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <nav>
      <p>
        Current phase: {phase} / {phaseIndex}
      </p>
      <p>DOM progress: {progress.toFixed(2)}</p>

      <button onClick={prev} disabled={isTransitioning}>
        Prev
      </button>

      <button onClick={next} disabled={isTransitioning}>
        Next
      </button>

      <button onClick={() => goTo("projects")} disabled={isTransitioning}>
        Go to Projects
      </button>
    </nav>
  );
}

function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress, direction }, delta) => {
    if (!meshRef.current) {
      return;
    }

    if (phase === "intro") {
      meshRef.current.position.z = -4 + progress * 4;
    }

    if (phase === "skills") {
      meshRef.current.rotation.y += delta;
    }

    if (phase === "projects") {
      const sign = direction === "prev" ? -1 : 1;
      meshRef.current.position.x = progress * sign * 2;
    }
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
    <FlowProvider
      phases={phases}
      transition={{
        duration: 1000,
        cooldown: 500,
        byPhase: {
          intro: {
            duration: 1600
          }
        }
      }}
    >
      <FlowNav />

      <Canvas>
        <ambientLight />
        <FlowBox />
      </Canvas>
    </FlowProvider>
  );
}
```

`FlowNav` is normal DOM React UI. `FlowBox` is rendered inside the R3F Canvas and may call `useFlowFrame`. The library does not provide visual effects or animation presets; the scene update logic is yours.

## Frame updates with `useFlowFrame`

Use `useFlowFrame` for frame-driven Canvas updates. It uses React Three Fiber's `useFrame` internally, so it follows the same rule: call it only from components rendered within `<Canvas>`.

```tsx
function RotatingPhaseMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress, isTransitioning }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.position.x = phase === "work" ? progress * 2 : 0;
    meshRef.current.visible = isTransitioning || progress > 0;
  });

  return <mesh ref={meshRef} />;
}
```

The frame state includes:

- `phase`
- `phaseIndex`
- `progress`
- `direction`
- `isTransitioning`

DOM-facing `useFlowProgress()` and `flow.progress` are useful for stateful UI, but they are not intended as frame-perfect animated values.

## Transition options

`transition` is the preferred timing API for `FlowProvider`.

```tsx
<FlowProvider
  phases={phases}
  transition={{
    duration: 1000,
    cooldown: 500,
    easing: (t) => t,
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

- `transition.duration` controls transition duration in milliseconds.
- `transition.cooldown` controls the core accepted-navigation cooldown in milliseconds.
- `transition.easing` controls easing.
- `transition.byPhase` uses the source phase. For example, `byPhase.intro` is used when leaving `intro`, regardless of the target phase.
- Fallback is per field: a phase override with only `duration` still uses global, legacy, or default cooldown/easing.
- `transition` takes precedence over legacy `transitionDurationMs`, `cooldownMs`, and `easing` when both are provided.
- Legacy timing props still work for compatibility.
- `lockDuringTransition` is intentionally not part of the current API. Navigation is ignored while a transition is active.

Public transition option types are exported as `FlowTransitionBaseOptions` and `FlowTransitionOptions`.

## Input hooks

Input hooks connect browser input to `next` and `prev`. They attach browser event listeners inside React effects and are guarded for non-browser environments.

Use an ignore selector list to avoid hijacking controls and editable content:

```ts
const ignore = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  "[contenteditable]",
  "[data-flow-ignore]"
];
```

### `useWheelInput`

```tsx
function InputLayer() {
  useWheelInput<Phase>({
    target: undefined,
    threshold: 40,
    axis: "y",
    cooldown: 500,
    ignore,
    preventDefault: true,
    enabled: true
  });

  return null;
}
```

Wheel down navigates to `next`; wheel up navigates to `prev` on the default `y` axis. Set `axis: "x"` for horizontal wheel gestures.

### `useTouchInput`

```tsx
function InputLayer() {
  useTouchInput<Phase>({
    target: undefined,
    threshold: 50,
    axis: "y",
    cooldown: 500,
    ignore,
    preventDefault: true,
    enabled: true
  });

  return null;
}
```

On the default `y` axis, swipe up navigates to `next` and swipe down navigates to `prev`. Set `axis: "x"` for horizontal swipes.

### `useKeyboardInput`

```tsx
function InputLayer() {
  useKeyboardInput<Phase>({
    target: undefined,
    keys: {
      next: ["ArrowDown", "ArrowRight", "PageDown", " "],
      prev: ["ArrowUp", "ArrowLeft", "PageUp"]
    },
    cooldown: 500,
    preventDefault: true,
    enabled: true
  });

  return null;
}
```

`keys.next` and `keys.prev` are the current keyboard configuration API. `nextKeys` and `prevKeys` still work as deprecated compatibility aliases. Keyboard input also ignores typing in inputs, textareas, selects, and contenteditable elements by default.

`target` accepts a `FlowInputTarget`: an `HTMLElement`, `Window`, or React ref object pointing to an element. If omitted, input hooks use `window`.

## Next.js / browser API safety notes

This package is designed to be usable from Next.js App Router Client Components.

- Use `FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and input hooks from Client Components.
- The package entry is marked as a client entry for Next.js App Router compatibility.
- Browser APIs are used inside hooks/effects, not at module import time.
- The package does not add Next.js as a dependency.
- No Next.js router integration is included.
- `useFlowFrame` still follows React Three Fiber rules and must be used inside a Canvas-bound component.

## Migration notes

### v0.3.0 `useFlowFrame` callback

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

The new callback type is exported as `FlowFrameCallback`, and the first argument type is exported as `FlowFrameState`.

### Timing props

Prefer `transition={{ duration, cooldown, easing, byPhase }}` for new code. Legacy `transitionDurationMs`, `cooldownMs`, and `easing` props remain supported for compatibility.

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
- `FlowTransitionBaseOptions`
- `FlowTransitionOptions`
- `FlowInputTarget`
- `UseWheelInputOptions`
- `UseTouchInputOptions`
- `UseKeyboardInputOptions`

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

## Development / validation

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
