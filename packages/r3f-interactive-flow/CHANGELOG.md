# r3f-interactive-flow

## 0.2.0

v0.2.0 is a stabilization release for the existing phase-based flow-control foundation. It focuses on documenting and validating current behavior rather than expanding the public API.

### Improved

- Improved transition lifecycle documentation for accepted navigation, progress updates, completion, ignored navigation, and invalid navigation.
- Clarified cooldown, lock, boundary, and invalid `goTo` behavior for the existing core flow machine.
- Clarified that DOM-facing progress from `useFlow` and `useFlowProgress` is distinct from frame-driven `useFlowFrame` progress for Canvas-bound updates.

### Tests

- Added and expanded core lifecycle regression coverage for initialization, navigation, transition progress, completion, lock behavior, cooldown behavior, non-looping boundaries, and invalid targets.
- Added React provider and hook coverage for `FlowProvider`, `useFlow`, `useFlowProgress`, snapshot updates, lock controls, and outside-provider errors.
- Added `useFlowFrame` bridge coverage for frame updates, callback arguments, latest-callback handling, completion sync, and outside-provider errors.
- Added wheel, touch, and keyboard input hook coverage for event listener setup and cleanup, thresholds or key mappings, disabled state, prevention behavior, lock and transition gates, target elements, and import-time browser guards.
- Extracted shared private input test utilities for input hook tests. These utilities are internal test support only and are not public API.

### Documentation

- Updated v0.2.0 behavior and test coverage documentation around transition lifecycle, cooldown, lock, boundary, input gating, and invalid navigation behavior.
- Documented DOM progress versus frame-driven `useFlowFrame` responsibilities.
- Added the v0.2.0 release readiness checklist for maintainers.

### Scope

- No major public API expansion is introduced in v0.2.0.
- No package exports, dependencies, release automation, or package version changes are part of this changelog entry.
- No particle, camera preset, shader, timeline, router, GSAP, or Framer Motion integration features were added.
- No loop, queue, restart, interrupt, retarget, public source-phase, public target-phase, or `lockDuringTransition` behavior was added.

## 0.1.0

Initial release.

### Added

- Added a small phase-based flow control layer for React Three Fiber experiences.
- Added core phase machine support for `next`, `prev`, and `goTo`.
- Added transition progress, transition direction, lock state, and transition state tracking.
- Added React provider and hooks:
  - `FlowProvider`
  - `useFlow`
  - `useFlowProgress`
- Added React Three Fiber frame bridge:
  - `useFlowFrame`
- Added browser input hooks:
  - `useWheelInput`
  - `useTouchInput`
  - `useKeyboardInput`
- Added basic Vite example.
- Added package build, typecheck, test, lint, format, package dry-run, and release readiness scripts.
- Added npm-facing README, MIT license, and initial tests.

### Scope

This release intentionally keeps the library focused on predictable phase-based flow control.
It is not a visual effects collection, a camera preset library, a particle library, a shader effect library, a portfolio template, or a full animation framework.
