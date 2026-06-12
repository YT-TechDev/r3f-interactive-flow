# v0.2.0 Behavior Specification

This document records the current behavior of `r3f-interactive-flow` before v0.2.0 implementation work begins and captures the intended v0.2.0 behavior rules.

It is a documentation-only audit. It does not add APIs, source code, exports, dependencies, or runtime behavior.

## 1. Current behavior audit

### Core machine setup

- `createFlowMachine` requires at least one phase. Passing an empty `phases` array throws an error before a machine is created.
- Phase names must be unique. Duplicate phase values throw an error before a machine is created.
- When `initialPhase` is omitted, the first configured phase is used.
- When `initialPhase` is provided, it must exist in `phases`. An unknown `initialPhase` throws an error before a machine is created.
- Phase order is the configured array order and is used for `phaseIndex`, `next`, `prev`, and `goTo` direction.
- `transitionDurationMs` defaults to `1000`.
- `transitionDurationMs` must be a finite positive number when provided.
- `easing` defaults to linear easing.

### Snapshot shape

`getSnapshot()` returns the current public machine state:

```ts
type FlowSnapshot<TPhase extends string> = {
  phase: TPhase;
  phaseIndex: number;
  progress: number;
  direction: "next" | "prev" | "none";
  isTransitioning: boolean;
  isLocked: boolean;
};
```

The same fields are exposed as getters on the machine and are included in React `FlowControls` from `FlowProvider`.

### Navigation: `next`, `prev`, and `goTo`

- `next()` targets the following configured phase.
- `prev()` targets the previous configured phase.
- `goTo(phase)` targets a specific configured phase.
- Accepted navigation immediately updates `phase` and `phaseIndex` to the target phase, sets `progress` to `0`, resets elapsed transition time, sets `direction` to `"next"` or `"prev"`, and sets `isTransitioning` to `true`.
- The current implementation does not keep public source and target phase fields. During a transition, the public `phase` is already the destination phase.
- A same-phase `goTo` is a no-op. It does not reset progress or start a transition.
- `goTo` with an unknown phase throws `Unknown phase` before calling the internal navigation helper. It should not mutate the machine first.

### Boundary behavior

- `prev()` from the first phase is a no-op.
- `next()` from the last phase is a no-op.
- Boundary no-ops preserve the current phase and idle transition state.
- There is no current loop option.

### Transition progress behavior

- `update(deltaMs)` throws when `deltaMs` is not finite.
- `update(deltaMs)` returns without changes when the machine is not transitioning.
- Negative `deltaMs` values are clamped to `0` for elapsed-time accumulation, so they do not reduce progress.
- Progress is calculated from elapsed time divided by `transitionDurationMs` and clamped to the `0..1` range.
- The easing function receives the clamped raw progress.
- Eased progress is clamped to `0..1` for in-progress updates.
- When raw progress reaches `1`, public `progress` is set to exactly `1`.
- Oversized deltas complete the transition without overshooting progress.

### Transition completion behavior

- A transition completes when raw progress reaches `1`.
- On completion, elapsed time is set to `transitionDurationMs`, `direction` becomes `"none"`, and `isTransitioning` becomes `false`.
- Because accepted navigation updates `phase` and `phaseIndex` at transition start, completion does not change the public phase again.

### Easing behavior

- Default easing is linear.
- A custom easing function can be supplied to `createFlowMachine` and `FlowProvider`.
- The custom easing function affects reported progress during the transition.
- Final completion still reports `progress: 1` when raw progress reaches the end of the duration.

### Lock and unlock

- `lock()` sets `isLocked` to `true`.
- `unlock()` sets `isLocked` to `false`.
- Lock state is included in snapshots.
- Calling `lock()` during an active transition does not pause or cancel the transition.
- A locked machine continues to update an already-active transition when `update()` is called.

### Navigation while locked

- `next`, `prev`, and valid `goTo` navigation are ignored while `isLocked` is `true`.
- Locked navigation does not mutate phase, progress, direction, or transition state.
- After a transition completes while locked, further navigation remains ignored until `unlock()` is called.

### Navigation while transitioning

- New navigation requests are ignored while `isTransitioning` is `true`.
- There is no queue, restart, interrupt, or retarget behavior.
- There is no explicit `lockDuringTransition` option today; ignoring navigation during transitions is the current built-in behavior.

### `FlowProvider` behavior

- `FlowProvider` creates a core machine with `useMemo` from `phases`, `initialPhase`, `transitionDurationMs`, and `easing`.
- It stores a React snapshot state initialized from `machine.getSnapshot()`.
- Provider controls call the matching machine method and then sync the React snapshot.
- `goTo` errors from the machine are not caught by the provider.
- The provider exposes `controls`, the underlying `machine`, and `syncSnapshot` through internal context.

### `useFlowFrame` update behavior

- `useFlowFrame` must be used inside `FlowProvider`; otherwise it throws.
- It calls React Three Fiber's `useFrame`, so it must be used from a Canvas-bound component.
- Each frame, it snapshots the machine, calls `machine.update(delta * 1000)`, snapshots again, and invokes the latest callback with `(after.progress, delta)`.
- It only calls `syncSnapshot()` when the frame changed the machine from transitioning to not transitioning.
- It does not sync React state on every frame while a transition is active.

### Wheel input behavior

