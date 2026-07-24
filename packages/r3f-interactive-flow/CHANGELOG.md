# r3f-interactive-flow

## 2.8.0

`r3f-interactive-flow@2.8.0` is a transition-contract completeness minor
release. It validates and documents the existing transition lifecycle, records
an evidence-backed no-change decision for source/target transition metadata,
and aligns user-facing documentation with the confirmed runtime contract,
while preserving the stable v2 runtime, public API, package exports,
dependencies, and peer dependency ranges.

### Validated transition contract

- Accepted `next()`, `prev()`, and `goTo()` navigation with positive duration
  updates `phase` and `phaseIndex` to the target synchronously, resets
  `progress` to `0`, and derives `direction` from source versus target index.
- `progress`, `direction`, and `isTransitioning` follow a deterministic
  lifecycle from accepted navigation through raw completion.
- Raw elapsed progress, not eased public progress, decides transition
  completion; eased output reaching `0` or `1` early does not end the
  transition or reset lifecycle state.
- Finite custom easing output is clamped through the existing `clamp01`
  behavior before becoming public `progress`; non-finite and non-monotonic
  easing output remain incidental implementation detail, not a stable
  contract.
- Zero-duration transitions complete synchronously in the same call: target
  phase and index update, `progress` becomes `1`, `direction` returns to
  `"none"`, and `isTransitioning` remains `false`.
- An oversized delta consumes remaining transition time first, then applies
  the leftover delta to provider cooldown.
- Manual lock composition is independent from transition and cooldown state:
  it blocks new valid navigation without pausing an active transition or
  cooldown.
- The provider owns the only machine-advancing clock; `useFlowFrame` remains
  read-only and never advances the machine. React and R3F sampling are
  separate paths over the same provider-owned machine.
- Provider cooldown and hook-local input cooldowns remain separate concerns
  and are not conflated.

### Direct navigation and transition options

- Forward and reverse non-adjacent `goTo()` resolve in one direct transition
  with direction derived from relative indexes; intermediate phases are not
  visited or queued.
- `transition.byPhase` resolves from the source phase for adjacent and
  non-adjacent navigation, with independent per-field fallback:
  `byPhase -> transition global -> legacy top-level -> default`.
- Same-phase requests and known rejected navigation (boundary, locked,
  transitioning, or cooldown) remain mutation-free no-ops.
- Unknown `goTo()` targets throw before the normal rejection path, including
  while locked, transitioning, or in cooldown.

### Metadata decision and documentation

- Recorded the evidence-backed decision not to add `sourcePhase`,
  `targetPhase`, or `previousPhase` to `FlowSnapshot`, `FlowControls`, or
  `FlowFrameState` in v2.8.0. Application-owned previous-phase tracking,
  built from the existing public API, is sufficient for the demonstrated
  non-adjacent scenarios. Future reconsideration requires a separately
  approved, evidence-backed Issue.
- Aligned the root README, the distributed package README, the core-concepts
  guide, the R3F usage guide, and the common-mistakes guide with the
  confirmed transition contract, including the React Effect-owned committed
  observation pattern, R3F frame-local ref observation, and the
  zero-duration completion-observation caveat.

### Maintenance

- Pinned `actions/checkout` to `7.0.1` in CI and release workflows.
- Updated root and example development-tool dependencies (patch/minor) with
  an associated root lockfile update. These are development tooling changes
  only and do not affect the distributed package's runtime dependencies.

### Compatibility

- No runtime source changes are included in the v2.8.0 milestone work.
- No public API additions or removals are included.
- No public TypeScript production-type changes are included.
- No package export or package-subpath changes are included.
- No runtime dependency additions are included.
- No peer dependency range changes are included.
- The root-only package boundary remains unchanged.
- No migration is required for existing v2 consumers.
- No source/target metadata fields, accepted-navigation callbacks, lifecycle
  event emitters, transition queues, route pairs, graphs, timelines, router
  integration, or visual interpolation abstraction was added.

## 2.7.0

