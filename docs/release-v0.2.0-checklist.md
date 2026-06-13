# v0.2.0 Release Readiness Checklist

## Purpose

Use this checklist for the final maintainer pass before publishing `r3f-interactive-flow` v0.2.0.

v0.2.0 is a stabilization release for the existing phase-based flow-control foundation. This checklist is documentation-only and must not be used as approval to change runtime behavior, package versions, public API, exports, dependencies, or release automation.

Do not publish from this checklist alone. Complete the checks, prepare release notes, and perform the actual release only through the repository's normal maintainer release process.

## 1. Public API confirmation

Confirm the package entry point still exposes only the intended small API surface for v0.2.0:

- [ ] `FlowProvider`
- [ ] `useFlow`
- [ ] `useFlowProgress`
- [ ] `useFlowFrame`
- [ ] `useWheelInput`
- [ ] `useTouchInput`
- [ ] `useKeyboardInput`
- [ ] `UseWheelInputOptions`
- [ ] `UseTouchInputOptions`
- [ ] `UseKeyboardInputOptions`

Before release, verify that:

- [ ] No accidental new runtime exports were added.
- [ ] No accidental new type exports were added.
- [ ] Private test utilities remain private and are not exported from the package entry point.
- [ ] The public API remains aligned with the README and v0.2.0 behavior docs.

## 2. Scope confirmation

Confirm v0.2.0 remains a foundation-stabilization release, not a feature-expansion release.

The release must not add:

- [ ] Particle APIs.
- [ ] Camera presets.
- [ ] Shader effects.
- [ ] Animation timelines.
- [ ] Router integration.
- [ ] GSAP wrappers.
- [ ] Framer Motion wrappers.
- [ ] Heavy runtime dependencies.
- [ ] Queue, restart, interrupt, or retarget transition behavior.
- [ ] Public source-phase or target-phase fields.

## 3. Behavior confirmation

Confirm the documented v0.2.0 behavior remains implemented and covered:

- [ ] Accepted navigation publishes the destination phase at transition start.
- [ ] Transition progress remains normalized to `0..1`.
- [ ] Navigation while transitioning is ignored.
- [ ] Boundary navigation remains a no-op: first-phase `prev` and last-phase `next` do not loop.
- [ ] Invalid `goTo` targets throw predictably and do not mutate state.
- [ ] Cooldown behavior is documented and covered.
- [ ] Lock behavior is documented and covered.
- [ ] No `lockDuringTransition` option exists in v0.2.0.
- [ ] No loop behavior exists in v0.2.0.
- [ ] Ignored navigation does not queue, restart, interrupt, retarget, mutate state, or extend cooldown.

## 4. React and R3F responsibility confirmation

Confirm documentation and examples preserve the intended responsibility split:

- [ ] React snapshot state from `useFlow` is presented as DOM/UI/coarse application state.
- [ ] `useFlowProgress` is presented as DOM-facing progress, not a frame-perfect animation channel.
- [ ] `useFlowFrame` is presented as the Canvas-bound bridge for frame-driven visual updates.
- [ ] React state is not recommended for every-frame visual updates.
- [ ] Frame-driven visual updates use refs or mutable Three.js/R3F state where appropriate.
- [ ] R3F hooks are not called outside Canvas-bound components.
- [ ] DOM controls and Canvas scene components share flow state through `FlowProvider`, not ad hoc globals.

## 5. Input hook confirmation

Confirm the browser input hooks remain thin adapters to flow controls:

- [ ] Wheel input maps accepted wheel gestures to flow navigation.
- [ ] Touch input maps accepted swipe gestures to flow navigation.
- [ ] Keyboard input maps configured keys to flow navigation.
- [ ] Input hooks delegate cooldown and transition gating to the flow controls/core machine.
- [ ] Browser APIs are not accessed at module import time.
- [ ] Event listener setup and cleanup remain covered by tests.
- [ ] Disabled, locked, transitioning, and cleanup behavior remain covered by tests.

## 6. Test and validation commands

Run these checks before publishing and record the exact results in the release notes or release PR:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm lint
pnpm format
pnpm package:verify
pnpm --filter vite-basic build
pnpm pack:dry-run
```

Notes for maintainers:

- [ ] `pnpm package:verify` should run after `pnpm build` so package output exists.
- [ ] `pnpm pack:dry-run` must remain a dry run only; do not publish during readiness validation.
- [ ] If any command is skipped, document why it was skipped.
- [ ] Do not claim a command passed unless it was actually run.

## 7. Package output confirmation

Confirm package output and package metadata are release-ready:

- [ ] ESM output exists at the configured package export path.
- [ ] CJS output exists at the configured package export path.
- [ ] DTS output exists at the configured package export path.
- [ ] `package.json` `exports` point to the built ESM, CJS, and DTS files.
- [ ] The package `files` list includes only expected publish artifacts.
- [ ] The required `"use client"` directive is preserved near the top of built client entry output.
- [ ] Private test utilities are not included as public exports.
- [ ] Peer dependencies remain correct for React, React DOM, Three.js, and React Three Fiber.
- [ ] No new runtime dependency was added for v0.2.0.

## 8. Example confirmation

Confirm the Vite basic example still demonstrates focused usage:

- [ ] `pnpm --filter vite-basic build` passes.
- [ ] The example uses the small public API surface.
- [ ] The example demonstrates practical phase navigation and progress usage.
- [ ] The example does not imply built-in particle systems, camera preset systems, shader effect systems, timelines, router integration, or animation-framework wrappers.
- [ ] The example keeps DOM/UI usage separate from Canvas-bound frame updates where applicable.

## 9. Documentation confirmation

Confirm the user-facing docs are aligned for v0.2.0:

- [ ] README install instructions are current.
- [ ] README usage examples match the public API.
- [ ] README explains the library's non-goals.
- [ ] README guidance distinguishes DOM progress from frame-driven `useFlowFrame` progress.
- [ ] `docs/behavior-v0.2.0.md` reflects current behavior.
- [ ] `docs/transition-lifecycle-v0.2.0.md` reflects intended v0.2.0 lifecycle rules.
- [ ] `docs/roadmap-v0.2.0.md` links to this checklist for the final release pass.
- [ ] Docs do not describe non-existent v0.2.0 features as available behavior.

## 10. Release notes preparation

Prepare release notes that summarize the stabilization work without implying a major API expansion:

- [ ] Summarize core lifecycle regression coverage improvements.
- [ ] Summarize React provider and hook coverage improvements.
- [ ] Summarize `useFlowFrame` bridge coverage improvements.
- [ ] Summarize wheel, touch, and keyboard input hook coverage improvements.
- [ ] Summarize shared private input test utilities while noting they are not public API.
- [ ] Summarize README/docs clarifications, especially DOM progress versus frame-driven `useFlowFrame` progress.
- [ ] Summarize cooldown and input behavior stabilization.
- [ ] Explicitly mention that v0.2.0 does not include a major public API expansion.
- [ ] Mention that no particle, camera preset, shader effect, timeline, router, GSAP, or Framer Motion integration features were added.

## 11. Final maintainer sign-off

Before publishing, confirm:

- [ ] No package versions were changed outside the approved release process.
- [ ] No changeset was added unless the repository's release process explicitly requires it.
- [ ] No release command has been run during readiness validation.
- [ ] The release notes are ready for human review.
- [ ] A maintainer has reviewed the final package diff and validation output.
- [ ] The actual publish step will be run separately by an authorized maintainer.
