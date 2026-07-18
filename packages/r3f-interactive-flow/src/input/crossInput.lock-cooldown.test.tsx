import React, { act, useContext } from "react";
import { describe, expect, it } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowMachineContext } from "../react/FlowContext";
import type { MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useKeyboardInput } from "./useKeyboardInput";
import { useTouchInput } from "./useTouchInput";
import { useWheelInput } from "./useWheelInput";

type MinimalTouch = {
  clientX: number;
  clientY: number;
};

class MinimalKeyboardEvent {
  defaultPrevented = false;
  target: EventTarget | MinimalEventTarget | null;
  readonly key: string;
  readonly repeat: boolean;
  readonly type: string;

  constructor(type: string, eventInitDict: KeyboardEventInit = {}) {
    this.type = type;
    this.key = eventInitDict.key ?? "";
    this.repeat = eventInitDict.repeat ?? false;
    this.target = (eventInitDict as { target?: EventTarget | MinimalEventTarget }).target ?? null;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

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
  KeyboardEvent: MinimalKeyboardEvent as typeof globalThis.KeyboardEvent,
  TouchEvent: MinimalTouchEvent as unknown as typeof globalThis.TouchEvent,
  WheelEvent: MinimalWheelEvent as typeof globalThis.WheelEvent
});

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const ControlsProbe = createControlsProbe<TestPhase>();
const { renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function AllInputProbe() {
  useWheelInput<TestPhase>({ threshold: 40 });
  useKeyboardInput<TestPhase>();
  useTouchInput<TestPhase>({ threshold: 40 });

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

function dispatchKeyDown(key: string): MinimalKeyboardEvent {
  const event = new KeyboardEvent("keydown", { key }) as MinimalKeyboardEvent;

  act(() => {
    windowTarget.dispatchEvent(event);
  });

  return event;
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

function renderCrossInputFlow(
  initialPhase?: TestPhase,
  options: Parameters<typeof renderFlow>[2] = {}
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
      <AllInputProbe />
      <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      <MachineProbe
        onRender={(renderedMachine, renderedSyncSnapshot) => {
          machine = renderedMachine;
          syncSnapshot = renderedSyncSnapshot;
        }}
      />
    </>,
    initialPhase,
    options
  );

  return {
    getControls: () => latestControls,
    getMachine: () => machine,
    sync: () => syncSnapshot?.()
  };
}

describe("cross-input lock and cooldown behavior", () => {
  it("keeps wheel and keyboard next input from bypassing a shared lock", () => {
    const flow = renderCrossInputFlow();

    act(() => {
      flow.getControls()?.lock();
    });

    dispatchWheel(41);
    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("none");

    act(() => {
      flow.getControls()?.unlock();
    });

    expect(flow.getControls()?.phase).toBe("intro");

    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("keeps keyboard and wheel prev input from bypassing a shared lock", () => {
    const flow = renderCrossInputFlow("work");

    act(() => {
      flow.getControls()?.lock();
    });

    dispatchKeyDown("ArrowUp");
    dispatchWheel(-41);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("none");

    act(() => {
      flow.getControls()?.unlock();
    });

    expect(flow.getControls()?.phase).toBe("work");

    dispatchWheel(-41);

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("prev");
  });

  it("keeps keyboard and touch input from bypassing wheel-started flow cooldown", () => {
    const flow = renderCrossInputFlow(undefined, { transitionDurationMs: 100, cooldownMs: 500 });

    dispatchWheel(41);

    act(() => {
      flow.getMachine()?.update(100);
      flow.sync();
    });

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.isTransitioning).toBe(false);

    dispatchKeyDown("ArrowDown");
    swipe(100, 59);

    expect(flow.getControls()?.phase).toBe("work");

    act(() => {
      flow.getMachine()?.update(500);
      flow.sync();
    });

    expect(flow.getControls()?.phase).toBe("work");

    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("contact");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("keeps wheel and keyboard input from bypassing touch-started flow cooldown", () => {
    const flow = renderCrossInputFlow(undefined, { transitionDurationMs: 100, cooldownMs: 500 });

    swipe(100, 59);

    act(() => {
      flow.getMachine()?.update(100);
      flow.sync();
    });

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.isTransitioning).toBe(false);

    dispatchWheel(41);
    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("work");

    act(() => {
      flow.getMachine()?.update(500);
      flow.sync();
    });

    expect(flow.getControls()?.phase).toBe("work");

    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("contact");
    expect(flow.getControls()?.direction).toBe("next");
  });
});
