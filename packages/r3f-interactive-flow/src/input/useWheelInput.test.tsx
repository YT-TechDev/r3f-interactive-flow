import React, { act, useContext } from "react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowContext } from "../react/FlowContext";
import type { MinimalElement, MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useWheelInput } from "./useWheelInput";
import type { UseWheelInputOptions } from "./useWheelInput";

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

installMinimalDom({ WheelEvent: MinimalWheelEvent as typeof globalThis.WheelEvent });

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const ControlsProbe = createControlsProbe<TestPhase>();
const { getRoot, renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function WheelInputProbe({ options = {} }: { options?: UseWheelInputOptions }) {
  useWheelInput<TestPhase>(options);

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

function dispatchWheel(
  deltaY: number,
  target: MinimalEventTarget = windowTarget,
  eventInitDict: WheelEventInit & { target?: EventTarget | MinimalEventTarget | null } = {}
): MinimalWheelEvent {
  const { target: eventTarget, ...wheelInit } = eventInitDict;
  const event = new WheelEvent("wheel", { ...wheelInit, deltaY }) as MinimalWheelEvent;
  event.target = eventTarget ?? null;

  act(() => {
    target.dispatchEvent(event);
  });

  return event;
}

describe("useWheelInput", () => {
  it("attaches a wheel event listener only when enabled", () => {
    const addEventListenerSpy = vi.spyOn(globalThis, "addEventListener");

    renderFlow(<WheelInputProbe options={{ enabled: false }} />);

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      "wheel",
      expect.any(Function),
      expect.anything()
    );
    expect(windowTarget.listenerCount("wheel")).toBe(0);

    renderFlow(<WheelInputProbe />);

    expect(addEventListenerSpy).toHaveBeenCalledWith("wheel", expect.any(Function), {
      passive: false
    });
    expect(windowTarget.listenerCount("wheel")).toBe(1);
  });

  it("navigates to the next phase when wheel down passes the threshold", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("navigates to the previous phase when wheel up passes the threshold", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchWheel(-41);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("ignores wheel deltas inside the threshold", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchWheel(40);
    dispatchWheel(-40);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("none");
  });

  it("allows a threshold of 0", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 0 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(1);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("does not navigate when disabled", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("navigates after being re-enabled", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: true }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("removes the wheel event listener when enabled changes to false", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: true }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(1);

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(0);

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("defaults preventDefault to true", () => {
    renderFlow(<WheelInputProbe />);

    const event = dispatchWheel(0);

    expect(event.defaultPrevented).toBe(true);
  });

  it("does not call preventDefault when preventDefault is false", () => {
    renderFlow(<WheelInputProbe options={{ preventDefault: false }} />);

    const event = dispatchWheel(0);

    expect(event.defaultPrevented).toBe(false);
  });

  it("does not navigate when the flow is locked", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    act(() => {
      latestControls?.lock();
    });
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.isLocked).toBe(true);

    act(() => {
      latestControls?.unlock();
    });
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
    expect(latestControls?.isLocked).toBe(false);
  });

  it("does not navigate when the flow is transitioning", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(41);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.isTransitioning).toBe(true);
  });

  it("cleans up the wheel event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(globalThis, "removeEventListener");

    renderFlow(<WheelInputProbe />);

    expect(windowTarget.listenerCount("wheel")).toBe(1);

    act(() => {
      getRoot()?.unmount();
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith("wheel", expect.any(Function));
    expect(windowTarget.listenerCount("wheel")).toBe(0);
  });

  it("does not require browser APIs at module import time", async () => {
    const originalWindow = globalThis.window;

    vi.resetModules();
    delete (globalThis as Partial<typeof globalThis>).window;

    await expect(import("./useWheelInput")).resolves.toHaveProperty("useWheelInput");

    Object.assign(globalThis, { window: originalWindow });
  });

  it("can attach to a provided target element", () => {
    const target = document.createElement("div");
    const targetRef = { current: target } satisfies RefObject<HTMLElement>;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(0);
    const minimalTarget = target as unknown as MinimalElement;

    expect(minimalTarget.listenerCount("wheel")).toBe(1);

    dispatchWheel(41, minimalTarget);

    expect(latestControls?.phase).toBe("work");
  });

  it("can attach directly to a provided HTMLElement target", () => {
    const target = document.createElement("div");
    const minimalTarget = target as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ target }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(0);
    expect(minimalTarget.listenerCount("wheel")).toBe(1);

    dispatchWheel(41, minimalTarget);

    expect(latestControls?.phase).toBe("work");
  });

  it("can attach explicitly to window", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ target: window }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(1);

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
  });

  it("falls back to window when a provided target ref is empty", () => {
    const targetRef = { current: null } satisfies RefObject<HTMLElement | null>;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(1);

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("uses deltaY for the y axis and deltaX for the x axis", () => {
    const yTarget = document.createElement("div") as unknown as MinimalElement;
    const xTarget = document.createElement("div") as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe
          options={{ axis: "y", threshold: 40, target: yTarget as unknown as HTMLElement }}
        />
        <WheelInputProbe
          options={{ axis: "x", threshold: 40, target: xTarget as unknown as HTMLElement }}
        />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(0, yTarget, { deltaX: 41 });

    expect(latestControls?.phase).toBe("intro");

    dispatchWheel(0, xTarget, { deltaX: 41 });

    expect(latestControls?.phase).toBe("work");
  });

  it("uses selected-axis sign for next and previous navigation", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ axis: "x", threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchWheel(0, windowTarget, { deltaX: -41 });

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("ignores user-provided selector matches without preventing default", () => {
    const ignored = document.createElement("div");
    ignored.setAttribute("class", "ignore-wheel");
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ ignore: [".ignore-wheel"] }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchWheel(41, windowTarget, {
      target: ignored as unknown as EventTarget
    });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
  });

  it("keeps preventDefault enabled by default for non-ignored events", () => {
    renderFlow(<WheelInputProbe options={{ ignore: [".ignore-wheel"] }} />);

    const event = dispatchWheel(41);

    expect(event.defaultPrevented).toBe(true);
  });

  it("blocks rapid repeated navigation with hook-local cooldown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ cooldown: 500 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>,
      "work",
      { transitionDurationMs: 100 }
    );

    dispatchWheel(-41);

    act(() => {
      machine?.update(100);
      syncSnapshot?.();
    });

    vi.setSystemTime(250);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("intro");

    vi.setSystemTime(500);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    vi.useRealTimers();
  });

  it("does not consume hook-local cooldown for locked, threshold, or ignored wheel events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    const ignored = document.createElement("div");
    ignored.setAttribute("class", "ignore-wheel");

    renderFlow(
      <>
        <WheelInputProbe options={{ cooldown: 500, ignore: [".ignore-wheel"], threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    act(() => {
      latestControls?.lock();
    });
    dispatchWheel(41);

    vi.setSystemTime(100);
    act(() => {
      latestControls?.unlock();
    });
    dispatchWheel(40);

    vi.setSystemTime(250);
    dispatchWheel(41, windowTarget, { target: ignored as unknown as EventTarget });
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("does not consume hook-local cooldown for rejected first-boundary wheel input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ cooldown: 500, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(-41);

    expect(latestControls).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    vi.setSystemTime(250);
    dispatchWheel(41);

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
    vi.useRealTimers();
  });

  it("does not consume hook-local cooldown for rejected last-boundary wheel input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ cooldown: 500, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>,
      undefined,
      { transitionDurationMs: 100, cooldownMs: 0 }
    );

    act(() => {
      machine?.goTo("contact");
      machine?.update(100);
      syncSnapshot?.();
    });

    dispatchWheel(41);

    expect(latestControls).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    vi.setSystemTime(250);
    dispatchWheel(-41);

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
    vi.useRealTimers();
  });
  it("does not extend hook-local cooldown for wheel events ignored while transitioning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ cooldown: 500 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>
    );

    dispatchWheel(41);

    vi.setSystemTime(1_400);
    dispatchWheel(41);

    act(() => {
      machine?.update(1_000);
      syncSnapshot?.();
    });

    vi.setSystemTime(1_500);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("does not navigate through wheel input while the flow transition cooldown is active", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>,
      undefined,
      { transitionDurationMs: 100, cooldownMs: 500 }
    );

    dispatchWheel(41);

    act(() => {
      machine?.update(100);
      syncSnapshot?.();
    });

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.isTransitioning).toBe(false);

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");

    act(() => {
      machine?.update(400);
      syncSnapshot?.();
    });

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
  });

  it("removes the listener from the old target when the target changes", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;

    function RetargetingProbe({ target }: { target: HTMLElement }) {
      useWheelInput<TestPhase>({ target });

      return null;
    }

    renderFlow(
      <>
        <RetargetingProbe target={firstTarget as unknown as HTMLElement} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("wheel")).toBe(1);

    renderFlow(
      <>
        <RetargetingProbe target={secondTarget as unknown as HTMLElement} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("wheel")).toBe(0);
    expect(secondTarget.listenerCount("wheel")).toBe(1);

    dispatchWheel(41, firstTarget);

    expect(latestControls?.phase).toBe("intro");

    dispatchWheel(41, secondTarget);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("throws a clear error for invalid cooldown values", () => {
    expect(() => renderFlow(<WheelInputProbe options={{ cooldown: -1 }} />)).toThrow(
      "useWheelInput cooldown must be a finite non-negative number."
    );
  });

  it("throws a clear error for invalid threshold values", () => {
    for (const threshold of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
      expect(() => renderFlow(<WheelInputProbe options={{ threshold }} />)).toThrow(
        "useWheelInput threshold must be a finite non-negative number."
      );
    }
  });
});
