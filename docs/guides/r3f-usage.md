# React Three Fiber usage

> **Status: placeholder.** This file establishes the v2.3.0 user-facing docs
> structure. The full guide is planned for issue #325.

## What this guide will cover

- Bridging flow state into frame-based updates with `useFlowFrame`.
- Why `useFlowFrame` must be called inside a Canvas-bound component under
  `FlowProvider`.
- Updating refs and Three.js objects in the frame callback instead of routing
  high-frequency values through React state.
- Where the library's R3F responsibility ends: it is a control layer, not a
  visual effects, camera preset, shader, or particle library.

## Import contract

```ts
import { useFlowFrame } from "r3f-interactive-flow";
```

Use package-root imports only.

## For now

Until this guide is filled in, see the "Driving R3F frame updates" and "DOM/UI
to Canvas coordination" sections of the
[package README](../../packages/r3f-interactive-flow/README.md).

See the [guides index](./README.md) for the full reading order.
