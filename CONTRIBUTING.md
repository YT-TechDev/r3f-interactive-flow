# Contributing

Thank you for your interest in `r3f-interactive-flow`.

This project is currently focused on stabilizing the v0.2.0 foundation.

## Project scope

In scope:

- phase management
- transition progress
- `next`, `prev`, and `goTo`
- wheel, touch, and keyboard input
- cooldown and input lock behavior
- `lockDuringTransition`
- DOM/UI to R3F Canvas connection
- `useFlowFrame`
- TypeScript safety
- tests
- documentation and small examples

Out of scope:

- particle APIs
- camera presets
- shader effects
- animation timelines
- GSAP integration
- Framer Motion integration
- router integration
- large demo templates
- full website templates

## Branch policy

Do not work directly on `main`.

Use a focused branch for each change, with names such as:

- `fix/progress-locking`
- `test/add-core-machine-tests`
- `docs/update-readme`
- `chore/update-release-checks`

## Development

Use pnpm.

```bash
pnpm install
pnpm build
pnpm package:verify
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm --filter vite-basic build
pnpm pack:dry-run
```

Before release-related work, run:

```bash
pnpm release:check
```

Do not run publishing commands unless you intentionally want to publish:

```bash
pnpm release
changeset publish
npm publish
```

## Pull requests

Please keep PRs small and focused.

Good PRs:

- fix a cooldown edge case
- add core flow machine tests
- improve input handling behavior
- clarify README usage
- improve TypeScript types
- fix package output issues

Avoid:

- broad rewrites
- new runtime dependencies
- large demo templates
- new public APIs without prior discussion
- visual effect collections
- camera/shader/particle/timeline features

Before requesting review:

- confirm there are no unrelated file changes
- confirm public API changes are intentional and documented
- confirm dependencies were not added accidentally
- list checks run, failed, or skipped

## Architecture rules

- `core/` must stay React-independent.
- `react/` contains React Context, Provider, and hooks.
- `r3f/` contains React Three Fiber bridge hooks.
- `input/` contains browser input handling.
- Do not mix DOM input logic into R3F scene logic.
- Do not call R3F hooks such as `useFrame` or `useThree` outside Canvas-bound components.
- Do not put frame-driven values into React state unless there is a clear reason.

## Public API changes

The public API should stay small and predictable.

Current public exports are documented in the README. Do not remove, rename, add, or otherwise expand public exports without explaining:

- the problem being solved
- why userland code cannot solve it
- the impact on README examples
- the impact on package exports
- the impact on TypeScript types

Input hooks are public convenience hooks and should not be removed silently.

## Dependencies

The core package should keep dependencies minimal.

Do not add runtime dependencies unless the change has been discussed first.

The library package should keep these as peer dependencies:

- `react`
- `react-dom`
- `three`
- `@react-three/fiber`

Avoid adding these to the core library:

- `@react-three/drei`
- `zustand`
- `gsap`
- `framer-motion`
- `leva`
- `tailwindcss`
- `storybook`
- `react-spring`
- `next`

## Next.js compatibility

Client-facing React/R3F entry files should be safe for Next.js App Router Client Components.

Do not access `window`, `document`, or browser event APIs at module import time. Use browser APIs inside effects, event handlers, or guarded client-side code.

Do not add Next.js as a dependency.

## If something fails

Do not apply broad fixes.

Report:

- the failed command
- the exact error
- the smallest proposed fix
- the files changed

If the failure reveals a larger design or API issue, stop and discuss it before changing architecture.
