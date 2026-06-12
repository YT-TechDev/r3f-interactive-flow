# v0.2.0 Transition Lifecycle Rules

## 1. Purpose

This document defines the intended transition lifecycle rules for v0.2.0. It is based on the current behavior audit in `docs/behavior-v0.2.0.md` and turns those audit findings into explicit lifecycle decisions for issue #53.

This document is documentation-only. It does not change runtime behavior, add dependencies, expand the public API, add public exports, or implement transition, cooldown, lock, loop, queue, restart, interrupt, or retarget behavior.

## 2. Lifecycle summary

The v0.2.0 lifecycle is conceptual and should not be treated as a new public state machine API. Public state should remain limited to the existing flow snapshot and controls unless a separate design explicitly changes that scope.

At a high level, navigation and transition behavior follows these outcomes:

- **Idle**: no active transition is running and navigation may be accepted only if all gates allow it.
- **Accepted navigation**: a valid navigation request passes boundary, same-phase, lock, transition, and cooldown gates.
- **Transition start**: accepted navigation immediately publishes the destination phase and starts transition progress at `0`.
- **Transition progress**: frame or machine updates advance normalized progress toward completion.
- **Transition completion**: raw progress reaches `1`, final progress is reported as `1`, and transition flags reset.
- **Ignored navigation**: otherwise valid navigation is ignored because it is blocked by boundary, same-phase, lock, active transition, or cooldown behavior.
- **Rejected invalid navigation**: invalid `goTo` targets throw predictably and do not mutate machine state.

## 3. Idle state

The flow is idle when:

- `isTransitioning` is `false`.
- `direction` is `"none"`.
- `phase` is the current public phase.
- `progress` is either `0` before any transition or `1` after a completed transition.

Navigation may be accepted only when the machine is not locked, is not cooling down, and the target is valid and different from the current phase.

## 4. Accepted navigation

Accepted navigation applies to `next`, `prev`, and valid different-phase `goTo` requests. For v0.2.0, the conservative current behavior should be preserved:

- Accepted navigation immediately updates public `phase` to the destination phase.
- Accepted navigation immediately updates `phaseIndex` to the destination index.
- Accepted navigation sets `progress` to `0`.
- Accepted navigation sets `direction` to `"next"` or `"prev"`.
- Accepted navigation sets `isTransitioning` to `true`.
- Accepted navigation starts cooldown if `cooldownMs` is positive.
- Accepted navigation does not expose public source or target phase fields.

## 5. Transition progress

Transition progress follows these rules:

- Progress is normalized to `0..1`.
- Progress begins at `0` for each accepted transition.
- Progress advances through `update(deltaMs)` and through `useFlowFrame` when used from a Canvas-bound R3F component.
- Non-finite deltas should fail predictably.
- Negative deltas should not reverse progress.
- Easing affects reported progress during transition.
- Progress must not overshoot `1`.
- Final completion reports `progress: 1`.

## 6. Transition completion

Transition completion follows these rules:

- A transition completes when raw progress reaches `1`.
- `progress` becomes exactly `1`.
- `direction` becomes `"none"`.
- `isTransitioning` becomes `false`.
- Completion should not update `phase` or `phaseIndex` again because they already changed at transition start.
- Completion should happen once per accepted transition.
- Completion should not start or restart cooldown.

## 7. `next`

`next` follows these rules:

- It targets the next configured phase.
- It first checks boundary behavior.
- From the last phase, it is a no-op.
- When accepted, it uses the shared accepted-navigation lifecycle.
- While locked, transitioning, or cooling down, a valid `next` request is ignored.

## 8. `prev`

`prev` follows these rules:

- It targets the previous configured phase.
- From the first phase, it is a no-op.
- When accepted, it uses the shared accepted-navigation lifecycle.
- While locked, transitioning, or cooling down, a valid `prev` request is ignored.

## 9. `goTo`

`goTo` follows these rules:

