import React, { act, useContext } from "react";
import { describe, expect, it } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowMachineContext } from "../react/FlowContext";
import type { MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useTouchInput } from "./useTouchInput";
import type { UseTouchInputOptions } from "./useTouchInput";
import { useWheelInput } from "./useWheelInput";
import type { UseWheelInputOptions } from "./useWheelInput";

type MinimalTouch = {
  clientX: number;
  clientY: number;
};

class MinimalTouchEvent {
  changedTouches: MinimalTouch[];
  defaultPrevented = false;
  target: EventTarget | MinimalEventTarget | null = null;
  touches: MinimalTouch[];
  readonly type: string;

  constructor(
    type: string,
    eventInitDict: { changedTouches?: MinimalTouch[]; touches?: MinimalTouch[] } = {}
  ) {
    this.type = type;
    this.changedTouches = eventInitDict.changedTouches ?? [];
    this.touches = eventInitDict.touches ?? [];
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

class MinimalWheelEvent {
  defaultPrevented = false;
  target: EventTarget | MinimalEventTarget | null = null;
  readonly type: string;
  readonly deltaX: number;
  readonly deltaY: number;

  constructor(type: string, eventInitDict: WheelEventInit = {}) {
    this.type = type;
    this.deltaX = eventInitDict.deltaX ?? 0;
    this.deltaY = eventInitDict.deltaY ?? 0;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

installMinimalDom({
  TouchEvent: MinimalTouchEvent as unknown as typeof globalThis.TouchEvent,
  WheelEvent: MinimalWheelEvent as typeof globalThis.WheelEvent
});

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const ControlsProbe = createControlsProbe<TestPhase>();
const { renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function TouchWheelInputProbe({
  touchOptions = {},
  wheelOptions = {}
}: {
  touchOptions?: UseTouchInputOptions;
  wheelOptions?: UseWheelInputOptions;
}) {
  useTouchInput<TestPhase>({ threshold: 40, ...touchOptions });
  useWheelInput<TestPhase>({ threshold: 40, ...wheelOptions });

  return null;
}

function MachineProbe({
  onRender
}: {
  onRender: (machine: FlowMachine<TestPhase>, syncSnapshot: () => void) => void;
}) {
  const context = useContext(FlowMachineContext);

  if (context === null) {
    throw new Error("MachineProbe must be rendered inside FlowProvider.");
  }

  onRender(context.machine as FlowMachine<TestPhase>, context.syncSnapshot as () => void);

  return null;
}

function dispatchWheel(deltaY: number): MinimalWheelEvent {
  const event = new WheelEvent("wheel", { deltaY }) as MinimalWheelEvent;

  act(() => {
    windowTarget.dispatchEvent(event);
  });

  return event;
}

function dispatchTouch(
  type: string,
  eventInitDict: { changedTouches?: MinimalTouch[]; touches?: MinimalTouch[] } = {}
): MinimalTouchEvent {
  const event = new MinimalTouchEvent(type, eventInitDict);

  act(() => {
    windowTarget.dispatchEvent(event);
  });

  return event;
}

function swipe(startY: number, endY: number): void {
  dispatchTouch("touchstart", { touches: [{ clientX: 0, clientY: startY }] });
  dispatchTouch("touchend", { changedTouches: [{ clientX: 0, clientY: endY }] });
}

function renderTouchWheelFlow(
  initialPhase?: TestPhase,
  inputOptions: {
    touchOptions?: UseTouchInputOptions;
    wheelOptions?: UseWheelInputOptions;
  } = {}
): {
  getControls: () => FlowControls<TestPhase> | undefined;
  getMachine: () => FlowMachine<TestPhase> | undefined;
  sync: () => void;
} {
  let latestControls: FlowControls<TestPhase> | undefined;
  let machine: FlowMachine<TestPhase> | undefined;
  let syncSnapshot: (() => void) | undefined;

  renderFlow(
    <>
      <TouchWheelInputProbe {...inputOptions} />
      <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      <MachineProbe
        onRender={(renderedMachine, renderedSyncSnapshot) => {
          machine = renderedMachine;
          syncSnapshot = renderedSyncSnapshot;
        }}
      />
    </>,
    initialPhase
  );

  return {
    getControls: () => latestControls,
    getMachine: () => machine,
    sync: () => syncSnapshot?.()
  };
}

function finishTransition(flow: ReturnType<typeof renderTouchWheelFlow>): void {
  act(() => {
    flow.getMachine()?.update(1_000);
    flow.sync();
  });
}

describe("touch and wheel input mounted together", () => {
  it("navigates next from wheel input without duplicate touch navigation", () => {
    const flow = renderTouchWheelFlow();

    expect(windowTarget.listenerCount("wheel")).toBe(1);
    expect(windowTarget.listenerCount("touchstart")).toBe(1);
    expect(windowTarget.listenerCount("touchend")).toBe(1);

    dispatchWheel(41);
    swipe(100, 59);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
    expect(flow.getControls()?.isTransitioning).toBe(true);
  });

  it("navigates next from touch input without duplicate wheel navigation", () => {
    const flow = renderTouchWheelFlow();

    swipe(100, 59);
    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
    expect(flow.getControls()?.isTransitioning).toBe(true);
  });

  it("resolves touch swipe next and wheel next consistently after transitions finish", () => {
    const flow = renderTouchWheelFlow();

    swipe(100, 59);
    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");

    finishTransition(flow);
    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("contact");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("resolves touch swipe previous and wheel previous consistently after transitions finish", () => {
    const flow = renderTouchWheelFlow("contact");

    swipe(100, 141);
    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("prev");

    finishTransition(flow);
    dispatchWheel(-41);

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("prev");
  });

  it("keeps touch threshold behavior while wheel input is mounted", () => {
    const flow = renderTouchWheelFlow();

    swipe(100, 60);

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("none");

    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("keeps wheel threshold behavior while touch input is mounted", () => {
    const flow = renderTouchWheelFlow();

    dispatchWheel(40);

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("none");

    swipe(100, 59);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("keeps wheel input active when touch input is disabled", () => {
    const flow = renderTouchWheelFlow(undefined, { touchOptions: { enabled: false } });

    expect(windowTarget.listenerCount("touchstart")).toBe(0);
    expect(windowTarget.listenerCount("touchend")).toBe(0);
    expect(windowTarget.listenerCount("wheel")).toBe(1);

    swipe(100, 59);
    expect(flow.getControls()?.phase).toBe("intro");

    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("keeps touch input active when wheel input is disabled", () => {
    const flow = renderTouchWheelFlow(undefined, { wheelOptions: { enabled: false } });

    expect(windowTarget.listenerCount("touchstart")).toBe(1);
    expect(windowTarget.listenerCount("touchend")).toBe(1);
    expect(windowTarget.listenerCount("wheel")).toBe(0);

    dispatchWheel(41);
    expect(flow.getControls()?.phase).toBe("intro");

    swipe(100, 59);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("does not replay ignored touch input after later wheel input", () => {
    const flow = renderTouchWheelFlow("work");

    swipe(100, 60);
    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("contact");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("does not replay ignored wheel input after later touch input", () => {
    const flow = renderTouchWheelFlow("work");

    dispatchWheel(40);
    swipe(100, 141);

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("prev");
  });
});
