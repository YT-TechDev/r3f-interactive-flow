# Accessible interaction and reduced motion

This guide describes how to connect `r3f-interactive-flow` to accessible application UI and reduced-motion policy without expanding the package API. It is written for humans and for AI coding agents that need bounded, package-root examples.

The package exposes state and controls. It does not render accessible UI for the application.

## Responsibility boundary

| Package owns                                                       | Application owns                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Phase state and `next`, `prev`, `goTo`.                            | Rendered controls, labels, and names.                                     |
| Transition progress, direction, locks, transitions, and cooldowns. | Disabled/current semantics.                                               |
| Optional input-hook accepted/rejected decisions.                   | Focus order, visible focus, focus movement, and restoration.              |
| Native actionable/editable protection.                             | Phase status and announcement wording.                                    |
| Repeated-key rejection.                                            | Contrast, target size, layout, and responsive behavior.                   |
| Rejected navigation remaining unprevented.                         | Nested-scroll CSS, `touch-action`, and overscroll policy.                 |
| Accepted prevention when configured.                               | Motion preference detection or a user setting.                            |
| Zero- and short-duration transition support.                       | Normal/reduced provider configuration.                                    |
| Provider-owned cleanup on unmount.                                 | Scene, camera, shader, particle, CSS, and other visual-motion policy.     |
|                                                                    | Acceptance or handling of state reset after intentional provider remount. |

## Visible controls are the baseline

Visible DOM controls are the baseline operation path. They remain usable without `useKeyboardInput`, wheel, or touch hooks because native buttons can call `next`, `prev`, and `goTo` directly.

Use package-root imports only:

```tsx
import { useFlow } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];
```

## Phase controls and discrete status

```tsx
function PhaseNavigation() {
  const flow = useFlow<Phase>();
  const atFirst = flow.phaseIndex === 0;
  const atLast = flow.phaseIndex === phases.length - 1;

  return (
    <section aria-labelledby="flow-navigation-heading">
      <h2 id="flow-navigation-heading">Flow navigation</h2>

      <p role="status" aria-live="polite" aria-atomic="true">
        {flow.phase} ({flow.phaseIndex + 1} of {phases.length})
      </p>

      <div role="group" aria-label="Sequential phase navigation">
        <button type="button" onClick={flow.prev} disabled={atFirst}>
          Previous
        </button>
        <button type="button" onClick={flow.next} disabled={atLast}>
          Next
        </button>
      </div>

      <div role="group" aria-label="Direct phase navigation">
        {phases.map((phase) => {
          const current = flow.phase === phase;

          return (
            <button
              key={phase}
              type="button"
              onClick={() => flow.goTo(phase)}
              disabled={current}
              aria-current={current ? "step" : undefined}
            >
              {current ? `${phase} (current)` : phase}
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

The status wording is application-owned. Keep live status discrete: phase name and index are appropriate; per-frame `progress` is not. `useFlowProgress` may drive visual progress UI such as a `<progress>` element, but do not announce every frame through a live region. Phase navigation does not move focus, so any focus movement or restoration after navigation is also application-owned.

## Optional input hooks and native behavior

Input hooks are optional enhancements around the same phase controls. Mount them from a DOM/input component under `FlowProvider`, not from Canvas scene logic.

```tsx
import { useKeyboardInput, useTouchInput, useWheelInput } from "r3f-interactive-flow";

const inputIgnore = ["[data-flow-ignore]"] as const;

const keyboardKeys = {
  next: ["ArrowDown", "ArrowRight", "PageDown"],
  prev: ["ArrowUp", "ArrowLeft", "PageUp"]
} as const;

function FlowInputLayer() {
  useWheelInput<Phase>({ ignore: inputIgnore, threshold: 48, cooldown: 250 });
  useTouchInput<Phase>({ ignore: inputIgnore, threshold: 44, cooldown: 250 });
  useKeyboardInput<Phase>({ keys: keyboardKeys, cooldown: 250 });

  return null;
}
```

Wheel and touch support `ignore` selectors. Keyboard has no `ignore` selector. `ignoreWhenTyping` defaults to `true`, so input, textarea, select, and `contenteditable` targets are protected by default. Repeated keydown is ignored. Space and Enter retain native activation on actionable controls, and button or anchor descendants inherit that actionable protection. Rejected navigation remains unprevented; accepted navigation may prevent default when configured. Focus remains application-owned.

## Focus ownership

`FlowProvider`, `useFlow`, `useFlowProgress`, `useFlowFrame`, and the input hooks do not implement roving tabindex, focus traps, automatic phase focus movement, or restoration after remount. Treat package focus non-interference as a boundary: applications choose focus order, visible focus styles, when focus should move, and how focus should recover after an intentional keyed provider remount.

## Ignored and nested-scroll regions

```tsx
<div className="nested-scroll" data-flow-ignore tabIndex={0}>
  ...
