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

Define the tuple at module scope, or memoize it if it is derived at runtime. A mounted `FlowProvider` reads its phases and transition configuration once, when that provider instance mounts, so an ordinary parent rerender with a fresh but equivalent array or object preserves the current phase, progress, lock, transition, and cooldown state. Hoisting the tuple is still recommended for TypeScript inference, readability, and maintaining a clear phase type, not because equivalent rerenders reset the machine.

Changing configuration props alone does not reconfigure an already mounted provider. To intentionally reset the flow or apply new phases, timing, cooldown, or easing, change the provider element's React `key` so React unmounts the old provider and mounts a new one:

```tsx
<FlowProvider key={flowConfigurationVersion} phases={phases} transition={transition}>
  <Experience />
</FlowProvider>
```

`key` is React's remount mechanism; it is not a `FlowProvider` API prop.

### Reduced motion is application policy

The library does not expose a separate reduced-motion API, read `matchMedia`, or automatically choose a reduced-motion mode. If your app needs reduced motion, choose the transition timing in application code. To intentionally apply a changed provider configuration, change the provider element's React `key`; that remounts `FlowProvider` and explicitly resets phase, progress, transition, lock, and cooldown state.

```tsx
<FlowProvider
  key={reducedMotion ? "reduced" : "normal"}
  phases={phases}
  transition={reducedMotion ? { duration: 0, cooldown: 250 } : { duration: 700, cooldown: 250 }}
>
  <Experience />
</FlowProvider>
```

Use `duration: 0` only if an immediate transition is right for your app; it is representative, not mandatory. A short non-zero duration is also valid, and cooldown is independent so a positive cooldown may remain. Changing provider duration does not automatically reduce scene, camera, shader, particle, CSS, or other motion. See [Accessible interaction and reduced motion](./accessibility-and-reduced-motion.md) for the full responsibility split and keyed-remount recipe.

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

Their exact signatures are:

```ts
next: () => boolean;
prev: () => boolean;
goTo: (phase: TPhase) => boolean;
```

The returned boolean reports whether this request was accepted. Existing callers
may continue to use these controls as statements and ignore the result. `lock()`
and `unlock()` remain `void`.

