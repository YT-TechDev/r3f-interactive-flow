# Core concepts

`r3f-interactive-flow` is a small, predictable control layer for phase-based
interactive React Three Fiber websites. It is not an animation framework, camera
preset library, or visual-effects collection. Its job is narrow and dependable:
model an experience as a known list of phases, move between them with explicit
controls, and expose the transition state to both React UI and the React Three
Fiber frame loop without letting the two responsibilities blur together.

This guide explains the ideas the rest of the guides build on. It assumes you
have already rendered a first flow in the
[Getting started](./getting-started.md) guide. All examples use package-root
imports only:

```tsx
import { FlowProvider, useFlow, useFlowProgress } from "r3f-interactive-flow";
```

## Mental model

Think of the library as a small state machine with a well-defined snapshot:

- `FlowProvider` owns one phase machine for a known list of phases.
- You move through phases with `next`, `prev`, and `goTo`.
- At any moment the machine has a **snapshot**: which phase you are on, whether a
  transition is running, which direction it is going, and how far along it is.
- React reads that snapshot for UI. React Three Fiber reads the same snapshot in
  the frame loop for scene updates.

The library does not decide what your scene looks like or how it animates. It
decides _when_ you are moving, _where_ you are moving, and _how far_ you have
moved. Your application and your Three.js code decide what to do with that.

## Phases

A **phase** is a named, discrete state of your experience — `"intro"`, `"work"`,
`"contact"`. It is a label, not a scene, animation, or camera position. Your code
maps a phase to whatever it should mean visually.

Phases are declared as a stable `as const` tuple, defined outside your
components:

```tsx
const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];
```

### Why phases should be a stable, known list

The library expects the full set of phases up front, and expects it not to
change between renders. A stable list is what makes the flow predictable:

- **Ordering is meaningful.** `next` and `prev` walk the tuple in order, so the
  sequence you write is the sequence users move through.
- **Targets are type-checked.** With `as const`, `goTo` only accepts a real
  phase name, and `phase` is a precise literal type rather than a bare string.
- **Bounds are well-defined.** The machine knows the first and last phase, so it
  can safely ignore out-of-bounds navigation.

Define the tuple at module scope, or memoize it if it is derived at runtime.
Rebuilding the array on every render works against the machine and can cause
unnecessary resets.

## Phase index

Every phase has a position in the tuple, exposed as `phaseIndex` (zero-based).
`phase` is the name; `phaseIndex` is the position. Use whichever is convenient:

```tsx
function Status() {
  const { phase, phaseIndex } = useFlow<Phase>();

  return (
    <p>
      Phase {phaseIndex + 1} of {phases.length}: {phase}
    </p>
  );
}
```

You move between phases with three controls from `useFlow`:

- `next()` advances to the next phase in the tuple.
- `prev()` steps back to the previous phase.
- `goTo(target)` jumps directly to a named phase.

All three are safe to call unconditionally. A call is ignored when it is out of
bounds (`next` on the last phase, `prev` on the first), or when it is blocked by
an active transition, a lock, or a cooldown. Controls never throw and never move
you somewhere unexpected, so you can wire them straight to buttons or input.

## Direction

While a transition is running, `direction` describes **which way through the
phase list** the machine is moving. It is one of:

- `"next"` — moving toward a later phase.
- `"prev"` — moving toward an earlier phase.
- `"none"` — no transition is in progress.

`direction` is transition direction only. It is **not** a camera direction, an
animation preset, an easing choice, or a visual style. It answers "are we going
forward or backward through the phases?" — nothing more. Your scene code can use
it to decide how to interpret progress, but the library assigns it no visual
meaning of its own.

## Transition progress

A move between phases is not instantaneous. While it runs, `progress` reports how
far along the transition is as a **normalized value from `0` to `1`**:

- `0` means the transition has just begun.
- `1` means it has completed.
- Values in between represent the fraction of the transition elapsed.

`progress` is a plain, unitless number. It is not seconds, not pixels, and not
tied to any particular easing curve — it is a normalized position within the
current transition that you are free to map onto anything: an opacity, a
rotation, a progress bar, a scroll indicator.

For DOM/UI, read it with `useFlowProgress`. While a transition runs, the provider
advances its single clock once per animation frame and updates the React snapshot
each frame, so this value moves continuously from `0` to `1` — smooth enough to
drive a `<progress>` element or a percentage label directly, with no Canvas
required:

```tsx
function ProgressBar() {
  const progress = useFlowProgress();

  return <progress max={1} value={progress} aria-label="Flow transition progress" />;
}
```

