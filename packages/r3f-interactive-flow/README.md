# r3f-interactive-flow

`r3f-interactive-flow` is a small React Three Fiber utility for predictable phase-based interactive flow control in client-side React/R3F sites.

It helps an app describe a known list of phases, move between those phases with `next`, `prev`, and `goTo`, read transition progress from DOM/UI, connect optional browser input hooks, and bridge the same flow state into Canvas-bound frame updates with `useFlowFrame`.

This README describes the current stable public API for r3f-interactive-flow. For release history, see CHANGELOG.md.

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

Supported imports are package-root imports only. Internal source, build, or responsibility-specific paths are not public API, including `r3f-interactive-flow/src/*`, `r3f-interactive-flow/dist/*`, `r3f-interactive-flow/react`, `r3f-interactive-flow/r3f`, and `r3f-interactive-flow/input`.

## Validated integration behavior

Published-package validation for the v2.5.0 usage milestone exercised `r3f-interactive-flow@2.4.0` from npm through package-root imports only. The durable behavior validated for consumers is that `next()`, `prev()`, and direct `goTo()` share one `FlowProvider` machine; rejected navigation from boundaries, locks, active transitions, or cooldowns is safe and does not queue stale movement.

A single `FlowProvider` can wrap DOM controls, input helpers, progress UI, and a Canvas subtree. DOM navigation and `useFlowProgress` do not require Canvas, and a remounted Canvas can observe the current provider-owned flow again through read-only `useFlowFrame` consumers. Input hooks call the existing `next` and `prev` controls. Accepted input navigation may call `preventDefault()` when enabled; rejected input preserves native page scrolling and native control behavior. Reduced motion is application-owned: pass the transition timing your app wants, and use a React `key` remount only when you intentionally want to apply a new provider configuration and reset flow state.

The evidence included representative desktop Chrome validation with physical mouse, high-resolution trackpad, and keyboard input, plus physical iPhone Safari touch validation. This is not broad browser certification, and optional physical tablet validation was not completed. Current bounded evidence includes focused Node/minimal-DOM tests for deterministic library contracts and one Vitest Browser Mode file running through a Playwright-managed headless Chromium instance for native activation, focus non-interference, prevention, repeat, and DOM ancestry. This is not physical-device, screen-reader, cross-browser, WCAG, or accessibility certification. The detailed input guide is available at <https://github.com/YT-TechDev/r3f-interactive-flow/blob/main/docs/guides/input-handling.md>, the accessible interaction and reduced-motion guide is available at <https://github.com/YT-TechDev/r3f-interactive-flow/blob/main/docs/guides/accessibility-and-reduced-motion.md>, and the repository evidence report is available at <https://github.com/YT-TechDev/r3f-interactive-flow/blob/main/docs/releases/v2.5.0-real-world-browser-validation-report.md>.

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

## Transition semantics

This section is the complete public transition contract and stands on its own. It is validated against the v2.8.0 test suite (`createFlowMachine.transition-regressions.test.ts`, `FlowProvider.test.tsx`, `useFlowFrame.test.tsx`).

### Initial snapshot

On mount, the snapshot reports the configured `initialPhase` (or the first phase in `phases`), `progress: 0`, `direction: "none"`, and `isTransitioning: false`.

### Accepted navigation start (positive duration)

Immediately after an accepted `next()`, `prev()`, or different-phase `goTo()` with a positive `duration`:

| Field                | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| `phase`/`phaseIndex` | the accepted **target**, synchronously                   |
| `progress`           | `0`                                                      |
| `direction`          | `"next"` or `"prev"`, from target index vs. source index |
| `isTransitioning`    | `true`                                                   |

The **source** phase (the phase being left) selects `transition.byPhase` options for this transition, but the source phase itself is not exposed in the public snapshot — only the target `phase` is.

### Active transition: easing and progress

While a positive-duration transition runs, raw elapsed progress is derived from elapsed time and `duration`, and the configured easing function receives that raw progress. Ordinary finite easing output is clamped to `[0, 1]` and becomes public `progress`.

