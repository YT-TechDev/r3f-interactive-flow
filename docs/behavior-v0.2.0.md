# v0.2.0 Current Behavior Audit and Intended Rules

## 1. Purpose

This document records the current observed behavior of `r3f-interactive-flow` before v0.2.0 implementation work and preserves the intended v0.2.0 behavior rules that guide that work.

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
- **Documented current behavior**: direct React provider tests cover initial snapshot provisioning and snapshot updates after navigation and lock controls.

### `useFlow` return shape

- **Documented current behavior**: `useFlow` returns the current `FlowControls` shape: `phase`, `phaseIndex`, `progress`, `direction`, `isTransitioning`, `isLocked`, `next`, `prev`, `goTo`, `lock`, and `unlock`.
- **Documented current behavior**: the controls call the underlying machine and then call `syncSnapshot()`.
- **Documented current behavior**: controls are memoized from the current snapshot, machine, and sync function.
- **Documented current behavior**: hook-level tests cover the returned `useFlow` control shape in a mounted React tree and snapshot updates after navigation and lock controls.

### `useFlowProgress` behavior

- **Documented current behavior**: `useFlowProgress` returns `context.controls.progress`.
- **Documented current behavior**: direct tests cover `useFlowProgress` returning the provider progress value.

### Hooks outside `FlowProvider`

- **Documented current behavior**: `useFlow` throws `useFlow must be used inside FlowProvider.` when context is missing.
- **Documented current behavior**: `useFlowProgress` throws `useFlowProgress must be used inside FlowProvider.` when context is missing.
- **Documented current behavior**: `useFlowFrame` throws `useFlowFrame must be used inside FlowProvider.` when context is missing.
- **Documented current behavior**: input hooks call `useFlow`, so they inherit the `useFlow` provider requirement.
- **Documented current behavior**: direct tests cover clear outside-provider errors for `useFlow`, `useFlowProgress`, and `useFlowFrame`. Input hooks inherit the `useFlow` provider requirement.

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
- **Documented current behavior**: direct `useFlowFrame` tests cover frame registration, millisecond machine updates, callback progress and delta arguments, latest-callback ref behavior, transition-completion React sync, and provider error behavior.
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
- **Documented current behavior**: direct wheel input tests cover listener setup and cleanup, default and custom targets, enabled behavior, threshold behavior, default and disabled `preventDefault`, lock and transition gates, and no browser API access at module import time.

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
- **Documented current behavior**: direct touch input tests cover listener setup and cleanup, default and custom targets, enabled behavior, default threshold behavior, swipe direction mapping, threshold no-ops, `touchcancel`, missing touch guards, default and disabled `preventDefault`, lock and transition gates, and no browser API access at module import time.

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
- **Documented current behavior**: direct keyboard input tests cover listener setup and cleanup, default and custom targets, enabled behavior, unmapped and repeated key filtering, editable-target filtering, default and custom key mapping, default and disabled `preventDefault`, lock and transition gates, and no browser API access at module import time.

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

Existing tests cover the core machine, easing helpers, package entry public API, React provider and hooks, the R3F frame bridge, and browser input hooks. Input hook tests share private test utilities for minimal DOM setup and provider rendering so the repeated listener, target, and cleanup scenarios stay maintainable without adding public API.

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

### Current test coverage

- **Documented current behavior**: React `FlowProvider` and hook tests cover initial render behavior, `useFlow` return shape, navigation and lock snapshot updates, `useFlowProgress`, and outside-provider errors for React hooks.
- **Documented current behavior**: `useFlowFrame` tests cover frame registration, machine update timing, callback arguments, latest-callback ref behavior, completion-only React sync, and outside-provider errors.
- **Documented current behavior**: wheel input tests cover listener setup and cleanup, target handling, threshold behavior, `preventDefault` behavior, enabled behavior, lock/transition gating, and browser guard behavior.
- **Documented current behavior**: touch input tests cover listener setup and cleanup, target handling, threshold behavior, swipe direction mapping, cancel behavior, missing touch guards, `preventDefault` behavior, enabled behavior, lock/transition gating, and browser guard behavior.
- **Documented current behavior**: keyboard input tests cover listener setup and cleanup, target handling, key mapping, repeat filtering, editable-target filtering, `preventDefault` behavior, enabled behavior, lock/transition gating, and browser guard behavior.

### Remaining test and release-readiness gaps

- **Missing test coverage**: Vite example behavior or build-only smoke coverage beyond release checks.
- **Needs documentation pass**: DOM `flow.progress` expectations versus frame-driven progress from `useFlowFrame` should remain explicit in docs and examples.
- **Needs release pass**: final v0.2.0 readiness should confirm the current test matrix, package contents, README guidance, and release checklist.