For frame-driven scene updates, read the same value inside the frame loop with
`useFlowFrame` instead — see [React state vs frame updates](#react-state-vs-frame-updates).

## Transition state

`isTransitioning` is a boolean: `true` while a phase change is in progress,
`false` when the machine is settled on a phase. Use it to reflect state in the
UI or to gate interactions:

```tsx
function Status() {
  const { phase, isTransitioning } = useFlow<Phase>();

  return (
    <p>
      {phase}
      {isTransitioning ? " — transitioning" : " — ready"}
    </p>
  );
}
```

Together, `phase`, `phaseIndex`, `direction`, `progress`, and `isTransitioning`
form the full transition snapshot. When `isTransitioning` is `false`, `direction`
is `"none"` and `progress` rests at a settled value; when it is `true`,
`direction` and `progress` describe the move that is underway.

## Locking and cooldown

Both locking and cooldown exist for the same reason: to keep navigation
predictable and prevent unwanted or repeated phase changes. They work at
different time scales.

**Locking** is an explicit, held pause on navigation. `useFlow` exposes `lock`
and `unlock`, and the snapshot reports `isLocked`. While locked, `next`, `prev`,
and `goTo` are ignored. Use it when a phase change must not happen right now — for
example, during an intro sequence or a modal interaction — and release it when
navigation should resume.

```tsx
function GatedControls() {
  const { next, lock, unlock, isLocked } = useFlow<Phase>();

  return (
    <div>
      <button onClick={next} disabled={isLocked}>
        Next
      </button>
      <button onClick={isLocked ? unlock : lock}>{isLocked ? "Unlock" : "Lock"}</button>
    </div>
  );
}
```

**Cooldown** is an automatic, brief window after a transition during which new
navigation is ignored. It absorbs rapid repeated triggers — a fast scroll, a held
key, a double tap — so a single intent produces a single phase change. Cooldown
is configured, not called: the provider accepts a transition cooldown, and the
input hooks accept their own cooldown.

```tsx
<FlowProvider phases={phases} transition={{ duration: 700, cooldown: 250 }}>
  {/* ... */}
</FlowProvider>
```

Both are conceptual guardrails on the same navigation controls. Locking is a
deliberate hold you manage; cooldown is a short automatic settle the library
manages for you. Neither bypasses the machine — they just decide when a
navigation call is accepted.

## React state vs frame updates

This is the central idea of the library. Two systems are involved, and each has
a job:

- **React manages state.** Which phase you are on, whether a transition is
  running, and the DOM UI derived from it are React's responsibility. React
  re-renders when that state changes — including each frame of an active
  transition, so a `useFlowProgress` bar or a `useFlow().progress` label animates
  smoothly from `0` to `1`.
- **React Three Fiber manages frame-based visual updates.** A scene updates many
  times per second inside the Canvas frame loop, mutating Three.js objects
  directly.

Both sides read the same provider-owned machine, advanced by one provider-owned
clock. They sample it in independent render loops, though, so do not assume a DOM
render and a Canvas frame capture the exact same `progress` value at the exact
same instant — treat them as two views of one machine, not one shared sample.

### Why not copy frame values into React state for scene animation

The provider already keeps React progress current for DOM UI. The thing to avoid
is routing _scene animation_ through React: copying `progress` out of
`useFlowFrame` into a `useState` each frame to move a mesh forces the whole React
subtree to reconcile every frame, which fights how both libraries are designed.
React is built around state changes; R3F is built to mutate the scene imperatively
inside its own loop.

So the rule is:

- Use **React state** (`useFlow`, `useFlowProgress`) for DOM UI — labels, buttons,
  progress bars, status text. These update continuously during a transition.
- Use the **frame loop** (`useFlowFrame`) for per-frame visual work — mesh
  positions, rotations, material values, camera movement. Keep those values in
  refs and Three.js objects, not in React state.

`useFlowProgress` is the right tool for DOM progress indicators. It is not the
tool for animating a scene frame by frame — that is what `useFlowFrame` is for.

## How the hooks fit together

Three hooks read the same flow state for different jobs:

- **`useFlow`** — the phase snapshot and controls. Read `phase`, `phaseIndex`,
  `direction`, `isTransitioning`, and `isLocked`; call `next`, `prev`, `goTo`,
  `lock`, and `unlock`. This is your DOM/UI and navigation surface.
- **`useFlowProgress`** — just the transition `progress` value, for DOM UI such as
  labels and progress bars. It updates continuously while a transition runs and is
  a focused read for the common UI case.
- **`useFlowFrame`** — the same snapshot delivered inside the React Three Fiber
  frame loop, for per-frame scene updates. It must be called from a component
  rendered inside `<Canvas>` and under `FlowProvider`, and it is covered in the
  [React Three Fiber usage guide](./r3f-usage.md).

All three live under one `FlowProvider` and observe one shared machine.
`useFlow` and `useFlowProgress` belong to the React/DOM side; `useFlowFrame`
belongs to the frame-updated Canvas side. Choosing the right hook for each job is
what keeps the React/R3F split clean.

## Next steps

- [React Three Fiber usage](./r3f-usage.md) — the `useFlowFrame` bridge and
  Canvas boundaries.
- [Input handling](./input-handling.md) — wheel, touch, and keyboard input
  hooks, and how they respect locks and cooldowns.
- [Getting started](./getting-started.md) — revisit the first working flow if
  you skipped it.