</div>
```

```css
.nested-scroll {
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
}
```

`data-flow-ignore` only works because the application passes the matching selector to wheel and touch hooks. The package injects no CSS. Keyboard has no ignore-selector option, so visible flow controls should remain available outside the region. Target size, layout, scrolling, and mobile behavior remain application policy. `touch-action: pan-y` is an example for a vertical nested-scroll region, not a universal rule.

## Reduced-motion recipe

Reduced motion is application policy. Use existing APIs only.

```tsx
import { useState } from "react";
import { FlowProvider } from "r3f-interactive-flow";

const phases = ["intro", "work", "contact"] as const;
type Phase = (typeof phases)[number];
type MotionMode = "normal" | "reduced";

const transitionByMotionMode = {
  normal: { duration: 700, cooldown: 250 },
  reduced: { duration: 0, cooldown: 250 }
} as const;

function Experience({ motionMode }: { motionMode: MotionMode }) {
  return <p>Motion mode: {motionMode}</p>;
}

function App() {
  const [motionMode, setMotionMode] = useState<MotionMode>("normal");

  return (
    <>
      <fieldset>
        <legend>Motion</legend>
        <label>
          <input
            type="checkbox"
            checked={motionMode === "reduced"}
            onChange={(event) => setMotionMode(event.currentTarget.checked ? "reduced" : "normal")}
          />
          Reduce flow transition motion
        </label>
      </fieldset>

      <FlowProvider
        key={motionMode}
        phases={phases}
        transition={transitionByMotionMode[motionMode]}
      >
        <Experience motionMode={motionMode} />
      </FlowProvider>
    </>
  );
}
```

Provider configuration is mount-scoped. Changing props on the same provider does not reconfigure the machine. Changing React `key` intentionally remounts the provider; `key` is not a `FlowProvider` prop. Remount resets phase, progress, transition, lock, and cooldown state. The application decides whether that reset is acceptable and how to restore any needed application state or focus.

`duration: 0` is one valid choice, not a requirement. A short non-zero duration is also valid. Cooldown is independent and may remain positive. The package does not read `matchMedia`; preference detection remains application-owned. The package does not preserve state across remount.

## Scene-motion boundary

Changing provider duration does not automatically reduce scene, camera, parallax, shader, particle, CSS, or other motion. Apply motion preference separately in Canvas-bound scene code.

```tsx
import { useRef } from "react";
import type * as THREE from "three";
import { useFlowFrame } from "r3f-interactive-flow";

function FlowSceneObject({ motionMode }: { motionMode: MotionMode }) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const motionScale = motionMode === "reduced" ? 0.15 : 1;

  useFlowFrame<Phase>(({ progress }, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta * motionScale;
    meshRef.current.position.x = progress * motionScale * 2;
  });

  return <mesh ref={meshRef} />;
}
```

`useFlowFrame` remains Canvas-bound. Keep per-frame scene values in refs or Three.js objects, with no per-frame React state writes.

## Evidence boundaries

Deterministic Node/minimal-DOM tests cover timing, lifecycle, accepted/rejected behavior, repeat, typing protection, and remount behavior. One Playwright-managed headless Chromium lane covers bounded native activation, focus non-interference, prevention, repeat, and DOM ancestry. The published-package consumer demonstrates one application-owned UI, status, focus style, motion, responsive, and nested-scroll pattern. Earlier physical evidence is limited to specifically recorded v2.5.0 scenarios.

This evidence does not claim WCAG conformance, screen-reader certification, cross-browser certification, complete keyboard-accessibility claims, universal reduced-motion correctness, or package-owned accessible UI.

## Agent-readable checklist

Do:

- use package-root imports;
- render native application controls;
- disable first/last/current boundaries in app code;
- use discrete phase status;
- keep focus application-owned;
- mount input hooks in a DOM/input component;
- use ignore selectors only for wheel/touch;
- use intentional keyed remount for changed provider configuration;
- reduce scene motion separately.

Do not invent:

- `AccessibleFlowProvider`;
- `useReducedMotion`;
- automatic package `matchMedia`;
- package-rendered Previous/Next controls;
- automatic ARIA/live announcements;
- package focus movement or restoration;
- keyboard ignore selectors;
- per-frame live progress announcements;
- mandatory `duration: 0`;
- internal imports;
- runtime dependencies.