- It targets a configured phase by value.
- Same-phase `goTo` is a no-op.
- Valid different-phase `goTo` uses the shared accepted-navigation lifecycle.
- Direction is derived from the target index relative to the current index.
- Invalid targets should continue to throw predictably for v0.2.0.
- Invalid target behavior should not leave partial transition state.

## 10. Same-phase navigation

Same-phase navigation follows these rules:

- Same-phase `goTo` is a no-op.
- It does not reset progress.
- It does not start a transition.
- It does not change direction.
- It does not start or reset cooldown.

## 11. Invalid targets

The intended v0.2.0 decision for invalid targets is:

- Invalid `goTo` should continue to throw before valid-navigation gates such as lock, transition, and cooldown.
- Invalid `goTo` should not mutate `phase`, `phaseIndex`, `progress`, `direction`, lock state, transition state, or cooldown state.
- This behavior should be tested as a regression.

## 12. Navigation while transitioning

Navigation while transitioning follows these rules:

- Valid navigation while transitioning is ignored.
- No queue is created.
- No restart behavior is added.
- No interrupt behavior is added.
- No retarget behavior is added.
- No new cooldown window is started.
- The active transition continues to completion.
- This is the default v0.2.0 behavior.
- `lockDuringTransition` should not be added unless separately designed.

## 13. Navigation while locked

Navigation while locked follows these rules:

- Valid navigation while locked is ignored.
- Lock does not pause or cancel an active transition.
- Active transitions continue when frame updates occur.
- Unlock does not clear cooldown directly.
- After unlock, navigation may proceed only if the flow is idle and cooldown has expired.

## 14. Navigation during cooldown

Navigation during cooldown follows these rules:

- Cooldown is owned by the core machine.
- Cooldown starts on accepted navigation.
- Cooldown and transition time can overlap.
- Valid navigation during cooldown is ignored.
- Ignored navigation does not queue, restart, retarget, mutate state, or extend cooldown.
- Same-phase and boundary no-ops do not start cooldown.
- Input hooks should not maintain independent cooldown timers.

## 15. Boundary behavior

Boundary behavior follows these rules:

- `prev` from the first phase remains a no-op.
- `next` from the last phase remains a no-op.
- No loop behavior is added for v0.2.0.
- No boundary wrapping is added for v0.2.0.
- Boundary no-ops do not start cooldown.

## 16. DOM progress versus R3F frame progress

DOM and R3F progress expectations are intentionally different:

- DOM controls read React snapshot state through `useFlow`.
- R3F scene components receive frame-driven progress through `useFlowFrame`.
- `useFlowFrame` may receive progress every frame without forcing React state updates every frame.
- DOM `flow.progress` should not be documented as a frame-perfect animated value.
- Examples should make this distinction clear.
- Frame-driven visual updates should use refs or mutable state, not React state updates every frame.

## 17. Non-goals for v0.2.0

v0.2.0 does not include:

- No transition queue.
- No restart behavior.
- No interrupt behavior.
- No retarget behavior.
- No loop or boundary wrapping.
- No public source or target phase fields.
- No animation timeline system.
- No router integration.
- No camera presets.
- No shader effects.
- No particle APIs.
- No GSAP or Framer Motion integration.
- No new runtime dependency.

## 18. Test implications

Later implementation and test PRs should add or preserve coverage for:

- Accepted `next`.
- Accepted `prev`.
- Accepted `goTo`.
- Same-phase `goTo` no-op.
- Invalid `goTo` throw and no mutation.
- First and last boundary no-op.
- Transition completion once.
- Progress clamp.
- Navigation while transitioning ignored.
- Navigation while locked ignored.
- Navigation during cooldown ignored.
- Cooldown starts on accepted navigation.
- Ignored navigation does not reset cooldown.
- DOM progress versus `useFlowFrame` expectations where feasible.

## 19. Relationship to existing docs

`docs/behavior-v0.2.0.md` records the current behavior audit and intended high-level rules.

`docs/transition-lifecycle-v0.2.0.md` defines the transition lifecycle decisions for issue #53.

Later implementation and test PRs should follow these docs.
