# Input handling

`r3f-interactive-flow` includes three optional browser input hooks:

- `useWheelInput` maps wheel movement to `next` and `prev`.
- `useTouchInput` maps swipe movement to `next` and `prev`.
- `useKeyboardInput` maps configured keys to `next` and `prev`.

These hooks are small browser input helpers. They are not a full gesture
framework, router, animation system, or replacement for your app's own input
model. Use them when a page should let common browser input move through the
same flow phases that your buttons or other controls already use.

The v2.5.0 real-world usage validation confirmed this behavior with representative desktop Chrome physical mouse, high-resolution trackpad, keyboard, and physical iPhone Safari touch evidence. Treat that as integration evidence, not broad browser certification; optional physical tablet validation remained unverified because no tablet was available.

## Import contract

Import hooks from the package root:

```ts
import { useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";
```

Do not import from internal package paths.

## Where to mount input hooks

Mount input hooks from client-side DOM/input layer components rendered under
`FlowProvider`. Keep this layer outside R3F scene components by default so DOM
input behavior stays separate from Canvas-bound scene logic.

```tsx
"use client";

import { FlowProvider, useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";

type Phase = "intro" | "details" | "outro";

const phases: Phase[] = ["intro", "details", "outro"];

function FlowInputLayer() {
  useWheelInput<Phase>();
  useTouchInput<Phase>();
  useKeyboardInput<Phase>();

  return null;
}

export function Experience() {
  return (
    <FlowProvider phases={phases} transition={{ duration: 700, cooldown: 250 }}>
      <FlowInputLayer />
      {/* DOM controls and Canvas content can live here. */}
    </FlowProvider>
  );
}
```

In frameworks with server components, put the input layer behind the normal
client boundary for React hooks and browser events. The hooks attach browser
event listeners from effects after mount; they do not attach listeners or read
browser globals at module import time.

## How input maps to flow navigation

The input hooks drive the existing flow controls. They do not bypass flow state
or create a separate navigation path.

| Hook               | Browser input              | Flow control called |
| ------------------ | -------------------------- | ------------------- |
| `useWheelInput`    | Wheel delta past threshold | `next` or `prev`    |
| `useTouchInput`    | Swipe past threshold       | `next` or `prev`    |
| `useKeyboardInput` | Configured keydown         | `next` or `prev`    |

Because the hooks use the same controls as manual UI, the same rules apply:
locks, active transitions, phase boundaries, provider cooldowns, and hook-local
cooldowns can all prevent an input event from moving to another phase.

## `preventDefault` follows accepted navigation

`preventDefault` defaults to `true` on every input hook, but the hooks only
call `preventDefault()` on a browser event after that event has produced an
accepted flow navigation (or, for touch, on later events belonging to a
gesture that already navigated). An input event that is rejected — by a
threshold miss, a phase boundary, a manual lock, an active transition, a
provider cooldown, a hook-local cooldown, an ignored region, or a native
actionable control — leaves the browser's default behavior alone, so page
scroll, native button/link activation, and text field editing keep working
normally.

Set `preventDefault: false` on a hook to let accepted navigation happen
without suppressing the browser's default behavior at all.

## Wheel input

Use wheel input for scroll-like phase navigation.

```tsx
import { useWheelInput } from "r3f-interactive-flow";

type Phase = "intro" | "details" | "outro";

export function FlowInputLayer() {
  useWheelInput<Phase>({
    threshold: 40,
    cooldown: 500,
    ignore: ["[data-flow-ignore]"]
  });

  return null;
}
```

`useWheelInput` reads the wheel delta on the `y` axis by default and
normalizes browser wheel delta modes before comparing the value with
`threshold`. Pixel-mode deltas are used directly, line-mode deltas are scaled
to pixel-like units, and page-mode deltas are scaled to larger page-like units.
The conversion details stay internal; `threshold` remains the public
configuration value in normalized internal units.

- A positive delta greater than `threshold` calls `next`.
- A negative delta less than `-threshold` calls `prev`.
- A delta at or within the threshold does nothing.

Small same-direction wheel deltas accumulate during a short wheel burst, which
keeps high-resolution trackpads from missing intentional scroll gestures. A
direction reversal, a target change, or a short period of wheel inactivity
resets pending wheel intent, and the current event starts the new burst.

