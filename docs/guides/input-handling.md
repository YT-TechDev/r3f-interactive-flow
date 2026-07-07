# Input handling

`r3f-interactive-flow` ships three optional browser input hooks:
`useWheelInput`, `useTouchInput`, and `useKeyboardInput`. They connect wheel,
touch, and keyboard events to the flow controls you already have.

This guide explains how to wire them up predictably: where they belong, how they
drive navigation, and how they respect locks and cooldowns so a single gesture
produces a single phase change.

It assumes you have read [Getting started](./getting-started.md) and
[Core concepts](./core-concepts.md).

All examples use package-root imports only:

```tsx
import { FlowProvider, useWheelInput, useTouchInput, useKeyboardInput } from "r3f-interactive-flow";
```

These hooks are small helpers, not a gesture engine. They map coarse
wheel/swipe/key intent onto `next` and `prev`. The library is not a gesture
framework, a scroll framework, or a router, and these hooks do not try to be one.

## Mental model

Think of the input hooks as a thin layer between the browser and the flow
machine.

- **Browser events come in** - wheel deltas, touch swipes, key presses.
- **The hook decides whether that counts as intent** - is the movement past the
  threshold, is the flow free to move, has the cooldown elapsed.
- **Accepted intent drives the existing controls** - the hook calls the same
  `next` and `prev` that a button would. It never bypasses the flow machine and
  never invents its own navigation path.

Because the hooks route through the same machine as your DOM controls, wheel,
touch, keyboard, and button navigation all stay in agreement. There is no
separate input state to keep in sync.

Two placement rules follow from this:

- Input hooks belong in **DOM/client components** mounted under `FlowProvider`.
  They attach listeners to `window` (or a DOM element you choose), which is the
  browser's job, not the scene's.
- Input hooks should **not** be mixed into R3F scene object logic. A mesh
  rendered inside `<Canvas>` has no business owning global input listeners, and
  the Canvas runs a separate reconciler. Keep input in the DOM layer where it
  belongs.

## Recommended component split

A predictable app keeps input in its own small component rather than sprinkling
listeners across the tree. One `FlowProvider` sits above everything that shares
flow state; an input layer and your DOM controls live beneath it, alongside (but
outside) the `<Canvas>` subtree.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { FlowProvider } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];

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

`InputLayer` is a component that renders nothing and only calls the input hooks.
`Controls` holds ordinary buttons wired to `useFlow`. Both share the single
machine created by `FlowProvider`.

```tsx
function InputLayer() {
  useWheelInput<Phase>({ threshold: 40, cooldown: 500 });
  useTouchInput<Phase>({ threshold: 50, cooldown: 500 });
  useKeyboardInput<Phase>({ cooldown: 250 });

  return null;
}
```

An input component that returns `null` is intentional: its whole job is to
attach listeners from effects. Keeping it separate makes it easy to find,
toggle, or remove without touching your visible UI.

## Wheel input

`useWheelInput` maps wheel movement onto `next` and `prev`. A wheel delta past
the threshold in the positive direction advances the flow; past the threshold in
the negative direction moves it back.

```tsx
function WheelLayer() {
  useWheelInput<Phase>({
    threshold: 40,
    axis: "y",
    cooldown: 500,
    ignore: ["[data-flow-ignore]"]
  });

  return null;
}
```

Options:

- `threshold` - the minimum absolute wheel delta that counts as navigation.
  Defaults to `40`. Smaller values feel more sensitive; larger values require a
  more deliberate scroll.
