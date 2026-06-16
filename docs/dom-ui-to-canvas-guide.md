# DOM UI to Canvas usage guide

This guide shows the intended way to wire normal React DOM UI to a React Three Fiber scene with `r3f-interactive-flow`.

The short version:

- Put `FlowProvider` above both the DOM UI and the `<Canvas>` that need the same flow state.
- Let DOM React components call `useFlow` for buttons, labels, navigation, and accessibility-friendly controls.
- Let DOM status components call `useFlowProgress` for coarse transition status.
- Let Canvas-bound R3F components call `useFlowFrame` for frame-driven visual updates.
- Keep browser input hooks in DOM/client React components, not inside scene objects.
- Keep R3F hooks such as `useFrame`, `useThree`, and `useFlowFrame` inside components rendered within `<Canvas>`.

## Responsibilities

Use each layer for the job it owns:

| Layer                       | Owns                                                                           | Avoid                                            |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| DOM React UI                | Buttons, links, labels, forms, overlays, input hook setup, accessible controls | Per-frame mesh, camera, or material mutation     |
| `FlowProvider`              | Shared phase state, transition timing, locking, and cooldown behavior          | Visual effects or scene-specific animation logic |
| Canvas-bound R3F components | Frame updates, refs, meshes, cameras, materials, lights, scene behavior        | Browser input listeners and DOM UI concerns      |

`useFlow` and `useFlowProgress` are React snapshot hooks. They are useful for UI, but they are not meant to drive frame-perfect animation through React state. Use `useFlowFrame` inside the Canvas tree when a visual needs transition progress every frame.

## Where to place `FlowProvider`

Place one `FlowProvider` above the DOM UI and the Canvas subtree that should share the same phase state:

```tsx
const flowTransition = { duration: 900, cooldown: 400 } as const;

<FlowProvider phases={phases} transition={flowTransition}>
  <InputLayer />
  <PageChrome />

  <Canvas>
    <Scene />
  </Canvas>
</FlowProvider>;
```

Keep `phases` and configuration props stable. Define phase tuples and configuration objects outside components, or memoize derived configuration before passing it to `FlowProvider`.

## DOM controls with `useFlow`

Use `useFlow` in normal React components for phase controls and status that can update with React:

```tsx
function PhaseNav() {
  const { phase, next, prev, goTo, isTransitioning } = useFlow<Phase>();

  return (
    <nav data-flow-ignore>
      <p>Current section: {phase}</p>
      <button type="button" onClick={prev} disabled={isTransitioning}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={isTransitioning}>
        Next
      </button>
      <button type="button" onClick={() => goTo("contact")} disabled={isTransitioning}>
        Contact
      </button>
    </nav>
  );
}
```

This is the right place for buttons, links, forms, nav state, labels, and screen-reader-friendly controls.

## DOM progress and status with `useFlowProgress`

Use `useFlowProgress` for DOM progress indicators and debug/status text:

```tsx
function ProgressStatus() {
  const progress = useFlowProgress();

  return <p data-flow-ignore>Transition progress: {Math.round(progress * 100)}%</p>;
}
```

This progress is a React snapshot. It is suitable for UI, not for per-frame mesh animation.

## Canvas visuals with `useFlowFrame`

Use `useFlowFrame` only from components rendered inside `<Canvas>`. It uses React Three Fiber's frame loop and follows the same Canvas-bound hook rule as `useFrame` and `useThree`.

The current callback shape is:

```tsx
useFlowFrame(({ progress }, delta) => {
  // mutate Canvas-local refs here
});
```

A Canvas component should own its visual behavior:

```tsx
function HeroBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress, direction }, delta) => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    mesh.rotation.y += delta * 0.6;

    if (phase === "intro") {
      mesh.position.z = -3 + progress * 3;
    }

    if (phase === "projects") {
      const sign = direction === "prev" ? -1 : 1;
      mesh.position.x = progress * sign * 2;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}
```

Do not call `useFlowFrame`, `useFrame`, or `useThree` from DOM-only components outside `<Canvas>`.

## Input hook placement

Set up wheel, touch, and keyboard input in a small DOM/client component inside `FlowProvider` and outside scene logic:

```tsx
const inputIgnore = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "form",
  "[contenteditable='true']",
  "[data-flow-ignore]"
] as const;

const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

function FlowInputLayer() {
  useWheelInput<Phase>({ ignore: inputIgnore });
  useTouchInput<Phase>({ ignore: inputIgnore });
  useKeyboardInput<Phase>({ keys: keyboardKeys });

  return null;
}
```

Wheel and touch input support `ignore` selectors. Use them so scrolling or swiping over buttons, links, forms, and `[data-flow-ignore]` UI does not hijack those controls.

