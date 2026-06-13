# v0.2.0 Roadmap: Production-ready flow control foundation

## 1. v0.2.0 theme

**Production-ready flow control foundation.**

v0.2.0 should make `r3f-interactive-flow` reliable as a small flow-control layer for production React Three Fiber experiences. The release should focus on predictable phase changes, well-specified transition progress, dependable input behavior, and clear guidance for connecting DOM UI with Canvas-bound R3F scene updates.

This roadmap is an implementation plan and requirements document. It does not add APIs, source code, dependencies, exports, or runtime behavior by itself.

## 2. v0.2.0 goals

- Stabilize the core flow machine so phase changes are deterministic and easy to test.
- Define transition progress behavior before implementation work begins.
- Make `next`, `prev`, and `goTo` behavior consistent across direct calls and browser input hooks.
- Clarify cooldown and input lock semantics, and document the built-in transition gate without adding a `lockDuringTransition` API.
- Document non-looping boundary behavior at the first and last phases.
- Improve reliability expectations for wheel, touch, and keyboard navigation.
- Preserve a clean connection model between DOM UI controls and R3F Canvas components.
- Provide practical `useFlowFrame` examples that use refs or mutable frame state instead of pushing frame-driven values into React state every frame.
- Preserve strengthened tests around core transition logic before release.
- Improve README guidance while keeping the library's scope narrow.

## 3. v0.2.0 requirements

### Core flow machine stability

- Phase ordering must be derived from the configured `phases` tuple and remain stable for the lifetime of a provider instance.
- The active phase must always be one of the configured phases.
- Transition state must have explicit progress, direction, and completion rules using the current public snapshot shape.
- Invalid phase targets must be handled predictably and must not leave the machine in a partial transition state.
- Repeated navigation calls during locks, cooldowns, or transitions must have documented outcomes.

### Transition progress behavior

- Progress must be normalized to the `0..1` range for a transition.
- Progress must begin at `0`, complete at `1`, and avoid overshooting.
- Easing behavior must be deterministic and testable.
- Completion must update the current phase exactly once per transition.
- Ignored navigation requests must be explicitly specified; queues, restarts, interrupts, and retargeting remain out of scope for v0.2.0.

### Navigation behavior: `next`, `prev`, and `goTo`

- `next` must target the following phase in the configured order.
- `prev` must target the previous phase in the configured order.
- `goTo` must target the requested configured phase.
- Calls that resolve to the current phase must have a documented no-op behavior.
- Boundary behavior must remain documented as non-looping no-ops unless a separate future design adds a loop option.
- Navigation methods must share the same lock, cooldown, and transition gating rules regardless of whether they are called from DOM UI, input hooks, or app code.

### Cooldown

- Cooldown must prevent accidental rapid repeated navigation without broadening the public API beyond the separately approved v0.2.0 surface.
- The cooldown option is owned by the core machine as the authoritative cooldown gate; `FlowProvider` delegates to the core machine, and browser input hooks do not maintain independent cooldown timers.
- Cooldown must start on accepted navigation, not on transition completion. Completion must not restart or extend cooldown.
- Cooldown must apply consistently to wheel, touch, keyboard, provider controls, and direct `next`, `prev`, and valid `goTo` calls.
- Navigation attempted during cooldown must be ignored without queuing, interrupting, restarting, retargeting, mutating state, or extending the cooldown.
- Navigation attempted while locked or transitioning must keep the existing conservative outcome: valid navigation is ignored, active transitions continue to completion, and no new cooldown window starts.
- Tests must cover accepted calls, ignored calls during cooldown, ignored calls while locked, ignored calls during transitions, and calls after both transition and cooldown gates are open.

### Input lock

- Input lock must provide an explicit way to ignore browser input while preserving direct programmatic navigation semantics if that distinction is intended.
- Locked input must not mutate transition progress or phase state.
- Lock state changes must not require remounting Canvas scene components.

### Transition gating

- Navigation requests during an active transition are ignored by the current core machine.
- v0.2.0 should preserve this conservative behavior without adding queues, restarts, interrupts, retargeting, or a `lockDuringTransition` option.
- The default should favor predictable production behavior over surprising visual effects.

### Boundary behavior

- The current v0.2.0 scope does not add loop behavior.
- First-phase `prev` and last-phase `next` calls are documented no-ops.
- Boundary behavior must be identical for direct calls and browser input hooks.

