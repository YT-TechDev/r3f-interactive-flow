# r3f-interactive-flow

## 2.1.0

`r3f-interactive-flow@2.1.0` is a release-prep update for input, transition, and package boundary hardening. It records completed validation work without changing source behavior, public API, package exports, or dependencies.

### Hardened

- Added focused core test coverage for rapid repeated input and lock/cooldown edge cases.
- Clarified Client Component and Next.js App Router usage expectations.
- Confirmed existing wheel, touch, and keyboard input listener setup and cleanup behavior remains safe.
- Confirmed package files, exports, dependencies, peer dependencies, and README import guidance remain safe.

### Scope

- No public API changes are included in this PR.
- No dependency changes are included in this PR.
- No package export changes are included in this PR.
- No source behavior changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 2.0.0

`r3f-interactive-flow@2.0.0` finalizes the stable package root API and release documentation after v2.0.0 readiness validation. It prepares the package version and changelog for the manual release steps without changing source behavior, tests, package exports, or dependencies.

### Changed

- Finalized the stable public API documentation for the package root exports.
- Finalized the package export boundary as root-only.
- Finalized README guidance for v2.0.0 usage, peer dependencies, hook boundaries, Next.js Client Component usage, and non-goals.
- Added v2.0.0 migration guidance.
- Added a v2.0.0 release notes draft.
- Recorded full v2.0.0 release validation, including install, format, lint, tests, build, package typecheck, package dry-run, and Vite example build.
- Confirmed the package root import boundary.

### Scope

- No public API expansion is included in this PR.
- No package export expansion is included in this PR.
- No runtime dependencies are included in this PR.
- No Next.js dependency is included in this PR.
- No source code changes are included in this PR.
- No test changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.
- No milestone closeout is included in this PR.

## 1.9.0

`r3f-interactive-flow@1.9.0` is a release-candidate hardening release. It prepares package metadata and changelog documentation for manual publish, tag, and release steps without expanding the public API, adding runtime dependencies, or changing source behavior.

### Hardened

- Audited package entrypoint runtime exports.
- Audited public type exports.
- Audited package metadata and generated root entrypoint artifacts.
- Clarified README and example documentation for v2.0.0 readiness.
- Recorded package dry-run validation for publish contents.
- Documented release-candidate bug triage and baseline status.

### Scope

- No public API expansion is included in this PR.
- No new runtime dependencies are included in this PR.
- No source behavior changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 1.8.0

`r3f-interactive-flow@1.8.0` is a React and R3F bridge hardening release. It stabilizes provider, progress, frame bridge, and client-facing entry compatibility coverage without expanding the public API or adding runtime dependencies.

### Hardened

- Added `FlowProvider` behavior coverage.
- Added `useFlowProgress` behavior coverage.
- Added `useFlowFrame` bridge coverage.
- Added client-facing entry compatibility coverage for Next.js Client Component usage.
- Clarified Canvas-bound hook usage guidance.
- Documented the v1.8.0 React and R3F bridge baseline.

### Scope

- No public API expansion is included in this PR.
- No new runtime dependencies are included in this PR.
- No Next.js dependency or router integration is included in this PR.
- No visual effects, animation timelines, camera presets, templates, or third-party animation wrappers are included.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 1.7.0

`r3f-interactive-flow@1.7.0` is an input integration hardening release. It stabilizes combined input behavior and lifecycle handling without expanding the public API or adding runtime dependencies.

### Hardened

- Added cross-input lock and cooldown coverage.
- Added combined wheel and keyboard input scenario coverage.
- Added combined touch and wheel input scenario coverage.
- Aligned disabled and re-enabled lifecycle behavior across input hooks.
- Hardened custom input target retargeting behavior.
- Documented the v1.7.0 input integration baseline.

### Scope

- No public API expansion is included in this PR.
- No new runtime dependencies are included in this PR.
- No visual effects, animation timelines, camera presets, router integration, Next.js-specific integration, templates, or third-party animation wrappers are included.
- No release automation changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 1.6.0

`r3f-interactive-flow@1.6.0` is a transition behavior hardening release. It stabilizes existing core transition behavior through deterministic coverage and documentation without expanding the library scope.

### Hardened