- A non-monotonic or endpoint-producing custom easing function can make `progress` decrease, or reach `0` or `1`, before the transition actually finishes.
- **Raw elapsed time — not the eased `progress` value — decides completion.** Reaching `progress === 1` does not by itself prove the transition is done.
- `direction` and `isTransitioning` both stay unchanged until raw completion.

Use `isTransitioning` as the lifecycle signal, not `progress === 1` alone. Non-finite (`NaN`, `Infinity`) easing return values are not part of the stable contract — treat them as an incidental implementation detail, not something to rely on.

### Completion

At raw completion: `progress` is forced to `1`, `direction` becomes `"none"`, `isTransitioning` becomes `false`, and provider cooldown begins (if configured). The completed snapshot stays stable through cooldown-only time — nothing mutates it again until the next accepted navigation.

### Adjacent and non-adjacent `goTo()`

`next()`/`prev()` move exactly one phase index. `goTo(target)` navigates directly to any known phase, forward or backward, in **one** transition:

```text
phases: ["intro", "overview", "detail", "contact"]
current: "intro" (index 0)
goTo("contact") -> target "contact" (index 3), direction "next"
```

Intermediate phases (`"overview"`, `"detail"`) are neither visited nor queued. `transition.byPhase` resolves from the source phase for both adjacent and non-adjacent navigation. There is no route-pair configuration, graph, queue, or timeline — one direct transition per accepted call.

### Rejection and errors

| Request                            | Blocking condition          | Result                  |
| ---------------------------------- | --------------------------- | ----------------------- |
| `next`/`prev`                      | out of bounds               | rejected, no mutation   |
| `goTo(known target)`               | same as current phase       | rejected, no mutation   |
| `next`/`prev`/`goTo(known target)` | manual lock active          | rejected, no mutation   |
| `next`/`prev`/`goTo(known target)` | active transition           | rejected, no mutation   |
| `next`/`prev`/`goTo(known target)` | provider cooldown remaining | rejected, no mutation   |
| `goTo(unknown target)`             | any state                   | **throws**, no mutation |

An unknown `goTo()` target throws before the normal lock/transition/cooldown rejection path — this happens even while locked, transitioning, or in cooldown. With a properly typed closed phase union (an `as const` phase tuple), ordinary application code cannot construct an unknown target; an unsafe cast or an unvalidated dynamic string is what reaches this path. Known targets never throw — they are rejected as a safe no-op instead.

### Transition option precedence

Each option field resolves independently, in this order:

1. `transition.byPhase[sourcePhase].field`
2. `transition.field`
3. legacy top-level field (`transitionDurationMs`, `cooldownMs`, `easing` prop)
4. package default

Defaults: `duration: 1000`, `cooldown: 0`, `easing`: linear.

A `byPhase` override for one field (say, `duration`) does not replace the other fields (`cooldown`, `easing`) — each field falls back through the precedence chain independently. `byPhase` selects by **source** phase only; it does not select by target phase or by a source/target pair.

### Zero-duration transitions

An accepted transition with `duration: 0` completes synchronously in the same call: `phase`/`phaseIndex` update immediately, `progress` is `1` immediately, `direction` is `"none"` immediately, and `isTransitioning` stays `false` — there is no observable active-transition frame. Provider cooldown (if configured) starts immediately.

### Manual lock and cooldown composition

- **Manual lock** (`lock()`/`unlock()`) blocks new valid navigation. It does not pause, cancel, or slow an active transition, and it does not pause provider cooldown. It is a navigation gate, not a clock pause.
- **Provider cooldown** belongs to the provider-owned flow machine. It starts once a transition completes (including synchronous zero-duration completion) and rejects manual controls and all input hooks globally until it elapses. It continues to run while manual lock is active. It is not exposed as a remaining-time value.
- **Hook-local cooldown** belongs only to one `useWheelInput`/`useTouchInput`/`useKeyboardInput` instance. It starts only after that hook produces an accepted navigation and throttles only that hook — it does not lock the machine and does not block direct `next`/`prev`/`goTo` calls or other hook instances when provider state is otherwise ready.

