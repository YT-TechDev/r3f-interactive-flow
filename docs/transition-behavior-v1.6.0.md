# v1.6.0 Transition Behavior Baseline

This document records the core transition behavior baseline confirmed for v1.6.0 after transition hardening. It is documentation-only: it does not add runtime features, expand the public API, add dependencies, or introduce visual effects, animation timelines, camera presets, router integration, templates, or third-party animation wrappers.

The baseline applies to the core phase machine behavior behind `next()`, `prev()`, `goTo()`, `lock()`, `unlock()`, `update()`, and the published snapshot fields: `phase`, `phaseIndex`, `progress`, `direction`, `isTransitioning`, and `isLocked`.

## Phase boundary navigation

The core machine treats boundary navigation as a no-op.

- `next()` at the final phase is ignored.
- `prev()` at the first phase is ignored.
- Boundary no-op navigation does not move past the first or final phase.
- Boundary no-op navigation does not start a transition.
- Boundary no-op navigation does not open a cooldown gate by itself.
- Repeated boundary navigation preserves the settled snapshot.

## `goTo()`

`goTo()` starts navigation only when the target is configured and different from the current phase.

- `goTo(currentPhase)` is a no-op.
- `goTo(validDifferentPhase)` transitions to the requested phase.
- Multi-phase jumps resolve to the requested target phase, not to an intermediate adjacent phase.
- Direction is derived from the target index relative to the current index: forward jumps use `"next"`, backward jumps use `"prev"`.
- `goTo()` requests ignored during active transitions do not retarget the active transition and do not corrupt state.
- Invalid `goTo()` targets continue to throw and do not mutate the current snapshot.

## Lock and unlock

Manual locking blocks new navigation requests. It does not pause or cancel an active transition.

- Navigation while manually locked is ignored.
- `unlock()` only removes the manual lock; it does not trigger navigation.
- `unlock()` allows later valid navigation when the machine is otherwise idle and not cooling down.
- Locking during an active transition preserves the transition state.
- A locked active transition can continue to completion through `update()`.
- Later navigation remains blocked until `unlock()` is called.

## Cooldown and ignored navigation

Cooldown is started by accepted navigation. Ignored navigation must not start a transition or mutate the settled snapshot.

- Valid navigation during cooldown is blocked until cooldown has elapsed.
- Cooldown is not extended by ignored navigation.
- Boundary no-op navigation does not open a cooldown gate by itself.
- Same-phase `goTo()` does not open a cooldown gate by itself.
- Locked navigation does not bypass cooldown.
- Navigation ignored during an active transition does not reset or extend cooldown.
- Once cooldown has elapsed, the next valid navigation works normally.

## Transition progress, direction, and state

Accepted navigation immediately publishes the destination phase and starts transition progress at `0`. `update(deltaMs)` advances the active transition until completion.

- During an active transition, `progress` advances from `0` toward `1`, `direction` is `"next"` or `"prev"`, and `isTransitioning` is `true`.
- Completed transitions settle with `progress: 1`, `direction: "none"`, and `isTransitioning: false`.
- Boundary no-op navigation does not mutate progress.
- Boundary no-op navigation does not leave stale direction.
- Boundary no-op navigation does not leave `isTransitioning: true`.
- Repeated boundary navigation after completed transitions preserves the settled snapshot.
- Additional navigation while a transition is active is ignored; it does not queue, restart, interrupt, or retarget the active transition.

## Scope notes

This baseline describes existing core transition behavior only. It does not document or imply any animation timeline system, visual effect layer, camera preset API, router integration, Next.js-specific integration, CLI/codegen, template system, or public API expansion.
