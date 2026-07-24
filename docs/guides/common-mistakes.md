# Common mistakes

This guide covers common integration mistakes when using
`r3f-interactive-flow` in React and React Three Fiber apps. It is written for
both people and AI coding agents: keep hook placement clear, import only from the
package root, and use the library as a small predictable control layer rather
than a full application framework.

If you are new to the package, start with [Getting started](./getting-started.md)
and [Core concepts](./core-concepts.md). For more placement details, see
[React Three Fiber usage](./r3f-usage.md), [Input handling](./input-handling.md),
and [Next.js usage](./nextjs-usage.md).

## Treating `phase` as the source during a transition

An accepted `next()`, `prev()`, or `goTo()` updates `phase` to the **target**
immediately — before any transition frame has run. There is no point during an
active transition where `phase` still reports where you came from; the package
exposes no public source-phase field.

### Mistake

```tsx
useFlowFrame<Phase>(({ phase, isTransitioning }) => {
  if (isTransitioning) {
    console.log("leaving", phase); // wrong: phase is already the target
  }
});
```

### Better

Track the previously observed phase yourself if you need the source — see
[Expecting source/target metadata from the package](#expecting-sourcetarget-metadata-from-the-package)
below.

## Treating `progress === 1` as the only completion signal

Public `progress` is the configured easing function's output. A non-monotonic
or endpoint-producing custom easing function can make `progress` reach `1`
before the transition has actually completed — raw elapsed time, not eased
`progress`, decides completion.

### Mistake

```tsx
useFlowFrame<Phase>(({ progress }) => {
  if (progress === 1) {
    onTransitionDone(); // may fire early with a custom easing function
  }
});
```

### Better

```tsx
useFlowFrame<Phase>(({ isTransitioning }) => {
  if (!isTransitioning) {
    onTransitionDone(); // false only at raw completion
  }
});
```

Use `isTransitioning` — not `progress === 1` — as the lifecycle signal.

## Expecting non-adjacent `goTo()` to visit intermediate phases

Calling `goTo("contact")` from `"intro"` performs exactly **one** transition
straight to `"contact"`. Any phases in between are never visited and never
queued — there is no route-pair configuration, graph, or timeline behind
`goTo()`.

### Mistake

Building UI or scene logic that expects a frame callback, an intermediate
`phase` value, or a queued sequence of transitions for a non-adjacent jump.

### Better

Treat every accepted `goTo()` as one direct transition to its target, whether
the target is adjacent or not. If your scene needs to react differently to a
non-adjacent jump, compare the source and target phase indexes yourself — see
[Core concepts](./core-concepts.md#adjacent-and-non-adjacent-navigation).

## Expecting source/target metadata from the package

`FlowSnapshot`, `FlowControls`, and `FlowFrameState` do not include
`sourcePhase`, `targetPhase`, or `previousPhase`. This is a deliberate v2.8.0
decision, not a gap: `phase` already reports the accepted target immediately,
and `direction` reports forward/reverse for positive-duration transitions.

### Mistake

```tsx
const { sourcePhase, targetPhase } = useFlow<Phase>(); // does not exist
```

### Better

Retain the previously observed public `phase` yourself and derive source and
target from it:

```tsx
function usePhaseTrace(phase: Phase) {
  const previousRef = useRef<Phase | null>(null);
  const sourceRef = useRef<Phase | null>(null);

  if (previousRef.current !== phase) {
    sourceRef.current = previousRef.current;
    previousRef.current = phase;
  }

  return { source: sourceRef.current, target: phase };
}
```

This is application code built on public `useFlow`/`useFlowFrame` output, not
a package API — see
[Core concepts](./core-concepts.md#application-owned-previous-phase-tracking)
for the full pattern.

## Assuming `lock()` pauses transition or cooldown

`lock()` blocks new navigation. It does not pause, slow, or cancel an active
transition, and it does not pause provider cooldown — both keep running on
their own clock while locked.

### Mistake

Calling `lock()` expecting an in-progress transition to freeze at its current
`progress`, or expecting provider cooldown to stop counting down.

### Better

Call `lock()` only to prevent _new_ navigation calls from being accepted.
Active transitions and cooldowns finish on their own schedule regardless of
lock state.

## Conflating provider cooldown with hook-local cooldown

There are two separate cooldown mechanisms. **Provider cooldown** is a
machine-wide gate configured through `transition.cooldown`: it starts after a
transition completes and rejects manual controls and every input hook until it
elapses. **Hook-local cooldown** is a `cooldown` option on one
`useWheelInput`/`useTouchInput`/`useKeyboardInput` instance: it starts only
after that hook produces an accepted navigation and throttles only that hook.

### Mistake

Assuming a wheel hook's `cooldown` option blocks keyboard input, or that
raising provider `transition.cooldown` throttles a single input hook only.

### Better

Configure provider `transition.cooldown` to gate all navigation globally after
a transition. Configure each input hook's own `cooldown` option to throttle
that hook's repeated triggers independently.

## Calling `useFlowFrame` outside `<Canvas>`

`useFlowFrame` is Canvas-bound. It follows the same placement rule as React Three
Fiber's `useFrame`: call it only from a component rendered inside `<Canvas>`.
The component must also be under the same `FlowProvider` that owns the phase
machine.

### Mistake

```tsx
import { Canvas } from "@react-three/fiber";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;

function PageShell() {
  useFlowFrame(({ progress }) => {
    console.log(progress);
  });

  return <Canvas>{/* scene */}</Canvas>;
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <PageShell />
    </FlowProvider>
  );
}
```

`PageShell` renders outside the Canvas scene tree, so it is the wrong place for a
Canvas-bound frame hook.

### Better

```tsx
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ progress }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = progress * Math.PI;
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
        <FlowMesh />
      </Canvas>
    </FlowProvider>
  );
}
```

Keep per-frame scene work inside scene components. Use `useFlow` and
`useFlowProgress` for regular React UI outside Canvas.

## Assuming transitions need a Canvas or `useFlowFrame`

`FlowProvider` owns the transition clock and advances the machine itself, one step
per animation frame while a transition settles. It does not depend on a mounted
`<Canvas>` or any `useFlowFrame` consumer. `useFlowFrame` is a read-only observer
for scene animation — it never advances the machine — so navigation and DOM
progress work in a Canvas-free app.

### Mistake

Reaching for `useFlowFrame` (and therefore a `<Canvas>`) just to make a DOM
progress bar move, or believing a transition will not complete without one.

### Better

Read `useFlowProgress` directly in DOM UI. It updates every frame during a
transition, so a `<progress>` element animates smoothly with no Canvas anywhere:

```tsx
import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function Navigator() {
  const { phase, next, prev } = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <div>
      <p>{phase}</p>
      <progress max={1} value={progress} aria-label="Flow transition progress" />
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
    </div>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases} transition={{ duration: 700 }}>
      <Navigator />
    </FlowProvider>
  );
}
```

## Calling React or R3F hooks in the wrong tree

React hooks, R3F hooks, and browser input hooks each belong to different parts of
the app.

- `useFlow` and `useFlowProgress` are regular React hooks. Call them under
  `FlowProvider`; they do not need Canvas.
- `useFlowFrame` is an R3F frame hook. Call it from Canvas-rendered components.
- `useWheelInput`, `useTouchInput`, and `useKeyboardInput` are browser input
  hooks. Mount them from a client-side DOM/input layer under `FlowProvider` by
  default.

### Mistake

```tsx
import { useThree } from "@react-three/fiber";
import { useFlow } from "r3f-interactive-flow";

function Header() {
  const { camera } = useThree();
  const { phase } = useFlow();

  return <p>{phase}</p>;
}
```

`Header` is regular DOM UI, so it should not call R3F hooks such as `useThree`.
The same rule applies to `useFrame` and to any hook that expects the Canvas
reconciler.

### Better

```tsx
import { useFlow } from "r3f-interactive-flow";

function Header() {
  const { phase } = useFlow();

  return <p>{phase}</p>;
}
```

If a scene object needs camera or frame-loop access, keep that logic in a
component rendered inside `<Canvas>`. If a DOM component needs flow state, read it
through `useFlow` or `useFlowProgress` under `FlowProvider`.

## Importing from internal paths

The public API is exported from the package root. Do not import from internal
entry points, build output, or source files. Internal paths can change without
being treated as public API.

### Mistake

Do not import from internal paths such as:

- `r3f-interactive-flow/react`
- `r3f-interactive-flow/r3f`
- `r3f-interactive-flow/input`
- `r3f-interactive-flow/src/*`
- `r3f-interactive-flow/dist/*`

Also avoid local imports that reach into this package's `src/` or `dist/`
folders.

### Better

```tsx
import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";
```

Package-root imports keep examples portable and keep your app aligned with the
supported public surface.

## Relying only on wheel, touch, or shortcuts

Wheel, touch, and keyboard hooks are optional enhancements, not the baseline operation path. Render visible native controls that call `next`, `prev`, and `goTo`, and disable first, last, and current boundaries in application code. See [Accessible interaction and reduced motion](./accessibility-and-reduced-motion.md).

## Expecting package-rendered accessibility UI

The package exposes state and controls. It does not render Previous/Next controls, choose labels, set all ARIA semantics, move focus, restore focus, or announce phase changes for you. Application code owns native controls, disabled/current semantics, visible focus, discrete phase status, and announcement wording.

## Announcing progress every frame

`useFlowProgress` is useful for visual progress UI, but transition progress updates every frame. Do not put per-frame `progress` values in a live region. Announce discrete phase status, such as phase name and index, when that matches your application policy.

## Treating prop changes as live FlowProvider reconfiguration

A mounted `FlowProvider` reads its phases and transition configuration once, when
that provider instance mounts. Ordinary parent rerenders preserve current flow
state, even if they pass fresh but equivalent inline arrays or option objects.
Changing configuration props alone does not reconfigure the mounted machine.

### Mistake

```tsx
import { FlowProvider } from "r3f-interactive-flow";

export function App({ phases, transitionDuration }: Props) {
  return (
    <FlowProvider phases={phases} transition={{ duration: transitionDuration }}>
      <Experience />
    </FlowProvider>
  );
}
```

Updating `phases` or `transitionDuration` on the same provider position will not
apply a new machine configuration.

### Better

```tsx
import { FlowProvider } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

export function App() {
  return (
    <FlowProvider
      key={flowConfigurationVersion}
      phases={phases}
      initialPhase="intro"
      transition={transition}
    >
      <Experience />
    </FlowProvider>
  );
}
```

Define static phases at module scope for TypeScript inference, readability, and
a clear phase type. If phases or timing are derived from runtime data, change the
provider element's React `key` when you intentionally want React to unmount the
old provider and mount a new machine with that configuration. `key` is React's
remount mechanism, not a `FlowProvider` API prop.

## Treating reduced motion as a built-in provider mode

Reduced motion is application policy. The library does not expose a separate reduced-motion hook, provider prop, or automatic media-query behavior. Choose the normal or reduced transition options in your app, and change the provider element's React `key` only when you intentionally want to remount the provider and reset phase, progress, transition, lock, and cooldown state. Changing configuration props on the same mounted provider does not live-reconfigure the machine.

```tsx
<FlowProvider
  key={reducedMotion ? "reduced" : "normal"}
  phases={phases}
  transition={reducedMotion ? { duration: 0, cooldown: 0 } : { duration: 700, cooldown: 250 }}
>
  <Experience />
</FlowProvider>
```

`duration: 0` is one valid app choice, not a universal requirement; a short non-zero duration may be more appropriate, and cooldown can remain positive. Provider duration also does not reduce Canvas, camera, shader, particle, CSS, or other motion; reduce scene motion separately in Canvas-bound code.

## Copying high-frequency frame values into React state

Transition progress changes frequently during a transition. Copying every frame
into React state forces React to re-render at frame-loop speed and works against
React Three Fiber's imperative scene update model.

### Mistake

```tsx
import { useState } from "react";
import { useFlowFrame } from "r3f-interactive-flow";

function FlowMesh() {
  const [progress, setProgress] = useState(0);

  useFlowFrame((state) => {
    setProgress(state.progress);
  });

  return (
    <mesh scale={1 + progress}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

### Better

```tsx
import { useRef } from "react";
import type * as THREE from "three";
import { useFlowFrame } from "r3f-interactive-flow";

function FlowMesh() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame(({ progress }) => {
    if (!meshRef.current) {
      return;
    }

    const scale = 1 + progress;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

Use React state for stable UI snapshots and discrete UI changes. Use
`useFlowFrame` with refs for per-frame scene values.

## Mounting input hooks inside mesh or scene components by default

Wheel, touch, and keyboard hooks attach browser input behavior. They should
usually live in a small DOM/input layer under `FlowProvider`, not inside every
mesh or scene object.

### Mistake

```tsx
import { useWheelInput } from "r3f-interactive-flow";

function ProductMesh() {
  useWheelInput();

  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

Mounting input hooks inside scene objects makes input behavior harder to audit
and can accidentally duplicate listeners when scene objects mount more than once.

### Better

```tsx
import { FlowProvider, useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";

const phases = ["intro", "details", "outro"] as const;

function FlowInputLayer() {
  useWheelInput();
  useTouchInput();
  useKeyboardInput();

  return null;
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowInputLayer />
      <Experience />
    </FlowProvider>
  );
}
```

See [Input handling](./input-handling.md) for thresholds, cooldowns, ignore
selectors, and enabled flags.

## Treating the package as a larger framework

`r3f-interactive-flow` is intentionally small. It coordinates named phases,
transitions, progress, and optional input helpers. It is not a complete animation
framework, router, visual effects library, camera preset library, shader library,
particle library, GSAP wrapper, Framer Motion wrapper, or template system.

### Mistake

```tsx
import { useFlow } from "r3f-interactive-flow";

function RouteLikePage() {
  const { goTo } = useFlow();

  return <button onClick={() => goTo("/pricing")}>Open pricing route</button>;
}
```

Flow phases are app-defined states, not route URLs. The package does not replace
your framework router, your animation library, or your scene architecture.

### Better

```tsx
import { useFlow } from "r3f-interactive-flow";

function SectionControls() {
  const { goTo } = useFlow<"intro" | "features" | "contact">();

  return <button onClick={() => goTo("contact")}>Show contact section</button>;
}
```

Use the package to keep a small interactive flow predictable. Compose it with
your own routing, animation choices, camera logic, shaders, particles, effects,
and templates only where those concerns belong in your app.

## Quick checklist

- Import only from `"r3f-interactive-flow"`.
- Put `FlowProvider` above the DOM controls and the `<Canvas>` that share one
  phase machine.
- Call `useFlowFrame` only inside Canvas-rendered components.
- Keep R3F hooks out of DOM components.
- Keep browser input hooks in a DOM/input layer by default.
- Hoist phase arrays for type inference and readability when they represent a fixed ordered tuple.
- Avoid React state writes for per-frame values.
- Keep the library's role focused: predictable phase flow, not a full framework.