### Wheel, touch, and keyboard input reliability

- Wheel input should account for noisy deltas and trackpad bursts.
- Touch input should define swipe direction, minimum distance, and cancellation behavior.
- Keyboard input should define default keys, focus considerations, repeat-key behavior, and prevention behavior.
- Browser event listeners must be attached and removed predictably.
- Browser APIs must not be accessed at module import time.

### DOM UI to R3F Canvas connection

- DOM UI should call `useFlow` from inside `FlowProvider` and should not need to know about R3F internals.
- Canvas-bound scene components should use R3F bridge hooks such as `useFlowFrame` inside the Canvas tree.
- Shared flow state should come from provider context rather than ad hoc global state.
- Frame-driven values should use refs or mutable frame state where appropriate.

### `useFlowFrame` examples

- Examples should demonstrate Canvas-bound usage only.
- Examples should mutate Three.js objects through refs in `useFrame` callbacks.
- Examples should avoid setting React state every frame for visual-only values.
- Examples should show how DOM controls and Canvas animation can be connected through the shared flow provider.

### Tests for core, React, R3F, and input behavior

- Core transition tests cover initialization, `next`, `prev`, `goTo`, progress completion, lock behavior, cooldown behavior, non-looping boundaries, and invalid targets.
- React provider and hook tests cover mounted provider behavior, `useFlow`, `useFlowProgress`, and outside-provider errors.
- R3F bridge tests cover `useFlowFrame` frame updates, callback arguments, latest-callback behavior, completion sync, and outside-provider errors.
- Browser input tests cover wheel, touch, and keyboard event behavior and integration boundaries without coupling DOM input logic to R3F scene logic.
- Input hook tests use shared private test utilities for minimal DOM setup and provider rendering; those utilities are not public API.

### README improvements

- README changes for v0.2.0 should remain concise and user-facing.
- README examples should align with the limited public API direction.
- README guidance should link to this roadmap while avoiding speculative runtime API documentation.

## 4. Public API policy

The v0.2.0 public API direction remains intentionally small and is limited to the existing flow, R3F bridge, and input hooks:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`

The input hook option types are also exported as supporting TypeScript types for the existing input hooks:

- `UseWheelInputOptions`
- `UseTouchInputOptions`
- `UseKeyboardInputOptions`

This roadmap must not be interpreted as approval to add new runtime APIs or exports in v0.2.0. Any future API expansion requires a separate design discussion and should not be bundled into the v0.2.0 foundation work.

## 5. Architecture boundaries

The implementation should keep these responsibility boundaries clear:

```txt
core/
  React-independent phase machine, easing, and types

react/
  FlowProvider, context, and React hooks

r3f/
  React Three Fiber bridge hooks

input/
  browser input hooks for wheel, touch, and keyboard
