# Input handling

`r3f-interactive-flow` ships three optional browser input hooks:
`useWheelInput`, `useTouchInput`, and `useKeyboardInput`.

This guide explains how to wire them up predictably.

It assumes you have read [Getting started](./getting-started.md) and
[Core concepts](./core-concepts.md).

All examples use package-root imports only:

<!-- prettier-ignore -->
```tsx
import {
  FlowProvider,
  useWheelInput,
  useTouchInput,
  useKeyboardInput
} from "r3f-interactive-flow";
```

## Mental model

The input hooks are small browser event adapters. They listen for browser input,
interpret one intentional action, and call the existing flow navigation controls.
They do not create a second navigation system.

- `useWheelInput` maps wheel movement to `next` and `prev`.
- `useTouchInput` maps swipe gestures to `next` and `prev`.
- `useKeyboardInput` maps configured keys to `next` and `prev`.

The hooks are optional. You can use regular buttons, links, or your own event
handlers instead. The important part is that every input path should still move
through the same `FlowProvider` controls, so locks, active transitions,
boundaries, and cooldowns stay consistent.

Input hooks belong in DOM/client components because they attach browser event
listeners from React effects. They need a browser runtime, and they need to be
rendered under `FlowProvider` so they can read the shared flow machine.

Do not mix these hooks into R3F scene object logic. A scene object rendered
inside `<Canvas>` should focus on frame-based visual updates. Browser input is
page-level React work; per-frame mesh, material, and camera updates are Canvas
work.

## Recommended component split

A predictable app usually has a small input layer next to the rest of the DOM UI,
with the Canvas kept separate.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { FlowProvider, useWheelInput, useTouchInput, useKeyboardInput } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500 });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500 });
  useKeyboardInput<Phase>({ cooldown: 250 });

  return null;
}

function SceneObject() {
  return <mesh />;
}

export function App() {
  return (
    <FlowProvider phases={phases} initialPhase="intro">
      <InputLayer />
      <Controls />

      <Canvas>
        <ambientLight />
        <SceneObject />
      </Canvas>
    </FlowProvider>
  );
}
```

In this shape, `InputLayer` is a client-side React component under
`FlowProvider`, but it is not inside `<Canvas>`. It can attach browser input
listeners without becoming part of the R3F scene tree.

Use DOM controls for visible UI and input hooks for optional browser shortcuts.
Both should call the same flow controls rather than trying to move scene objects
directly.

## Wheel input

`useWheelInput` listens for wheel events and converts movement past a threshold
into phase navigation.

```tsx
import { useWheelInput } from "r3f-interactive-flow";

function WheelInputLayer() {
  useWheelInput<Phase>({
    threshold: 40,
    cooldown: 500,
    axis: "y",
    ignore: ["[data-flow-ignore]"]
  });

  return null;
}
```

Use a threshold so small trackpad movement does not trigger navigation. Use a
cooldown so one fast wheel gesture does not step through multiple phases before
the user can see the result.

By default, wheel input uses the vertical axis. If your layout is horizontal,
set `axis: "x"`. Use `ignore` selectors for page regions where wheel movement
should not control the flow, such as a scrollable panel or form area.

```tsx
function Sidebar() {
  return <div data-flow-ignore>Scrollable content that should not change phase.</div>;
}
```

Wheel input should feel like a discrete phase control, not a continuous scroll
position. If users can produce many wheel events quickly, tune `threshold` and
`cooldown` together.

## Touch input

`useTouchInput` listens for touch gestures and converts a swipe past a threshold
into phase navigation.

```tsx
import { useTouchInput } from "r3f-interactive-flow";

function TouchInputLayer() {
  useTouchInput<Phase>({
    threshold: 50,
    cooldown: 500,
    axis: "y",
    ignore: ["[data-flow-ignore]"]
  });

  return null;
}
```

Touch input is also discrete. A swipe should request one phase change. It should
not behave like a full gesture framework, drag system, or scroll timeline.

Use `threshold` to distinguish intentional swipes from small finger movement.
Use `cooldown` to avoid multiple phase changes from repeated gestures. Use
`ignore` selectors for controls, forms, or scrollable areas where touch input
should stay local to that element.

If your experience moves horizontally, set `axis: "x"`. Keep the chosen touch
axis aligned with how the phase sequence is presented in your UI.

## Keyboard input

`useKeyboardInput` listens for keydown events and maps configured keys to
`next` and `prev`.

```tsx
import { useKeyboardInput } from "r3f-interactive-flow";

