# vite-basic example

## Purpose

This is a small Vite and React Three Fiber usage example for `r3f-interactive-flow`. It shows how the package README and user guides translate into a runnable app without turning the example into a docs site, framework integration, or template system.

For package-level API details, see the [package README](../../packages/r3f-interactive-flow/README.md).

## What this example demonstrates

- `FlowProvider` setup with a stable phase tuple and transition cooldown configuration.
- `useFlow` for DOM controls that move to the previous, next, or selected phase.
- `useFlowProgress` for DOM UI that displays stable flow state and progress snapshots.
- `useFlowFrame` for Canvas-bound mesh updates that follow React Three Fiber hook rules.
- Optional `useWheelInput`, `useTouchInput`, and `useKeyboardInput` helpers in a DOM input layer outside the Canvas.
- Input thresholds, cooldowns, ignore selectors, and grouped keyboard `keys.next` / `keys.prev` bindings.

## What it intentionally does not demonstrate

- No docs site or documentation framework.
- No framework integration beyond this Vite/R3F example.
- No visual effects collection, camera preset API, shader API, particle system, or animation timeline system.
- No router integration.
- No GSAP or Framer Motion integration.
- No portfolio template, website template, code generation, or large demo system.
- No Next.js-specific behavior.

## Related guides

- [Getting started](../../docs/guides/getting-started.md) explains the basic package setup that this example uses.
- [Core concepts](../../docs/guides/core-concepts.md) covers phases, transitions, progress, and flow state.
- [R3F usage](../../docs/guides/r3f-usage.md) explains why `useFlowFrame` belongs inside Canvas-bound components.
- [Input handling](../../docs/guides/input-handling.md) covers the optional wheel, touch, and keyboard hooks used by this example.
- [Common mistakes](../../docs/guides/common-mistakes.md) lists the boundaries this example follows, including keeping DOM input logic out of R3F scene logic.
- [Next.js usage](../../docs/guides/nextjs-usage.md) is separate boundary guidance for Next.js projects and is not required for this Vite example.

## Run commands

From the repository root:

```bash
pnpm install
pnpm --filter vite-basic dev
```

## Build command

From the repository root:

```bash
pnpm --filter vite-basic build
```

## Notes

- `useFlowFrame` must stay inside components rendered within `Canvas`.
- DOM/UI should use `useFlow` or `useFlowProgress`, not per-frame React state.
- Input hooks are optional. They attach browser listeners inside effects and should stay in DOM/client components, outside Canvas scene logic.