`r3f-interactive-flow@2.7.0` is an accessibility-responsibility,
reduced-motion-guidance, and focused browser-evidence minor release. It
preserves the stable v2 runtime, public API, package boundary, dependencies, and
peer ranges while validating and documenting how application-owned controls,
focus, native activation, motion preference, and Canvas motion integrate with
the existing flow primitives.

### Validated

- Zero-duration transitions complete immediately.
- Positive provider cooldown may remain after an immediate transition.
- React key remount applies changed provider configuration.
- Remount resets phase, progress, transition, lock, and cooldown state.
- One Vitest Browser Mode file uses one Playwright-managed headless Chromium.
- Bounded browser evidence covers native button, anchor, checkbox, editable targets, prevention, repeat, DOM ancestry, and focus non-interference.
- Visible native controls work without `useKeyboardInput`.

### Usage and documentation

- Package and application responsibility boundaries are explicit.
- Applications own controls, labels, ARIA, disabled/current states, focus, status wording, responsive layout, nested-scroll CSS, and motion preference.
- The representative consumer demonstrates visible controls, discrete status, focus-visible styles, nested scrolling, responsive targets, and motion modes.
- The new guide documents package-root recipes, keyed remount, state reset, nested scrolling, and separate Canvas motion.
- Stale deferred-Chromium wording was corrected.

### Compatibility

- No runtime source changes are included in v2.7.0 milestone work.
- No public API or public type changes are included.
- No export or package-subpath changes are included.
- No runtime dependency or peer-range changes are included.
- The root-only package boundary remains unchanged.
- Browser tooling is root development tooling only.
- No package-rendered UI, automatic ARIA, focus movement, announcement API, `matchMedia` behavior, or reduced-motion hook is included.
- No accessibility, WCAG, screen-reader, cross-browser, or physical-device certification claim is included.

## 2.6.0

`r3f-interactive-flow@2.6.0` is a focused browser lifecycle and input hardening minor release. It preserves the existing public API, public types, package exports, dependencies, peer dependency ranges, and root-only package boundary while correcting two input timing and touch lifecycle behaviors and documenting the proven browser boundaries.

### Fixed

- Preserve committed touch gesture state across rerenders that provide semantically equivalent `ignore` selector arrays, including fresh equivalent inline arrays whose identity changes. Materially changed selectors still replace the relevant Effect and reset pending gesture/listener state as intended.
- Use monotonic elapsed time for wheel burst inactivity and wheel, touch, and keyboard hook-local cooldowns. The current implementation uses `performance.now()`, so wall-clock changes no longer distort these elapsed-time decisions without making universal hidden-tab, OS-sleep, or background-time guarantees.

### Hardened

- Strengthened deterministic regression coverage for input rerender and target-resolution contracts, including unresolved explicit refs never falling back to `window`, same-commit ref resolution, dynamic target replacement boundaries, and equivalent versus material option changes.
- Completed focused touch interruption coverage for commitment, missing `touches[0]`, `touchcancel`, and unmount/remount interruption behavior.
- Locked provider timing contracts for the first-frame rAF baseline, non-negative handling for decreasing rAF timestamps, large positive deltas that complete transitions and consume remaining provider cooldown in the same update, zero-duration transitions plus cooldown, and monotonic hook-local elapsed-time behavior.

### Documentation

- Updated the input guide and README files to document listener Effect setup and cleanup, target-resolution boundaries, unresolved explicit ref behavior, the absence of automatic mutable-ref tracking, dynamic target application responsibility, and accepted/rejected `preventDefault()` behavior.
- Documented nested ignored/editable/actionable ancestor protection, wheel burst behavior, bounded single-touch semantics, keyboard input's lack of an `ignore` selector, provider and hook time-source inventory, bounded browser/background claims, and hoisted input option constants in examples.

### Compatibility

