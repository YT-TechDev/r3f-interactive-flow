# Core concepts

> **Status: placeholder.** This file establishes the v2.3.0 user-facing docs
> structure. The full guide is planned for issue #324.

## What this guide will cover

- Phases as a known, stable list.
- Transitions between phases and transition direction.
- Reading transition progress with `useFlowProgress` for DOM/UI.
- Locks, cooldowns, and predictable navigation.
- The core split: React manages state, React Three Fiber manages frame-based
  visual updates, and this library bridges both through predictable phase
  transitions.

## Import contract

```ts
import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";
```

Use package-root imports only.

## For now

Until this guide is filled in, see the "Mental model" section of the
[package README](../../packages/r3f-interactive-flow/README.md).

See the [guides index](./README.md) for the full reading order.
