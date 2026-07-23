import React, { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  FlowProvider,
  useFlow,
  useFlowProgress,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";

type TestPhase = "intro" | "work" | "details" | "contact";

type Snapshot = {
  phase: TestPhase;
  phaseIndex: number;
  progress: number;
  direction: string;
  isTransitioning: boolean;
};

type InputOptions = {
  enabled?: boolean;
  ignore?: readonly string[];
  touch?: boolean;
  wheel?: boolean;
};

const phases = ["intro", "work", "details", "contact"] as const;

let container: HTMLDivElement | undefined;
let root: Root | undefined;

beforeAll(() => {
  console.info(`browser user agent: ${navigator.userAgent}`);
});

afterEach(() => {
  if (root !== undefined) {
    act(() => {
      root?.unmount();
    });
  }

  container?.remove();
  root = undefined;
  container = undefined;
});

function InputLayer({ enabled = true, ignore = [], touch = false, wheel = true }: InputOptions) {
  useWheelInput<TestPhase>({ threshold: 40, cooldown: 0, enabled: enabled && wheel, ignore });
  useTouchInput<TestPhase>({ threshold: 40, cooldown: 0, enabled: enabled && touch, ignore });

  return null;
}

function StateProbe() {
  const flow = useFlow<TestPhase>();
  const progress = useFlowProgress();

  return (
    <output data-testid="state">
      {JSON.stringify({
        phase: flow.phase,
        phaseIndex: flow.phaseIndex,
        progress,
        direction: flow.direction,
        isTransitioning: flow.isTransitioning
      })}
    </output>
  );
}

function Targets() {
  return (
    <div data-testid="host">
      <button data-testid="button" type="button">
        <span data-testid="button-child">button child</span>
      </button>
      <div contentEditable data-testid="editable" suppressContentEditableWarning>
        <span data-testid="editable-child">editable child</span>
      </div>
      <div data-flow-ignore data-testid="ignored">
        <span data-testid="ignored-child">ignored child</span>
      </div>
      <div data-testid="neutral">
        <span data-testid="neutral-child">neutral child</span>
      </div>
    </div>
  );
}

function App({ children, inputOptions }: { children?: ReactNode; inputOptions?: InputOptions }) {
  return (
    <FlowProvider<TestPhase> phases={phases} transitionDurationMs={0} cooldownMs={0}>
      {inputOptions === undefined ? null : <InputLayer {...inputOptions} />}
      <StateProbe />
      {children}
    </FlowProvider>
  );
}

function mount(ui: ReactNode): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(ui);
  });
}

function rerender(ui: ReactNode): void {
  act(() => {
    root?.render(ui);
  });
}

function getByTestId(testId: string): HTMLElement {
  const element = container?.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  if (element === undefined || element === null) {
    throw new Error(`Missing test element: ${testId}`);
  }

  return element;
}

function readSnapshot(): Snapshot {
  return JSON.parse(getByTestId("state").textContent ?? "{}");
}

function dispatchWheel(target: Element, deltaY: number): { event: WheelEvent; result: boolean } {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY
  });
  let result = true;

  act(() => {
    result = target.dispatchEvent(event);
  });

  return { event, result };
}

function createTouch(target: EventTarget, clientY: number): Touch {
  return new Touch({ identifier: 1, target, clientX: 0, clientY });
}

function dispatchTouch(
  target: Element,
  type: "touchstart" | "touchmove",
  clientY: number
): { event: TouchEvent; result: boolean } {
  const touch = createTouch(target, clientY);
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: [touch],
    targetTouches: [touch],
    changedTouches: [touch]
  });
  let result = true;

  act(() => {
    result = target.dispatchEvent(event);
  });

  return { event, result };
}

describe("Chromium input event smoke coverage", () => {
  it("cancels accepted wheel navigation and leaves rejected wheel input unprevented", () => {
    mount(
      <App inputOptions={{ wheel: true }}>
        <Targets />
      </App>
    );

    const accepted = dispatchWheel(getByTestId("neutral-child"), 41);

    expect(readSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false
    });
    expect(accepted.event.defaultPrevented).toBe(true);
    expect(accepted.result).toBe(false);

    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
    mount(
      <App inputOptions={{ wheel: true }}>
        <Targets />
      </App>
    );

    const rejected = dispatchWheel(getByTestId("neutral-child"), -41);

    expect(readSnapshot().phase).toBe("intro");
    expect(rejected.event.defaultPrevented).toBe(false);
    expect(rejected.result).toBe(true);
  });

  it("cancels accepted touch navigation and leaves rejected touch input unprevented", () => {
    mount(
      <App inputOptions={{ touch: true, wheel: false }}>
        <Targets />
      </App>
    );

    const neutral = getByTestId("neutral-child");
    dispatchTouch(neutral, "touchstart", 100);
    const accepted = dispatchTouch(neutral, "touchmove", 59);

    expect(readSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false
    });
    expect(accepted.event.defaultPrevented).toBe(true);
    expect(accepted.result).toBe(false);

    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
    mount(
      <App inputOptions={{ touch: true, wheel: false }}>
        <Targets />
      </App>
    );

    const rejectedTarget = getByTestId("neutral-child");
    dispatchTouch(rejectedTarget, "touchstart", 100);
    const rejected = dispatchTouch(rejectedTarget, "touchmove", 141);

    expect(readSnapshot().phase).toBe("intro");
    expect(rejected.event.defaultPrevented).toBe(false);
    expect(rejected.result).toBe(true);
  });

  it("preserves nested actionable, editable, and ignored ancestry while accepting neutral wheel input", () => {
    mount(
      <App inputOptions={{ wheel: true, ignore: ["[data-flow-ignore]"] }}>
        <Targets />
      </App>
    );

    for (const testId of ["button-child", "editable-child", "ignored-child"] as const) {
      const event = dispatchWheel(getByTestId(testId), 41);

      expect(readSnapshot().phase).toBe("intro");
      expect(event.event.defaultPrevented).toBe(false);
      expect(event.result).toBe(true);
    }

    const accepted = dispatchWheel(getByTestId("neutral-child"), 41);

    expect(readSnapshot().phaseIndex).toBe(1);
    expect(accepted.event.defaultPrevented).toBe(true);
    expect(accepted.result).toBe(false);
  });

  it("does not duplicate navigation across enabled, unmount, and remount lifecycle", () => {
    mount(
      <App inputOptions={{ enabled: false, wheel: true }}>
        <Targets />
      </App>
    );

    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(0);

    rerender(
      <App inputOptions={{ enabled: true, wheel: true }}>
        <Targets />
      </App>
    );
    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(1);

    rerender(
      <App>
        <Targets />
      </App>
    );
    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(1);

    rerender(
      <App inputOptions={{ enabled: true, wheel: true }}>
        <Targets />
      </App>
    );
    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(2);
  });
});