- No public API additions or removals are included.
- No public TypeScript type changes are included.
- No package export changes or new package subpaths are included.
- No runtime dependency additions are included.
- No peer dependency range changes are included.
- The root-only package boundary remains unchanged.
- The touch-ignore rerender and monotonic elapsed-time fixes are behavioral corrections within the existing API.
- No generalized gesture framework, E2E framework, or automated browser harness was added.
- v2.6.0 deterministic focused tests validate library contracts; they are not automated real-browser or physical-device certification, and v2.6.0 does not rerun or expand the v2.5.0 physical-device matrix.

## 2.5.0

`r3f-interactive-flow@2.5.0` is a validation-and-documentation-focused minor release. It preserves the 2.4.0 runtime source, public API, public types, package exports, dependencies, and peer dependency ranges while adding evidence-backed validation records, integration documentation, and release metadata.

### Validated

- Added a standalone Vite + React Three Fiber consumer that resolves the exact published npm package outside the workspace.
- Validated package-root imports and the existing public API across DOM, Canvas, wheel, trackpad, touch, keyboard, native controls, ignored regions, Canvas lifecycle, and reduced-motion application configuration.
- Recorded 82 PASS scenarios, zero failures, zero blocked scenarios, and one optional unverified physical-tablet environment.
- Confirmed representative physical mouse, high-resolution trackpad, physical keyboard, responsive/touch emulation, and physical iPhone Safari behavior.
- Confirmed DOM navigation and progress remain active without Canvas and that Canvas observation resumes after remount.
- Confirmed no reproducible package runtime or public type defect.

### Documentation

- Added evidence-backed integration guidance to the root README, npm package README, and user guides.
- Clarified package-root imports, DOM/Canvas responsibility boundaries, accepted-only event suppression, native behavior preservation, ignored nested-scroll regions, and application-owned reduced motion.
- Added durable maintainer validation records and a published-package consumer verification lane.

### Compatibility

- No runtime source changes from 2.4.0 are included.
- No public API additions or removals are included.
- No public TypeScript type changes are included.
- No package export changes are included.
- No runtime dependency additions are included.
- No peer dependency range changes are included.
- The root-only package boundary remains unchanged.
- Optional physical-tablet validation is not claimed.
- v2.5.0 is not broad browser certification.

## 2.4.0

`r3f-interactive-flow@2.4.0` improves runtime correctness, React integration performance, cross-device browser input behavior, and release supply-chain security while preserving the existing public API and root-only package boundary.

### Fixed

- Start provider cooldown at the actual transition-completion boundary instead of consuming it concurrently with the transition.
- Support zero-duration transitions as immediate completions that enter their configured cooldown synchronously.
- Prevent explicitly supplied but unresolved input refs from silently falling back to `window`.
- Consume wheel, keyboard, and touch browser events only after flow navigation is accepted.
- Preserve native browser behavior for rejected input, phase boundaries, locks, cooldowns, active transitions, editable elements, and actionable controls.
- Normalize wheel `deltaMode` values and accumulate high-resolution trackpad deltas into deterministic, one-navigation-per-burst input.
- Preserve `FlowProvider` state across semantically equivalent parent renders and use React `key` remounting as the explicit reconfiguration mechanism.

### Performance

- Separate stable flow-machine access from reactive snapshot subscriptions so `useFlowFrame()` and stable-machine consumers do not re-render on every transition frame.
- Preserve continuous reactive progress updates for `useFlow()` and `useFlowProgress()` consumers.

### Hardened

- Add regression coverage for provider render boundaries, mount-scoped configuration, post-transition cooldowns, zero-duration transitions, input target resolution, accepted-navigation event consumption, actionable controls, touch commitment, and wheel normalization and accumulation.
- Add a blocking production dependency audit to CI.
- Pin third-party GitHub Actions to reviewed full commit SHAs and use explicit least-privilege permissions.
- Add a manually dispatched npm Trusted Publishing workflow using GitHub Actions OIDC and automatic provenance.
- Make the pnpm minimum release-age policy explicit while preserving the workspace and build policies.
- Document the remaining Low development-only `esbuild` advisory and its follow-up decision.

### Compatibility