One wheel burst can produce at most one accepted phase navigation. Follow-up
momentum events in the same direction and on the same target do not advance
through additional phases. If a threshold-crossing attempt is rejected by a
boundary, lock, transition, provider cooldown, or hook-local cooldown, the hook
does not call `preventDefault()` and does not queue stale intent for a later
automatic navigation.

Useful options:

- `threshold`: minimum wheel delta required before the hook requests navigation.
  The default is `40`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `ignore`: selectors for regions where wheel input should not drive flow
  navigation.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true`. The hook only calls `preventDefault()`
  after a wheel event has produced an accepted navigation; threshold misses,
  boundaries, locks, transitions, cooldowns, and ignored or actionable targets
  never suppress the native wheel event.
- `axis`: use `"x"` instead of the default `"y"` for horizontal wheel input.

`useWheelInput` also skips navigation for wheel events that target a native
editable field (`input`, `textarea`, `select`, or a `contenteditable` region)
or an actionable control (`button`, or `a` with an `href`), in addition to any
selectors passed through `ignore`. These built-in targets keep their native
wheel/scroll behavior without any extra configuration.

## Touch input

Use touch input for simple swipe-to-advance behavior.

```tsx
import { useTouchInput } from "r3f-interactive-flow";

type Phase = "intro" | "details" | "outro";

export function FlowInputLayer() {
  useTouchInput<Phase>({
    threshold: 50,
    cooldown: 500,
    ignore: ["[data-flow-ignore]"]
  });

  return null;
}
```

`useTouchInput` tracks the start and end position on the `y` axis by default:

- An upward swipe farther than `threshold` calls `next`.
- A downward swipe farther than `threshold` calls `prev`.
- A short movement at or within the threshold does nothing.

A touch gesture starts at `touchstart` and is committed the first time a
`touchmove` crosses `threshold` and the flow accepts the resulting navigation.
Once a gesture is committed:

- navigation happens exactly once for that gesture;
- later `touchmove` events from the same gesture may still call
  `preventDefault()` (when enabled) but never navigate again.

If a gesture never produces a qualifying `touchmove` (a sparse or synthetic
touch stream), `touchend` acts as a fallback and attempts navigation once
using the start and end positions. `touchcancel`, and `touchend` on an
uncommitted or ignored gesture, fully reset gesture state.

Useful options:

- `threshold`: minimum swipe distance required before the hook requests
  navigation. The default is `50`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `ignore`: selectors for regions where touch gestures should not drive flow
  navigation.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true`. The hook only calls `preventDefault()`
  once a gesture has produced an accepted navigation (at the committing
  `touchmove`, on later `touchmove` events in that same gesture, or at the
  `touchend` fallback); short gestures, boundaries, locks, transitions,
  cooldowns, and ignored or actionable gesture origins never suppress the
  native touch event.
- `axis`: use `"x"` instead of the default `"y"` for horizontal swipe input.

`useTouchInput` also skips a gesture that starts on a native editable field
(`input`, `textarea`, `select`, or a `contenteditable` region) or an
actionable control (`button`, or `a` with an `href`), in addition to any
selectors passed through `ignore`. A gesture that starts in one of these
regions stays ignored for its whole lifetime, even if a later `touchmove`
leaves the region.

## Ignore selectors for interactive regions

Wheel and touch input already skip native editable fields and actionable
controls (`input`, `textarea`, `select`, `contenteditable` regions, `button`,
and `a` with an `href`) without any configuration. Use `ignore` selectors for
additional DOM regions where native interaction should win: scrollable panels,
drawers, menus, and other custom controls.

```tsx
import { useTouchInput, useWheelInput } from "r3f-interactive-flow";

const inputIgnore = ["[data-flow-ignore]"] as const;

export function FlowInputLayer() {
  useWheelInput({ ignore: inputIgnore });
  useTouchInput({ ignore: inputIgnore });

  return null;
}
```

Then mark larger UI regions that should not trigger phase navigation:

