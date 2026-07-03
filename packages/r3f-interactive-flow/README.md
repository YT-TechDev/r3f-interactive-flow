# r3f-interactive-flow

## Overview

`r3f-interactive-flow` is a small React Three Fiber utility for predictable phase, input, transition, and frame control in interactive R3F websites.

It gives your app a typed phase machine, DOM-friendly controls, optional browser input hooks, transition progress, and a Canvas-bound `useFlowFrame` bridge. React manages application and UI state. React Three Fiber manages frame-based visual updates. This library bridges them through predictable phase transitions.

## What this library is not

This library intentionally keeps a narrow scope. It does not provide:

- visual effects collections
- camera presets
- shader APIs
- animation timelines
- scene templates, portfolio templates, or demo kits
- router integration
- GSAP or Framer Motion wrappers
- replacements for `@react-three/fiber`, `three`, or `@react-three/drei`

Users own animation, effects, camera, shader, router, and scene logic. `r3f-interactive-flow` only coordinates predictable phase/input/frame state.

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

`react`, `react-dom`, `three`, and `@react-three/fiber` are peer dependencies. Install them in your application alongside `r3f-interactive-flow`. The library does not bundle React, React DOM, Three.js, or React Three Fiber, and it does not require `@react-three/drei`, GSAP, Framer Motion, or other visual or animation libraries.

```json
{
  "@react-three/fiber": ">=8.0.0 <10.0.0",
  "react": ">=18.0.0 <20.0.0",
  "react-dom": ">=18.0.0 <20.0.0",
  "three": ">=0.150.0 <1.0.0"
}
```

## Minimal setup

Define phases as a const tuple, wrap the shared subtree with `FlowProvider`, and keep DOM controls separate from Canvas-bound scene logic.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlow, useFlowFrame, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function OverlayControls() {
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
      <OverlayControls />
      <ProgressLabel />

      <Canvas>
        <ambientLight />
        <SceneObject />
      </Canvas>
    </FlowProvider>
  );
}
```

`FlowProvider` should wrap every component that shares one flow state: DOM controls, DOM status labels, optional input helpers, and the `<Canvas>` subtree. `useFlow` and `useFlowProgress` are regular React hooks for DOM UI under the provider. `useFlowFrame` is for components rendered inside `<Canvas>` because it uses React Three Fiber frame behavior.

Keep provider inputs stable between renders. Define static phase tuples outside components, or memoize derived phase lists and transition configuration.

## FlowProvider usage

`FlowProvider` is the main React-side entry point for phase-based flow state. It creates the flow machine for a known list of phases, keeps a React snapshot of the current phase state, and provides controls and transition state to hooks rendered below it.

Place one `FlowProvider` above the React subtree that should share the same phase state. For a typical R3F page, that shared subtree contains DOM navigation, status UI, optional browser input components, and the `<Canvas>` area.

```tsx
const phases = ["intro", "details", "contact"] as const;
type Phase = (typeof phases)[number];

