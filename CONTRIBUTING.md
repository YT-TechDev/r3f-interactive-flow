# Contributing

Thank you for your interest in contributing to `r3f-interactive-flow`.

This project is a small React Three Fiber utility for predictable phase-based interactive flow control.

## Project scope

Focus on:

- phase management
- transition progress
- `next`, `prev`, and `goTo`
- wheel, touch, and keyboard input
- cooldown / input lock behavior
- DOM/UI to R3F Canvas connection
- `useFrame` bridge for R3F scenes

This project is not:

- a visual effects collection
- a replacement for `@react-three/drei`
- a particle library
- a camera preset library
- a shader effect library
- a portfolio template
- a full animation framework
- a GSAP or Framer Motion wrapper

## Branch policy

Do not work directly on `main`.

Create a focused branch for every change:

```bash
git checkout main
git pull origin main
git checkout -b docs/update-readme
```

Use clear branch names such as:

- `fix/progress-locking`
- `test/add-core-machine-tests`
- `docs/update-readme`
- `chore/update-release-checks`

## Keep PRs small

Prefer small focused PRs.

Avoid mixing unrelated changes such as implementation changes, README rewrites, dependency updates, formatting-only changes, and example changes in the same PR.

## Architecture rules

- `core/` must stay React-independent.
- `react/` contains React Context, Provider, and hooks.
- `r3f/` contains React Three Fiber bridge hooks.
- `input/` contains browser input handling.
- Do not mix DOM input logic into R3F scene logic.
- Do not call R3F hooks such as `useFrame` or `useThree` outside Canvas-bound components.
- Do not put frame-driven values into React state unless there is a clear reason.

## Public API rules

The public API should stay small and predictable.

Current public exports are documented in the README.

Do not remove or rename public exports without maintainer discussion.

Input hooks are currently public convenience hooks and should not be removed silently.

## Dependency rules

Keep dependencies minimal.

The library package should keep these as peer dependencies:

- `react`
- `react-dom`
- `three`
- `@react-three/fiber`

Do not add runtime dependencies without a clear maintainer-approved reason.

Avoid adding the following to the core library:

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

Do not access `window`, `document`, or browser event APIs at module import time.

Browser APIs should only be used inside effects, event handlers, or guarded client-side code.

Do not add Next.js as a dependency.

## Development setup

Use pnpm.

```bash
pnpm install
```

## Verification

Before opening a PR, run as many of these as possible:

```bash
pnpm build
pnpm package:verify
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm --filter vite-basic build
pnpm pack:dry-run
```

For full release readiness:

```bash
pnpm release:check
```

Do not run publishing commands unless you intentionally want to publish:

```bash
pnpm release
changeset publish
npm publish
```

## PR checklist

Before requesting review:

- Keep the branch focused.
- Confirm there are no unrelated file changes.
- Confirm public API changes are intentional and documented.
- Confirm dependencies were not added accidentally.
- Confirm checks were run or clearly marked as not run.
- Explain any failed or skipped checks.

## If something fails

Do not apply broad fixes.

Report:

- the failed command
- the exact error
- the smallest proposed fix
- the files changed

If the failure reveals a larger design or API issue, stop and discuss it before changing architecture.
