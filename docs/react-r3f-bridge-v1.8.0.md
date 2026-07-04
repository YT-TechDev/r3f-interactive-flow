# React and R3F bridge baseline for v1.8.0

This document records the React and React Three Fiber bridge behavior baseline confirmed for v1.8.0 after React/R3F hardening. It is documentation-only: it does not add runtime features, expand the public API, add dependencies, introduce Next.js router integration, or add visual effects, animation timelines, camera presets, templates, or third-party animation wrappers.

The baseline applies to the existing React provider and hooks used to share one flow machine between DOM/client UI and Canvas-bound R3F scene code:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`

For adjacent behavior, see the [v1.7.0 input integration baseline](input-integration-v1.7.0.md) and the [v1.6.0 transition behavior baseline](transition-behavior-v1.6.0.md).

## Scope

v1.8.0 React/R3F bridge hardening confirms behavior for:

- React provider snapshot behavior and shared controls
- progress reads through `useFlowProgress`
- Canvas-bound frame-loop reads through `useFlowFrame`
- client-facing entry file compatibility for Client Component usage
- the separation between DOM/client hooks and Canvas-bound R3F hooks

This baseline does not change the public API. It documents existing behavior only.

## FlowProvider

`FlowProvider` owns one shared flow machine for the React subtree that should stay in sync. A typical R3F page should place one provider above DOM controls, DOM status UI, optional input helper components, and the `<Canvas>` subtree.

Confirmed baseline behavior:

- The provider creates one shared flow machine for React UI and Canvas integration below it.
- `useFlow` exposes the current provider controls and snapshot to components rendered under the provider.
- Initial phase resolution follows the existing provider options, including the configured `initialPhase` when provided.
- The provider snapshot exposes the current `phase`, `phaseIndex`, `progress`, `direction`, `isTransitioning`, and `isLocked` values according to existing machine behavior.
- Navigation controls such as `next()`, `prev()`, and `goTo()` update the provider snapshot according to the core machine rules.
- Boundary navigation and current-phase `goTo()` remain no-ops according to the existing transition behavior baseline.
- Manual `lock()` and `unlock()` are reflected through `useFlow`, and locked navigation remains blocked until unlocked.
- Provider children do not require an R3F `<Canvas>` wrapper. DOM/client components can consume `useFlow` and `useFlowProgress` under the provider without Canvas.
- Client-facing module imports are not intended to require browser globals at module import time.

`FlowProvider` should not be split into separate providers for DOM controls and Canvas scene objects that are expected to share one flow state. Separate providers create separate flow machines.

## useFlowProgress

`useFlowProgress` is the React-side progress hook for components rendered under `FlowProvider`. It is intended for DOM/client UI such as status text, labels, progress indicators, and other coarse React snapshots.

Confirmed baseline behavior:

- `useFlowProgress` reads the same provider progress snapshot as `useFlow().progress`.
- It starts at the provider's initial progress.
- It updates when the provider and underlying machine snapshot update during transitions.
- It remains stable when navigation is blocked by phase boundaries or manual lock.
- Multiple consumers rendered under the same provider receive the same progress value.
- It does not require an R3F `<Canvas>` wrapper.
- It requires `FlowProvider` and reports a clear provider usage error when rendered outside the provider.

Use `useFlowProgress` for React UI that needs progress. Do not treat it as the frame-perfect source for mesh, material, camera, or transform updates; use `useFlowFrame` from Canvas-bound scene components for frame-loop reads.

## useFlowFrame

`useFlowFrame` is the R3F bridge hook for reading the latest flow state during frame updates. It uses React Three Fiber frame behavior, so it is Canvas-bound.

Confirmed baseline behavior:

- `useFlowFrame` registers frame work through React Three Fiber's frame loop.
- It reads the latest machine snapshot during frame updates.
- It advances the flow machine using the frame delta according to the existing implementation and passes the callback the resulting flow frame state plus the original delta value.
- The callback receives the frame state fields `phase`, `phaseIndex`, `progress`, `direction`, and `isTransitioning`.
- It reports stable idle, active transition, completed transition, current-phase no-op, and rejected boundary navigation snapshots according to existing machine behavior.
- It keeps the React provider snapshot synchronized when an active transition completes.
- It requires `FlowProvider` and the normal R3F Canvas context rules for hooks that use the frame loop.

Use `useFlowFrame` from components rendered inside `<Canvas>` when a scene object needs the current flow snapshot during the R3F frame loop. Good uses include refs, mutable Three.js objects, material values, visibility, camera state, or other Canvas-local frame state.

Do not use `useFlowFrame` from DOM controls, route or layout components, provider setup, input listener components, or other code that is not rendered inside `<Canvas>`.

## Client entry compatibility

v1.8.0 also records the client-facing entry file baseline for React, R3F, and input hooks.

Confirmed baseline behavior:

- Client-facing React, R3F, and input entry files are guarded with a `"use client"` directive.
- Browser APIs are not intended to run at module import time.
- Public React/R3F/input APIs are client-side APIs for Client Components in Next.js App Router projects.
- Server Components can pass serializable data into a Client Component wrapper, but they should not render `FlowProvider` or call flow hooks directly.
- No Next.js dependency is required.
- No Next.js router integration is provided.

This compatibility baseline is about safe client entry usage. It does not add Next.js-specific APIs, route synchronization, or router behavior.

## Usage boundaries

Keep responsibilities separated:

- Use `FlowProvider` once around the shared DOM/client and Canvas subtree for one interactive flow.
- Use `useFlow` in React/client components for snapshot fields, navigation controls, and lock/unlock controls.
- Use `useFlowProgress` in React/client components for coarse progress UI.
- Use browser input hooks from React/client input-layer components under `FlowProvider`; see the v1.7.0 input integration baseline for input-specific behavior.
- Use `useFlowFrame` only from R3F scene components rendered inside `<Canvas>`.
- Keep every-frame visual values in refs, mutable Three.js objects, or Canvas-local state instead of React state unless intentionally synchronizing a stable UI snapshot.

These boundaries match the existing package model: React manages application and UI state, React Three Fiber manages frame-based scene updates, and this package bridges them through predictable phase state.

## Out of scope

v1.8.0 React/R3F bridge hardening does not introduce:

- new public APIs
- new provider props
- new hook options
- new runtime dependencies
- Next.js as a dependency
- Next.js router integration
- visual effects
- animation timelines
- camera presets
- templates
- third-party animation wrappers
- package version changes
- release preparation changes

## Validation baseline

The v1.8.0 behavior is covered by focused tests for:

- `FlowProvider` initial snapshots, configured initial phase behavior, controls shape, navigation updates, lock/unlock behavior, stable no-op navigation, transition option forwarding, children without Canvas, and import-time browser global safety
- `useFlowProgress` alignment with `useFlow().progress`, transition updates, blocked navigation stability, multiple consumers without Canvas, and provider usage errors
- `useFlowFrame` frame callback registration, post-update frame snapshots, latest snapshot reads across frames, callback ref freshness, transition completion synchronization, stable completed snapshots, no-op navigation stability, and provider usage errors
- public entry compatibility, including exact runtime exports, `"use client"` directives for client-facing files, and import behavior without browser globals

These tests describe the behavior baseline. This document should not be read as a promise of additional API surface beyond the current documented provider, hooks, and public types.