const transition = { duration: 700, cooldown: 250 };

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
    <FlowProvider phases={phases} initialPhase="intro" transition={transition}>
      <Status />
      <Controls />
      {/* Canvas and Canvas-bound components can live here too. */}
    </FlowProvider>
  );
}
```

Child components consume flow state through the existing hooks:

- `useFlow` reads the current snapshot and calls controls such as `next`, `prev`, and `goTo` from DOM/client UI.
- `useFlowProgress` reads provider progress for DOM status, labels, and coarse UI.
- `useFlowFrame` is the Canvas-bound bridge for frame updates in R3F components.

Do not use R3F hooks such as `useFrame`, `useThree`, or `useFlowFrame` in provider setup, route/layout components, or ordinary DOM controls. Keep browser input and DOM listener logic in React/client components under `FlowProvider`, and let Canvas scene objects react to the resulting flow state.

## Input behavior baseline

The input hooks are optional DOM/client-side utilities for driving the existing flow controls. They are documented here as the v1.4.0 input behavior baseline: practical navigation helpers, not R3F visual effects, router behavior, animation timelines, or scene systems.

Render input hooks from React components under `FlowProvider`, outside Canvas scene objects. They attach browser event listeners from effects, so browser APIs are not accessed at module import time. When browser APIs are unavailable, or when `enabled: false`, the hooks do not attach listeners. Disabled hooks also skip option validation, so temporarily disabled input can carry incomplete or invalid navigation options without throwing until re-enabled.

By default, input hooks listen on `window`. Where `target` is supported, pass `window`, an `HTMLElement`, or a ref to an `HTMLElement`; an empty ref falls back to `window`. Listeners are removed on unmount, when input is disabled, and when the target changes.

### Wheel input

`useWheelInput` listens for `wheel` events and maps movement on one axis to `next` or `prev` navigation.

- Default target: `window`.
- Supported targets: `window`, an `HTMLElement`, or an element ref.
- Default axis: `"y"`; `axis: "x"` uses `deltaX` instead of `deltaY`.
- Default threshold: `40`.
- Default cooldown: `0`.
- Default `preventDefault`: `true` for non-ignored wheel events.
- Positive movement beyond the selected-axis threshold requests `next`.
- Negative movement beyond the selected-axis threshold requests `prev`.
- Movement at or inside the threshold is ignored. For example, with `threshold: 40`, `40` and `-40` do not navigate, while `41` and `-41` can.
- `threshold: 0` is allowed; invalid finite-negative or non-finite thresholds throw only while enabled.
- `ignore` selectors skip matching events without calling `preventDefault` or consuming hook-local cooldown.

### Keyboard input

`useKeyboardInput` listens for `keydown` events and maps configured keys to `next` or `prev` navigation.

- Default target: `window`.
- Supported targets: `window`, an `HTMLElement`, or an element ref.
- Default next keys: `ArrowDown`, `ArrowRight`, `PageDown`, and Space.
- Default previous keys: `ArrowUp`, `ArrowLeft`, and `PageUp`.
- Default cooldown: `0`.
- Default `preventDefault`: `true` only for mapped, non-ignored key events.
- Unmapped keys are ignored and are not prevented.
- Repeated `keydown` events (`event.repeat`) are ignored.
- Typing targets are ignored by default: `input`, `textarea`, `select`, and `contenteditable` elements. Set `ignoreWhenTyping: false` to allow mapped keys from those targets.
- Prefer `keys: { next, prev }` for custom mappings. The legacy `nextKeys` and `prevKeys` aliases are still recognized, but `keys` takes precedence when both are provided.
- If the same key is mapped to both directions, `next` wins.

### Touch input

`useTouchInput` listens for touch gestures and maps one completed touch start/end gesture to `next` or `prev` navigation.

- Default target: `window`.
- Supported targets: `window`, an `HTMLElement`, or an element ref.
- Default axis: `"y"`; `axis: "x"` compares horizontal positions instead.
- Default threshold: `50`.
- Default cooldown: `0`.
- Default `preventDefault`: `true` for non-ignored `touchmove` events.
- On the `y` axis, swipe up beyond the threshold requests `next`; swipe down beyond the threshold requests `prev`.
- On the `x` axis, swipe left beyond the threshold requests `next`; swipe right beyond the threshold requests `prev`.
- Movement at or inside the threshold is ignored. For example, with `threshold: 40`, a 40px gesture does not navigate, while a 41px gesture can.
- `threshold: 0` is allowed; invalid finite-negative or non-finite thresholds throw only while enabled.
- Missing `touches[0]` on `touchstart`, missing `changedTouches[0]` on `touchend`, or `touchend` without a stored `touchstart` is ignored without throwing.
- `touchcancel` resets the stored gesture start so a later `touchend` does not navigate accidentally.
- `ignore` selectors skip matching gestures without preventing default touch movement or consuming hook-local cooldown.

### Locks, transitions, and cooldowns

Input hooks request the existing flow controls; they do not bypass core navigation rules.

- Supported input navigation directions are `next` and `prev`.
- Input while `isLocked` is ignored.
- Input while `isTransitioning` is ignored.
- Previous navigation at the first phase is ignored. Next navigation at the last phase is rejected by the core flow machine.
- Hook-local `cooldown` starts only after an accepted input-driven navigation. Ignored or rejected input does not consume or extend it.
- Hook-local cooldown is separate from the core transition cooldown configured on `FlowProvider`. Even when a hook-local cooldown allows an event, the core transition cooldown can still reject navigation until the flow machine is ready.

### DOM and R3F separation

Keep DOM input hooks in React/client components under `FlowProvider`, not inside R3F scene objects by default. DOM input logic owns browser listener setup, cleanup, ignore selectors, typing-target behavior, locks, and cooldown checks. Canvas-bound scene components should react to flow state with `useFlowFrame` and R3F hooks, not own global browser input wiring.

### Browser API safety

The input modules are safe to import when `window` or related browser globals are unavailable. Browser targets are resolved from effects after render, and listeners attach only when enabled and browser APIs exist. This keeps package imports compatible with server-rendered module loading, while actual input handling remains client-side behavior.

## Usage checklist

Use this checklist before adding or editing examples, docs, or app code that uses `r3f-interactive-flow`. The package is a small predictable control layer for shared phase state, browser input, transition progress, and Canvas-bound frame updates. It is not a visual effects framework.

### Provider

- Define `phases` as a stable readonly tuple when possible, such as `const phases = ["intro", "work", "contact"] as const`.
- Place one `FlowProvider` above the DOM UI, optional input helpers, status labels, and `<Canvas>` subtree that should share one flow state.
- Do not split DOM controls and Canvas scene objects across separate providers unless the flows are intentionally isolated.
- Keep transition configuration stable between renders by defining static objects outside components or memoizing derived values.

### DOM UI

- Use `useFlow` in DOM/client components for `phase`, `phaseIndex`, and controls such as `next`, `prev`, and `goTo`.
- Use `useFlowProgress` for coarse DOM progress labels, status UI, or simple progress bars.
- Do not call R3F hooks such as `useFrame`, `useThree`, or `useFlowFrame` from DOM UI, route, layout, or provider setup components.

### Browser input

- Mount `useWheelInput`, `useTouchInput`, or `useKeyboardInput` from DOM/client components rendered under `FlowProvider`.
- Keep browser event listener wiring out of mesh and scene object components by default.
- Remember that input helpers do not require `<Canvas>`; they drive the existing flow controls from the DOM/client layer.
- Use ignore selectors and typing-target behavior intentionally so input does not hijack form controls or links.

### Canvas scene

- Render R3F scene objects inside `<Canvas>`.
- Use `useFlowFrame` only from Canvas-bound components that need per-frame phase or progress data.
- Use R3F hooks such as `useFrame` and `useThree` only inside Canvas-bound components.
- Update refs, transforms, visibility, materials, cameras, or other mutable Three.js scene state from frame-based logic.

### Frame updates

- Do not push every-frame mesh, material, camera, or transform values through React state.
- Keep high-frequency visual values in refs or mutable Three.js object state.
- Use React state and React-side flow snapshots for controls, labels, accessibility state, and other stable UI.

### Scope boundaries

- Do not add animation timelines, camera preset APIs, shader effect APIs, particle systems, router integration, or GSAP / Framer Motion wrapper language to examples.
- Do not present the package as a `@react-three/drei` replacement, scene template, portfolio template, or visual effects collection.
- Keep examples small, dependency-light, and focused on phase control, DOM-to-Canvas wiring, and predictable frame updates.

## v1.5.0 usage readiness baseline

The v1.5.0 usage readiness baseline documents the current stable usage model. It is a documentation closeout for clearer examples, DOM-to-Canvas wiring, checklist guidance, entrypoint export coverage, and peer dependency expectations. It does not add runtime behavior or broaden the public API.

### Expected usage model

- Define stable phase tuples and wrap the shared DOM and Canvas subtree with one `FlowProvider`.
- Use `useFlow` for DOM/client controls and `useFlowProgress` for DOM/client progress or status UI.
- Mount `useWheelInput`, `useTouchInput`, and `useKeyboardInput` from DOM/client components under `FlowProvider` when browser input helpers are needed.
- Use `useFlowFrame` from Canvas-bound R3F components for per-frame phase and progress data.
- Keep R3F hooks inside Canvas-bound components, and keep every-frame visual values in refs or mutable Three.js object state instead of React state.

### Package expectations

- Keep package usage focused on phase control, transition progress, DOM controls, optional browser input helpers, and Canvas-bound frame updates.
- Treat the package entrypoint export tests as the guard for the current runtime export surface.
- Provide `react`, `react-dom`, `three`, and `@react-three/fiber` from the consuming app as peer dependencies.

### Not covered by this baseline

This baseline does not promise public API expansion, runtime dependency additions, router or Next.js-specific router integration, animation timelines, visual effect systems, camera presets, shader APIs, particle or effect collection APIs, GSAP or Framer Motion wrappers, large demos, portfolio templates, CLI or code generation, AI-specific runtime behavior, release automation, package version changes, npm publishing, git tags, or changelog release entries.

## Common mistakes and anti-patterns

Use this section as a quick checklist when wiring a flow. Most issues come from mixing provider scope, Canvas scope, browser input, and per-frame animation responsibilities.

### Calling hooks outside `FlowProvider`

- **Mistake:** Calling `useFlow`, `useFlowProgress`, or `useFlowFrame` from a component that is not rendered under `FlowProvider`.
- **Why it is a problem:** These hooks read the shared flow context. Without the provider, the component has no flow machine, snapshot, controls, or transition state to read.
- **Recommended approach:** Put one `FlowProvider` above the DOM UI, input helpers, and `<Canvas>` subtree that should share the same flow state.

### Splitting shared state across multiple providers

- **Mistake:** Mounting one `FlowProvider` around DOM controls and another around the Canvas when both areas are expected to stay in sync.
- **Why it is a problem:** Each provider owns its own flow machine. Navigation in one provider does not update the other provider.
- **Recommended approach:** Use a single shared provider for one shared interactive experience. Only mount multiple providers when you intentionally want independent flow states.

### Recreating `phases` or transition config every render

- **Mistake:** Creating `phases`, `transition`, or `transition.byPhase` inline on every render.
- **Why it is a problem:** Unstable provider props can recreate flow configuration unnecessarily and make transition behavior harder to reason about.
- **Recommended approach:** Define static phase tuples and transition objects outside components, or memoize values that must be derived from props or data.

### Calling Canvas-bound hooks from DOM components

- **Mistake:** Calling `useFlowFrame`, `useFrame`, or `useThree` in DOM UI, route, layout, or provider setup components.
- **Why it is a problem:** These hooks are Canvas-bound. `useFlowFrame` uses React Three Fiber frame behavior and must run from a component rendered inside `<Canvas>`.
- **Recommended approach:** Use `useFlow` and `useFlowProgress` for DOM UI. Use `useFlowFrame` only in R3F scene components rendered inside `<Canvas>`.

### Pushing frame-perfect visual values through React state

- **Mistake:** Calling React state setters every frame for mesh positions, material values, camera movement, or other high-frequency visual updates.
- **Why it is a problem:** React state is for application state and stable UI snapshots, not frame-by-frame scene mutation. Per-frame state updates can cause unnecessary React renders and jittery scene code.
- **Recommended approach:** Keep frame-driven values in refs or mutable Three.js object state inside Canvas-bound components. Use React state for controls, labels, status UI, and other coarse snapshots.

### Mixing DOM input logic into scene objects

- **Mistake:** Registering wheel, touch, or keyboard DOM event handling directly inside R3F mesh or scene components by default.
- **Why it is a problem:** Scene components become responsible for browser listener setup, cleanup, ignore selectors, cooldowns, and flow controls, which blurs DOM input and R3F rendering responsibilities.
- **Recommended approach:** Put browser input helpers in React/client components inside `FlowProvider`. Let Canvas-bound scene code react to the resulting flow state with `useFlowFrame`.

### Treating React-side progress as frame-perfect animation data

- **Mistake:** Using `useFlowProgress` or `useFlow().progress` as the source for frame-perfect Canvas animation.
- **Why it is a problem:** React-side progress is useful for DOM status, labels, disabled states, and coarse UI. Canvas animation should be driven on the R3F frame loop.
- **Recommended approach:** Use `useFlowFrame` for per-frame mesh, material, camera, and scene updates. Use `useFlowProgress` for DOM progress indicators and other UI that does not need frame-perfect updates.

### Expanding examples beyond the library scope

- **Mistake:** Presenting examples as animation timelines, routers, visual effects collections, camera preset systems, shader systems, portfolio templates, `@react-three/drei` replacements, or GSAP / Framer Motion wrappers.
- **Why it is a problem:** The library is a focused phase/input/frame coordination utility. Broad examples imply features and maintenance responsibilities that are outside the public API.
- **Recommended approach:** Keep examples small, dependency-light, and copy-paste-friendly. Show one concept at a time with React, React Three Fiber, Three.js, and the existing public hooks.

## Flow controls with `useFlow`

`useFlow` is the React-side hook for reading the current flow snapshot and calling flow controls. It must be called from a React component rendered under `FlowProvider`.

It returns the current snapshot values:

- `phase`: the active phase value from the `phases` tuple.
- `phaseIndex`: the zero-based index of `phase` in the `phases` tuple.
- `progress`: the current transition progress from `0` to `1`.
- `direction`: `"next"`, `"prev"`, or `"none"` for the active or most recent transition direction.
- `isTransitioning`: whether a transition is currently active.
- `isLocked`: whether navigation is currently locked.

It also returns controls:

- `next()`: request navigation to the next phase.
- `prev()`: request navigation to the previous phase.
- `goTo(phase)`: request navigation to a specific phase.
- `lock()`: block new navigation requests.
- `unlock()`: allow navigation requests again.

Use `useFlow` when a component needs flow controls or more than just transition progress. Common uses include DOM navigation, buttons, labels, debug panels, accessibility-friendly controls, and input-driven controls that call `next`, `prev`, `goTo`, `lock`, or `unlock`.

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

`isLocked` is useful for temporarily blocking navigation from UI or input layers:

```tsx
function LockToggle() {
  const { isLocked, lock, unlock } = useFlow<Phase>();

  return (
    <button onClick={isLocked ? unlock : lock}>
      {isLocked ? "Unlock navigation" : "Lock navigation"}
    </button>
  );
}
```

`useFlow` is not a frame-perfect animation API. Reading `progress` from `useFlow` is fine for React UI, labels, disabled states, and coarse status displays. For per-frame Canvas animation, use `useFlowFrame` inside a component rendered within `<Canvas>`.

## Core behavior baseline

The core flow machine is intentionally small and deterministic. The v1.3.0 baseline tests define the behavior below for phase snapshots, navigation requests, transition timing, locks, and cooldowns. This section describes the core machine behavior, not R3F visual effects, input-hook semantics, router behavior, or animation presets.

### Snapshot fields

A flow snapshot contains the current phase state and transition flags:

- `phase`: the current target phase. A valid transition updates this value immediately when navigation starts.
- `phaseIndex`: the zero-based index for `phase`.
- `progress`: transition progress. The initial snapshot starts at `0`. A valid transition starts at `0`, advances only when time is passed through explicit updates, reaches `1` when the transition completes, and remains `1` while settled after a completed transition.
- `direction`: `"next"`, `"prev"`, or `"none"`. Forward moves use `"next"`; backward moves use `"prev"`; completed and idle snapshots use `"none"`.
- `isTransitioning`: `true` during an active transition and `false` before a transition starts or after it completes.
- `isLocked`: `true` after manual `lock()` and `false` after `unlock()`.

The initial settled snapshot uses the initial phase, its phase index, `progress: 0`, `direction: "none"`, `isTransitioning: false`, and `isLocked: false`. After the first completed transition, the settled progress is `1`.

### Navigation controls

`next()`, `prev()`, and `goTo(phase)` request transitions between known phases:

- `next()` starts a transition to the next phase when there is one.
- `prev()` starts a transition to the previous phase when there is one.
- `goTo(phase)` starts a transition when the requested phase is known and different from the current phase.
- `goTo(phase)` uses `direction: "next"` when moving to a later phase and `direction: "prev"` when moving to an earlier phase.
- Starting any valid transition sets the target `phase` and `phaseIndex` immediately, sets `progress` to `0`, sets `isTransitioning` to `true`, and records the transition `direction`.

Boundary and no-op requests are ignored and leave the snapshot stable:

- `next()` at the last phase is ignored.
- `prev()` at the first phase is ignored.
- `goTo()` targeting the current phase is ignored.

### Transition lifecycle

Transition timing is driven by explicit updates from the host layer. During a transition, `progress` advances from `0` toward `1` as update time accumulates. When enough time has been provided for the configured duration, the transition completes with `progress: 1`, `direction: "none"`, and `isTransitioning: false`. Additional updates after completion keep the settled snapshot stable unless they advance cooldown timing.

Navigation requested while a transition is active is ignored. Ignored requests do not restart the active transition, reverse its direction, change its target phase, extend its timing, or extend cooldown gates. This applies to repeated `next()` / `prev()` calls, `goTo()` calls for other phases, `goTo()` calls for the already-targeted phase, and boundary-style requests made while another transition is active.

### Locks and cooldowns

Manual locking blocks new navigation requests:

- `lock()` sets `isLocked` to `true`.
- Navigation while locked is ignored and leaves the snapshot stable.
- Locking during an active transition does not stop that transition; explicit updates continue advancing it.
- A completed transition can remain locked with `isLocked: true`; navigation remains ignored until `unlock()` is called.
- `unlock()` sets `isLocked` to `false` and allows later valid navigation requests again.

When `cooldownMs` is configured, cooldown behavior is time-driven by explicit updates. After a transition completes, navigation remains ignored until enough update time has advanced through the cooldown window. Ignored navigation during cooldown does not extend the cooldown. This describes the core machine behavior only; browser input hooks may add their own event handling concerns and should not be treated as the source of truth for core cooldown timing.

## Transition progress with `useFlowProgress`

`useFlowProgress` is the React-side hook for reading only the current transition progress. It must be called from a React component rendered under `FlowProvider`.

It returns a single number:

- `0` before any transition starts and at the start of a new transition.
- Values between `0` and `1` while a transition is active.
- `1` after a transition reaches the target phase; the current implementation keeps that completed progress value while the phase is settled.

Use `useFlowProgress` when a component only needs progress and does not need the full flow snapshot or controls. It is a good fit for DOM progress text, coarse progress bars, loading-style indicators, and small status UI.

```tsx
function ProgressLabel() {
  const progress = useFlowProgress();

  return <p>Transition progress: {Math.round(progress * 100)}%</p>;
}
```

```tsx
function ProgressBar() {
  const progress = useFlowProgress();

  return (
    <div
      aria-label="Transition progress"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress * 100)}
      role="progressbar"
    >
      <div style={{ transform: `scaleX(${progress})`, transformOrigin: "left" }} />
    </div>
  );
}
```

Choose between the hooks by what the component needs:

- Use `useFlow` to read phase state and call controls.
- Use `useFlowProgress` when progress is the only value needed.
- Both hooks read React-side provider state and should live under the same `FlowProvider` as the components they coordinate.
- Neither hook should be treated as a frame-perfect animation API; use `useFlowFrame` for per-frame R3F scene updates.

```tsx
export function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowNav />
      <ProgressLabel />
    </FlowProvider>
  );
}
```

## DOM input and R3F scene separation

Keep browser input, React UI state, and frame-based scene updates in separate layers. This keeps DOM event listeners easy to clean up, keeps React responsible for coarse application state, and keeps React Three Fiber responsible for visual work that changes every frame.

Recommended responsibility split:

- DOM/client React components own buttons, navigation UI, labels, status display, and browser input helpers.
- DOM/client React components can call `next`, `prev`, and `goTo` from `useFlow`.
- DOM/client React components can read coarse UI state with `useFlow` and `useFlowProgress`.
- Browser input helpers such as `useWheelInput`, `useTouchInput`, and `useKeyboardInput` should live in React/client components rendered inside `FlowProvider`, not inside scene objects.
- Canvas-bound components own `useFlowFrame`, `useFrame`, `useThree`, and frame-by-frame mesh, material, camera, or scene updates.
- Frame-driven visual values should usually live in refs or mutable Three.js object state, not React state.

Avoid placing DOM input logic directly inside R3F scene components. If a scene component has a very intentional reason to register a DOM listener, keep the listener narrowly scoped and clean it up correctly; most flow navigation should stay in normal React/client components next to the rest of the UI.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlow, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function DomControls() {
  const { phase, next, prev, goTo } = useFlow<Phase>();

  return (
    <nav>
      <p>Current phase: {phase}</p>
      <button onClick={prev}>Prev</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Contact</button>
    </nav>
  );
}

function SceneBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.position.x = phase === "work" ? progress * 2 : 0;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export function Experience() {
  return (
    <FlowProvider phases={phases}>
      <DomControls />

      <Canvas>
        <ambientLight />
        <SceneBox />
      </Canvas>
    </FlowProvider>
  );
}
```

