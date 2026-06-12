# v0.2.0 Current Behavior Audit

## 1. Purpose

This document records the current observed behavior of `r3f-interactive-flow` before v0.2.0 implementation work. It is an audit document, not an implementation plan.

This PR is documentation-only. It does not change runtime behavior, add dependencies, expand the public API, add public exports, or implement cooldown, lock, transition, or input behavior changes.

The statuses used below are:

- **Documented current behavior**: behavior is observable in source and/or existing tests.
- **Unclear behavior**: behavior is not fully specified or may depend on environment/runtime details.
- **Missing test coverage**: behavior is observable in source but lacks direct test coverage.
- **Not currently implemented**: no current implementation was observed.

## 2. Current public API surface

The package entry file currently has a `"use client"` directive and exports the following runtime API:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`

The package entry file currently exports these option types:

- `UseWheelInputOptions`
- `UseTouchInputOptions`
- `UseKeyboardInputOptions`

The core machine, core types, easing helpers, provider prop types, and internal context types are not currently exported from the package entry file. This audit does not propose or add any new public exports.

## 3. Core flow behavior audit

The core machine behavior below is observed from `packages/r3f-interactive-flow/src/core/createFlowMachine.ts`, `packages/r3f-interactive-flow/src/core/types.ts`, `packages/r3f-interactive-flow/src/core/easing.ts`, and the existing core tests.

### Initialization

- **Documented current behavior**: `createFlowMachine` requires at least one phase. An empty `phases` array throws before a machine is created.
- **Documented current behavior**: duplicate phase values throw before a machine is created.
- **Documented current behavior**: when `initialPhase` is omitted, the first configured phase is used.
- **Documented current behavior**: when `initialPhase` is provided, it must be included in `phases`; otherwise creation throws.
- **Documented current behavior**: `transitionDurationMs` defaults to `1000` and must be finite and positive when provided.
- **Documented current behavior**: `cooldownMs` defaults to `0` and must be finite and greater than or equal to `0` when provided.
- **Documented current behavior**: `easing` defaults to linear easing.

### Phase ordering

- **Documented current behavior**: phase ordering is the order of the configured `phases` array.
- **Documented current behavior**: this configured order drives `phaseIndex`, `next`, `prev`, and `goTo` direction.

### Active phase

- **Documented current behavior**: the public `phase` getter and snapshot field return the current internal `phaseIndex` entry.
- **Documented current behavior**: accepted navigation updates `phase` to the destination immediately at transition start, not at transition completion.
- **Documented current behavior**: there are no public source-phase or target-phase snapshot fields.

### `phaseIndex`

- **Documented current behavior**: `phaseIndex` is initialized to the index of `initialPhase` or `0` when no `initialPhase` is provided.
- **Documented current behavior**: accepted navigation updates `phaseIndex` to the destination immediately at transition start.
- **Documented current behavior**: if the internal index ever points outside `phases`, reading the current phase throws an internal error. No public API currently exposes a way to intentionally create that state.

### Direction

- **Documented current behavior**: `direction` starts as `"none"`.
- **Documented current behavior**: accepted forward navigation sets `direction` to `"next"`.
- **Documented current behavior**: accepted backward navigation sets `direction` to `"prev"`.
- **Documented current behavior**: transition completion resets `direction` to `"none"`.
- **Documented current behavior**: ignored navigation does not change `direction`.

### Progress

- **Documented current behavior**: `progress` starts at `0`.
- **Documented current behavior**: accepted navigation resets `progress` to `0`.
- **Documented current behavior**: `update(deltaMs)` computes raw progress from elapsed transition time divided by `transitionDurationMs` and clamps it to `0..1`.
- **Documented current behavior**: negative deltas are treated as `0`, so they do not reduce progress or cooldown time.
- **Documented current behavior**: non-finite deltas throw.
- **Documented current behavior**: in-progress eased output is clamped to `0..1`.
- **Documented current behavior**: when raw progress reaches `1`, reported progress is exactly `1`.

### `isTransitioning`

- **Documented current behavior**: `isTransitioning` starts as `false`.
- **Documented current behavior**: accepted navigation sets `isTransitioning` to `true`.
- **Documented current behavior**: when raw transition progress reaches `1`, `isTransitioning` becomes `false`.
- **Documented current behavior**: ignored navigation does not change `isTransitioning`.

### `next`

- **Documented current behavior**: `next()` targets `phaseIndex + 1`.
- **Documented current behavior**: if the target is in bounds and navigation gates are open, it starts a transition to the next phase.
- **Documented current behavior**: if the target is out of bounds, it is ignored.
- **Documented current behavior**: if locked, transitioning, or cooling down, it is ignored.

### `prev`

- **Documented current behavior**: `prev()` targets `phaseIndex - 1`.
- **Documented current behavior**: if the target is in bounds and navigation gates are open, it starts a transition to the previous phase.
- **Documented current behavior**: if the target is out of bounds, it is ignored.
- **Documented current behavior**: if locked, transitioning, or cooling down, it is ignored.

### `goTo`

- **Documented current behavior**: `goTo(phase)` resolves the target by `phases.indexOf(phase)`.
- **Documented current behavior**: a known phase starts navigation when gates are open and the target is different from the current phase.
- **Documented current behavior**: direction is derived from whether the target index is greater than or less than the current index.
- **Documented current behavior**: an unknown phase throws `Unknown phase` before navigation gate checks.

### Same-phase navigation

- **Documented current behavior**: `goTo` with the current phase is a no-op.
- **Documented current behavior**: same-phase `goTo` does not reset progress, start a transition, change direction, or start cooldown.

### Invalid phase targets

- **Documented current behavior**: `goTo` with a phase not present in `phases` throws.
- **Documented current behavior**: existing tests cover invalid `goTo` while idle, while transitioning, and while cooldown is active.
- **Unclear behavior**: because invalid target validation happens before lock/transition/cooldown gates, invalid `goTo` throws even if a valid target would otherwise be ignored by a gate. This is observable in source, but the desired long-term priority order should remain explicitly specified for v0.2.0.

### First/last phase boundary behavior

- **Documented current behavior**: `prev()` from the first phase is a no-op.
- **Documented current behavior**: `next()` from the last phase is a no-op.
- **Documented current behavior**: boundary no-ops preserve the full current snapshot and do not start cooldown.

### Loop behavior

- **Not currently implemented**: no loop option or boundary wrapping behavior was observed.

### Transition start

- **Documented current behavior**: accepted navigation immediately updates `phase`, `phaseIndex`, `progress`, `direction`, `elapsedMs`, `cooldownRemainingMs`, and `isTransitioning`.
- **Documented current behavior**: cooldown starts on accepted navigation, not on transition completion.

### Transition progress updates

- **Documented current behavior**: `update(deltaMs)` advances cooldown time first, then transition progress.
- **Documented current behavior**: when not transitioning, `update(deltaMs)` can still reduce active cooldown time, then returns without changing transition state.
- **Documented current behavior**: while transitioning, elapsed transition time accumulates using non-negative delta time.

### Transition completion

- **Documented current behavior**: a transition completes when raw progress reaches `1`.
- **Documented current behavior**: completion sets elapsed transition time to `transitionDurationMs`, direction to `"none"`, and `isTransitioning` to `false`.
- **Documented current behavior**: completion does not change `phase` or `phaseIndex` again because those values already changed at transition start.
- **Documented current behavior**: extra updates after completion keep the completed snapshot stable, except for any non-public cooldown timer countdown.

### Easing behavior

- **Documented current behavior**: default easing is linear.
- **Documented current behavior**: custom easing can be supplied to `createFlowMachine` and `FlowProvider`.
- **Documented current behavior**: custom easing affects public `progress` during a transition.
- **Documented current behavior**: custom easing output is clamped to `0..1`.
- **Documented current behavior**: final completion forces public `progress` to `1` when raw progress reaches `1`, even if the custom easing output would be below `1`.

### Lock behavior

- **Documented current behavior**: `lock()` sets `isLocked` to `true`.
- **Documented current behavior**: valid `next`, `prev`, and `goTo` navigation is ignored while locked.
- **Documented current behavior**: locking during an active transition does not pause, cancel, or roll back the active transition.
- **Documented current behavior**: while locked, active transitions continue when `update()` is called.
- **Documented current behavior**: valid navigation ignored by lock does not start or reset cooldown.

### Unlock behavior

- **Documented current behavior**: `unlock()` sets `isLocked` to `false`.
- **Documented current behavior**: after unlocking, navigation can proceed if the machine is idle, the target is valid and different from the current phase, and cooldown has expired.
- **Documented current behavior**: unlocking does not clear cooldown directly.

### Cooldown behavior

- **Documented current behavior**: `cooldownMs` is implemented in the core machine and provider options.
- **Documented current behavior**: omitted `cooldownMs` behaves as `0`, preserving immediate navigation after a completed transition.
- **Documented current behavior**: positive cooldown starts when navigation is accepted.
- **Documented current behavior**: cooldown and transition time overlap.
- **Documented current behavior**: valid navigation is ignored while cooldown is active.
- **Documented current behavior**: navigation during cooldown does not queue, restart, retarget, or mutate public snapshot fields.
- **Documented current behavior**: same-phase and boundary no-ops do not start cooldown.
- **Documented current behavior**: locked or transitioning ignored navigation does not start or reset cooldown.
- **Documented current behavior**: negative update deltas do not reduce cooldown time.
- **Unclear behavior**: remaining cooldown time is not exposed in the public snapshot, so consumers cannot directly observe cooldown state except through ignored navigation.

### `lockDuringTransition` behavior

- **Not currently implemented**: no `lockDuringTransition` option was observed.
- **Documented current behavior**: navigation is always ignored while `isTransitioning` is `true`, which acts like a built-in transition gate.
- **Not currently implemented**: no queue, interrupt, restart, or retarget behavior was observed for navigation attempted during an active transition.

## 4. React provider and hook behavior audit

The React behavior below is observed from `FlowProvider`, `FlowContext`, `useFlow`, and `useFlowProgress`.

### `FlowProvider` props

- **Documented current behavior**: `FlowProvider` accepts `phases`, `initialPhase`, `transitionDurationMs`, `cooldownMs`, `easing`, and `children`.
- **Documented current behavior**: `FlowProvider` creates a core machine with `useMemo` from `phases`, `initialPhase`, `transitionDurationMs`, `cooldownMs`, and `easing`.
- **Documented current behavior**: if any of those dependencies change, a new core machine is created and the provider syncs React snapshot state from it.
- **Documented current behavior**: provider calls do not catch machine errors; for example, `goTo` can throw through the provider control.
- **Missing test coverage**: no direct React provider tests were observed.

### `useFlow` return shape

- **Documented current behavior**: `useFlow` returns the current `FlowControls` shape: `phase`, `phaseIndex`, `progress`, `direction`, `isTransitioning`, `isLocked`, `next`, `prev`, `goTo`, `lock`, and `unlock`.
- **Documented current behavior**: the controls call the underlying machine and then call `syncSnapshot()`.
- **Documented current behavior**: controls are memoized from the current snapshot, machine, and sync function.
- **Missing test coverage**: no hook-level tests were observed for the returned shape or memoization behavior.

### `useFlowProgress` behavior

- **Documented current behavior**: `useFlowProgress` returns `context.controls.progress`.
- **Missing test coverage**: no direct tests were observed for `useFlowProgress`.

### Hooks outside `FlowProvider`

- **Documented current behavior**: `useFlow` throws `useFlow must be used inside FlowProvider.` when context is missing.
- **Documented current behavior**: `useFlowProgress` throws `useFlowProgress must be used inside FlowProvider.` when context is missing.
- **Documented current behavior**: `useFlowFrame` throws `useFlowFrame must be used inside FlowProvider.` when context is missing.
- **Documented current behavior**: input hooks call `useFlow`, so they inherit the `useFlow` provider requirement.
- **Missing test coverage**: no direct tests were observed for outside-provider errors.

### React state updates

- **Documented current behavior**: `FlowProvider` stores the machine snapshot in React state.
- **Documented current behavior**: imperative controls sync React state immediately after calling machine methods.
- **Documented current behavior**: `useFlowFrame` syncs React state only when a frame changes the machine from transitioning to not transitioning.
- **Unclear behavior**: while a transition is active, React UI reading `flow.progress` does not appear to be synced every frame by `useFlowFrame`; frame callbacks receive current machine progress directly instead. This appears intentional for avoiding frame-by-frame React state updates, but it should be clearly specified for v0.2.0.

### Frame-driven values and React state boundaries

- **Documented current behavior**: R3F frame callbacks receive current progress each frame without requiring React state updates on every frame.
- **Unclear behavior**: DOM UI examples display `progress` from React state, which may update on navigation start and transition completion but not every frame. The expected DOM progress display semantics should be specified for v0.2.0.

## 5. R3F bridge behavior audit

The R3F bridge behavior below is observed from `useFlowFrame` and the Vite example.

### `useFlowFrame`

- **Documented current behavior**: `useFlowFrame(callback)` accepts a callback shaped as `(progress: number, delta: number) => void`.
- **Documented current behavior**: the hook stores the latest callback in a ref and refreshes it in an effect.
- **Documented current behavior**: each R3F frame captures a before snapshot, calls `machine.update(delta * 1000)`, captures an after snapshot, and calls the latest callback with `after.progress` and the original R3F `delta` in seconds.

### React Three Fiber `useFrame`

- **Documented current behavior**: `useFlowFrame` imports and calls React Three Fiber's `useFrame`.
- **Documented current behavior**: because it uses `useFrame`, it is expected to be called from a Canvas-bound component.

### Canvas-bound usage

- **Documented current behavior**: the README and Vite example show `useFlowFrame` inside a component rendered within `<Canvas>`.
- **Unclear behavior**: runtime behavior outside a Canvas is governed by React Three Fiber's `useFrame` behavior, not by a local guard beyond the `FlowProvider` context check.

### Callback progress passing

- **Documented current behavior**: callbacks receive the post-update progress value for the current frame.
- **Documented current behavior**: callbacks receive `delta` in seconds, matching React Three Fiber's frame delta.
- **Documented current behavior**: callback return values are ignored.

### Observed limitations

- **Documented current behavior**: React snapshot state is synced on transition completion, not every frame.
- **Missing test coverage**: no direct tests were observed for `useFlowFrame` update behavior, callback shape, completion sync, or provider error behavior.
- **Unclear behavior**: consumers needing per-frame source/target phase details cannot read them because the public snapshot only exposes the destination phase during a transition.

## 6. Input hook behavior audit

The input hook behavior below is observed from `useWheelInput`, `useTouchInput`, and `useKeyboardInput`.

### `useWheelInput`

- **Documented current behavior**: enabled by default; passing `enabled: false` skips listener setup.
- **Documented current behavior**: browser APIs are accessed inside effects and guarded by `typeof window === "undefined"`.
- **Documented current behavior**: the listener target is `options.target?.current` when present, otherwise `window`.
- **Documented current behavior**: a `wheel` listener is added with `{ passive: false }` and removed during cleanup.
- **Documented current behavior**: `preventDefault` defaults to `true`; when true, wheel events call `preventDefault()` before flow gating.
- **Documented current behavior**: `threshold` defaults to `40`.
- **Documented current behavior**: `deltaY > threshold` maps to `next()` and `deltaY < -threshold` maps to `prev()`.
- **Documented current behavior**: deltas at or within the threshold do nothing.
- **Documented current behavior**: wheel input checks `isLocked` and `isTransitioning` before calling navigation.
- **Documented current behavior**: cooldown is not checked directly in the hook; cooldown gating happens in the core machine after the hook calls `next()` or `prev()`.
- **Unclear behavior**: there is no input-specific debouncing or trackpad-burst filtering beyond transition and cooldown gates.
- **Missing test coverage**: no direct wheel input tests were observed.

### `useTouchInput`

- **Documented current behavior**: enabled by default; passing `enabled: false` skips listener setup.
- **Documented current behavior**: browser APIs are accessed inside effects and guarded by `typeof window === "undefined"`.
- **Documented current behavior**: the listener target is `options.target?.current` when present, otherwise `window`.
- **Documented current behavior**: `touchstart`, `touchmove`, `touchend`, and `touchcancel` listeners are added and removed during cleanup.
- **Documented current behavior**: `touchstart`, `touchend`, and `touchcancel` are registered passive; `touchmove` is registered with `{ passive: false }`.
- **Documented current behavior**: `preventDefault` defaults to `true`; when true, `touchmove` calls `preventDefault()`.
- **Documented current behavior**: `threshold` defaults to `50`.
- **Documented current behavior**: the hook stores the first `touchstart` Y coordinate and compares it with the first `changedTouches` Y coordinate on `touchend`.
- **Documented current behavior**: upward swipes with `startY - endY > threshold` map to `next()`.
- **Documented current behavior**: downward swipes with `startY - endY < -threshold` map to `prev()`.
- **Documented current behavior**: gestures at or within the threshold do nothing.
- **Documented current behavior**: `touchcancel` resets the stored touch start.
- **Documented current behavior**: touch input checks `isLocked` and `isTransitioning` before calling navigation.
- **Documented current behavior**: cooldown is not checked directly in the hook; cooldown gating happens in the core machine after the hook calls `next()` or `prev()`.
- **Unclear behavior**: multi-touch behavior is not explicitly specified; the hook uses the first available touch in the relevant event arrays.
- **Unclear behavior**: swipe cancellation and nested scroll-container behavior are not explicitly specified.
- **Missing test coverage**: no direct touch input tests were observed.

### `useKeyboardInput`

- **Documented current behavior**: enabled by default; passing `enabled: false` skips listener setup.
- **Documented current behavior**: browser APIs are accessed inside effects and guarded by `typeof window === "undefined"`.
- **Documented current behavior**: the listener target is `options.target?.current` when present, otherwise `window`.
- **Documented current behavior**: a `keydown` listener is added and removed during cleanup.
- **Documented current behavior**: `preventDefault` defaults to `true`; it is called only for recognized next/prev keys after repeat and editable-target filtering.
- **Documented current behavior**: default next keys are `ArrowDown`, `ArrowRight`, `PageDown`, and Space (`" "`).
- **Documented current behavior**: default previous keys are `ArrowUp`, `ArrowLeft`, and `PageUp`.
- **Documented current behavior**: custom `nextKeys` and `prevKeys` arrays can replace the defaults.
- **Documented current behavior**: repeated keydown events (`event.repeat`) are ignored.
- **Documented current behavior**: keyboard events from `input`, `textarea`, `select`, and content-editable elements are ignored when `HTMLElement` checks are available.
- **Documented current behavior**: keyboard input checks `isLocked` and `isTransitioning` before calling navigation.
- **Documented current behavior**: cooldown is not checked directly in the hook; cooldown gating happens in the core machine after the hook calls `next()` or `prev()`.
- **Unclear behavior**: if a key appears in both `nextKeys` and `prevKeys`, `next()` wins because the hook checks next before previous.
- **Missing test coverage**: no direct keyboard input tests were observed.

## 7. Example behavior audit

The Vite example behavior below is observed from `examples/vite-basic/src/App.tsx`.

### `FlowProvider` usage

- **Documented current behavior**: the example defines `const phases = ["intro", "work", "contact"] as const` and derives a `Phase` union from the tuple.
- **Documented current behavior**: `App` wraps the input layer, DOM panel, and Canvas area in `<FlowProvider phases={phases}>`.
- **Documented current behavior**: the example uses default transition duration, default cooldown, and default easing.

### DOM UI connection to flow state

- **Documented current behavior**: `FlowControlsPanel` uses `useFlow<Phase>()`.
- **Documented current behavior**: the panel displays `phase`, `phaseIndex`, `progress`, `direction`, and `isTransitioning`.
- **Documented current behavior**: DOM buttons call `prev`, `next`, and `goTo` for each known phase.
- **Unclear behavior**: the DOM `progress` display may not animate every frame because frame-driven progress is not synced to React state every frame.

### R3F scene use of `useFlowFrame`

- **Documented current behavior**: `FlowBox` is rendered inside `<Canvas>` and calls `useFlowFrame`.
- **Documented current behavior**: the frame callback rotates and scales the mesh from the supplied progress.
- **Documented current behavior**: the example keeps per-frame mesh updates inside the Canvas-bound scene component rather than routing them through React DOM state.

### Architecture boundaries

- **Documented current behavior**: DOM state/control usage stays in React components under the provider.
- **Documented current behavior**: R3F frame updates stay in Canvas-bound scene code.
- **Documented current behavior**: input hooks are isolated in a `FlowInputs` component under the provider.

### Documentation/example gaps

- **Missing test coverage**: no example tests were observed.
- **Unclear behavior**: the example does not demonstrate `cooldownMs`, `lock`, `unlock`, disabled inputs, custom targets, or custom thresholds.
- **Unclear behavior**: the example does not explain that DOM progress and R3F frame progress may update at different frequencies.
- **Unclear behavior**: the example does not show recommended handling for locked UI controls or boundary-disabled buttons.

## 8. Existing tests audit

Existing tests are concentrated in core behavior, easing helpers, and the package entry public API.

### Behavior already tested

- **Documented current behavior**: initial snapshot from first phase.
- **Documented current behavior**: `initialPhase` selection.
- **Documented current behavior**: empty phases, duplicate phases, and invalid initial phase errors.
- **Documented current behavior**: `next()` transition start and completion.
- **Documented current behavior**: negative update deltas do not reduce progress.
- **Documented current behavior**: oversized update deltas clamp and complete.
- **Documented current behavior**: `prev()` navigation.
- **Documented current behavior**: `goTo()` navigation.
- **Documented current behavior**: same-phase `goTo()` no-op.
- **Documented current behavior**: invalid `goTo()` throws and does not mutate idle, active-transition, or cooldown snapshots.
- **Documented current behavior**: first/last boundary no-ops preserve state.
- **Documented current behavior**: lock/unlock state updates.
- **Documented current behavior**: navigation while locked is ignored.
- **Documented current behavior**: active transitions continue after `lock()`.
- **Documented current behavior**: navigation while transitioning is ignored.
- **Documented current behavior**: default cooldown behavior, zero cooldown behavior, positive cooldown gating, cooldown start timing, and cooldown interaction with lock/transition gates.
- **Documented current behavior**: invalid `cooldownMs`, invalid `transitionDurationMs`, and invalid `deltaMs` errors.
- **Documented current behavior**: completed transitions stay stable after extra updates.
- **Documented current behavior**: custom easing and easing clamp behavior.
- **Documented current behavior**: `clamp01` and `linear` helpers.
- **Documented current behavior**: public runtime exports and exported input hook option types.

### Missing tests

- **Missing test coverage**: React `FlowProvider` render behavior and prop reinitialization.
- **Missing test coverage**: `useFlow` return shape in a mounted React tree.
- **Missing test coverage**: `useFlowProgress` behavior.
- **Missing test coverage**: outside-provider errors for React, R3F, and input hooks.
- **Missing test coverage**: `useFlowFrame` frame update behavior, callback arguments, latest-callback ref behavior, and completion-only React sync behavior.
- **Missing test coverage**: wheel input listener setup/cleanup, target handling, threshold behavior, preventDefault behavior, enabled behavior, lock/transition/cooldown interaction, and browser guard behavior.
- **Missing test coverage**: touch input listener setup/cleanup, target handling, threshold behavior, preventDefault behavior, cancel behavior, lock/transition/cooldown interaction, and browser guard behavior.
- **Missing test coverage**: keyboard input listener setup/cleanup, target handling, key mapping, repeat filtering, editable-target filtering, preventDefault behavior, lock/transition/cooldown interaction, and browser guard behavior.
- **Missing test coverage**: Vite example behavior or build-only smoke coverage beyond release checks.

### Prioritized missing tests for v0.2.0

1. Core initialization, `next`, `prev`, and `goTo` should remain covered as regression tests.
2. Invalid targets should remain covered, including the interaction with lock/transition/cooldown gates.
3. Boundary behavior should remain covered, including first-phase `prev` and last-phase `next` no-ops.
4. Transition progress completion should remain covered, including eased progress, oversized deltas, negative deltas, and final `progress: 1`.
5. Lock behavior should remain covered, including lock during active transitions and unlock after completion.
6. Cooldown behavior should remain covered, including default `0`, positive cooldown, cooldown start timing, and ignored navigation not resetting cooldown.
7. Input gating should be added for wheel, touch, and keyboard hooks, especially repeated wheel/keyboard input, touch thresholds, preventDefault timing, and lock/transition/cooldown interaction.
8. React/R3F integration tests should be added for provider sync behavior and `useFlowFrame` completion sync.

## 9. Findings summary

### Behavior that appears stable

- Core phase initialization and validation are well covered.
- Public snapshot shape is small and consistent.
- `next`, `prev`, `goTo`, same-phase no-ops, invalid targets, and boundary no-ops have direct core coverage.
- Transition progress, completion, custom easing, and final progress clamping have direct core coverage.
- Lock and cooldown behavior are implemented in the core machine and have direct core coverage.
- Public package entry exports are tested.

### Behavior that needs clearer specification

- Whether invalid `goTo` should continue to throw before lock/transition/cooldown gates in every future scenario.
- Whether public `phase` should continue to switch to the destination at transition start.
- Whether consumers should expect DOM `flow.progress` to update only at navigation start/completion while R3F callbacks receive frame-driven progress.
- Whether remaining cooldown time should stay internal or become observable in some future design.
- Whether overlapping custom keyboard next/prev key lists should be specified or guarded.
- How touch multi-touch, swipe cancellation, nested scroll containers, and trackpad bursts should behave.

### Behavior that needs tests

- React provider and hook behavior.
- R3F bridge behavior.
- Wheel, touch, and keyboard input behavior.
- Example/build smoke coverage where feasible.

### Behavior that should not change without a separate design issue

- Public API surface and package entry exports.
- Public snapshot shape.
- Destination phase becoming public at transition start.
- Invalid `goTo` throwing behavior.
- Boundary no-op behavior and lack of loop behavior.
- Built-in transition gate that ignores navigation while transitioning.
- Core ownership of lock and cooldown gates.
- Input hooks remaining thin adapters from browser events to flow controls.

## 10. Recommended follow-up issues

- Define transition lifecycle rules for v0.2.0.
- Add core transition behavior tests.
- Stabilize cooldown and lock behavior.
- Improve wheel, touch, and keyboard input reliability.
- Add React provider and hook tests.
- Add R3F bridge tests for `useFlowFrame`.
- Improve README and example guidance for v0.2.0.
- Specify DOM progress versus frame progress expectations.
- Decide whether invalid `goTo` target priority should remain throw-first across all gates.

## References

This audit references issue #51 and should be treated as a documentation baseline before v0.2.0 behavior changes.