### React and R3F sampling

One `FlowProvider` owns one flow machine and its transition clock for its mounted lifetime. `useFlow` and `useFlowProgress` are the public React/DOM observation surface; `useFlowFrame` (Canvas-bound) is a read-only R3F observer that samples the same machine every frame without advancing it. Multiple React and R3F consumers observe the same provider-owned flow, but React commits and R3F frames run on separate scheduling paths — they are not guaranteed to read the exact same `progress` at the exact same instant.

### Source and target metadata

r3f-interactive-flow intentionally does not add `sourcePhase`, `targetPhase`, or `previousPhase` to `FlowSnapshot`, `FlowControls`, or `FlowFrameState`. Evaluation found no genuine missing capability: `phase` already reports the accepted target immediately, and `direction` reports forward/reverse for positive-duration transitions.

When application code needs the phase a transition left from:

1. Retain the previously observed public `phase` in a ref or state.
2. On render (or frame), compare it against the current public `phase`.
3. When the phase has actually changed, the retained value is the source and the new `phase` is the target; then update the retained value.
4. For a positive-duration transition, use the current `direction` directly. For a zero-duration transition (where `direction` is already `"none"` in the same call), derive direction by comparing the source and target phase indexes instead.

Rejected and same-phase requests never mutate the public `phase`, so this derivation never records a false trace. This pattern is application code built on public `useFlow`/`useFlowFrame` output — it is not a package API, and no such field is planned.

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
  const { phase, phaseIndex, next, prev, goTo } = useFlow<Phase>();

  return (
    <div>
      <p>Current phase: {phase}</p>
      <button type="button" onClick={prev} disabled={phaseIndex === 0}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={phaseIndex === phases.length - 1}>
        Next
      </button>
      <button type="button" onClick={() => goTo("contact")}>
        Contact
      </button>
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

`FlowProvider` reads its configuration when that provider instance mounts. Ordinary parent rerenders, including fresh equivalent inline arrays or objects, preserve the current flow state; changing configuration props alone does not reconfigure the mounted machine. To intentionally reset state or apply new phases, timing, cooldown, or easing, change the provider element's React `key` so React remounts it. Hoist phase tuples for TypeScript inference, readability, and a clear phase type—not merely to prevent rerender resets. `key` is React's remount mechanism, not a `FlowProvider` API prop.

## Focused usage recipes

These recipes use package root imports only. Keep DOM controls and input layers under `FlowProvider`; keep R3F frame work inside Canvas-bound components.

### Minimal phase navigation

```tsx
import { FlowProvider, useFlow } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function Navigation() {
  const { phase, phaseIndex, next, prev, goTo } = useFlow<Phase>();

  return (
    <nav>
      <p>Phase: {phase}</p>
      <button type="button" onClick={prev} disabled={phaseIndex === 0}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={phaseIndex === phases.length - 1}>
        Next
      </button>
      <button type="button" onClick={() => goTo("contact")}>
        Contact
      </button>
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
      <button type="button" onClick={prev} disabled={phaseIndex === 0}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={phaseIndex === phases.length - 1}>
        Next
      </button>
      <button type="button" onClick={() => goTo("work")}>
        Work
      </button>
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

`useFlowProgress` is for DOM UI such as labels and progress bars. It updates every animation frame while a transition runs, so this `<progress>` element moves smoothly from `0` to `1` with no `<Canvas>` mounted — navigation and progress are fully Canvas-free. Reserve `useFlowFrame` for animating an R3F scene instead of copying every-frame values into React state.

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

const inputIgnore = ["[data-flow-ignore]"] as const;
const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500, ignore: inputIgnore });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500, ignore: inputIgnore });
  useKeyboardInput<Phase>({ cooldown: 250, keys: keyboardKeys });

  return null;
}
```

Mount input hooks from a client-side input layer under `FlowProvider`, outside the R3F scene tree by default. Browser listeners are attached in React Effects after mount; `enabled: false` skips setup, and cleanup follows unmount or Effect replacement. An omitted target resolves to `window`, but an unresolved explicit ref attaches nowhere and never falls back to `window`. Later arbitrary `ref.current` changes are not automatically tracked; for dynamic targets, pass a resolved element through React state or intentionally reconfigure/remount the input layer. Touch support is bounded single-touch swipe behavior, not a full gesture framework. Use `ignore` selectors for wheel and touch regions that should not trigger flow navigation, such as `<div data-flow-ignore />`; keyboard input has no `ignore` selector and ignores typing targets by default.

### Lock and cooldown notes

Use the existing `lock`, `unlock`, provider transition cooldown, and input hook cooldown options to prevent repeated accidental phase changes. Provider transition cooldown starts after the accepted transition completes, runs for the full configured duration after completion, and applies globally to manual controls and all input hooks. Hook-local cooldown starts only after that hook produces an accepted input navigation and remains separate. Input hooks respect active positive-duration transitions, locks, phase boundaries, and cooldowns; they drive the same `next` and `prev` controls rather than bypassing flow state. There is no `lockDuringTransition` option in the current v2 API. A transition duration of `0` is supported as immediate: `progress` settles at `1`, `isTransitioning` is `false`, and any provider cooldown starts immediately after that synchronous completion.

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
  const { phaseIndex, next, prev, goTo } = useFlow<Phase>();

  return (
    <div>
      <button type="button" onClick={prev} disabled={phaseIndex === 0}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={phaseIndex === phases.length - 1}>
        Next
      </button>
      <button type="button" onClick={() => goTo("contact")}>
        Contact
      </button>
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

`useFlowProgress` returns the current transition progress from the active provider snapshot. Use it for DOM progress labels, status displays, and progress bars; it advances continuously while a transition runs. For frame-driven scene animation, use `useFlowFrame` inside Canvas-bound components instead of pushing every-frame values through React state.

## R3F frame bridge

`useFlowFrame` bridges flow state into the React Three Fiber frame loop for scene animation. It is a read-only observer: it reads the provider-owned machine each frame without advancing it, so transitions are driven by the provider clock whether or not any `useFlowFrame` consumer is mounted. It must be called from a component rendered inside `<Canvas>` and under `FlowProvider`.

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

## Client usage and Next.js App Router boundary

`FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and input hooks are client-side React APIs. In Next.js App Router projects, use them from Client Components and add `"use client"` to files that render the provider or call these hooks.

- Server Components can pass serializable data into a Client Component wrapper, but this package does not claim Server Component support.
- Do not render `FlowProvider` or call flow hooks directly from Server Components.
- Do not access `window`, `document`, or browser event APIs at module import time. Browser input hooks attach listeners only from client-side runtime effects.
- `useFlowFrame` still belongs only in Canvas-bound components.
- The package is Next.js compatible, but not Next.js integrated. Next.js is not a dependency.
- The package does not provide Next.js router integration.

## Hook boundary summary

| Hook or component                                    | Where it belongs                                                         | Use it for                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `FlowProvider`                                       | Client-side React tree around the UI and Canvas integration area         | One shared phase machine for DOM controls, status UI, optional input helpers, and the `<Canvas>` subtree |
| `useFlow`                                            | Client-side React components rendered under `FlowProvider`               | Phase state, labels, navigation controls, locks, and DOM/client UI wiring                                |
| `useFlowProgress`                                    | Client-side React components rendered under `FlowProvider`               | DOM progress labels, status text, and progress bars that update continuously during a transition         |
| `useFlowFrame`                                       | R3F scene components rendered inside `<Canvas>` and under `FlowProvider` | Bridging flow state into the R3F frame loop for refs and Canvas-local objects                            |
| `useWheelInput`, `useTouchInput`, `useKeyboardInput` | Client-side React input layer components rendered under `FlowProvider`   | Browser wheel, touch, and keyboard listeners that drive existing flow controls                           |

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