`DomControls` is a normal React UI component that calls flow controls. `SceneBox` is Canvas-bound and reacts to flow state through `useFlowFrame`. `useFrame`, `useThree`, and `useFlowFrame` should not be used in DOM/UI components outside `<Canvas>`.

## DOM to Canvas wiring

Use one `FlowProvider` for the client-side subtree that shares a flow state. Put DOM controls, status UI, optional input helpers, and the `<Canvas>` under that provider so they read the same phase machine instead of synchronizing separate state by hand.

### Recommended tree

```tsx
<FlowProvider phases={phases} transition={transition}>
  <OverlayControls />
  <ProgressLabel />
  <WheelInputBridge />

  <Canvas>
    <SceneObject />
  </Canvas>
</FlowProvider>
```

Keep `phases` and transition configuration stable between renders. Define static tuples and objects outside components, or memoize values that must be derived from props or data.

### DOM responsibilities

DOM/client components should own UI and browser input wiring:

- render buttons, labels, progress bars, and status UI
- call `next`, `prev`, and `goTo` from `useFlow`
- read coarse state with `useFlow`
- read DOM progress/status with `useFlowProgress`
- optionally mount `useWheelInput`, `useTouchInput`, or `useKeyboardInput` under `FlowProvider`

Input helper components do not require Canvas. They should stay with the rest of the DOM/client layer because they own browser event listener setup and cleanup, ignore selectors, typing-target behavior, locks, and cooldown checks.

