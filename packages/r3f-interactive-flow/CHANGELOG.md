# r3f-interactive-flow

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
