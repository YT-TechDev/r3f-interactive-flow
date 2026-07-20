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
pnpm preview
```

From the repository root, the network-backed verification command is:

```sh
pnpm consumer:published:verify
```

That root command copies this consumer to a temporary directory outside the repository, installs fresh dependencies, verifies that `r3f-interactive-flow` resolves to npm version `2.4.0` instead of a local workspace path, then runs the production build.

The consumer also includes a local `pnpm-workspace.yaml` with only `allowBuilds.esbuild` enabled. That narrow pnpm 11 policy makes the standalone Vite install self-contained without inheriting the repository workspace package or permitting arbitrary dependency lifecycle scripts.

## Validation surfaces

- Public API coverage: `FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, `useWheelInput`, `useTouchInput`, and `useKeyboardInput`.
- DOM and input logic remain outside Canvas; `useFlowFrame` is used only by Canvas-bound observer components.
- Native actionable controls include a text input, textarea, select, checkbox, regular button, and regular anchor outside the broad ignored region.
- A separate `data-flow-ignore` nested scroll region has constrained height and enough content to scroll independently.
- Normal and reduced motion are application-owned modes. Switching modes intentionally changes the provider key, remounts `FlowProvider`, and resets flow state; this does not claim a complete library-level reduced-motion policy.
- The Canvas mount/unmount control removes and restores the Canvas subtree without unmounting `FlowProvider`, leaving DOM phase state and `useFlowProgress` mounted.
- The layout is mobile-responsive for browser validation.

Issue #379 is responsible for browser-level validation against this surface.

## Non-goals

This fixture does not add runtime dependencies, workspace links, local tarballs, source-path imports, shaders, particle systems, camera presets, GSAP, Framer Motion, Zustand, routing, release automation, package publishing, tags, or changes to library runtime behavior.
