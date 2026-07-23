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
- Visible Previous, Next, and direct phase buttons are the baseline operation path. Wheel, touch, and configured keyboard shortcuts are optional enhancements, so users do not need gesture or shortcut input to operate the flow.
- First, last, and current phase boundaries use native `disabled` buttons. The current direct phase button also uses visible `(current)` text and `aria-current="step"` so the state is not color-only.
- A visible application-owned discrete phase status uses `role="status"` and reports only the current phase name and index. Transition progress remains in the visual status grid and observer diagnostics, but is not announced as the primary live status.
- The event trace listens for `wheel`, `touchmove`, `touchend`, and `keydown`, captures event type and target immediately, and reads the final `defaultPrevented` value in a queued microtask after synchronous event propagation finishes. It is a labelled diagnostic region and intentionally not a live region.
- Application CSS supplies consistent `:focus-visible` styling for buttons, links, form controls, `contenteditable`, and the focusable nested-scroll region.
- Native actionable and editable controls include a text input, textarea, select, checkbox, regular button, regular anchor, and `contenteditable` region, preserving browser-owned behavior instead of replacing them with custom widgets.
- `data-flow-ignore` is passed to the wheel and touch hooks for the explicit nested-scroll region. The region remains independently scrollable with application-owned nested-scroll CSS and visible guidance that flow buttons remain available outside it. Keyboard input uses the public `keys` and `ignoreWhenTyping` options, so native form typing is preserved without claiming `useKeyboardInput` supports ignore selectors.
- Two independent Canvas-bound `useFlowFrame` observers write read-only frame samples to DOM outputs without React state writes, navigation calls, transition timing changes, or extra clocks.
- The Canvas mount/unmount control removes and restores the Canvas subtree without unmounting `FlowProvider`, leaving DOM phase state and `useFlowProgress` mounted.
- Normal and reduced motion are manual, application-owned modes. The fixture keeps stable application constants for provider transition configuration, using positive-duration normal transitions and representative `duration: 0` reduced transitions with a separate positive provider cooldown.
- Switching modes intentionally changes the provider key, remounts `FlowProvider`, and resets flow state. The key is React remount behavior, not a package API prop, and the fixture visibly describes that reset near the native toggle.
- Canvas scene motion is separately reduced by application code; changing provider duration does not automatically reduce scene, camera, shader, CSS, or other non-flow motion.
- The `duration: 0` reduced-mode choice is one application policy example, not a universal accessibility requirement or a complete reduced-motion policy.
- The layout is mobile-responsive for owner-assisted browser validation, keeps the 860px grid collapse, and adds a narrow target layout so controls can stack without becoming a design system.

## Owner-assisted browser validation results

Issue #379 validation is complete. This fixture was used for desktop browser validation, responsive and touch emulation, and physical mobile validation while consuming `r3f-interactive-flow@2.4.0` from npm rather than a workspace link.

Physical mouse, high-resolution trackpad, keyboard, and iPhone Safari touch evidence passed. The optional physical tablet lane remains unverified because no physical tablet was available. Detailed evidence is stored in [`docs/releases/v2.5.0-real-world-browser-validation-report.md`](../../docs/releases/v2.5.0-real-world-browser-validation-report.md).

## Non-goals

This fixture demonstrates one application pattern. It does not define package UI, prove screen-reader behavior, claim WCAG conformance, claim cross-browser or accessibility certification, make `duration: 0` a universal requirement, or serve as the final public user guide for #393.

This fixture does not add runtime dependencies, workspace links, local tarballs, source-path imports, shaders, particle systems, camera presets, GSAP, Framer Motion, Zustand, routing, release automation, package publishing, tags, or changes to library runtime behavior. It is not a portfolio starter, visual-effects package, browser certification suite, accessibility certification suite, complete reduced-motion policy, or full accessibility solution.
