# Getting started

> **Status: placeholder.** This file establishes the v2.3.0 user-facing docs
> structure. The full guide is planned for issue #323.

## What this guide will cover

- Installing `r3f-interactive-flow` and its peer dependencies.
- Wrapping an app with `FlowProvider` and a stable `as const` phase tuple.
- Reading the current phase with `useFlow` and moving between phases with
  `next`, `prev`, and `goTo`.
- A minimal first working example using package-root imports only.

## Import contract

```ts
import { FlowProvider, useFlow } from "r3f-interactive-flow";
```

Use package-root imports only. Do not import from internal paths such as
`r3f-interactive-flow/react` or `r3f-interactive-flow/src/*`.

## For now

Until this guide is filled in, follow the "Installation" and "Basic usage"
sections of the
[package README](../../packages/r3f-interactive-flow/README.md).

See the [guides index](./README.md) for the full reading order.