function KeyboardInputLayer() {
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

The default keyboard behavior already covers common navigation keys. Configure
`keys` when your experience has a clearer direction or when you want to avoid a
key that conflicts with the rest of your page.

Keyboard input ignores repeated keydown events from a held key. It also ignores
typing targets by default, such as inputs, textareas, selects, and editable
content. This keeps normal text entry from unexpectedly changing phases.

Use `cooldown` when keyboard navigation should pause briefly after a phase
change. This is especially useful when the same keyboard controls are also used
by visible buttons or other page UI.

## Locking and cooldown

Input hooks call the same flow navigation path as buttons that use `next` and
`prev`. They do not bypass the flow machine.

A navigation request can be ignored when:

- the flow is locked;
- a transition is already active;
- the request would move before the first phase or after the last phase;
- the relevant cooldown window has not finished;
- the event did not pass the input hook threshold or key mapping.

Locking is an explicit application decision. Use `lock` and `unlock` from
`useFlow` when navigation should pause for a modal, intro sequence, blocking UI,
or another interaction that must finish first.

Cooldown is a short automatic guard against repeated input. Provider transition
cooldown and input hook cooldowns both help make browser input feel intentional.
They are especially important for wheel, touch, and keyboard events because
browsers can deliver those events rapidly.

Repeated input should be controlled because phase navigation is discrete. A
single user intent should normally produce one accepted phase change, then give
the transition time to start or finish before another one is accepted.

## Keeping input separate from R3F scenes

Keep browser input hooks in DOM/client components, and keep frame work in
Canvas-bound components.

```tsx
import { useFlow, useWheelInput, useTouchInput, useKeyboardInput } from "r3f-interactive-flow";

function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500 });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500 });
  useKeyboardInput<Phase>({ cooldown: 250 });

  return null;
}

function Controls() {
  const { phase, phaseIndex, next, prev } = useFlow<Phase>();

  return (
    <div>
      <p>
        Phase {phaseIndex + 1}: {phase}
      </p>
      <button onClick={prev}>Previous</button>
      <button onClick={next}>Next</button>
    </div>
  );
}

function SceneObject() {
  return <mesh />;
}
```

`InputLayer` and `Controls` are regular React components. They can live next to
your page layout, overlays, and status UI. `SceneObject` is a Canvas component.
It should not call wheel, touch, or keyboard input hooks.

This separation keeps responsibilities clear:

- DOM/client components decide when input requests navigation.
- `FlowProvider` decides whether navigation is accepted.
- Canvas components decide how the current phase and transition progress affect
  scene visuals.

## Troubleshooting

### Input does nothing

Confirm the component that calls the input hook is rendered under
`FlowProvider`. The hooks need the provider context, just like `useFlow`.

Also confirm the component is a client component in frameworks with server and
client boundaries. Input hooks attach browser listeners from effects and should
not be called from server-rendered-only components.

### Wheel or touch changes too many phases

Increase `threshold`, increase `cooldown`, or both. Wheel and touch hardware can
produce many events from one gesture, so repeated events should be controlled.

### Input fires while using a form or scrollable panel

For wheel and touch, add an ignored region and pass a matching selector in
`ignore`.

```tsx
function InputLayer() {
  useWheelInput<Phase>({ ignore: ["[data-flow-ignore]"] });
  useTouchInput<Phase>({ ignore: ["[data-flow-ignore]"] });

  return null;
}

function FormPanel() {
  return (
    <div data-flow-ignore>
      <input aria-label="Name" />
    </div>
  );
}
```

Keyboard input ignores typing targets by default. If you override keyboard
options, preserve that behavior unless you have a specific reason not to.

### Input works in DOM controls but not in Canvas objects

That is a sign the responsibilities are mixed. Keep input hooks outside
`<Canvas>`, and use Canvas-bound frame hooks only for scene updates. The input
layer should request `next` or `prev`; scene objects should react to the flow
state they receive through the R3F bridge.

### Navigation is ignored during a transition

That is expected. Input hooks respect active transitions and locks. If the app
needs faster navigation, tune transition duration and cooldown, but keep repeated
browser events guarded so users do not skip phases accidentally.

## Next steps

- [Common mistakes](./common-mistakes.md) - patterns to avoid when combining
  provider state, DOM input, and Canvas scene updates.
- [Next.js usage](./nextjs-usage.md) - client component boundaries for provider
  and input hooks.
- [React Three Fiber usage](./r3f-usage.md) - safe Canvas placement and the
  `useFlowFrame` bridge.