```tsx
export function SidePanel() {
  return (
    <aside data-flow-ignore>
      <button type="button">Open details</button>
      <p>This panel can handle its own scroll, touch, and controls.</p>
    </aside>
  );
}
```

Ignored wheel and touch events return before navigation and leave native behavior available. Use ignore selectors as
a boundary between page-level flow input and local UI controls, including custom nested-scroll regions.

## Keyboard input

Use keyboard input when arrow keys, page keys, or your own key mapping should
move through phases.

```tsx
import { useKeyboardInput } from "r3f-interactive-flow";

type Phase = "intro" | "details" | "outro";

export function FlowInputLayer() {
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

Configure keys with `keys.next` and `keys.prev`:

- `keys.next` lists key values that call `next`.
- `keys.prev` lists key values that call `prev`.

If you omit `keys`, the default next keys are `ArrowDown`, `ArrowRight`,
`PageDown`, and Space (`" "`). The default previous keys are `ArrowUp`,
`ArrowLeft`, and `PageUp`.

Useful options:

- `keys.next`: key values that request `next`.
- `keys.prev`: key values that request `prev`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true`. The hook only calls `preventDefault()`
  after a mapped key has produced an accepted navigation; unmapped keys,
  repeated keys, typing targets, boundaries, locks, transitions, and cooldowns
  never suppress the native keydown event.
- `ignoreWhenTyping`: defaults to `true`, so keyboard events from inputs,
  textareas, selects, and contenteditable elements are ignored.

Keyboard input ignores repeated `keydown` events from a held key.

Space and Enter get extra protection: when the key is Space or Enter and the
event target is (or is nested inside) a native actionable control — `button`,
`a` with an `href`, `input`, `textarea`, or `select` — the hook does not
navigate and does not call `preventDefault()`, even if Space or Enter is
mapped to `next` or `prev`. This keeps native button and link activation
working when Space is the default next key or when Enter is mapped
explicitly. Space and Enter still navigate normally when mapped and the event
target is not an actionable control.

## Thresholds and cooldowns

Thresholds filter noisy input before navigation is requested:

- Wheel threshold is based on wheel delta.
- Touch threshold is based on swipe distance.
- Keyboard input has no threshold; it uses key matching instead.

Cooldowns reduce accidental repeated navigation:

- `transition.cooldown` on `FlowProvider` is part of the shared flow navigation
  rules. It starts after the accepted transition completes, runs for the full
  configured duration after completion, and blocks manual controls plus wheel,
  touch, and keyboard hooks globally.
- `cooldown` on an input hook is local to that hook and starts only after that
  hook's accepted navigation request. It is separate from provider transition
  cooldown.

Use provider cooldown for global phase navigation pacing. Use hook cooldown when
a specific browser input source, such as trackpad wheel bursts or repeated swipe
attempts, needs extra spacing.

## Locks, transitions, boundaries, and ignored input

Input hooks are conservative. An input event may be recognized by the browser
listener but still not change phase.

Navigation does not happen when:

- the flow is locked;
- a transition is already active;
- provider cooldown is still active;
- the hook-local cooldown is still active;
- wheel or touch movement does not pass the threshold;
- the event starts from an ignored, editable, or actionable wheel or touch
  region;
- keyboard input comes from a typing target while `ignoreWhenTyping` is enabled;
- a mapped Space or Enter key targets a native actionable control;
- the request would move before the first phase or after the last phase.

In every one of these cases the input hooks also leave `preventDefault()`
uncalled, so the browser's native behavior for that event — page scroll,
button/link activation, text editing — is unaffected. Only an event that
actually produces an accepted navigation (or a later event in an
already-accepted touch gesture) gets suppressed, and only when
`preventDefault` is left at its default of `true`.

Ignored input does not queue a future transition. Once the relevant lock,
transition, boundary, or cooldown condition is gone, the user must provide a new
input event.

## Keep input separate from scene code

Prefer this split:

- DOM/input layer: `useWheelInput`, `useTouchInput`, `useKeyboardInput`, buttons,
  links, forms, and other page controls.
- R3F scene layer: Canvas-bound rendering and `useFlowFrame` animation reads.

This keeps browser input listeners out of scene components and avoids coupling
DOM event policy to objects rendered inside the Canvas.
