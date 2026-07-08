# Input handling

`r3f-interactive-flow` includes three optional browser input hooks:

- `useWheelInput` maps wheel movement to `next` and `prev`.
- `useTouchInput` maps swipe movement to `next` and `prev`.
- `useKeyboardInput` maps configured keys to `next` and `prev`.

These hooks are small browser input helpers. They are not a full gesture
framework, router, animation system, or replacement for your app's own input
model. Use them when a page should let common browser input move through the
same flow phases that your buttons or other controls already use.

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

`useWheelInput` reads the wheel delta on the `y` axis by default:

- A positive delta greater than `threshold` calls `next`.
- A negative delta less than `-threshold` calls `prev`.
- A delta at or within the threshold does nothing.

Useful options:

- `threshold`: minimum wheel delta required before the hook requests navigation.
  The default is `40`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `ignore`: selectors for regions where wheel input should not drive flow
  navigation.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true` for handled, non-ignored wheel events.
- `axis`: use `"x"` instead of the default `"y"` for horizontal wheel input.

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

Useful options:

- `threshold`: minimum swipe distance required before the hook requests
  navigation. The default is `50`.
- `cooldown`: hook-local time in milliseconds after an accepted input-driven
  navigation. The default is `0`.
- `ignore`: selectors for regions where touch gestures should not drive flow
  navigation.
- `enabled`: set to `false` to skip listener setup.
- `preventDefault`: defaults to `true` for non-ignored touch move events.
- `axis`: use `"x"` instead of the default `"y"` for horizontal swipe input.

## Ignore selectors for interactive regions

Wheel and touch input support `ignore` selectors. Use them for DOM regions where
native interaction should win: buttons, links, forms, scrollable panels, drawers,
menus, and other controls.

```tsx
import { useTouchInput, useWheelInput } from "r3f-interactive-flow";

const inputIgnore = ["button", "a", "input", "textarea", "select", "[data-flow-ignore]"] as const;

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

Ignored wheel and touch events return before navigation. Use ignore selectors as
a boundary between page-level flow input and local UI controls.

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
- `preventDefault`: defaults to `true` for recognized next/previous keys.
- `ignoreWhenTyping`: defaults to `true`, so keyboard events from inputs,
  textareas, selects, and contenteditable elements are ignored.

Keyboard input ignores repeated `keydown` events from a held key. If focused
buttons should keep their native Space behavior, omit Space from `keys.next` as
shown above.

## Thresholds and cooldowns

Thresholds filter noisy input before navigation is requested:

- Wheel threshold is based on wheel delta.
- Touch threshold is based on swipe distance.
- Keyboard input has no threshold; it uses key matching instead.

Cooldowns reduce accidental repeated navigation:

- `transition.cooldown` on `FlowProvider` is part of the shared flow navigation
  rules.
- `cooldown` on an input hook is local to that hook and starts only after that
  hook's accepted navigation request.

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
- the event starts from an ignored wheel or touch region;
- keyboard input comes from a typing target while `ignoreWhenTyping` is enabled;
- the request would move before the first phase or after the last phase.

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