- `useWheelInput` must be used inside `FlowProvider` because it calls `useFlow`.
- It attaches a `wheel` listener after mount unless `enabled` is `false` or `window` is unavailable.
- The default target is `window`; an element ref target can be provided.
- The default threshold is `40`.
- `preventDefault` defaults to `true` and the listener is registered with `{ passive: false }`.
- Positive `deltaY` greater than the threshold calls `next()`.
- Negative `deltaY` less than the negative threshold calls `prev()`.
- Input is ignored when the current flow is locked or transitioning.
- There is no current cooldown or trackpad-burst filtering beyond the threshold and transition/lock gates.
- The listener is removed in the effect cleanup.

### Touch input behavior

- `useTouchInput` must be used inside `FlowProvider` because it calls `useFlow`.
- It attaches touch listeners after mount unless `enabled` is `false` or `window` is unavailable.
- The default target is `window`; an element ref target can be provided.
- The default threshold is `50`.
- `preventDefault` defaults to `true` for `touchmove` and the `touchmove` listener is registered with `{ passive: false }`.
- `touchstart` stores the first touch's `clientY`.
- `touchmove` only handles default prevention.
- `touchend` compares the stored start Y with the first changed touch's `clientY`.
- Swipe up beyond the threshold calls `next()`.
- Swipe down beyond the threshold calls `prev()`.
- Input is ignored when the current flow is locked or transitioning.
- `touchcancel` resets the stored touch start value.
- There is no current velocity, multi-touch, swipe-cancellation, or cooldown logic beyond the threshold, cancellation reset, and transition/lock gates.
- All attached listeners are removed in the effect cleanup.

### Keyboard input behavior

- `useKeyboardInput` must be used inside `FlowProvider` because it calls `useFlow`.
- It attaches a `keydown` listener after mount unless `enabled` is `false` or `window` is unavailable.
- The default target is `window`; an element ref target can be provided.
- Default next keys are `ArrowDown`, `ArrowRight`, `PageDown`, and Space.
- Default previous keys are `ArrowUp`, `ArrowLeft`, and `PageUp`.
- Custom `nextKeys` and `prevKeys` arrays can be provided.
- Repeated keydown events are ignored.
- Events from `input`, `textarea`, `select`, or content-editable elements are ignored when `HTMLElement` is available.
- Unmapped keys are ignored.
- `preventDefault` defaults to `true` for mapped keys.
- Input is ignored when the current flow is locked or transitioning.
- There is no current cooldown or additional focus-management option beyond editable-target filtering.
- The listener is removed in the effect cleanup.

### Browser API access timing

- Input hooks are client modules, but they guard browser listener setup inside `useEffect` with `typeof window === "undefined"`.
- `useKeyboardInput` references `HTMLElement` only inside a helper that checks `typeof HTMLElement === "undefined"` first.
- The current browser input hooks should not require `window`, `document`, `HTMLElement`, `WheelEvent`, `TouchEvent`, or `KeyboardEvent` to exist at module import time.

### Event listener cleanup expectations

- Wheel, touch, and keyboard hooks all return cleanup functions from their listener effects.
- Cleanup removes listeners from the same event target captured when the effect ran.
- Effects re-run when relevant options change, so the previous listeners should be removed before new listeners are attached.

## 2. Intended v0.2.0 behavior rules

- Default behavior should remain predictable and conservative.
- Navigation during an active transition should be ignored by default unless a future explicit option changes that behavior.
- Boundary navigation should remain a no-op by default unless a future explicit loop option is added.
- Same-phase navigation should remain a no-op.
- Invalid phase targets should fail predictably and must never leave the machine in a partial transition state.
- Transition progress should remain normalized to `0..1`.
- Completion should update transition state exactly once per accepted transition.
- Cooldown behavior is defined below before implementation, including timing, scope, and interaction with accepted or ignored navigation.
- `lockDuringTransition` behavior should be specified before implementation. The default should remain equivalent to ignoring navigation during active transitions unless a deliberate option changes it.
- Browser input hooks should not access `window`, `document`, `HTMLElement`, or other browser APIs at module import time.
- R3F hooks must remain Canvas-bound and should continue to rely on React Three Fiber APIs only from Canvas components.
- DOM input logic must stay separate from R3F scene logic.
- Frame-driven visual updates should use refs or mutable state rather than React state updates every frame.
- The public API should remain narrow and should not grow as part of the v0.2.0 stabilization work unless separately designed.

### Cooldown semantics

This section defines the intended v0.2.0 cooldown behavior only. It does not implement `cooldownMs`, add configuration options, change exports, or change runtime behavior.

#### Conceptual ownership

- Cooldown should be an authoritative core-machine navigation gate if a cooldown option is added. The core machine is the only layer that can consistently decide whether a navigation request is accepted, ignored by a lock, ignored by an active transition, ignored by cooldown, or rejected because the target is invalid.
- `FlowProvider` should only pass future cooldown configuration into the core machine and expose the existing controls that delegate to the machine. It should not maintain a separate provider-level cooldown timer that can diverge from direct machine behavior.
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

## 3. Open decisions for later PRs

- Should an explicit loop option be added later, and if so should it live in the core machine, provider, or input layer?
- Should `lockDuringTransition` be exposed as an option or remain the default internal behavior?
- If `lockDuringTransition` becomes configurable, should non-default behavior ignore, queue, restart, or retarget active transitions?
- Do transition snapshots need source and target phase information internally without expanding the public API?
- Should accepted navigation continue to update the public `phase` at transition start, or should public phase updates move to completion in a future major behavior change?
- Do input hooks need additional filtering for trackpad bursts, swipe cancellation, multi-touch gestures, focus handling, or nested scroll containers?
- Should invalid `goTo` continue throwing, or should a future strictness option allow ignored invalid targets?

## 4. Non-goals

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
