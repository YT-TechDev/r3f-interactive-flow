# User guides

These guides are the user-facing documentation for `r3f-interactive-flow`.

`r3f-interactive-flow` is a small, predictable control layer for phase-based
interactive React Three Fiber websites. It connects user input, scene phases,
transition progress, React state, and React Three Fiber frame-based updates.

The core idea:

- React manages state.
- React Three Fiber manages frame-based visual updates.
- This library bridges both through predictable phase transitions.

## Who these guides are for

- Users who want to install and use the library.
- AI coding agents that need reliable usage guidance.
- Contributors checking expected usage patterns.

## Import contract

All guides use package-root imports only:

```ts
import {
  FlowProvider,
  useFlow,
  useFlowProgress,
  useFlowFrame,
  useWheelInput,
  useTouchInput,
  useKeyboardInput
} from "r3f-interactive-flow";
```

Do not import from internal package paths such as `r3f-interactive-flow/react`,
`r3f-interactive-flow/r3f`, `r3f-interactive-flow/input`,
`r3f-interactive-flow/src/*`, or `r3f-interactive-flow/dist/*`. Those paths are
not public package exports.

## Recommended reading order

1. [Getting started](./getting-started.md) — install the package and render a
   first working flow.
2. [Core concepts](./core-concepts.md) — phases, transitions, progress, and the
   React / R3F split.
3. [React Three Fiber usage](./r3f-usage.md) — the `useFlowFrame` bridge and
   Canvas boundaries.
4. [Input handling](./input-handling.md) — wheel, touch, and keyboard input
   hooks.
5. [Next.js usage](./nextjs-usage.md) — safe Client Component usage in the App
   Router.
6. [Common mistakes](./common-mistakes.md) — patterns to avoid and how to fix
   them.

## Guides

| Guide                                     | Covers                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| [Getting started](./getting-started.md)   | Install, peer dependencies, first phase flow.                              |
| [Core concepts](./core-concepts.md)       | Phases, transitions, progress, locks, cooldowns, reduced-motion ownership. |
| [React Three Fiber usage](./r3f-usage.md) | `useFlowFrame`, Canvas boundaries, frame updates.                          |
| [Input handling](./input-handling.md)     | `useWheelInput`, `useTouchInput`, `useKeyboardInput`.                      |
| [Next.js usage](./nextjs-usage.md)        | Client Component boundaries in the App Router.                             |
| [Common mistakes](./common-mistakes.md)   | Anti-patterns and their fixes.                                             |

## How the documentation is organized

This repository keeps three kinds of documentation separate:

- **User-facing guides** live here in `docs/guides/*`. They explain how to
  install and use the library.
- **npm-distributed docs** are
  [`packages/r3f-interactive-flow/README.md`](../../packages/r3f-interactive-flow/README.md)
  and `packages/r3f-interactive-flow/CHANGELOG.md`. npm users can start from the
  published package README without reading maintainer docs first.
- **Maintainer, release, roadmap, and audit docs** live under their existing
  maintainer-oriented locations such as `docs/releases/*` and the roadmap and
  spec files in `docs/`. These are not usage guides.

If you are consuming the package from npm, start with the package README. If you
are working in this repository or writing usage examples, start with these
guides.
