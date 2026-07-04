# Input integration baseline for v1.7.0

This document records the input integration behavior baseline confirmed for v1.7.0 after input hardening. It is documentation-only: it does not add runtime features, expand the public API, add dependencies, or introduce visual effects, animation timelines, camera presets, router integration, templates, or third-party animation wrappers.

The baseline applies to the existing `useWheelInput`, `useKeyboardInput`, and `useTouchInput` hooks rendered under `FlowProvider` in client React components. The hooks remain DOM input helpers for driving the existing `next` and `prev` flow controls; they are not Canvas scene logic and they do not replace app-owned input or animation systems.

## Scope

v1.7.0 input integration hardening confirms behavior for mounting the input hooks alone and together:

- wheel input through `useWheelInput`
- keyboard input through `useKeyboardInput`
- touch gesture input through `useTouchInput`
- shared lock, transition, and provider cooldown behavior across input types
- disabled, re-enabled, unmounted, and retargeted listener lifecycles
- ignored input handling without replaying stale gestures or events later

This baseline does not change the public API. It documents the existing hook options and behavior only.

## Input hooks

The three input hooks attach browser listeners from effects and use the shared flow state from `FlowProvider`.

- `useWheelInput` listens for `wheel` events. By default it reads `deltaY`, uses a threshold of `40`, treats positive movement beyond the threshold as `next`, and treats negative movement beyond the threshold as `prev`.
- `useKeyboardInput` listens for `keydown` events. By default it maps `ArrowDown`, `ArrowRight`, `PageDown`, and Space to `next`, and maps `ArrowUp`, `ArrowLeft`, and `PageUp` to `prev`.
- `useTouchInput` listens for `touchstart`, `touchmove`, `touchend`, and `touchcancel`. By default it reads vertical movement, uses a threshold of `50`, treats upward swipe movement beyond the threshold as `next`, and treats downward swipe movement beyond the threshold as `prev`.

All three hooks:

- default to `window` when no target is provided
- support existing custom targets through `target`
- support `enabled: false`
- skip listener attachment when disabled or when no browser target is available
- validate cooldown and threshold options only while enabled
- remove their own listeners on cleanup
- do not introduce new v1.7.0 hook options

## Cross-input lock and cooldown

Mounted input hooks share the same `FlowProvider` flow controls and core machine state. One input type must not bypass state created by another input type.

- A manual `lock()` blocks wheel, keyboard, and touch navigation until `unlock()` is called.
- A transition started by one input type blocks additional navigation from the other mounted input types while the transition is active.
- Provider-level cooldown from an accepted navigation blocks later wheel, keyboard, and touch navigation until the cooldown elapses.
- Ignored input during lock, active transition, or provider cooldown does not queue navigation for later replay.
- Hook-local cooldown still applies only to the hook instance that owns it; provider cooldown is the shared cross-input cooldown gate.

## Combined wheel and keyboard input

When `useWheelInput` and `useKeyboardInput` are mounted together:

- each hook attaches one listener for its own event type while enabled
- a wheel `next` navigation does not duplicate through a following keyboard `next` event during the same active transition
- a keyboard `next` navigation does not duplicate through a following wheel `next` event during the same active transition
- after the transition finishes and cooldown allows navigation, either input type can navigate again normally
- wheel and keyboard directions remain consistent: positive wheel movement and default next keys navigate forward; negative wheel movement and default previous keys navigate backward
- ignored wheel movement at or inside the threshold is not replayed by a later keyboard event
- ignored keyboard events, including ignored typing-target events, are not replayed by a later wheel event
- disabling one hook leaves the other hook active when it is still enabled

## Combined touch and wheel input

When `useTouchInput` and `useWheelInput` are mounted together:

- each hook attaches listeners for its own event types while enabled
- a wheel navigation does not duplicate through a following touch gesture during the same active transition
- a touch navigation does not duplicate through a following wheel event during the same active transition
- after the transition finishes and cooldown allows navigation, either input type can navigate again normally
- touch and wheel directions remain consistent: upward touch movement and positive wheel movement navigate forward; downward touch movement and negative wheel movement navigate backward
- ignored touch movement at or inside the threshold is not replayed by a later wheel event
- ignored wheel movement at or inside the threshold is not replayed by a later touch gesture
- disabling one hook leaves the other hook active when it is still enabled

## Threshold behavior

Wheel and touch thresholds are strict boundaries.

- Movement at the configured threshold is ignored.
- Movement inside the configured threshold is ignored.
- Movement beyond the configured threshold can request navigation when the flow is not locked, transitioning, cooling down, or at a blocked boundary.
- `threshold: 0` is valid for wheel and touch input.
- Negative, non-finite, or otherwise invalid threshold values throw only while the corresponding hook is enabled.

Keyboard input does not use a movement threshold. It navigates only for mapped keys, ignores repeated `keydown` events, and ignores typing targets by default.

## Disabled and re-enabled lifecycle

Disabled hooks are inert.

- `enabled: false` prevents listener attachment.
- Disabled hooks do not validate incomplete or invalid navigation options until re-enabled.
- Events dispatched while a hook is disabled are ignored and are not replayed after re-enable.
- Re-enabling a hook attaches the expected listener set once.
- Toggling enabled state does not leave duplicate listeners behind.
- Disabling one input hook does not disable another mounted input hook.

## Custom input targets

The existing `target` option supports `window`, an `HTMLElement`, or a ref to an `HTMLElement`.

- Hooks attach listeners to the resolved target.
- Empty or unresolved refs fall back to `window` where supported by the existing target resolution behavior.
- When a configured target changes, listeners are removed from the old target and attached to the new target.
- Events on the old target after retargeting do not navigate through stale listeners.
- Retargeting while disabled does not attach listeners until the hook is enabled again.
- Re-enabling after a target change attaches listeners to the current target, not to a stale target.

## Touch gesture cleanup

Touch input keeps temporary gesture state between `touchstart` and the completing event. v1.7.0 confirms cleanup for that state.

- `touchcancel` clears the stored gesture start position.
- Disabling `useTouchInput` clears active gesture state through effect cleanup.
- Unmounting `useTouchInput` clears active gesture state and removes all touch listeners.
- Changing the touch target clears active gesture state while moving listeners to the new target.
- A `touchend` that follows cancellation, disable, unmount, or target change does not complete a stale gesture or navigate accidentally.

## Out of scope

v1.7.0 input integration hardening does not introduce:

- new public APIs
- new input hook options beyond existing behavior
- router integration
- Next.js-specific integration
- visual effects
- animation timelines
- camera presets
- templates
- third-party animation wrappers
- new runtime dependencies

## Validation baseline

The v1.7.0 behavior is covered by focused input tests for:

- cross-input lock and cooldown behavior
- combined wheel and keyboard behavior
- combined touch and wheel behavior
- disabled and re-enabled hook lifecycle behavior
- listener cleanup on disable, unmount, and target change
- custom input target retargeting
- touch gesture cleanup on cancellation, disable, unmount, and target change

These tests describe the behavior baseline; this document should not be read as a promise of additional API surface beyond the current documented hooks and options.