### Prioritized remaining work for v0.2.0

1. Keep core initialization, `next`, `prev`, `goTo`, invalid targets, boundaries, progress completion, lock behavior, and cooldown behavior covered as regression tests.
2. Keep React provider/hooks, `useFlowFrame`, and wheel/touch/keyboard input hook coverage in place as behavior changes are reviewed.
3. Run and record release checks, including package verification and the Vite example build where feasible.
4. Clarify DOM progress versus frame progress expectations in docs/examples without changing runtime behavior.
5. Preserve invalid `goTo` throw-first priority as an explicitly documented stable rule unless a separate design issue changes it.

## 9. Findings summary

### Behavior that appears stable

- Core phase initialization and validation are well covered.
- Public snapshot shape is small and consistent.
- `next`, `prev`, `goTo`, same-phase no-ops, invalid targets, and boundary no-ops have direct core coverage.
- Transition progress, completion, custom easing, and final progress clamping have direct core coverage.
- Lock and cooldown behavior are implemented in the core machine and have direct core coverage.
- React provider and hook behavior has direct mounted-tree coverage.
- `useFlowFrame` bridge behavior has direct frame-callback coverage.
- Wheel, touch, and keyboard input hooks have direct event-behavior coverage.
- Public package entry exports are tested.

### Behavior that needs clearer specification

- Whether invalid `goTo` should continue to throw before lock/transition/cooldown gates in every future scenario.
- Whether public `phase` should continue to switch to the destination at transition start.
- Whether consumers should expect DOM `flow.progress` to update only at navigation start/completion while R3F callbacks receive frame-driven progress.
- Whether remaining cooldown time should stay internal or become observable in some future design.
- Whether overlapping custom keyboard next/prev key lists should be specified or guarded.
- How touch multi-touch, swipe cancellation, nested scroll containers, and trackpad bursts should behave.

### Behavior that still needs release-readiness attention

- Example/build smoke coverage where feasible.
- Documentation clarity for DOM progress versus frame progress expectations.
- Final release checklist verification against the current coverage and package output.

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

- Preserve transition lifecycle rules for v0.2.0 as regression coverage evolves.
- Keep core transition, cooldown, and lock behavior covered by regression tests.
- Keep wheel, touch, and keyboard input reliability covered by direct hook tests.
- Keep React provider/hooks and `useFlowFrame` bridge behavior covered by direct tests.
- Improve README and example guidance for v0.2.0 where it clarifies existing behavior.
- Specify DOM progress versus frame progress expectations.
- Keep invalid `goTo` target priority documented as throw-first across all gates unless a separate design issue changes it.
- Complete a final v0.2.0 release-readiness pass, including package verification and example build checks.

## 11. Intended v0.2.0 behavior rules

The current behavior audit above is the baseline. The rules below describe intended v0.2.0 stabilization behavior and should guide later implementation PRs without changing runtime behavior in this documentation PR.

- Default behavior should remain predictable and conservative.
- Navigation during an active transition should be ignored by default unless a future explicit option changes that behavior.
- Boundary navigation should remain a no-op by default unless a future explicit loop option is added.
- Same-phase navigation should remain a no-op.
- Invalid phase targets should fail predictably and must never leave the machine in a partial transition state.
- Transition progress should remain normalized to `0..1`.
- Completion should update transition state exactly once per accepted transition.
- Cooldown behavior should remain specified before further changes, including timing, scope, and interaction with accepted or ignored navigation.
- No `lockDuringTransition` option should be added for v0.2.0. The current behavior should remain equivalent to ignoring navigation during active transitions unless a separate future design changes it.
- Browser input hooks should not access `window`, `document`, `HTMLElement`, or other browser APIs at module import time.
- R3F hooks must remain Canvas-bound and should continue to rely on React Three Fiber APIs only from Canvas components.
- DOM input logic must stay separate from R3F scene logic.
- Frame-driven visual updates should use refs or mutable state rather than React state updates every frame.
- The public API should remain narrow and should not grow as part of the v0.2.0 stabilization work unless separately designed.

### Cooldown semantics

This section defines the intended v0.2.0 cooldown behavior. It does not change cooldown configuration, exports, or runtime behavior in this documentation PR.

#### Conceptual ownership

