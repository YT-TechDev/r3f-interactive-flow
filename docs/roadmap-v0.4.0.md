# r3f-interactive-flow v0.4.0 Roadmap

## Status

This roadmap describes planned stabilization work for `r3f-interactive-flow` v0.4.0. It is documentation-only: it does not publish, tag, release, add runtime behavior, add dependencies, or expand the public API by itself.

`v0.3.0` has been released. The next release should focus on stabilization, not feature expansion.

## v0.4.0 - Input, transition, and test hardening

### Goal

Stabilize the existing phase flow foundation by improving input reliability, transition lifecycle behavior, cooldown and locking behavior, and test coverage.

v0.4.0 should make input handling, transition lifecycle behavior, cooldown handling, locking behavior, and core tests more reliable and predictable.

It should avoid large new concepts, visual-effect APIs, animation timelines, camera presets, shader utilities, router integration, and unnecessary public API expansion.

### Priorities

- Harden transition lifecycle behavior for `next`, `prev`, and `goTo`.
- Clarify and test locking and cooldown behavior.
- Improve reliability of wheel, touch, and keyboard input hooks.
- Add or improve core tests for accepted and rejected navigation.
- Keep documentation synchronized with implemented behavior.

### Non-goals

- No visual effects collection.
- No particle API.
- No camera preset API.
- No shader effect API.
- No animation timeline system.
- No GSAP integration.
- No Framer Motion integration.
- No router integration.
- No large demo or template work.
- No new runtime dependencies without strong justification.
- No public API expansion unless separately approved and documented.
- No release automation changes unless explicitly requested.
- No npm publishing.
- No GitHub release creation.
- No tag creation.

## Transition lifecycle hardening

Implementation work should verify and improve the reliability of:

- `next`
- `prev`
- `goTo`
- boundary no-ops
- unknown phase handling
- transition progress from `0` to `1`
- transition completion
- direction reset to `"none"`
- rejected navigation not mutating state
- deterministic transition option resolution
- `transition` and `transition.byPhase` behavior

Expected direction:

- Navigation should be predictable.
- Rejected navigation should not partially mutate state.
- Core behavior should be testable without React or React Three Fiber.
- Transition behavior should remain independent from visual effects.

## Locking and cooldown behavior

v0.4.0 should clarify and test:

- manual `lock()` / `unlock()`
- active transition guard
- cooldown after accepted navigation
- ignored navigation should not start, reset, or extend cooldown
- cooldown longer than transition duration
- transition duration longer than cooldown
- input-level cooldown versus core-level cooldown
- no overlapping transitions by default

Do not introduce a new public `lockDuringTransition` API unless a separate issue explicitly approves it. The current focus is to stabilize existing locking and cooldown behavior, not to expand the public API.

## Input hook reliability

Implementation work should review and test:

- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`

Focus areas:

- listener attachment
- cleanup on unmount
- enabled/disabled behavior
- target handling
- threshold behavior
- axis handling
- ignore selectors
- keyboard repeat handling
- typing target guards
- SSR/import safety
- no browser API access at module import time

Expected direction:

- Input hooks should translate browser input into flow navigation requests.
- Input hooks should not own scene behavior.
- Input hooks should remain separate from R3F scene logic.
- Input hook options should stay focused and predictable.

## Core tests

v0.4.0 should prioritize tests for:

- initialization
- invalid phase lists
- invalid initial phase
- `next`
- `prev`
- `goTo`
- boundary no-ops
- unknown phase errors
- transition progress and completion
- direction changes
- lock and unlock
- transition guard behavior
- cooldown start, advancement, and ignored requests
- invalid timing options

Expected direction:

- Prefer tests before behavior changes when practical.
- Core tests should not depend on React.
- Tests should make future refactors safer.
- Behavior changes should be small and easy to review.

## Documentation sync

README and examples should be updated only when behavior is implemented or clarified.

README updates should stay focused on:

- expected transition behavior
- input hooks
- cooldown
- locking
- test-backed behavior
- migration notes if behavior changes

Avoid marketing-heavy language. Do not promise advanced animation features.

## v0.4.0 release-readiness checklist

Use this checklist after the hardening PRs land and before any explicit release-prep PR changes package versions, changelog entries, release notes, publishing, tags, or automation. This checklist is verification-only; it must not publish, tag, release, or change package versioning by itself.

### Core behavior

- [ ] Accepted `next`, `prev`, and `goTo` navigation is covered and behaves as documented.
- [ ] Rejected navigation keeps snapshots safe and does not partially mutate transition, lock, or cooldown state.
- [ ] Active transition guards reject overlapping navigation consistently.
- [ ] Cooldown behavior is covered for accepted navigation and ignored requests.
- [ ] Manual `lock()` and `unlock()` behavior is covered and matches the README.

### Input hooks

- [ ] Wheel, touch, and keyboard listener attachment and cleanup are covered.
- [ ] Enabled and disabled states are covered for each input hook.
- [ ] Target refs, direct targets, and empty-ref fallback behavior are covered.
- [ ] Retarget cleanup removes listeners from previous targets.
- [ ] SSR/import safety is verified, with no browser API access at module import time.

### Public API and types

- [ ] Runtime exports remain intentionally small and centered on the documented hooks and provider.
- [ ] Public type exports are covered by export/type checks.
- [ ] No incidental public API expansion was introduced during hardening.

### Documentation

- [ ] The root README and package README describe the same tested behavior.
- [ ] Behavior docs match implemented navigation guards, cooldowns, locks, and input hook reliability.
- [ ] Examples stay within the v0.4.0 scope and do not promise visual effects, timelines, router integration, or other non-goals.

### Release verification

- [ ] `pnpm release:check` passes from the repository root.
- [ ] Package output includes the expected files and preserves the built `"use client"` directive.
- [ ] The Vite example build passes as part of release verification.
- [ ] Package dry-run output is reviewed.
- [ ] Changelog entries and release notes drafts are updated only in a later explicit release-prep PR.

## Architecture rules to preserve

Keep the existing package structure:

```txt
packages/r3f-interactive-flow/
  src/
    core/
    react/
    r3f/
    input/
```

Rules:

- `core/` stays React-independent.
- `react/` owns provider, context, and hooks.
- `r3f/` owns Canvas-bound frame bridge hooks.
- `input/` owns browser input handling.
- Do not mix DOM input logic into R3F scene logic.
- Do not call R3F hooks such as `useFrame` or `useThree` outside Canvas-bound components.
- Do not use React state for values that change every frame unless synchronizing a stable snapshot intentionally.
- Keep public exports small and intentional.
- Avoid broad rewrites.
- Avoid unrelated file changes.

## Public API guidance

The public API should remain small and predictable. Current public API work should remain centered on:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`

Public types should be exported intentionally, not incidentally. Do not add new public APIs for v0.4.0 unless a separate issue explicitly approves the change.

If any public API change is proposed, document:

- rationale
- type shape
- runtime behavior
- migration impact
- README impact
- tests required
- whether the change is breaking

## Candidate issues

1. Harden core transition lifecycle behavior
2. Add core tests for transition guards and cooldown behavior
3. Improve wheel, touch, and keyboard input reliability
4. Clarify locking and cooldown behavior in README
5. Add release readiness checklist for v0.4.0
