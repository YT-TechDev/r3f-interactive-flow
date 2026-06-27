# r3f-interactive-flow

## 1.0.0

`r3f-interactive-flow@1.0.0` is the final stabilization release for the current focused library direction. It finalizes confidence in the existing phase, input, transition, React provider, package, documentation, example, and R3F frame bridge foundation without expanding the library into a general animation framework.

### Stabilized

- Strengthened public API and runtime export consistency coverage.
- Aligned root README and package README usage guidance for the final public API.
- Polished the `vite-basic` example guidance so input hooks remain optional browser helpers and `useFlowFrame` remains Canvas-bound.
- Added input hook cleanup coverage so wheel, touch, and keyboard listeners stop driving flow navigation after unmount.
- Added `useFlowFrame` final stability coverage for idle, completed, same-phase navigation, and rejected boundary navigation behavior.
- Added `FlowProvider` / React hook consistency coverage so `useFlow()` and `useFlowProgress()` remain aligned.
- Continued to focus on the existing public API and behavior.

### Tests

- Added public export coverage.
- Added input hook cleanup and unmount regression coverage.
- Added `useFlowFrame` final stability regression coverage.
- Added `FlowProvider` final hook consistency regression coverage.

### Documentation

- Added the `v1.0.0` stabilization roadmap.
- Synchronized post-`v0.9.0` project status.
- Aligned root README, package README, and `vite-basic` example guidance for the final focused scope.

### Scope

- No package version changes are included in this release-prep entry.
- No npm publishing is included in this release-prep entry.
- No git tag creation is included in this release-prep entry.
- No GitHub Release creation is included in this release-prep entry.
- No release automation changes were made.
- No runtime dependencies were added.
- No package export changes were made.
- No public API expansion was introduced.
- No source code or test changes are included in this docs-only release-prep entry.
- No visual effects, camera presets, shader APIs, animation timelines, router integration, GSAP integration, Framer Motion integration, or demo templates were added.

## 0.9.0

v0.9.0 is a narrow stabilization release for the existing phase, input, transition, React provider, and R3F frame bridge foundation. It hardens completion, no-op, boundary, and input cooldown behavior without introducing a new public API or broadening the library into visual effects, camera presets, shader APIs, animation timelines, router integration, or animation-framework wrappers.

### Improved

- Hardened `useFlowFrame` transition completion behavior for large frame deltas and post-completion stability.
- Strengthened core flow machine no-op and boundary stability behavior for rejected `prev()`, rejected `next()`, and same-phase `goTo(currentPhase)`.
- Strengthened React `FlowProvider` no-op and boundary stability behavior through React-facing hooks and snapshots.
- Fixed browser input hook cooldown behavior so hook-local cooldown is recorded only when input navigation is accepted.
- Generalized rejected boundary input handling so rejected input does not consume hook-local cooldown before a valid opposite-direction navigation.

### Tests

- Added regression coverage for `useFlowFrame` completion edge behavior.
- Added core machine regression coverage for no-op and boundary snapshot stability.
- Added React provider regression coverage for no-op and boundary snapshot stability.
- Added wheel, touch, and keyboard input regression coverage for rejected boundary input and accepted-navigation-only cooldown behavior.

### Documentation

- Synchronized README behavior documentation for accepted-navigation-only input hook cooldown behavior.
- Synchronized post-`0.8.0` project status documentation for the `v0.9.0` stabilization cycle.

### Scope

- No package version changes are included in this release-prep entry.
- No npm publishing is included in this release-prep entry.
- No git tag creation is included in this release-prep entry.
- No GitHub Release creation is included in this release-prep entry.
- No release automation changes were made.
- No dependency additions were made.
- No public API expansion was introduced.
- No source code or test changes are included in this docs-only release-prep entry.
- No visual effects, camera presets, shader APIs, animation timelines, router integration, GSAP integration, Framer Motion integration, or demo templates were added.

## 0.8.0

v0.8.0 is a narrow stabilization release for predictable transition, input, React provider, public export, and example behavior. It strengthens confidence in the current phase/input/progress/frame coordination API before further releases without introducing a new public API or broadening the project into a general animation framework.

### Improved

- Stabilized accepted and rejected navigation behavior with core transition regression coverage.
- Clarified transition cooldown behavior for accepted navigation and ignored requests.
- Covered transition option precedence, fallback behavior, and `transition.byPhase` source-phase semantics.
- Validated `FlowProvider` transition option forwarding and `useFlowProgress` consistency with `useFlow().progress`.

### Tests

- Added regression coverage for input hook cooldown gates.
- Added regression coverage for manual lock and unlock behavior.
- Added regression coverage for `enabled: false` input handling and re-enabled input behavior.
- Added public package export regression coverage to keep exports intentional.

### Documentation

- Synchronized README tested behavior documentation with the stabilized transition, input, provider, progress, and public export behavior.

### Examples

- Validated the Vite basic example and fixed local source resolution for example development.

### Scope

- No package version changes are included in this release-prep entry.
- No npm publishing is included in this release-prep entry.
- No git tag creation is included in this release-prep entry.
- No GitHub Release creation is included in this release-prep entry.
- No release automation changes were made.
- No dependency additions were made.
- No source code changes or public API expansion are introduced by this changelog entry.
- No visual effects, camera presets, shader APIs, animation timelines, router integration, GSAP integration, Framer Motion integration, or demo templates were added.

## 0.7.0

### Minor Changes

- Prepare the v0.7.0 stabilization release with consumer package confidence improvements, package output verification hardening, public API export checks, README/example consistency updates, and clearer release-prep documentation.