- Cooldown should be an authoritative core-machine navigation gate. The core machine is the only layer that can consistently decide whether a navigation request is accepted, ignored by a lock, ignored by an active transition, ignored by cooldown, or rejected because the target is invalid.
- `FlowProvider` should pass cooldown configuration into the core machine and expose controls that delegate to the machine. It should not maintain a separate provider-level cooldown timer that can diverge from direct machine behavior.
- Browser input hooks should not own independent cooldown state. Wheel, touch, and keyboard hooks may keep their existing input-specific threshold and event filtering responsibilities, but once an input gesture maps to `next()` or `prev()`, it should use the same provider controls and core-machine gates as direct calls.

#### Scope and consistency

- Cooldown should apply consistently to accepted `next`, `prev`, and valid `goTo` navigation regardless of whether the call originates from app code, DOM controls, `FlowProvider` controls, or browser input hooks.
- Cooldown should not be input-only. A direct call and an input-driven call made at the same machine state should have the same accepted-or-ignored outcome.
- Same-phase `goTo`, first-phase `prev`, and last-phase `next` should remain no-ops and should not start or reset cooldown.
- Invalid `goTo` targets should continue to fail predictably and should not be converted into cooldown ignores.

#### Timing

- Cooldown should start immediately when a navigation request is accepted. An accepted request is one that passes validation, is not blocked by lock, is not blocked by an active transition, is not blocked by an existing cooldown, is not a same-phase no-op, and is not a boundary no-op.
- Transition completion should not start a second cooldown window or reset the cooldown window. If cooldown is longer than the transition duration, navigation should remain ignored after completion until cooldown expires. If the transition is longer than cooldown, the existing active-transition gate should continue to ignore navigation until completion.
- Locking or unlocking should not pause, restart, or clear cooldown. Cooldown time should be based on elapsed machine time from the accepted navigation.

#### Gating outcomes

- Navigation attempted during cooldown should be ignored. It should not mutate `phase`, `phaseIndex`, `progress`, `direction`, `isTransitioning`, or `isLocked`. It should not queue a pending request, restart the transition, retarget the transition, extend the cooldown, or throw for otherwise valid navigation.
- Valid navigation attempted while locked should be ignored before any cooldown decision starts a new transition. It should not start, reset, extend, or clear cooldown. Existing active transitions should continue to progress when `update()` is called, matching current lock behavior.
- Valid navigation attempted while a transition is active should be ignored by the active-transition gate. It should not queue, interrupt, restart, retarget, start a new cooldown, or reset an existing cooldown.
- When multiple gates could apply, the outcome should remain conservative and observable state should not change. For implementation and tests, invalid target validation should remain explicit, while valid navigation should only be accepted from an unlocked, idle, non-cooling-down machine.

#### Interaction with current transition behavior

- The existing default behavior is that navigation during active transitions is ignored. Cooldown should layer onto that behavior rather than replacing it.
- Because cooldown starts on accepted navigation, cooldown and transition time can overlap. The next navigation may be accepted only after both gates are open: the previous transition has completed and the cooldown window has expired.
- v0.2.0 should not add queued, interrupted, restarted, or retargeted transitions as part of cooldown work.

#### Cooldown non-goals for v0.2.0

- No input-only cooldown semantics.
- No separate wheel, touch, or keyboard cooldown timers.
- No transition queue, restart, interrupt, or retarget behavior.
- No loop behavior or boundary wrapping.
- No public source/target phase snapshot expansion solely for cooldown.
- No router integration, animation timelines, camera presets, shader APIs, particle APIs, or third-party animation/state/demo-framework integrations.

For detailed transition lifecycle decisions, see `docs/transition-lifecycle-v0.2.0.md`.

## 12. Open decisions for later releases

- Should an explicit loop option be added later, and if so should it live in the core machine, provider, or input layer?
- Should a future release expose transition-gating configuration, or should the current internal behavior remain fixed?
- If transition-gating behavior ever becomes configurable, should non-default behavior ignore, queue, restart, or retarget active transitions?
- Do transition snapshots need source and target phase information internally without expanding the public API?
- Should accepted navigation continue to update the public `phase` at transition start, or should public phase updates move to completion in a future major behavior change?
- Do input hooks need additional filtering for trackpad bursts, swipe cancellation, multi-touch gestures, focus handling, or nested scroll containers?
- Should invalid `goTo` continue throwing, or should a future strictness option allow ignored invalid targets?

## 13. Non-goals

v0.2.0 does not include:

- visual effects collection
- camera presets
- shader APIs
- particle APIs
- animation timeline
- GSAP wrapper
- Framer Motion wrapper
- Next.js-specific router integration
- visual editor
- large demo template
- new runtime dependencies

These items may be explored separately in future releases or examples, but they are outside the v0.2.0 foundation scope.

## References

This audit references issue #51 and should be treated as a documentation baseline before v0.2.0 behavior changes.