`next()` and `prev()` always reject safely at the tuple's boundaries — calling
`next()` on the last phase or `prev()` on the first is a no-op, never a throw.
A `goTo()` call with a **known** phase (any value from your `as const` tuple)
is also always safe: it is rejected as a no-op, with no snapshot mutation,
when it targets the current phase or is blocked by an active transition, a
lock, or a cooldown. A `goTo()` call with an **unknown** target — a phase name
outside `phases` — throws instead of rejecting, and it throws before the
normal lock/transition/cooldown check even runs. With a properly typed closed
phase union, ordinary application code never constructs an unknown target;
only an unsafe cast or an unvalidated dynamic string reaches that throw. See
[Navigation rejection and errors](#navigation-rejection-and-errors) for the
full matrix.

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

## Adjacent and non-adjacent navigation

`next()` and `prev()` move exactly one phase index. `goTo(target)` can jump to
**any** known phase, not just an adjacent one — forward or backward through the
tuple:

```tsx
const phases = ["intro", "overview", "detail", "contact"] as const;
// current: "intro" (index 0)
goTo("contact"); // target "contact" (index 3), direction "next"
```

A non-adjacent `goTo()` still performs exactly **one** transition straight to
the target. The phases in between (`"overview"`, `"detail"`) are not visited
and not queued — there is no route-pair configuration, graph, or timeline
behind `goTo()`. `direction` is based on the target index relative to the
source index, the same way it is for `next()`/`prev()`. `transition.byPhase`
resolves from the **source** phase for both adjacent and non-adjacent
navigation — see [Transition options and `byPhase`](#transition-options-and-byphase).

## Transition options and `byPhase`

`duration`, `cooldown`, and `easing` configure how a transition runs. Each
field resolves independently, falling back through this precedence:

1. `transition.byPhase[sourcePhase].field`
2. `transition.field`
3. legacy top-level prop (`transitionDurationMs`, `cooldownMs`, `easing`)
4. package default (`duration: 1000`, `cooldown: 0`, linear `easing`)

```tsx
<FlowProvider
  phases={phases}
  transition={{
    duration: 700,
    cooldown: 200,
    byPhase: {
      intro: { duration: 1200 }
    }
  }}
>
  {/* ... */}
</FlowProvider>
```

Here, leaving `"intro"` uses `duration: 1200` but still falls back to the
transition-level `cooldown: 200` and the default easing — a `byPhase` override
for one field does not replace the other fields. `byPhase` is keyed by the
**source** phase (the phase you are transitioning away from), and it resolves
the same way for adjacent and non-adjacent `goTo()` navigation. There is no way
to select options by target phase or by a source/target pair.

## Navigation rejection and errors

| Request                             | Condition                   | Result                           |
| ----------------------------------- | --------------------------- | -------------------------------- |
| known navigation                    | accepted                    | returns `true`, snapshot updates |
| `prev()`                            | first phase                 | returns `false`, no mutation     |
| `next()`                            | final phase                 | returns `false`, no mutation     |
| `goTo(knownTarget)`                 | same as current phase       | returns `false`, no mutation     |
| `next()` / `prev()` / `goTo(known)` | manual lock active          | returns `false`, no mutation     |
| `next()` / `prev()` / `goTo(known)` | active transition           | returns `false`, no mutation     |
| `next()` / `prev()` / `goTo(known)` | provider cooldown remaining | returns `false`, no mutation     |
| `goTo(unknownTarget)`               | any state                   | **throws**, no mutation          |

A rejected call never mutates the snapshot — `phase`, `progress`, and
`direction` are exactly what they were before the call. An unknown `goTo()`
target throws _before_ the lock/transition/cooldown checks run, so it throws
even while locked, mid-transition, or in cooldown. A closed `as const` phase
union is what keeps ordinary application code out of that throwing path in the
first place; treat it as a programmer-error guard, not a runtime condition your
UI needs to branch on. Unknown-target validation happens before same-phase,
manual-lock, active-transition, and provider-cooldown rejection checks.

When application-owned UI messages, sound, analytics, focus, or visual feedback
should run only for an accepted request, branch directly on the result. There is
no need to compare snapshots merely to learn whether the request was accepted:

```tsx
function NextButton() {
  const { next } = useFlow<Phase>();

  const handleClick = () => {
    if (next()) {
      // Application-owned feedback for an accepted request.
    }
  };

  return (
    <button type="button" onClick={handleClick}>
      Next
    </button>
  );
}
```

`true` is not a transition-completion signal. For a positive duration, it is
returned when the transition starts; continue to observe `isTransitioning` and
`progress` for transition state. An accepted zero-duration request also returns
`true`, even though it completes synchronously with no active-transition frame.

The boolean deliberately does not expose a rejection reason, cooldown remaining,
future navigation availability, transition completion, or lifecycle events. It
is not a result object or reason enum, and this contract does not add `canNext`,
`canPrev`, `canGoTo`, or `canNavigate` APIs.

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

Public `progress` is the configured easing function's output, applied to the
transition's raw elapsed time. For ordinary finite easing this stays within
`[0, 1]`, but a non-monotonic or endpoint-producing custom easing function can
make `progress` decrease, or reach `0` or `1`, before the transition has
actually finished — **raw elapsed time, not eased `progress`, decides
completion.** Do not treat `progress === 1` alone as proof a transition is
done; use `isTransitioning` for that (see [Transition state](#transition-state)).

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

During an active transition, `phase` and `phaseIndex` already identify the
**target** you are moving to, not the phase you started from — the package
does not expose a public source-phase field while a transition runs. At raw
completion, `direction` resets to `"none"` and `isTransitioning` becomes
`false` in the same update. Because eased `progress` can reach `1` before raw
completion, `isTransitioning` — not `progress === 1` — is the reliable signal
that a transition has actually finished.

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

**Cooldown** is an automatic, brief window after a transition completes during
which new navigation is ignored. It absorbs rapid repeated triggers — a fast
scroll, a held key, a double tap — so a single intent produces a single phase
change. Provider transition cooldown starts at the transition completion
boundary, runs for the complete configured duration after that boundary, and
applies globally to manual controls and all input hooks. Provider cooldown is
a single machine-wide gate — it blocks every control and every input hook, not
just the one that triggered it. Hook-local cooldown is a separate, narrower
mechanism: it belongs to one `useWheelInput`/`useTouchInput`/`useKeyboardInput`
instance, starts only after that hook produces an accepted input navigation,
and throttles only that hook — it does not lock the machine and does not block
direct `next`/`prev`/`goTo` calls or other hook instances.

`useFlow()` exposes the machine-wide provider cooldown lifecycle as
`isCoolingDown`. It remains `false` during a positive-duration transition,
becomes `true` when that transition completes with positive provider cooldown,
and returns to `false` at expiry. An accepted zero-duration transition with
positive provider cooldown exposes `true` synchronously. Hook-local input
cooldown is separate and never changes this field.

```tsx
const { isTransitioning, isCoolingDown, isLocked } = useFlow<Phase>();
const disabled = isTransitioning || isCoolingDown || isLocked;
```

`isCoolingDown` is a boolean lifecycle boundary, not a countdown; it exposes no
remaining time.

```tsx
<FlowProvider phases={phases} transition={{ duration: 700, cooldown: 250 }}>
  {/* ... */}
</FlowProvider>
```

Both are conceptual guardrails on the same navigation controls. Locking is a
deliberate hold you manage; cooldown is a short automatic settle the library
manages for you. Active positive-duration transitions also reject `next`,
`prev`, and `goTo`; there is no `lockDuringTransition` option in the current v2
API. A transition duration of `0` is supported as an immediate transition:
`progress` is `1`, `isTransitioning` is `false`, and any provider cooldown starts
immediately after that synchronous completion.

Locking is purely a navigation gate: it never pauses, slows, or cancels an
active transition, and it never pauses provider cooldown — both keep running
on their own clock while locked. Locking and cooldown only decide whether a
_new_ navigation call is accepted; they do not alter time already in progress.

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

## Application-owned previous-phase tracking

The package does not add `sourcePhase`, `targetPhase`, or `previousPhase` to
the public snapshot — evaluation found no case that the current API and
ordinary React state cannot already handle. When your app needs the phase a
transition left from, derive it yourself in an Effect, so the trace only
updates after an actually committed phase change rather than during render:

```tsx
import { useEffect, useRef, useState } from "react";

type PhaseTrace = { source: Phase; target: Phase } | null;

function usePhaseTrace(phase: Phase): PhaseTrace {
  const previousPhaseRef = useRef(phase);
  const [trace, setTrace] = useState<PhaseTrace>(null);

  useEffect(() => {
    const source = previousPhaseRef.current;

    if (source === phase) {
      return;
    }

    setTrace({ source, target: phase });
    previousPhaseRef.current = phase;
  }, [phase]);

  return trace;
}
```

- Initialize the retained phase from the current public `phase`, and compare
  it inside an Effect that runs when `phase` changes — not by mutating a ref
  during render, which a concurrent or discarded render must not commit.
- When `phase` has actually changed, the retained value is the **source** and
  the new `phase` is the **target**.
- Use `direction` directly for a positive-duration transition; for a
  zero-duration transition, `direction` is already `"none"` in the same call,
  so derive direction by comparing the source and target phase indexes
  instead.
- Rejected and same-phase requests never mutate `phase`, so the Effect never
  fires for them and this derivation never records a false trace.

This is application code built on public `useFlow` output, not a package API —
no such field is planned for a future release. Inside `useFlowFrame`, the
equivalent comparison happens directly in the frame callback instead of an
Effect — see
[React Three Fiber usage](./r3f-usage.md#target-phase-non-adjacent-transitions-and-zero-duration).

## Next steps

- [React Three Fiber usage](./r3f-usage.md) — the `useFlowFrame` bridge and
  Canvas boundaries.
- [Input handling](./input-handling.md) — wheel, touch, and keyboard input
  hooks, and how they respect locks and cooldowns.
- [Getting started](./getting-started.md) — revisit the first working flow if
  you skipped it.
