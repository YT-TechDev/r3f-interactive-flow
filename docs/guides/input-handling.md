# Input handling

`r3f-interactive-flow` includes three optional browser input hooks:

- `useWheelInput` maps wheel movement to `next` and `prev`.
- `useTouchInput` maps single-touch swipe movement to `next` and `prev`.
- `useKeyboardInput` maps configured keys to `next` and `prev`.

These hooks are small browser input helpers. They are not a full gesture
framework, router, animation system, or replacement for your app's own input
model. Use them when a page should let common browser input move through the
same flow phases that your buttons or other controls already use.

Visible DOM controls are the baseline operation path; wheel, touch, and keyboard hooks are optional enhancements around the same flow controls. Earlier v2.5.0 real-world usage validation confirmed representative desktop Chrome physical mouse, high-resolution trackpad, keyboard, and physical iPhone Safari touch evidence. Current bounded evidence also includes focused Node/minimal-DOM tests for deterministic hook contracts and one Vitest Browser Mode file running through a Playwright-managed headless Chromium instance for native activation, focus non-interference, prevention, repeat, and DOM ancestry. Treat this as bounded evidence, not physical-device proof, cross-browser certification, screen-reader certification, WCAG conformance, a native-scroll-feel promise, or a background-tab guarantee. For application-owned controls, focus, nested scrolling, and motion policy, see [Accessible interaction and reduced motion](./accessibility-and-reduced-motion.md).

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
const inputIgnore = ["[data-flow-ignore]"] as const;
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
client boundary for React hooks and browser events. Browser listeners are
attached inside React Effects after mount. The modules do not read browser
globals or attach listeners at import time.

## Listener lifecycle and target resolution

`enabled: false` skips listener setup. When enabled, each hook resolves its
target during Effect setup and cleans up listeners when that Effect is replaced
and when the input layer unmounts. Cleanup and pending-state reset also happen
after intentional resolved target replacement or material option changes that
are represented by Effect dependencies. Ordinary equivalent rerenders are not
remounts, and equivalent option values should not be treated as discarding an
in-flight committed touch gesture. Raw browser listener identity is not a public
API contract.

The bounded target contract is:

- an omitted target resolves to `window`;
- an explicit `Window` attaches directly;
- an explicit `HTMLElement` attaches directly;
- an unresolved explicit ref attaches nowhere;
- an unresolved explicit ref never falls back to `window`;
- a normal React element ref resolved in the same commit is available before
  Effect setup;
- later arbitrary changes to `ref.current` are not automatically observed as
  subscription changes;
- mutable ref detachment/remount alone is not a target-tracking signal;
- direct resolved element identity replacement is supported through normal
  Effect cleanup and setup.

For dynamic targets, pass a resolved element through React state or
intentionally reconfigure/remount the input layer. The hooks do not include a
target manager, observer, polling loop, callback-ref API, or event bus.

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
cooldowns can all reject input without moving to another phase.

## `preventDefault` follows accepted navigation

`preventDefault` defaults to `true` on every input hook. Accepted navigation may
call `preventDefault()` when the hook's option is true. Later events in an
already committed touch gesture may also be prevented. Threshold misses,
ignored/actionable/editable origins, boundaries, locks, transitions, provider
cooldown, hook-local cooldown, repeated keys, typing targets, and other rejected
navigation attempts remain unprevented. Set `preventDefault: false` to allow
accepted navigation without suppressing native behavior.

## Wheel input

Use wheel input for scroll-like phase navigation.

```tsx
import { useWheelInput } from "r3f-interactive-flow";

const inputIgnore = ["[data-flow-ignore]"] as const;

type Phase = "intro" | "details" | "outro";

export function FlowInputLayer() {
  useWheelInput<Phase>({
    threshold: 40,
    cooldown: 500,
    ignore: inputIgnore
  });

  return null;
}
```

`useWheelInput` reads the wheel delta on the `y` axis by default and normalizes
browser wheel delta modes before comparing the value with `threshold`. Same-
direction deltas may accumulate in one short burst. Direction reversal, target
change, and inactivity reset pending burst intent. One burst produces at most
one accepted navigation. Rejected input does not consume hook-local cooldown and
does not queue later navigation. Accepted navigation may call `preventDefault()`
when enabled; rejected navigation remains unprevented. Wheel burst inactivity
and hook-local cooldown use monotonic elapsed time.

Do not rely on physical trackpad uniformity across every browser or device.

Useful options:

- `threshold`: minimum normalized wheel delta required before the hook requests
  navigation. The default is `40`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `ignore`: selectors for regions where wheel input should not drive flow
  navigation.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true` and follows the accepted-navigation rule
  above.
- `axis`: use `"x"` instead of the default `"y"` for horizontal wheel input.

`useWheelInput` also skips navigation for wheel events that target a native
editable field (`input`, `textarea`, `select`, or a `contenteditable` region) or
an actionable control (`button`, or `a` with an `href`), in addition to any
selectors passed through `ignore`.

## Touch input

Use touch input for bounded single-touch swipe-to-advance behavior. It is a
small single-touch swipe helper, not a full gesture framework.

```tsx
import { useTouchInput } from "r3f-interactive-flow";

const inputIgnore = ["[data-flow-ignore]"] as const;

type Phase = "intro" | "details" | "outro";

export function FlowInputLayer() {
  useTouchInput<Phase>({
    threshold: 50,
    cooldown: 500,
    ignore: inputIgnore
  });

  return null;
}
```

`useTouchInput` tracks single-touch position on the `y` axis by default. A
gesture is eligible only when it starts with exactly one active touch and stays
single-touch until navigation commits or the sequence ends. A sequence that
starts with multiple touches or later becomes multi-touch is ignored without
preventing its events. That invalidation is sticky even if the sequence returns
to one active touch; after all touches end, a fresh single-touch gesture is
eligible normally. An
upward swipe farther than `threshold` calls `next`; a downward swipe farther
than `threshold` calls `prev`; a short movement at or within the threshold does
nothing. Touch gesture distance is position-based and does not use a clock.

A gesture starts at `touchstart`. Threshold crossing during `touchmove` attempts
navigation and, when accepted, creates a committed touch gesture. One accepted
navigation can happen per committed touch gesture. Later `touchmove` events in
the same committed touch gesture may remain prevented when configured, but they
never navigate again. If a stream does not produce a qualifying `touchmove`,
`touchend` provides a bounded fallback using the start and end positions.
Missing `touches[0]` during `touchmove` does not invent a new gesture, and the
later `touchend` fallback remains bounded. `touchcancel` before or after
commitment clears gesture state. Unmount/remount during an active uncommitted
gesture does not replay it.

Ignored/actionable origin status is fixed from the gesture origin for the
gesture lifetime, even if later event targets leave that region. Disable,
unmount, target replacement, and material Effect replacement reset pending touch
state. Equivalent ignore rerenders preserve a committed touch gesture after the
#423 fix, while materially changed selectors intentionally replace the Effect
and reset relevant pending touch state.

The hook does not recognize pinch or rotate gestures and does not track touch
identity. There is no velocity, inertia, long-press, pointer-event, or general
gesture-recognition contract.

Useful options:

- `threshold`: minimum swipe distance required before the hook requests
  navigation. The default is `50`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `ignore`: selectors for regions where touch gestures should not drive flow
  navigation.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true` and follows the accepted-navigation rule
  above.
- `axis`: use `"x"` instead of the default `"y"` for horizontal swipe input.

`useTouchInput` also skips gestures that start on native editable fields or
actionable controls, in addition to any selectors passed through `ignore`.

## Ignore selectors and equivalent options

Wheel and touch input already skip native editable fields and actionable
controls (`input`, `textarea`, `select`, `contenteditable` regions, `button`,
and `a` with an `href`) without configuration. Use `ignore` selectors for
additional DOM regions where native interaction should win: scrollable panels,
drawers, menus, and other custom controls.

Descendant event targets inherit protection from matching ignored, editable, or
actionable ancestors. For example, an icon or nested span inside a button, a
descendant inside an anchor with `href`, a descendant inside an editable or
`contenteditable` region, and a descendant inside a `[data-flow-ignore]` region
keep the native or local interaction boundary of that ancestor.

```tsx
import { useTouchInput, useWheelInput } from "r3f-interactive-flow";

const inputIgnore = ["[data-flow-ignore]"] as const;

export function FlowInputLayer() {
  useWheelInput({ ignore: inputIgnore });
  useTouchInput({ ignore: inputIgnore });

  return null;
}
```

Semantically equivalent wheel/touch `ignore` selector arrays do not need to
destroy the intended listener/gesture lifecycle. The #423 fix preserves
committed touch gesture state across equivalent inline ignore rerenders.
Materially changed selectors intentionally replace the Effect and reset relevant
pending gesture/listener state. Hoisting constants is recommended for
readability, stable intent, and avoiding unnecessary listener work; it does not
mean every inline object is a correctness bug.