- Added phase boundary navigation coverage for first-phase and final-phase no-op behavior.
- Added `goTo()` edge-case coverage for same-phase, invalid target, multi-phase jump, and active-transition behavior.
- Added lock and unlock transition behavior coverage.
- Hardened cooldown consistency around ignored navigation during cooldown, lock, active transitions, same-phase requests, and phase boundaries.
- Ensured transition progress, direction, and state remain predictable at boundaries and after completion.
- Documented the v1.6.0 transition behavior baseline.

### Scope

- No public API expansion is included in this PR.
- No new runtime dependencies are included in this PR.
- No visual effects, animation timelines, camera presets, router integration, template systems, or third-party animation wrappers are included.
- No release automation changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 1.5.0

`r3f-interactive-flow@1.5.0` is a usage-readiness and package-stability release. It builds on the `1.3.0` core behavior baseline and the `1.4.0` input behavior baseline without treating this release as a major feature release.

### Documentation

- Tightened minimal usage examples for the focused phase, progress, and frame bridge workflow.
- Documented DOM-to-Canvas wiring patterns so browser input, React state, and Canvas-bound frame updates stay separated.
- Added an agent-readable usage checklist for predictable integration guidance.
- Clarified package metadata and peer dependency documentation for consumer readiness.
- Documented the v1.5.0 usage readiness baseline.

### Tests

- Added package entrypoint export coverage to keep the published surface intentional.

### Scope

- No public API expansion is included in this PR.
- No new runtime dependencies are included in this PR.
- No runtime behavior changes are included in this release-prep PR.
- No router integration, visual effect systems, camera presets, shader APIs, or animation timeline behavior are included.
- No release automation changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 1.4.0

`r3f-interactive-flow@1.4.0` is an input behavior baseline release. It stabilizes tested wheel, keyboard, and touch input behavior without expanding the public API or broadening the package scope.

### Changed

- Stabilized the input behavior baseline for wheel, keyboard, and touch input hooks.
- Audited input lock and cooldown behavior for accepted navigation, rejected navigation, transitions, and locked states.
- Aligned disabled input behavior so disabled hooks avoid listener setup and option validation where applicable.
- Documented tested input behavior for thresholds, key mappings, touch gestures, locks, transitions, cooldowns, listener cleanup, and browser API safety.

### Tests

- Added or expanded baseline coverage for wheel input behavior.
- Added or expanded baseline coverage for keyboard input behavior.
- Added or expanded baseline coverage for touch input behavior.

### Scope

- No public API expansion is included in this PR.
- No new runtime dependencies are included in this PR.
- No runtime behavior changes are included in this release-prep PR.
- No test changes are included in this release-prep PR.
- No examples changed in this release-prep PR.
- No visual effects, router integration, camera presets, shader APIs, or animation timeline features are included.
- No release automation changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 1.3.0

`r3f-interactive-flow@1.3.0` is a core behavior baseline release. It focuses on stabilizing and documenting existing core behavior without expanding the public API or broadening the package scope.

### Stabilized

- Added core transition lifecycle baseline tests.
- Added navigation boundary and no-op baseline tests.
- Added lock and cooldown baseline tests.
- Added transition re-entry and ignored navigation baseline tests.
- Added core behavior baseline documentation.

### Scope

- No public API expansion is included in this PR.
- No new runtime dependencies are included in this PR.
- No package exports changed.
- No visual effects, router integration, camera presets, shader APIs, or animation timeline features are included.
- No release automation changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 1.2.5

`r3f-interactive-flow@1.2.5` is a documentation and example-focused release that establishes clearer AI-readable usage guidance for the existing library surface. It does not change runtime behavior or expand the package API.

### Documentation

- Clarified README positioning, intended scope, and non-goals.
- Documented practical `FlowProvider` setup and usage expectations.
- Documented `useFlow()` and `useFlowProgress()` usage for phase navigation and progress reads.
- Documented `useFlowFrame()` as a Canvas-bound R3F hook that must stay inside Canvas-rendered components.
- Documented the separation between DOM input hooks and R3F scene logic.
- Added common mistakes and anti-patterns guidance.
- Simplified minimal usage examples for faster adoption.
- Added v1.2.5 closeout and release-readiness documentation.

### Scope

- No source or runtime behavior changed.
- No public API changed.
- No dependencies changed.
- No package exports changed.
- No release automation changed.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

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
