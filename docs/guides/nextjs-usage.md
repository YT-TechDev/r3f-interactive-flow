# Next.js usage

This guide explains how to use `r3f-interactive-flow` safely in Next.js App
Router projects. The package works well in Client Components, but it does not
turn Server Components into places where React hooks, React context providers,
Canvas-bound hooks, or browser input listeners can run.

If you are new to the package, start with [Getting started](./getting-started.md)
and then review [React Three Fiber usage](./r3f-usage.md),
[Input handling](./input-handling.md), and
[Common mistakes](./common-mistakes.md).

## Client Component boundary

`FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and the input hooks
are client-side React APIs. In a Next.js App Router project, any file that
renders `FlowProvider` or calls a flow hook should start with the Client
Component directive:

```tsx
"use client";
```

Server Components should not directly render `FlowProvider` and should not call
`useFlow`, `useFlowProgress`, `useFlowFrame`, `useWheelInput`, `useTouchInput`,
or `useKeyboardInput`. Keep the flow provider and hook calls behind a Client
Component boundary.

Use package-root imports only:

```tsx
import { FlowProvider, useFlow } from "r3f-interactive-flow";
```

Do not import from internal package paths.

## Client wrapper

A small Client Component wrapper is usually the cleanest boundary. Put
`FlowProvider` and any components that call flow hooks in the client file.

```tsx
"use client";

import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";

type Phase = "intro" | "details" | "contact";

const phases: Phase[] = ["intro", "details", "contact"];

function FlowControls() {
  const { phase, next, prev } = useFlow<Phase>();
  const progress = useFlowProgress<Phase>();

  return (
    <section>
      <p>Current phase: {phase}</p>
      <p>Progress: {Math.round(progress * 100)}%</p>
      <button type="button" onClick={prev}>
        Previous
      </button>
      <button type="button" onClick={next}>
        Next
      </button>
    </section>
  );
}

export function FlowClient() {
  return (
    <FlowProvider phases={phases} transition={{ duration: 700, cooldown: 250 }}>
      <FlowControls />
    </FlowProvider>
  );
}
```

A route, layout, or Server Component can render this wrapper as a normal React
component, but the flow state and hooks stay inside the client file.

## Server Component handoff with serializable props

Server Components may prepare serializable data and pass it into a Client
Component wrapper. Keep props plain: strings, numbers, booleans, arrays, and
objects that Next.js can serialize across the Server Component boundary.

```tsx
// app/experience/page.tsx
import { FlowClient } from "./FlowClient";

export default async function ExperiencePage() {
  const phases = ["intro", "details", "contact"] as const;

  return <FlowClient phases={phases} initialPhase="intro" />;
}
```

```tsx
// app/experience/FlowClient.tsx
"use client";

import { FlowProvider, useFlow } from "r3f-interactive-flow";

type Phase = "intro" | "details" | "contact";

type FlowClientProps = {
  phases: readonly Phase[];
  initialPhase: Phase;
};

function PhaseLabel() {
  const { phase } = useFlow<Phase>();

  return <p>Current phase: {phase}</p>;
}

export function FlowClient({ phases, initialPhase }: FlowClientProps) {
  return (
    <FlowProvider phases={phases} initialPhase={initialPhase}>
      <PhaseLabel />
    </FlowProvider>
  );
}
```

Do not pass functions, DOM nodes, class instances, or browser-only objects from a
Server Component into the client wrapper. If a value depends on `window`,
`document`, viewport size, or event listeners, compute or attach it in a
client-side effect instead.

## Browser APIs and import-time safety

Next.js may evaluate modules in server environments. Avoid reading browser APIs
at module import time:

```tsx
// Avoid this at module scope.
const width = window.innerWidth;
```

Read browser-only values after the component mounts, or in event handlers that
only run in the browser:

```tsx
"use client";

import { useEffect, useState } from "react";

export function ViewportLabel() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  return <p>Viewport width: {width ?? "unknown"}</p>;
}
```

The package input hooks follow this pattern: they attach browser listeners from
client-side effects rather than at module import time.

## Canvas-bound `useFlowFrame`

`useFlowFrame` remains Canvas-bound in Next.js projects. It follows the same
placement rule as React Three Fiber's `useFrame`: call it only from a component
rendered inside `<Canvas>`, and keep that Canvas tree under the relevant
`FlowProvider`.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { FlowProvider, useFlowFrame } from "r3f-interactive-flow";

const phases = ["intro", "details", "contact"] as const;
type Phase = (typeof phases)[number];

function SceneBox() {
  useFlowFrame<Phase>(({ progress }) => {
    // Update Canvas-bound objects here.
    console.log(progress);
  });

  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export function FlowCanvas() {
  return (
    <FlowProvider phases={phases}>
      <Canvas>
        <SceneBox />
      </Canvas>
    </FlowProvider>
  );
}
```

Do not call `useFlowFrame` from a route file, layout file, Server Component, or
DOM-only Client Component outside `<Canvas>`. For more placement examples, see
[React Three Fiber usage](./r3f-usage.md) and
[Common mistakes](./common-mistakes.md).

## Input hooks

`useWheelInput`, `useTouchInput`, and `useKeyboardInput` are client-side browser
input helpers. Mount them under `FlowProvider` from a Client Component. They
attach event listeners from effects after mount.

```tsx
"use client";

import { FlowProvider, useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";

type Phase = "intro" | "details" | "contact";

const phases: Phase[] = ["intro", "details", "contact"];

function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 400 });
  useTouchInput<Phase>({ threshold: 50 });
  useKeyboardInput<Phase>();

  return null;
}

export function FlowWithInput() {
  return (
    <FlowProvider phases={phases}>
      <InputLayer />
      {/* Page content and Canvas content can live here. */}
    </FlowProvider>
  );
}
```

Keep input handling in the DOM/input layer unless a Canvas-specific reason
requires otherwise. See [Input handling](./input-handling.md) for hook options,
thresholds, cooldowns, and ignored regions.

## What this package does not do in Next.js

`r3f-interactive-flow` is Next.js compatible, not Next.js integrated:

- Next.js is not a dependency.
- No Next.js router integration is provided.
- The package does not map phases to routes or route segments.
- The package does not provide Server Component versions of `FlowProvider` or the
  flow hooks.
- The package is not a router, animation framework, visual effects library,
  camera system, shader system, particle system, or template.

Use Next.js for routing and rendering boundaries. Use `r3f-interactive-flow` as
a small client-side phase control layer inside those boundaries.

## Troubleshooting checklist

If a Next.js integration fails, check these items first:

- Does every file that renders `FlowProvider` or calls a flow hook start with
  `"use client"`?
- Are Server Components only passing serializable props into the Client Component
  wrapper?
- Are all imports from `"r3f-interactive-flow"` rather than internal package
  paths?
- Are `window`, `document`, and event listeners used only after mount or inside
  browser-only handlers?
- Are input hooks mounted under `FlowProvider` from a Client Component?
- Is `useFlowFrame` called only from a component rendered inside `<Canvas>`?
- Are you avoiding assumptions that the package owns Next.js routing or route
  transitions?

For adjacent integration guidance, see [Getting started](./getting-started.md),
[React Three Fiber usage](./r3f-usage.md), [Input handling](./input-handling.md),
and [Common mistakes](./common-mistakes.md).
