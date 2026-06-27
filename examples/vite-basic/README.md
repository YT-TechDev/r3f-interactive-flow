# vite-basic example

## Purpose

This example uses the current stable public API in a small Vite and React Three Fiber app:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`

## What it demonstrates

- Stable phase tuple and transition configuration.
- Optional browser input hooks in a DOM layer outside the Canvas.
- DOM controls using `useFlow`.
- DOM status and progress using `useFlowProgress`.
- Canvas-bound mesh updates using `useFlowFrame`.
- Optional wheel, touch, and keyboard navigation with threshold and cooldown options.
- Ignore selectors for buttons, forms, links, and interactive UI.
- Grouped keyboard `keys.next` / `keys.prev` bindings.
- Keeping R3F frame updates inside Canvas-bound components.

## What it intentionally does not demonstrate

- No visual effects collection.
- No camera preset API.
- No shader API.
- No animation timeline system.
- No router integration.
- No GSAP or Framer Motion integration.
- No portfolio template, website template, or large demo system.

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
