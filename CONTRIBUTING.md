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

## Public API changes

The public API should stay small and predictable.

Do not add or rename public exports without explaining:

- the problem being solved
- why userland code cannot solve it
- the impact on README examples
- the impact on package exports
- the impact on TypeScript types

## Dependencies

The core package should keep dependencies minimal.

Do not add runtime dependencies unless the change has been discussed first.
