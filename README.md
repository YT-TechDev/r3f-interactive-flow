# r3f-interactive-flow

`r3f-interactive-flow` is an open-source React Three Fiber utility library for building phase-based interactive 3D websites.

The v0.1.0 setup currently focuses on the library foundation only:

- pnpm workspace
- package structure under `packages/r3f-interactive-flow`
- TypeScript / tsup / Vitest / ESLint / Prettier setup
- minimal source skeleton for core, React, R3F, and input boundaries

## Public API

The initial public API is intentionally small:

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

## Minimal usage

```tsx
"use client";

import {
  FlowProvider,
  useFlow,
  useWheelInput,
  useTouchInput,
  useKeyboardInput
} from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;

function FlowInputLayer() {
  useWheelInput<(typeof phases)[number]>();
  useTouchInput<(typeof phases)[number]>();
  useKeyboardInput<(typeof phases)[number]>();

  return null;
}

function FlowControlsPanel() {
  const flow = useFlow<(typeof phases)[number]>();

  return (
    <div>
      <p>Current phase: {flow.phase}</p>
      <button onClick={flow.prev}>Prev</button>
      <button onClick={flow.next}>Next</button>
    </div>
  );
}

export function App() {
  return (
    <FlowProvider phases={phases}>
      <FlowInputLayer />
      <FlowControlsPanel />
    </FlowProvider>
  );
}
```

Input hooks must be used inside `FlowProvider`.

`useFlowFrame` uses React Three Fiber's `useFrame`, so it must be used inside a Canvas-bound component.

## Repository structure

```txt
r3f-interactive-flow/
  packages/
    r3f-interactive-flow/
      src/
        core/
        react/
        r3f/
        input/
  examples/
  pnpm-workspace.yaml
  package.json
```

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

## License

MIT