## 0.6.0

v0.6.0 is a narrow input stabilization and release-prep release. It documents the completed v0.6.0 planning work, validates wheel and touch threshold handling, keeps threshold guidance synchronized, and adds targeted cooldown guard coverage for ignored or blocked wheel, touch, and keyboard input events.

### Improved

- Added v0.6.0 roadmap and planning documentation for the input stabilization pass.
- Validated wheel input threshold handling around configured boundary values.
- Validated touch input threshold handling around configured boundary values.
- Synchronized documentation for wheel and touch threshold validation behavior.
- Added hook-local cooldown guard tests for ignored or blocked wheel input events.
- Added hook-local cooldown guard tests for ignored or blocked touch input events.
- Added hook-local cooldown guard tests for ignored or blocked keyboard input events.

### Scope

- No npm publishing is included in this release-prep PR.
- No git tag creation is included in this release-prep PR.
- No GitHub Release creation is included in this release-prep PR.
- No release automation changes were made.
- No dependency additions were made.
- No public API expansion was introduced.
- No unrelated runtime expansion was introduced.
- No visual effects, camera presets, shader APIs, animation timelines, router integration, GSAP integration, or Framer Motion integration were added.

## 0.5.0

v0.5.0 is a narrow documentation and example stabilization release. It aligns repository guidance, package-facing validation notes, and example documentation with the existing public API and package behavior.

### Documentation

- Aligned the root README public API and export documentation with the package root exports.
- Synchronized package README validation guidance with the root README validation matrix.
- Added README coverage for the Vite basic example.
- Clarified Next.js Client Component boundaries for provider, hook, and browser input usage.
- Documented validation command guidance by PR type.
- Updated roadmap progress for the completed v0.5.0 documentation and example stabilization pass.

### Scope

- No runtime code changes are included in v0.5.0.
- No public runtime API expansion was introduced.
- No new runtime dependencies were added.
- No visual effects, camera presets, shader APIs, animation timelines, router integration, GSAP integration, Framer Motion integration, or large templates were added.
- No publishing, tag creation, GitHub Release creation, or release automation changes are included in this release-prep PR.

## 0.4.0

v0.4.0 is an input, transition, and test hardening release for the existing phase flow foundation. It focuses on regression coverage, documented guard behavior, and release-readiness documentation without adding visual-effect APIs, release automation, or runtime dependencies.

### Improved

- Added core cooldown guard regression coverage for accepted navigation and ignored requests.
- Clarified and covered accepted and rejected navigation guard behavior, including transition, lock, cooldown, boundary, same-phase, and invalid-target cases.
- Added wheel input lifecycle tests for listener attachment, cleanup, disabled state, retargeting, ignore selectors, and cooldown behavior.
- Added touch input lifecycle tests for listener attachment, cleanup, disabled state, retargeting, threshold handling, axis handling, and cooldown behavior.
- Added keyboard input lifecycle tests for listener attachment, cleanup, disabled state, retargeting, repeat handling, typing guards, and cooldown behavior.
- Added public type export coverage to keep exported types intentional.
- Synchronized README behavior guidance with the tested navigation guards, cooldown, locking, and input hook lifecycle behavior.
- Added v0.4.0 release-readiness checklist documentation for maintainers.

### Documentation

- Added a v0.4.0 release notes draft in `docs/releases/v0.4.0.md`.
- Kept the v0.4.0 scope focused on stabilization, verification, and package metadata preparation.

### Scope

- No publishing, tag creation, or GitHub Release creation is included in this release-prep change.
- No release automation changes were made.
- No runtime dependencies were added.
- No public runtime API expansion was introduced.
- No visual effects, particle, camera preset, shader, timeline, router, GSAP, or Framer Motion integration features were added.

## 0.3.0

v0.3.0 expands the phase/input/frame foundation while keeping the library focused on predictable control flow for interactive React Three Fiber websites.

### Added

- Added scoped wheel input options, including direct element/window targets, axis selection, ignore selectors, and hook-local cooldown.
- Added improved touch input options, including direct element/window targets, axis selection, ignore selectors, and hook-local cooldown.
- Added improved keyboard input guards with grouped `keys.next` / `keys.prev`, configurable typing guards, direct target support, and hook-local cooldown.
- Added `FlowFrameState` and `FlowFrameCallback`.
- Added a typed `useFlowFrame((state, delta) => ...)` callback payload.
- Added `transition` and `transition.byPhase` options for global and source-phase transition timing.
- Added public transition option types.

### Changed

- Changed `useFlowFrame` callback from `(progress, delta)` to `(state, delta)`.
- Made `transition` the preferred timing API while preserving legacy `transitionDurationMs`, `cooldownMs`, and `easing` props.
- Updated the Vite basic example to demonstrate the current DOM UI to Canvas usage pattern.

### Documentation

- Added v0.3.0 planning, readiness, and migration documentation.
- Reworked README guidance for DOM React UI controls, Canvas-bound frame updates, input hooks, transition options, and Next.js/browser safety.
- Documented `useFlowFrame` migration from `(progress, delta)` to `({ progress }, delta)`.

### Compatibility

- `nextKeys` and `prevKeys` remain as deprecated compatibility aliases for keyboard input.
- `transitionDurationMs`, `cooldownMs`, and `easing` remain supported for compatibility.
- `createFlowMachine` remains internal and is not exported from the package root.

### Scope

- No visual effect APIs were added.
- No camera preset APIs were added.
- No shader effect APIs were added.
- No animation timeline APIs were added.
- No router integration was added.
- No GSAP or Framer Motion integration was added.
- No runtime dependencies were added.

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
