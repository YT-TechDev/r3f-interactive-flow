# v0.2.0 Roadmap: Production-ready flow control foundation

## 1. v0.2.0 theme

**Production-ready flow control foundation.**

v0.2.0 should make `r3f-interactive-flow` reliable as a small flow-control layer for production React Three Fiber experiences. The release should focus on predictable phase changes, well-specified transition progress, dependable input behavior, and clear guidance for connecting DOM UI with Canvas-bound R3F scene updates.

This roadmap is an implementation plan and requirements document. It does not add APIs, source code, dependencies, exports, or runtime behavior by itself.

## 2. v0.2.0 goals

- Stabilize the core flow machine so phase changes are deterministic and easy to test.
- Define transition progress behavior before implementation work begins.
- Make `next`, `prev`, and `goTo` behavior consistent across direct calls and browser input hooks.
- Clarify cooldown, input lock, and `lockDuringTransition` semantics.
- Document expected loop behavior at the first and last phases.
- Improve reliability expectations for wheel, touch, and keyboard navigation.
- Preserve a clean connection model between DOM UI controls and R3F Canvas components.
- Provide practical `useFlowFrame` examples that use refs or mutable frame state instead of pushing frame-driven values into React state every frame.
- Strengthen tests around core transition logic before release.
- Improve README guidance while keeping the library's scope narrow.

## 3. v0.2.0 requirements

### Core flow machine stability

- Phase ordering must be derived from the configured `phases` tuple and remain stable for the lifetime of a provider instance.
- The active phase must always be one of the configured phases.
- Transition state must have explicit source, target, progress, direction, and completion rules.
- Invalid phase targets must be handled predictably and must not leave the machine in a partial transition state.
- Repeated navigation calls during locks, cooldowns, or transitions must have documented outcomes.

### Transition progress behavior

- Progress must be normalized to the `0..1` range for a transition.
- Progress must begin at `0`, complete at `1`, and avoid overshooting.
- Easing behavior must be deterministic and testable.
- Completion must update the current phase exactly once per transition.
- Interrupted, ignored, or queued navigation requests must be explicitly specified before implementation.

### Navigation behavior: `next`, `prev`, and `goTo`

- `next` must target the following phase in the configured order.
- `prev` must target the previous phase in the configured order.
- `goTo` must target the requested configured phase.
- Calls that resolve to the current phase must have a documented no-op behavior.
- Boundary behavior must respect the configured loop policy.
- Navigation methods must share the same lock, cooldown, and transition gating rules regardless of whether they are called from DOM UI, input hooks, or app code.

### Cooldown

- Cooldown must prevent accidental rapid repeated navigation.
- Cooldown start and end timing must be specified relative to accepted navigation and transition completion.
- Cooldown must apply consistently to wheel, touch, keyboard, and direct navigation calls if that is the chosen rule.
- Tests must cover accepted calls, ignored calls, and calls after the cooldown expires.

### Input lock

- Input lock must provide an explicit way to ignore browser input while preserving direct programmatic navigation semantics if that distinction is intended.
- Locked input must not mutate transition progress or phase state.
- Lock state changes must not require remounting Canvas scene components.

### `lockDuringTransition`

- When enabled, navigation requests during an active transition must follow one specified behavior, such as ignore, queue, or restart.
- When disabled, the allowed transition-interruption behavior must be specified and tested.
- The default should favor predictable production behavior over surprising visual effects.

### Loop behavior

- Looping must define `next` from the last phase and `prev` from the first phase.
- Non-looping boundary calls must be documented as no-ops or rejected requests.
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

### Tests for core logic

- Core transition tests should cover initialization, `next`, `prev`, `goTo`, progress completion, lock behavior, cooldown behavior, loop boundaries, and invalid targets.
- Tests should prefer React-independent core logic where possible.
- Browser input tests should focus on event behavior and integration boundaries without coupling DOM input logic to R3F scene logic.

### README improvements

- README changes for v0.2.0 should remain concise and user-facing.
- README examples should align with the limited public API direction.
- README guidance should link to this roadmap while avoiding speculative runtime API documentation.

## 4. Public API policy

The v0.2.0 public API direction is limited to:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`

This roadmap must not be interpreted as approval to add new runtime APIs or exports in v0.2.0. If the current repository already contains exports or README examples beyond this list, those existing artifacts should not be changed by this documentation-only task. Any future API expansion requires a separate design discussion and should not be bundled into the v0.2.0 foundation work.

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

### Milestone 1: Audit current behavior

- Inventory the current provider, hooks, core machine, input hooks, examples, README snippets, and tests.
- Record current behavior for `next`, `prev`, `goTo`, progress updates, loop boundaries, cooldown, and locks.
- Identify behavior that is undocumented, inconsistent, or hard to test.
- Confirm no implementation work starts until the expected behavior is written down.

### Milestone 2: Define transition rules

- Specify transition lifecycle states and their allowed transitions.
- Decide how navigation calls behave during active transitions.
- Define progress timing, easing, completion, cancellation, and same-phase navigation behavior.
- Document default boundary behavior for looped and non-looped flows.

### Milestone 3: Strengthen core tests

- Add or update tests for React-independent transition behavior first.
- Cover initialization, ordered navigation, invalid targets, loop boundaries, progress completion, locks, and cooldown.
- Add regression tests for any behavior discovered during the audit.
- Keep tests focused on stable behavior rather than implementation details.

### Milestone 4: Stabilize lock and cooldown behavior

- Implement the specified cooldown timing model.
- Implement the specified input lock behavior.
- Implement or refine `lockDuringTransition` according to the documented transition rules.
- Verify direct navigation and input-driven navigation use the same gating behavior where required.

### Milestone 5: Improve input reliability

- Review wheel handling for noisy deltas, trackpad bursts, thresholds, and cooldown interactions.
- Review touch handling for swipe thresholds, direction, cancellation, and listener cleanup.
- Review keyboard handling for key mapping, focus behavior, repeated key events, and prevention behavior.
- Ensure input hooks access browser APIs only after mount and clean up listeners on unmount or target changes.

### Milestone 6: Improve examples and README

- Update README examples to match the v0.2.0 public API direction where appropriate.
- Add concise `useFlowFrame` examples that mutate R3F objects through refs.
- Show DOM controls and Canvas components sharing flow state through `FlowProvider`.
- Avoid presenting non-goal features as built-in capabilities.

### Milestone 7: Prepare release checklist

- Confirm behavior requirements are reflected in tests.
- Run all available checks.
- Verify package contents and README guidance.
- Prepare release notes that emphasize the production-ready flow-control foundation and narrow scope.

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
- [ ] Confirm the public API direction remains limited to `FlowProvider`, `useFlow`, `useFlowProgress`, and `useFlowFrame`.
- [ ] Confirm architecture boundaries are documented.
- [ ] Confirm core behavior is specified before implementation starts.
- [ ] Confirm tests cover core transition behavior before release.
- [ ] Confirm input behavior is tested or manually verified where automated coverage is not practical.
- [ ] Confirm README guidance remains concise and aligned with the narrow library scope.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm lint`.

## 9. Maintainer notes

- Treat this roadmap as the source of truth for v0.2.0 implementation sequencing until a more detailed issue tracker exists.
- Prefer small PRs that map to one milestone at a time.
- Keep behavior changes separate from documentation-only updates when possible.
- Avoid widening the public API while stabilizing the foundation.
- Do not add animation, rendering, state-management, styling, or demo-framework dependencies to the core library for this release.
- If an implementation detail conflicts with these boundaries, update the design notes before changing source code.