- No public exports or hook signatures are added or removed.
- No runtime dependencies are added.
- Peer dependency ranges are unchanged.
- The root-only package export boundary is unchanged.
- Cooldown timing, browser input consumption, wheel gesture handling, and provider reconfiguration behavior are intentional user-visible corrections in this minor release.

## 2.3.1

`r3f-interactive-flow@2.3.1` is a focused maintenance release that corrects transition clock ownership and React progress synchronization while strengthening packed-package and supported-peer compatibility validation.

### Fixed

- Made `FlowProvider` the single owner of transition and cooldown clock advancement, so transition speed no longer depends on how many `useFlowFrame` consumers are mounted.
- Ensured transitions and cooldown work complete without requiring an R3F `<Canvas>` or any `useFlowFrame` consumer.
- Made `useFlowProgress()` and `useFlow().progress` update continuously (`0` to `1`) during transitions for React and DOM consumers, instead of only syncing at transition completion.
- Kept `useFlowFrame` as a read-only observer of provider-owned transition state; it never advances the machine.
- Corrected root package declaration routing so ESM consumers resolve `dist/index.d.ts` and CommonJS consumers resolve `dist/index.d.cts`, instead of CommonJS consumers silently resolving the ESM declaration file.

### Hardened

- Added packed-tarball consumer smoke checks covering ESM `import`, CommonJS `require`, ESM and CommonJS/NodeNext TypeScript declaration resolution, private internal path rejection, and `"use client"` output on both runtime bundles.
- Added focused supported-peer compatibility validation for React 18.3.1 / React DOM 18.3.1 / `@react-three/fiber` 8.18.0 / three 0.150.1, and React 19.2.7 / React DOM 19.2.7 / `@react-three/fiber` 9.6.1 / three 0.185.1.
- Added regression coverage for provider-owned transition progression, multi-consumer `useFlowFrame` behavior, and aligned `useFlowProgress()` / `useFlow().progress` output.

### Documentation

- Aligned transition progress guidance across the README files and `docs/guides` with the provider-owned, continuously-updating runtime contract.
- Updated maintainer, contributor, and security guidance to describe stable v2 maintenance instead of stale pre-1.0 milestones.

### Scope

- No public API additions or removals are included.
- No new public package subpaths are included.
- No runtime dependencies are added.
- The root-only package export boundary is unchanged; only ESM/CommonJS declaration routing within it was corrected.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.
- No milestone closeout is included in this PR.

## 2.3.0

`r3f-interactive-flow@2.3.0` is a documentation-focused release for the completed user-facing documentation foundation. It records completed guide structure, npm documentation audit, and example README alignment work without changing source behavior, public API, package exports, or dependencies.

### Documentation

- Added the user-facing guides structure under `docs/guides`.
- Added a getting started guide for first-time setup and usage.
- Added a core concepts guide for the phase flow mental model.
- Added an R3F usage guide for Canvas-bound integration patterns.
- Added an input handling guide for wheel, touch, and keyboard usage.
- Added a common mistakes guide for practical integration pitfalls.
- Added a Next.js Client Component usage guide.
- Completed an npm-distributed documentation audit.
- Aligned the `vite-basic` README with the user-facing guides.

### Scope

- No source/runtime behavior changes are included in this PR.
- No public API changes are included in this PR.
- No package export changes are included in this PR.
- No dependency changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

## 2.2.0

`r3f-interactive-flow@2.2.0` is a usage guidance and public API coverage hardening release. It records completed documentation and type-level validation work without changing source behavior, public API, package exports, or dependencies.

### Hardened

- Added type-level coverage for package root public API usage.
- Added focused usage recipes for stable public APIs.
- Improved human- and coding-agent-readable usage guidance.
- Clarified the mental model, supported root imports, hook placement rules, and do / do not boundaries.

### Scope

- No public API changes are included in this PR.
- No dependency changes are included in this PR.
- No package export changes are included in this PR.
- No source behavior changes are included in this PR.
- No npm publish is included in this PR.
- No git tag is included in this PR.
- No GitHub Release is included in this PR.

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
