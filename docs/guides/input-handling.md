# Input handling

> **Status: placeholder.** This file establishes the v2.3.0 user-facing docs
> structure. The full guide is planned for issue #326.

## What this guide will cover

- The optional browser input hooks: `useWheelInput`, `useTouchInput`, and
  `useKeyboardInput`.
- Mounting input hooks from a client-side input layer under `FlowProvider`,
  outside the R3F scene tree by default.
- Thresholds, cooldowns, and `ignore` selectors for regions that should not
  trigger navigation.
- How input hooks drive the existing `next` and `prev` controls and respect
  active transitions, locks, phase boundaries, and cooldowns.

## Import contract

```ts
import { useWheelInput, useTouchInput, useKeyboardInput } from "r3f-interactive-flow";
```

Use package-root imports only.

## For now

Until this guide is filled in, see the "Basic input hooks" section of the
[package README](../../packages/r3f-interactive-flow/README.md).

See the [guides index](./README.md) for the full reading order.
