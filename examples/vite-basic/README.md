# vite-basic example

## Purpose

This example demonstrates the current stable public API for a small Vite and React Three Fiber app:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`
- `useWheelInput`
- `useTouchInput`
- `useKeyboardInput`

## What it demonstrates

- Stable phase tuple and transition configuration.
- DOM input layer outside the Canvas.
- DOM controls using `useFlow`.
- DOM status and progress using `useFlowProgress`.
- Canvas-bound mesh updates using `useFlowFrame`.
- Wheel, touch, and keyboard navigation.
- Ignore selectors for buttons, forms, links, and interactive UI.
- Keeping R3F frame updates inside Canvas-bound components.

## What it intentionally does not demonstrate

- No visual effects collection.
- No camera preset API.
- No shader API.
- No animation timeline system.
- No router integration.
- No GSAP or Framer Motion integration.
- No large template or demo system.

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
- Input hooks attach browser listeners inside effects and should stay in DOM/client components.
