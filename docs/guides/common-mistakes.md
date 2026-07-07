# Common mistakes

> **Status: placeholder.** This file establishes the v2.3.0 user-facing docs
> structure. The full guide is planned for issue #327.

## What this guide will cover

- Importing from internal paths instead of the package root.
- Pushing every-frame values through React state instead of using
  `useFlowFrame`.
- Calling `useFlowFrame` outside a Canvas-bound component.
- Rendering `FlowProvider` or flow hooks from Server Components.
- Treating the library as a router, animation timeline, camera preset, shader,
  particle, visual-effects, or template system rather than a small control
  layer.

## Import contract

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

Use package-root imports only.

## For now

Until this guide is filled in, see the "Do / do not" and "Non-goals" sections of
the [package README](../../packages/r3f-interactive-flow/README.md).

See the [guides index](./README.md) for the full reading order.