### Canvas responsibilities

Canvas-bound R3F components should own frame-based scene updates:

- render inside `<Canvas>`
- call `useFlowFrame` to react to phase and progress on the R3F frame loop
- call R3F hooks such as `useFrame` and `useThree` only from Canvas-bound components
- update refs, transforms, visibility, materials, cameras, or other mutable scene state

Scene objects should react to the flow state. They should not own global wheel, touch, or keyboard listener wiring by default.

### Avoid mixing responsibilities

Do not move browser input listeners into mesh or scene object components just because the input affects the scene. That makes scene code responsible for DOM listener cleanup, ignored targets, typing behavior, cooldowns, and global navigation rules. Keep browser input in DOM/client components, then let `useFlowFrame` bridge the resulting phase state into Canvas updates.

`useFlow`, `useFlowProgress`, and the input hooks are React/client-side hooks for the DOM layer under `FlowProvider`. `useFlowFrame`, `useFrame`, and `useThree` are Canvas-bound hooks for components rendered inside `<Canvas>`.

### Small wiring example

```tsx
function OverlayControls() {
  const { phase, next, prev, goTo } = useFlow<Phase>();

  return (
    <nav>
      <p>Current phase: {phase}</p>
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
      <button onClick={() => goTo("contact")}>Contact</button>
    </nav>
  );
}

function ProgressLabel() {
  const progress = useFlowProgress();

  return <p>{Math.round(progress * 100)}%</p>;
}

function WheelInputBridge() {
  useWheelInput<Phase>({ threshold: 40 });

  return null;
}

function SceneObject() {
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

`OverlayControls`, `ProgressLabel`, and `WheelInputBridge` are DOM/client components rendered under `FlowProvider`. `SceneObject` is rendered inside `<Canvas>` and only reacts to the shared flow state. The library does not provide visual effects, scene presets, router integration, animation timelines, or GSAP / Framer Motion wrappers; scene update logic stays in your application.

## Frame updates with `useFlowFrame`

`useFlowFrame` is the Canvas-bound bridge between flow state and React Three Fiber frame updates. It reads the current flow snapshot, advances transition timing on each R3F frame, and passes phase data to scene code that updates meshes, materials, cameras, or other mutable Three.js objects.

Call `useFlowFrame` only from components rendered inside `<Canvas>`. The hook uses React Three Fiber's `useFrame` internally, and R3F hooks such as `useFrame` and `useThree` must run in Canvas-bound components. A component rendered in normal DOM/UI React should use `useFlow` or `useFlowProgress` instead.

Recommended split:

- React DOM/UI components use `useFlow` for controls and flow state.
- React DOM/UI components use `useFlowProgress` for coarse status UI.
- Canvas-bound R3F components use `useFlowFrame` for per-frame visual updates.
- Frame-driven values usually live in refs or mutable scene object state, not React state.

```tsx
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work"] as const;
type Phase = (typeof phases)[number];

function PhaseMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress, isTransitioning }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta;
    meshRef.current.position.x = phase === "work" ? progress * 2 : 0;
    meshRef.current.visible = isTransitioning || progress > 0;
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
      <Canvas>
        <ambientLight />
        <PhaseMesh />
      </Canvas>
    </FlowProvider>
  );
}
```

The frame state includes:

- `phase`
- `phaseIndex`
- `progress`
- `direction`
- `isTransitioning`

Avoid pushing frame-driven values through React state on every frame. React state is appropriate for application state, controls, labels, and stable UI snapshots. R3F frame code is a better fit for high-frequency scene updates.

```tsx
function GoodSceneBridge() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ progress }) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + progress);
    }
  });

  return <mesh ref={meshRef} />;
}
```

Do not call `useFlowFrame` from DOM components, route components that are not rendered under `<Canvas>`, or provider setup code. Keep DOM input and UI on the React side, and keep per-frame visual mutation inside Canvas-bound scene components.

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

## Tested navigation guards and cooldown behavior

Current tested navigation behavior is intentionally narrow and predictable:

- `next()`, `prev()`, and `goTo(phase)` start transitions only when the request is valid.
- Navigation requested while a transition is already active is ignored. Ignored navigation does not restart, reset, or extend the active transition or its cooldown.
- `lock()` blocks otherwise valid navigation requests. `unlock()` allows navigation again. Locking does not cancel a transition that has already started.
- Core transition cooldown starts from accepted navigation only. Boundary no-ops, same-phase `goTo`, locked navigation, and active-transition navigation do not start, reset, or extend that cooldown.
- Input hook cooldown and core transition cooldown are separate concepts. Hook cooldown throttles repeated browser input before it reaches the flow controls; core cooldown guards accepted phase navigation in the flow machine.
- Input hook cooldown is recorded only when browser input produces an accepted navigation. Rejected boundary input, disabled input, ignored targets, locked flow, and active-transition input do not consume or extend hook-local cooldown.
- Input hooks support `enabled: false` and can be re-enabled later; disabled hooks do not navigate, and re-enabled hooks resume listener behavior.

## Input hooks

Input hooks connect browser input to `next` and `prev`. They attach browser event listeners inside React effects, are guarded for non-browser environments, and do not access browser APIs at module import time.

`enabled: false` disables listener behavior, and changing `enabled` back to `true` re-attaches listener behavior. `target` accepts a direct `Window` or element target, or a React ref object pointing to an element. If `target` is omitted, or a ref is currently empty, the hooks fall back to `window`. When a target changes, the hooks clean up listeners from the old target before attaching to the new one.

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

Wheel down navigates to `next`; wheel up navigates to `prev` on the default `y` axis. Set `axis: "x"` for horizontal wheel gestures. `threshold` must be finite and non-negative; `threshold: 0` is allowed, while values below `0`, `NaN`, and infinities are invalid.

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

On the default `y` axis, swipe up navigates to `next` and swipe down navigates to `prev`. Set `axis: "x"` for horizontal swipes. `threshold` must be finite and non-negative; `threshold: 0` is allowed, while values below `0`, `NaN`, and infinities are invalid.

### `useKeyboardInput`

```tsx
function InputLayer() {
  useKeyboardInput<Phase>({
    target: undefined,
    keys: {
      next: ["ArrowDown", "ArrowRight", "PageDown"],
      prev: ["ArrowUp", "ArrowLeft", "PageUp"]
    },
    cooldown: 500,
    preventDefault: true,
    enabled: true
  });

  return null;
}
```

`keys.next` and `keys.prev` are the current keyboard configuration API. `nextKeys` and `prevKeys` still work as deprecated compatibility aliases. Keyboard input also ignores typing in inputs, textareas, selects, and contenteditable elements by default. The default next keys include Space, but DOM-control examples can omit Space so focused buttons keep native Space activation behavior.

`target` accepts a `FlowInputTarget`: an `HTMLElement`, `Window`, or React ref object pointing to an element. If omitted, or if a ref has not resolved yet, input hooks use `window`.

## Next.js / browser API safety notes

This package is designed to be usable from Next.js App Router Client Components.

- Use files marked with `"use client"` when rendering `FlowProvider` or calling `useFlow`, `useFlowProgress`, `useFlowFrame`, or the input hooks.
- Server Components can pass serializable data into a Client Component wrapper, but they should not render the provider or call these hooks directly.
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
```

For documentation-only package README changes:

```bash
pnpm format
pnpm lint
```

For package code or type changes:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format
```

For package output or export-related changes:

```bash
pnpm build
pnpm package:verify
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm pack:dry-run
```

Package-only dry run:

```bash
pnpm --filter r3f-interactive-flow pack:dry-run
```

For the full repository validation matrix by PR type, see the root README.

## License

MIT