Keyboard input ignores typing in inputs, textareas, selects, and contenteditable elements by default. The copyable DOM-control examples also omit Space from keyboard navigation so focused buttons keep their native Space activation behavior. Keep keyboard setup in the input layer with the other browser input hooks. If you need page-specific keyboard behavior, scope or enable the hook from DOM/client React code rather than moving it into R3F scene components.

## Next.js App Router notes

For the App Router, keep flow UI in Client Components:

- Add `"use client"` to files that render `FlowProvider` or call `useFlow`, `useFlowProgress`, `useFlowFrame`, `useWheelInput`, `useTouchInput`, or `useKeyboardInput`.
- Server Components can pass serializable data into a Client Component wrapper, but they should not call these hooks directly.
- Browser input hooks guard against missing `window`, but they still belong in Client Components because they use React effects and browser events.
- Canvas-bound components that call `useFlowFrame`, `useFrame`, or `useThree` must still be rendered inside `<Canvas>`.

### Server Component to Client Component wrapper

In the App Router, keep `page.tsx` and `layout.tsx` Server Components free of `FlowProvider` and flow hooks. Put `FlowProvider`, browser input hooks, `useFlow`, `useFlowProgress`, `<Canvas>`, and `useFlowFrame` usage inside a Client Component wrapper instead.

Server Components may pass serializable data, such as phase names or labels, into that wrapper. Browser input hooks still attach listeners inside effects, but the component that calls them must be a Client Component. This is not router integration; it is only a safe component boundary pattern.

File: `app/page.tsx`

```tsx
import { FlowExperienceClient } from "./FlowExperienceClient";

export default function Page() {
  return <FlowExperienceClient />;
}
```

File: `app/FlowExperienceClient.tsx`

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { FlowProvider, useFlow, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function FlowNav() {
  const flow = useFlow<Phase>();

  return (
    <nav data-flow-ignore>
      <p>Phase: {flow.phase}</p>
      <button type="button" onClick={flow.prev}>
        Prev
      </button>
      <button type="button" onClick={flow.next}>
        Next
      </button>
    </nav>
  );
}

function FlowBox() {
  useFlowFrame<Phase>(({ progress }) => {
    // Mutate Canvas-local refs here in real scenes.
    // Keep frame-driven updates inside Canvas-bound components.
    void progress;
  });

  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export function FlowExperienceClient() {
  return (
    <FlowProvider phases={phases}>
      <FlowNav />

      <Canvas>
        <FlowBox />
      </Canvas>
    </FlowProvider>
  );
}
```

## Complete copyable example

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import {
  FlowProvider,
  useFlow,
  useFlowFrame,
  useFlowProgress,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";

const phases = ["intro", "projects", "contact"] as const;
type Phase = (typeof phases)[number];

const flowTransition = { duration: 900, cooldown: 400 } as const;

const inputIgnore = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "form",
  "[contenteditable='true']",
  "[data-flow-ignore]"
] as const;

const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

function FlowInputLayer() {
  useWheelInput<Phase>({ ignore: inputIgnore });
  useTouchInput<Phase>({ ignore: inputIgnore });
  useKeyboardInput<Phase>({ keys: keyboardKeys });

  return null;
}

function FlowNav() {
  const { phase, next, prev, goTo, isTransitioning } = useFlow<Phase>();
  const progress = useFlowProgress();

  return (
    <aside data-flow-ignore>
      <p>Phase: {phase}</p>
      <p>Progress: {Math.round(progress * 100)}%</p>

      <button type="button" onClick={prev} disabled={isTransitioning}>
        Previous
      </button>
      <button type="button" onClick={next} disabled={isTransitioning}>
        Next
      </button>
      <button type="button" onClick={() => goTo("contact")} disabled={isTransitioning}>
        Contact
      </button>
    </aside>
  );
}

function FlowBox() {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFlowFrame<Phase>(({ phase, progress }, delta) => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    mesh.rotation.y += delta;

    if (phase === "intro") {
      mesh.position.z = -2 + progress * 2;
      return;
    }

    if (phase === "projects") {
      mesh.position.x = progress * 2;
      return;
    }

    mesh.position.y = progress;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <FlowBox />
    </>
  );
}

export function InteractivePage() {
  return (
    <FlowProvider phases={phases} transition={flowTransition}>
      <FlowInputLayer />
      <FlowNav />

      <Canvas>
        <Scene />
      </Canvas>
    </FlowProvider>
  );
}
```

## Boundary checklist

- DOM UI changes flow state with `useFlow`.
- DOM UI reads status with `useFlowProgress` when React-level progress is enough.
- Canvas components read frame progress with `useFlowFrame(({ progress }, delta) => { ... })`.
- Input hooks are configured in DOM/client components.
- Wheel and touch ignore selectors include buttons, links, forms, and `[data-flow-ignore]`.
- `useFrame`, `useThree`, and `useFlowFrame` stay inside the Canvas tree.
- Scene components own visual behavior; the library does not provide effects, camera presets, shader APIs, animation timelines, router integration, GSAP, or Framer Motion integration.