```

Architecture rules:

- `core/` must not import React.
- `core/` must not import React Three Fiber.
- `core/` must not access browser APIs.
- DOM input logic must not live in R3F scene logic.
- R3F hooks such as `useFrame` must only be used inside Canvas-bound components.
- Browser APIs such as `window` and `document` must not be accessed at module import time.
- Frame-driven values should not be pushed into React state every frame.
- Use refs or mutable frame state where appropriate.

## 6. Implementation milestones

### Milestone 1: Audit current behavior — complete

The current behavior audit and intended v0.2.0 rules are documented in [docs/behavior-v0.2.0.md](behavior-v0.2.0.md).

- Inventory the current provider, hooks, core machine, input hooks, examples, README snippets, and tests.
- Record current behavior for `next`, `prev`, `goTo`, progress updates, loop boundaries, cooldown, and locks.
- Identify behavior that is undocumented, inconsistent, or hard to test.
- Confirm no implementation work starts until the expected behavior is written down.
- Current status: documented in the behavior audit.

### Milestone 2: Define transition rules — complete

- Specify transition lifecycle states and their allowed transitions.
- Decide how navigation calls behave during active transitions.
- Define progress timing, easing, completion, cancellation, and same-phase navigation behavior.
- Document default non-looping boundary behavior.
- Current status: transition lifecycle rules are documented for the v0.2.0 scope.

### Milestone 3: Strengthen core tests — complete

- Add or update tests for React-independent transition behavior first.
- Cover initialization, ordered navigation, invalid targets, non-looping boundaries, progress completion, locks, and cooldown.
- Add regression tests for any behavior discovered during the audit.
- Keep tests focused on stable behavior rather than implementation details.
- Current status: core lifecycle and gating behavior has direct regression coverage.

### Milestone 4: Stabilize lock and cooldown behavior — complete

- Implement the specified cooldown timing model without adding queues, restarts, interrupts, retargeting, or loop behavior.
- Keep cooldown gating centralized in the core machine so direct navigation and input-driven navigation remain consistent.
- Implement the specified input lock behavior.
- Preserve the built-in transition gate without adding `lockDuringTransition`, queues, restarts, interrupts, or retargeting.
- Verify direct navigation and input-driven navigation use the same gating behavior where required.
- Current status: lock and cooldown behavior is covered in core tests, with hook tests covering lock and transition gates at input boundaries.

### Milestone 5: Improve input reliability — covered by current hook tests

- Review wheel handling for noisy deltas, trackpad bursts, thresholds, and cooldown interactions.
- Review touch handling for swipe thresholds, direction, cancellation, and listener cleanup.
- Review keyboard handling for key mapping, focus behavior, repeated key events, and prevention behavior.
- Ensure input hooks access browser APIs only after mount and clean up listeners on unmount or target changes.
- Current status: wheel, touch, and keyboard hook tests cover listener lifecycle, targets, thresholds/keys, prevention behavior, disabled state, lock/transition gating, and import-time browser guards.

### Milestone 6: Improve examples and README — docs clarified

- Update README examples to match the v0.2.0 public API direction where appropriate.
- Add concise `useFlowFrame` examples that mutate R3F objects through refs.
- Show DOM controls and Canvas components sharing flow state through `FlowProvider`.
- Avoid presenting non-goal features as built-in capabilities.
- Current status: DOM progress versus frame progress expectations are clarified in README and lifecycle documentation; keep future examples aligned with that distinction.

### Milestone 7: Prepare release checklist — remaining release pass

- Confirm behavior requirements are reflected in tests.
- Run all available checks.
- Verify package contents and README guidance.
- Prepare release notes that emphasize the production-ready flow-control foundation and narrow scope.
- Remaining status: run and record final release checks, including package verification and the Vite example build.

## 7. Non-goals

v0.2.0 does not include:

- Particle morph APIs.
- Camera presets.
- Shader effects.
- GSAP integration.
- Framer Motion integration.
- Next.js router integration.
- Visual editor.
- Timeline system.
- Large demo templates.
- Adding `@react-three/drei` to the core library.
- Adding `zustand` to the core library.
- Adding `gsap` to the core library.
- Adding `framer-motion` to the core library.
- Adding `leva` to the core library.
- Adding `tailwindcss` to the core library.
- Adding `storybook` to the core library.

These items may be explored separately in future releases or external examples, but they are outside the v0.2.0 foundation scope.

## 8. Release checklist

- [ ] Confirm the docs-only roadmap PR does not change source code.
- [ ] Confirm no dependencies were added.
- [ ] Confirm package configuration was not changed unless needed only for documentation linking.
- [ ] Confirm the public API direction remains limited to the existing flow, R3F bridge, and input hook exports documented in the Public API policy.
- [ ] Confirm architecture boundaries are documented.
- [ ] Confirm core behavior is specified before implementation starts.
- [x] Confirm tests cover core transition behavior before release.
- [x] Confirm wheel, touch, and keyboard input hook behavior has direct test coverage for current v0.2.0 scope.
- [ ] Confirm README guidance remains concise and aligned with the narrow library scope.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm format`.
- [ ] Run `pnpm package:verify`.
- [ ] Run `pnpm --filter vite-basic build`.
- [ ] Run `pnpm pack:dry-run`.

## 9. Maintainer notes

- Treat this roadmap as the source of truth for v0.2.0 implementation sequencing until a more detailed issue tracker exists.
- Prefer small PRs that map to one milestone at a time.
- Keep behavior changes separate from documentation-only updates when possible.
- Avoid widening the public API while stabilizing the foundation.
- Do not add animation, rendering, state-management, styling, or demo-framework dependencies to the core library for this release.
- If an implementation detail conflicts with these boundaries, update the design notes before changing source code.