Keyboard has no `ignore` selector option. Fresh equivalent keyboard `keys`
objects can still replace the keyboard listener because the keys object is an
Effect dependency, but rejected input and hook-local cooldown behavior remain as
described here.

## Keyboard input

Use keyboard input when arrow keys, page keys, or your own key mapping should
move through phases.

```tsx
import { useKeyboardInput } from "r3f-interactive-flow";

const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

type Phase = "intro" | "details" | "outro";

export function FlowInputLayer() {
  useKeyboardInput<Phase>({
    cooldown: 250,
    keys: keyboardKeys
  });

  return null;
}
```

Mapped `keydown` events call `next` or `prev`. Repeated `keydown` events from a
held key are ignored. Typing targets are protected when `ignoreWhenTyping` is
enabled. Space and Enter retain native activation behavior on actionable
controls, including button and anchor descendants. Accepted mapped navigation may be prevented when configured. Rejected
or protected keyboard input remains unprevented. Keyboard has no `ignore`
selector, and focus remains application-owned. Hook-local cooldown uses monotonic elapsed time, and rejected input
does not consume cooldown.

If you omit `keys`, the default next keys are `ArrowDown`, `ArrowRight`,
`PageDown`, and Space (`" "`). The default previous keys are `ArrowUp`,
`ArrowLeft`, and `PageUp`.

Useful options:

- `keys.next`: key values that request `next`.
- `keys.prev`: key values that request `prev`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true` and follows the accepted-navigation rule
  above.
- `ignoreWhenTyping`: defaults to `true`, so keyboard events from inputs,
  textareas, selects, and contenteditable elements are ignored.

## Thresholds, cooldowns, and clocks

Thresholds filter noisy input before navigation is requested:

- Wheel threshold is based on normalized wheel delta.
- Touch threshold is based on swipe distance.
- Keyboard input has no threshold; it uses key matching instead.

Cooldowns reduce accidental repeated navigation:

- `transition.cooldown` on `FlowProvider` is the provider cooldown. It starts
  after the accepted transition completes, runs for the configured duration, and
  blocks manual controls plus wheel, touch, and keyboard hooks globally.
- `cooldown` on an input hook is hook-local cooldown and starts only after that
  hook's accepted navigation request. Rejected input does not consume it.

The time-source inventory is intentionally bounded:

- `FlowProvider` transition and provider cooldown use `requestAnimationFrame`
  callback timestamp deltas.
- The core machine uses the caller-supplied delta.
- Wheel, touch, and keyboard hook-local cooldown use a monotonic event-time
  source (`performance.now()` in the current implementation).
- Wheel burst inactivity uses the same monotonic elapsed-time basis.
- Touch gesture distance is position-based and does not use a clock.

The first rAF callback establishes a zero-delta baseline. A later large positive
delta may complete the remaining transition and then consume remaining provider
cooldown in the same update. A decreasing rAF timestamp contributes zero
elapsed time. Zero-duration transition plus positive cooldown remains supported.
`FlowProvider` owns one clock and stops it after the machine settles. Input can
resume after transition and provider cooldown are fully settled.

No guarantee is made about whether hidden-tab, background suspension, OS sleep,
or device sleep time must always count or never count.

## Locks, transitions, boundaries, and ignored input

Input hooks are conservative. An input event may be recognized by the browser
listener but still become rejected navigation.

Navigation does not happen when:

- the flow is locked;
- a transition is already active;
- provider cooldown is still active;
- hook-local cooldown is still active;
- wheel or touch movement does not pass the threshold;
- the event starts from an ignored, editable, or actionable wheel or touch
  region;
- keyboard input comes from a typing target while `ignoreWhenTyping` is enabled;
- a mapped Space or Enter key targets a native actionable control;
- the request would move before the first phase or after the last phase.

In every one of these rejected cases, the input hooks leave `preventDefault()`
uncalled. Rejected input does not queue a future transition. Once the relevant
lock, transition, boundary, or cooldown condition is gone, the user must provide
a new input event.

## Keep input separate from scene code

Prefer this split:

- DOM/input layer: `useWheelInput`, `useTouchInput`, `useKeyboardInput`, buttons,
  links, forms, and other page controls.
- R3F scene layer: Canvas-bound rendering and `useFlowFrame` animation reads.

This keeps browser input listeners out of scene components and avoids coupling
DOM event policy to objects rendered inside the Canvas.
