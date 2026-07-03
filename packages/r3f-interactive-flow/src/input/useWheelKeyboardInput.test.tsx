import React, { act, useContext } from "react";
import { describe, expect, it } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowContext } from "../react/FlowContext";
import type { MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useKeyboardInput } from "./useKeyboardInput";
import type { UseKeyboardInputOptions } from "./useKeyboardInput";
import { useWheelInput } from "./useWheelInput";
import type { UseWheelInputOptions } from "./useWheelInput";

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
  WheelEvent: MinimalWheelEvent as typeof globalThis.WheelEvent
});

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const ControlsProbe = createControlsProbe<TestPhase>();
const { renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function WheelKeyboardInputProbe({
  keyboardOptions = {},
  wheelOptions = {}
}: {
  keyboardOptions?: UseKeyboardInputOptions;
  wheelOptions?: UseWheelInputOptions;
}) {
  useWheelInput<TestPhase>({ threshold: 40, ...wheelOptions });
  useKeyboardInput<TestPhase>(keyboardOptions);

  return null;
}

function MachineProbe({
  onRender
}: {
  onRender: (machine: FlowMachine<TestPhase>, syncSnapshot: () => void) => void;
}) {
  const context = useContext(FlowContext);

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

function dispatchKeyDown(
  key: string,
  eventInitDict: KeyboardEventInit & { target?: EventTarget | MinimalEventTarget } = {}
): MinimalKeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, ...eventInitDict }) as MinimalKeyboardEvent;

  act(() => {
    windowTarget.dispatchEvent(event);
  });

  return event;
}

function renderWheelKeyboardFlow(
  initialPhase?: TestPhase,
  inputOptions: {
    keyboardOptions?: UseKeyboardInputOptions;
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
      <WheelKeyboardInputProbe {...inputOptions} />
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

function finishTransition(flow: ReturnType<typeof renderWheelKeyboardFlow>): void {
  act(() => {
    flow.getMachine()?.update(1_000);
    flow.sync();
  });
}

describe("wheel and keyboard input mounted together", () => {
  it("navigates next from wheel input without duplicate keyboard navigation", () => {
    const flow = renderWheelKeyboardFlow();

    expect(windowTarget.listenerCount("wheel")).toBe(1);
    expect(windowTarget.listenerCount("keydown")).toBe(1);

    dispatchWheel(41);
    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
    expect(flow.getControls()?.isTransitioning).toBe(true);
  });

  it("navigates next from keyboard input without duplicate wheel navigation", () => {
    const flow = renderWheelKeyboardFlow();

    dispatchKeyDown("ArrowDown");
    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
    expect(flow.getControls()?.isTransitioning).toBe(true);
  });

  it("resolves wheel and keyboard next input consistently after transitions finish", () => {
    const flow = renderWheelKeyboardFlow();

    dispatchWheel(41);
    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");

    finishTransition(flow);
    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("contact");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("resolves wheel and keyboard previous input consistently after transitions finish", () => {
    const flow = renderWheelKeyboardFlow("contact");

    dispatchWheel(-41);
    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("prev");

    finishTransition(flow);
    dispatchKeyDown("ArrowUp");

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("prev");
  });

  it("keeps wheel threshold behavior while keyboard input is mounted", () => {
    const flow = renderWheelKeyboardFlow();

    dispatchWheel(40);

    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("none");

    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("does not replay ignored wheel input after later keyboard input", () => {
    const flow = renderWheelKeyboardFlow("work");

    dispatchWheel(40);
    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("contact");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("does not replay ignored keyboard input after later wheel input", () => {
    const flow = renderWheelKeyboardFlow("work");
    const input = document.createElement("input");

    const event = dispatchKeyDown("ArrowDown", { target: input });
    dispatchWheel(-41);

    expect(event.defaultPrevented).toBe(false);
    expect(flow.getControls()?.phase).toBe("intro");
    expect(flow.getControls()?.direction).toBe("prev");
  });

  it("keeps keyboard input active when wheel input is disabled", () => {
    const flow = renderWheelKeyboardFlow(undefined, { wheelOptions: { enabled: false } });

    expect(windowTarget.listenerCount("wheel")).toBe(0);
    expect(windowTarget.listenerCount("keydown")).toBe(1);

    dispatchWheel(41);
    expect(flow.getControls()?.phase).toBe("intro");

    dispatchKeyDown("ArrowDown");

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });

  it("keeps wheel input active when keyboard input is disabled", () => {
    const flow = renderWheelKeyboardFlow(undefined, { keyboardOptions: { enabled: false } });

    expect(windowTarget.listenerCount("wheel")).toBe(1);
    expect(windowTarget.listenerCount("keydown")).toBe(0);

    dispatchKeyDown("ArrowDown");
    expect(flow.getControls()?.phase).toBe("intro");

    dispatchWheel(41);

    expect(flow.getControls()?.phase).toBe("work");
    expect(flow.getControls()?.direction).toBe("next");
  });
});
