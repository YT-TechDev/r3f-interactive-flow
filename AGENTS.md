# Agent guidance

This repository contains `r3f-interactive-flow`, a small React Three Fiber utility for phase-based interactive 3D websites.

## General workflow

- Prefer small PR-sized changes.
- Start with tests for behavior changes when practical.
- Do not broaden the public API casually.
- Do not add runtime dependencies without strong justification.
- Do not rewrite unrelated files.
- Do not modify release automation unless explicitly asked.
- Do not publish packages, create tags, or create GitHub releases.
- Always report which checks were run and whether they passed.
- If a script does not exist, say so clearly.
- If checks cannot be run, explain why.
- Preserve the existing docs tone: practical, direct, and implementation-focused.

## v0.4.0 direction

The next planned release is `v0.4.0 - Input, transition, and test hardening`.

v0.4.0 should stabilize the existing phase flow foundation by improving input reliability, transition lifecycle behavior, cooldown and locking behavior, and test coverage. It is not a feature-expansion release.

For planning details, see `docs/roadmap-v0.4.0.md`.

## Architecture boundaries

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
- Avoid broad rewrites and unrelated file changes.

## v0.4.0 non-goals

- No visual effects collection, particle API, camera preset API, shader effect API, or animation timeline system.
- No GSAP, Framer Motion, or router integration.
- No large demo or template work.
- No unnecessary public API expansion.
- No new runtime dependencies unless separately justified.
- No release automation changes unless explicitly requested.
- No npm publishing, GitHub release creation, or tag creation.

## Public API guidance

Keep the public API centered on:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`

Public types should be exported intentionally, not incidentally. Do not add new public APIs for v0.4.0 unless a separate issue explicitly approves the change.
