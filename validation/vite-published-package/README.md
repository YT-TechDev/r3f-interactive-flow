# Published package usage validation

This standalone Vite + React Three Fiber consumer validates the published npm package lane for `r3f-interactive-flow@2.4.0`. It is a real consumer fixture, not a template.

## Purpose

The app exercises the public API through package-root imports from `"r3f-interactive-flow"` only. It intentionally lives at `validation/vite-published-package/`, outside the root pnpm workspace package patterns, so installs cannot resolve the local workspace package through `workspace:*` linking.

## Commands

From this directory after a standalone install:

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview --host 127.0.0.1
```

From the repository root, the network-backed verification command is:

```sh
pnpm consumer:published:verify
```

That root command copies this consumer to a temporary directory outside the repository, installs fresh dependencies, verifies that `r3f-interactive-flow` resolves to npm version `2.4.0` instead of a local workspace path, then runs the production build.

The consumer also includes a local `pnpm-workspace.yaml` with only `allowBuilds.esbuild` enabled. That narrow pnpm 11 policy makes the standalone Vite install self-contained without inheriting the repository workspace package or permitting arbitrary dependency lifecycle scripts.

## Validation surfaces

- Public API coverage: `FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, `useWheelInput`, `useTouchInput`, and `useKeyboardInput` from the package root.
- Lock/unlock controls call the existing `useFlow()` `lock()` and `unlock()` controls and display `isLocked` status.
- A visible input-target toggle switches between normal window input and an explicit unresolved `useRef<HTMLElement>(null)` target passed to wheel, touch, and keyboard hooks.
- The event trace listens for `wheel`, `touchmove`, `touchend`, and `keydown`, captures event type and target immediately, and reads the final `defaultPrevented` value in a queued microtask after synchronous event propagation finishes.
- Native actionable and editable controls include a text input, textarea, select, checkbox, regular button, regular anchor, and `contenteditable` region.
- `data-flow-ignore` is passed to the wheel and touch hooks for the explicit nested-scroll region. Keyboard input uses the public `keys` and `ignoreWhenTyping` options, so native form typing is preserved without claiming `useKeyboardInput` supports ignore selectors.
- Two independent Canvas-bound `useFlowFrame` observers write read-only frame samples to DOM outputs without React state writes, navigation calls, transition timing changes, or extra clocks.
- The Canvas mount/unmount control removes and restores the Canvas subtree without unmounting `FlowProvider`, leaving DOM phase state and `useFlowProgress` mounted.
- Normal and reduced motion are application-owned modes. Switching modes intentionally changes the provider key, remounts `FlowProvider`, and resets flow state; this does not claim a complete library-level reduced-motion policy.
- The layout is mobile-responsive for owner-assisted browser validation.

## Owner-assisted browser validation purpose

Issue #379 uses this fixture to collect browser and device evidence. Synthetic input can support acceptance and `defaultPrevented` checks, but it is not physical mouse, trackpad, keyboard, or touch evidence. Owner-assisted physical-device results should be recorded in the validation report before the PR is merged.

## Non-goals

This fixture does not add runtime dependencies, workspace links, local tarballs, source-path imports, shaders, particle systems, camera presets, GSAP, Framer Motion, Zustand, routing, release automation, package publishing, tags, or changes to library runtime behavior. It is not a portfolio starter, visual-effects package, browser certification suite, or full accessibility solution.