- `axis` - `"y"` (default) reads vertical scroll; `"x"` reads horizontal.
- `cooldown` - milliseconds to ignore further navigation after an accepted move.
  Defaults to `0`. See [Locking and cooldown](#locking-and-cooldown).
- `ignore` - an array of CSS selectors. If the event's target is inside a
  matching element, the wheel event is left alone, so scrollable panels and
  other opt-out regions keep their native behavior. Mark those regions with
  something like `<div data-flow-ignore>...</div>`.
- `preventDefault` - whether the hook calls `preventDefault()` on qualifying
  wheel events. Defaults to `true`, which stops the page from also scrolling
  when a wheel gesture drives a phase change.
- `enabled` - set to `false` to detach the listener without unmounting the
  component.
- `target` - an element, a ref to an element, or `Window`. Defaults to the
  window.

## Touch input

`useTouchInput` maps swipe gestures onto `next` and `prev`. It measures the
distance between where a touch starts and where it ends; a swipe past the
threshold navigates in the corresponding direction.

```tsx
function TouchLayer() {
  useTouchInput<Phase>({
    threshold: 50,
    axis: "y",
    cooldown: 500,
    ignore: ["[data-flow-ignore]"]
  });

  return null;
}
```

It accepts the same options as `useWheelInput` - `threshold` (defaults to `50`),
`axis`, `cooldown`, `ignore`, `preventDefault`, `enabled`, and `target`. A
vertical swipe up advances the flow on the default `"y"` axis; a swipe down moves
it back. Use `ignore` selectors for regions that should scroll or handle their
own touch gestures.

## Keyboard input

`useKeyboardInput` maps keys onto `next` and `prev`. By default the "next" keys
are `ArrowDown`, `ArrowRight`, `PageDown`, and `Space`, and the "prev" keys are
`ArrowUp`, `ArrowLeft`, and `PageUp`. Override them through the `keys` option.

```tsx
function KeyboardLayer() {
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

Options:

- `keys` - an object with optional `next` and `prev` arrays of `KeyboardEvent.key`
  values. Omit it to use the defaults above.
- `cooldown` - milliseconds to ignore further navigation after an accepted move.
  Defaults to `0`.
- `ignoreWhenTyping` - when `true` (the default), key presses inside `<input>`,
  `<textarea>`, `<select>`, and `contenteditable` elements are ignored, so typing
  in a form does not navigate the flow.
- `preventDefault` - whether the hook calls `preventDefault()` on a matched key.
  Defaults to `true`.
- `enabled` - set to `false` to detach the listener.
- `target` - an element, a ref, or `Window`. Defaults to the window.

Held keys do not repeat-fire navigation: the hook ignores auto-repeat `keydown`
events, so holding an arrow key does not race through phases.

## Locking and cooldown

The input hooks never bypass flow state. Before turning a wheel, touch, or key
event into navigation, each hook checks the current snapshot and quietly skips
the event when the flow is not free to move:

- **While a transition is running** (`isTransitioning` is `true`), input events
  are ignored. A gesture cannot interrupt or stack on top of an in-progress
  phase change.
- **While the flow is locked** (`isLocked` is `true`, via `lock`/`unlock` from
  `useFlow`), input events are ignored, exactly as `next`, `prev`, and `goTo`
  are. Use a lock when navigation must not happen right now - an intro sequence,
  a modal - and release it when navigation should resume.
- **At a boundary**, a "prev" gesture on the first phase is ignored, just as
  calling `prev` there does nothing.

**Cooldown** is a short window, in milliseconds, after an accepted navigation
during which the hook ignores further input. It is what turns a fast scroll, a
flick, or a quick double-tap into a single phase change instead of several. Each
input hook takes its own `cooldown` option, and it is independent of the
provider's transition cooldown:

```tsx
<FlowProvider phases={phases} transition={{ duration: 700, cooldown: 250 }}>
  {/* the provider cooldown applies to every navigation control */}
</FlowProvider>
```

The provider's `transition.cooldown` guards the machine after any transition;
the hook's `cooldown` additionally throttles that specific input source. Wheel
and touch events in particular arrive in rapid bursts, so a per-hook cooldown of
a few hundred milliseconds is usually what keeps navigation feeling like one step
per gesture rather than a scramble through phases.

For the conceptual background on locking and cooldown, see
[Core concepts](./core-concepts.md#locking-and-cooldown).

## Keeping input separate from R3F scenes

Input hooks are DOM/client hooks. Keep them out of the Canvas:

- Call them from ordinary React components rendered under `FlowProvider` and
  **outside** `<Canvas>` - an input layer or your DOM controls.
- Do not call them from a component rendered inside `<Canvas>`. Scene objects are
  for `useFlowFrame` and Three.js work; a mesh should not own global wheel or key
  listeners. `<Canvas>` also runs a separate reconciler, so mixing concerns there
  only makes the tree harder to reason about.
- Because both the input layer and the scene read the same `FlowProvider`, a
  swipe handled in the DOM layer updates the phase that a `useFlowFrame` scene
  object is already reading. You do not wire input into the scene directly - the
  shared machine connects them.

The input hooks are also safe under server-side rendering. They do not touch
`window` or `document` at module import time; listeners attach only from
client-side effects. In Next.js App Router projects, call them from Client
Components (`"use client"`) - see [Next.js usage](./nextjs-usage.md).

## Troubleshooting

**Nothing happens on scroll, swipe, or key press.** Confirm the input component
is mounted under `FlowProvider` and is actually rendered. Check that `enabled` is
not `false`, and that the flow is not locked or mid-transition - input is ignored
while `isLocked` or `isTransitioning` is `true`.

**Navigation feels twitchy or skips several phases at once.** Raise the
`cooldown`, and consider raising the `threshold`. Wheel and touch events fire in
bursts; a cooldown of a few hundred milliseconds collapses one gesture into one
step.

**A scrollable panel navigates the flow instead of scrolling.** Add an `ignore`
selector and mark the region, for example `ignore: ["[data-flow-ignore]"]` with
`<div data-flow-ignore>...</div>`. Events originating inside a matching element
are left alone.

**The page still scrolls when a wheel or swipe should drive the flow.** That is
`preventDefault` being disabled. It defaults to `true`; only set it to `false` if
you intend the browser to keep its native scroll behavior.

**Typing in a form field jumps between phases.** Keyboard input ignores typing
targets by default (`ignoreWhenTyping: true`). If you changed the `target` or
disabled that option, restore the default so form fields are respected.

**A "prev" gesture on the first phase does nothing.** That is expected. Backward
navigation past the first phase is ignored, the same as calling `prev` at the
start of the flow.

## Next steps

- [Common mistakes](./common-mistakes.md) - anti-patterns to avoid, including
  where input hooks should and should not live.
- [Next.js usage](./nextjs-usage.md) - safe Client Component usage in the App
  Router.
- [React Three Fiber usage](./r3f-usage.md) - the `useFlowFrame` bridge and how
  DOM input and Canvas scene layers share one machine.
