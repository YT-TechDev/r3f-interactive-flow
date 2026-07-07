# Next.js usage

> **Status: placeholder.** This file establishes the v2.3.0 user-facing docs
> structure. The full guide is planned for issue #328.

## What this guide will cover

- Using `FlowProvider` and the flow hooks safely from Client Components in the
  Next.js App Router.
- Adding `"use client"` to files that render the provider or call these hooks.
- Passing serializable data from Server Components into a Client Component
  wrapper.
- Boundaries: no `FlowProvider` or flow hooks in Server Components, and no
  browser API access at module import time.

The package is Next.js compatible, but not Next.js integrated. Next.js is not a
dependency, and router integration is intentionally out of scope.

## Import contract

```ts
import { FlowProvider, useFlow } from "r3f-interactive-flow";
```

Use package-root imports only.

## For now

Until this guide is filled in, see the "Client usage and Next.js App Router
boundary" section of the
[package README](../../packages/r3f-interactive-flow/README.md).

See the [guides index](./README.md) for the full reading order.
