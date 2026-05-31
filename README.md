# r3f-interactive-flow

`r3f-interactive-flow` is an open-source React Three Fiber utility library for building phase-based interactive 3D websites.

The v0.1.0 setup currently focuses on the library foundation only:

- pnpm workspace
- package structure under `packages/r3f-interactive-flow`
- TypeScript / tsup / Vitest / ESLint / Prettier setup
- minimal source skeleton for core, React, R3F, and input boundaries

## Public API target

The initial public API is intentionally small:

```ts
import { FlowProvider, useFlow, useFlowProgress, useFlowFrame } from "r3f-interactive-flow";
```

Full flow-machine behavior is not implemented yet in this setup step.

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
