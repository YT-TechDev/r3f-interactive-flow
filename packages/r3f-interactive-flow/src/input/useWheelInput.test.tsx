import React, { act, useContext, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowMachineContext } from "../react/FlowContext";
import type { MinimalElement, MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useWheelInput } from "./useWheelInput";
import type { UseWheelInputOptions } from "./useWheelInput";

class MinimalWheelEvent {
  static readonly DOM_DELTA_PIXEL = 0;
  static readonly DOM_DELTA_LINE = 1;
  static readonly DOM_DELTA_PAGE = 2;

  defaultPrevented = false;
  target: EventTarget | MinimalEventTarget | null = null;
  readonly type: string;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;

  constructor(type: string, eventInitDict: WheelEventInit = {}) {
    this.type = type;
    this.deltaX = eventInitDict.deltaX ?? 0;
    this.deltaY = eventInitDict.deltaY ?? 0;
    this.deltaMode = eventInitDict.deltaMode ?? MinimalWheelEvent.DOM_DELTA_PIXEL;
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
  const context = useContext(FlowMachineContext);

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

  it("normalizes pixel, line, page, and unknown wheel delta modes before threshold checks", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(41, windowTarget, { deltaMode: WheelEvent.DOM_DELTA_PIXEL });
    expect(latestControls?.phase).toBe("work");

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work",
      { providerKey: "line-mode", transition: { duration: 0 } }
    );

    dispatchWheel(3, windowTarget, { deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(latestControls?.phase).toBe("contact");

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 799 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      undefined,
      { providerKey: "page-mode", transition: { duration: 0 } }
    );

    dispatchWheel(1, windowTarget, { deltaMode: WheelEvent.DOM_DELTA_PAGE });
    expect(latestControls?.phase).toBe("work");

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      undefined,
      { providerKey: "unknown-mode", transition: { duration: 0 } }
    );

    dispatchWheel(41, windowTarget, { deltaMode: 99 });
    expect(latestControls?.phase).toBe("work");
  });

  it("normalizes horizontal wheel input on the x axis", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ axis: "x", threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(0, windowTarget, { deltaX: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
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

    const upEvent = dispatchWheel(40);
    const downEvent = dispatchWheel(-40);

    expect(upEvent.defaultPrevented).toBe(false);
    expect(downEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("none");
  });

  it("accumulates same-direction fragments and only prevents the accepted threshold-crossing event", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const first = dispatchWheel(10);
    const second = dispatchWheel(15);
    const third = dispatchWheel(16);

    expect(first.defaultPrevented).toBe(false);
    expect(second.defaultPrevented).toBe(false);
    expect(third.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");
  });

  it("keeps accumulated accepted navigation unprevented when preventDefault is false", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40, preventDefault: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const first = dispatchWheel(20);
    const second = dispatchWheel(21);

    expect(first.defaultPrevented).toBe(false);
    expect(second.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
  });

  it("treats accumulated values exactly equal to the threshold as below trigger", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const exactThreshold = dispatchWheel(15);
    dispatchWheel(25);

    expect(exactThreshold.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");

    dispatchWheel(1);

    expect(latestControls?.phase).toBe("work");
  });

  it("discards overflow after a threshold crossing attempt", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchWheel(-100);
    dispatchWheel(1);

    expect(latestControls?.phase).toBe("intro");
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

  it("does not validate wheel navigation options or attach listeners while disabled", () => {
    expect(() =>
      renderFlow(
        <WheelInputProbe
          options={{
            enabled: false,
            cooldown: -1,
            threshold: Number.NaN
          }}
        />
      )
    ).not.toThrow();

    expect(windowTarget.listenerCount("wheel")).toBe(0);
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

  it("does not replay disabled wheel input or duplicate listeners after re-enable", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: false, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(41);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("intro");
    expect(windowTarget.listenerCount("wheel")).toBe(0);

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: true, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(latestControls?.phase).toBe("intro");
    expect(windowTarget.listenerCount("wheel")).toBe(1);

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: false, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );
    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: true, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(1);

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

  it("defaults preventDefault to true for accepted next navigation", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchWheel(41);

    expect(event.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");
  });

  it("defaults preventDefault to true for accepted prev navigation", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    const event = dispatchWheel(-41);

    expect(event.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("intro");
  });

  it("does not call preventDefault for accepted navigation when preventDefault is false", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ preventDefault: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchWheel(41);

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
  });

  it("does not call preventDefault when the wheel delta misses the threshold", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchWheel(40);

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
  });

  it("does not call preventDefault for rejected first-boundary wheel input", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchWheel(-41);

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
  });

  it("does not call preventDefault for rejected last-boundary wheel input", () => {
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
      { transitionDurationMs: 100, cooldownMs: 0 }
    );

    act(() => {
      machine?.goTo("contact");
      machine?.update(100);
      syncSnapshot?.();
    });

    const event = dispatchWheel(41);

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("contact");
  });

  it("does not call preventDefault for wheel events targeting an actionable or editable control", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const button = document.createElement("button");
    const input = document.createElement("input");

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const buttonEvent = dispatchWheel(41, windowTarget, {
      target: button as unknown as EventTarget
    });
    const inputEvent = dispatchWheel(41, windowTarget, {
      target: input as unknown as EventTarget
    });

    expect(buttonEvent.defaultPrevented).toBe(false);
    expect(inputEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("triggers exactly one accepted navigation per accepted wheel event", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(renderedMachine) => (machine = renderedMachine)} />
      </>
    );

    const nextSpy = machine ? vi.spyOn(machine, "next") : undefined;
    dispatchWheel(41);

    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(latestControls?.phase).toBe("work");
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
    const lockedEvent = dispatchWheel(41);

    expect(lockedEvent.defaultPrevented).toBe(false);
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
    const transitioningEvent = dispatchWheel(41);

    expect(transitioningEvent.defaultPrevented).toBe(false);
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

  it("does not navigate from wheel events after the input hook unmounts", () => {
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

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    expect(windowTarget.listenerCount("wheel")).toBe(0);

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
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

  it("moves the wheel listener when a target ref points to a new element", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    const targetRef = { current: firstTarget as unknown as HTMLElement };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef, threshold: 41 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("wheel")).toBe(1);
    expect(secondTarget.listenerCount("wheel")).toBe(0);

    targetRef.current = secondTarget as unknown as HTMLElement;
    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );
    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("wheel")).toBe(0);
    expect(secondTarget.listenerCount("wheel")).toBe(1);

    dispatchWheel(41, firstTarget);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    dispatchWheel(41, secondTarget);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("re-enables wheel input on the current target ref only", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    const targetRef = { current: firstTarget as unknown as HTMLElement };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: false, target: targetRef, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("wheel")).toBe(0);

    targetRef.current = secondTarget as unknown as HTMLElement;
    renderFlow(
      <>
        <WheelInputProbe options={{ enabled: true, target: targetRef, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("wheel")).toBe(0);
    expect(secondTarget.listenerCount("wheel")).toBe(1);

    dispatchWheel(41, firstTarget);
    expect(latestControls?.phase).toBe("intro");

    dispatchWheel(41, secondTarget);
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

  it("does not fall back to window when an explicit target ref is empty", () => {
    const targetRef: RefObject<HTMLElement | null> = { current: null };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(0);

    dispatchWheel(41);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    act(() => {
      getRoot()?.unmount();
    });

    expect(windowTarget.listenerCount("wheel")).toBe(0);
  });

  it("attaches on a later relevant effect run after an explicit ref resolves", () => {
    const target = document.createElement("div") as unknown as MinimalElement;
    const targetRef: RefObject<HTMLElement | null> = { current: null };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef, threshold: 41 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(0);
    expect(target.listenerCount("wheel")).toBe(0);

    targetRef.current = target as unknown as HTMLElement;
    renderFlow(
      <>
        <WheelInputProbe options={{ target: targetRef, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(0);
    expect(target.listenerCount("wheel")).toBe(1);

    dispatchWheel(41, target);

    expect(latestControls?.phase).toBe("work");
  });

  it("resolves a React element ref in the effect after commit", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let attachedTarget: MinimalElement | undefined;

    function RefTimingProbe() {
      const targetRef = useRef<HTMLDivElement | null>(null);
      useWheelInput<TestPhase>({ target: targetRef, threshold: 40 });

      useEffect(() => {
        attachedTarget = targetRef.current as unknown as MinimalElement;
      });

      return <div ref={targetRef} />;
    }

    renderFlow(
      <>
        <RefTimingProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("wheel")).toBe(0);
    expect(attachedTarget?.listenerCount("wheel")).toBe(1);

    dispatchWheel(41, attachedTarget);

    expect(latestControls?.phase).toBe("work");
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

    vi.advanceTimersByTime(250);
    const cooldownEvent = dispatchWheel(41);

    expect(cooldownEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");

    vi.advanceTimersByTime(250);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("work");
    vi.useRealTimers();
  });

  it("uses monotonic elapsed time for wheel cooldown across wall-clock jumps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ cooldown: 500, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      undefined,
      { transitionDurationMs: 0, cooldownMs: 0 }
    );

    const accepted = dispatchWheel(41);
    expect(accepted.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");

    vi.setSystemTime(1_000_000);
    const forwardJumpEvent = dispatchWheel(41);
    expect(forwardJumpEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");

    vi.setSystemTime(0);
    vi.advanceTimersByTime(500);
    const boundaryEvent = dispatchWheel(41);
    expect(boundaryEvent.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("contact");
    vi.useRealTimers();
  });

  it("uses monotonic elapsed time for wheel burst inactivity across wall-clock jumps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40, cooldown: 0 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      undefined,
      { transitionDurationMs: 0, cooldownMs: 0 }
    );

    dispatchWheel(25);
    vi.setSystemTime(1_000_000);
    vi.advanceTimersByTime(200);
    const liveBurstEvent = dispatchWheel(20);

    expect(liveBurstEvent.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");

    vi.advanceTimersByTime(201);
    vi.setSystemTime(0);
    dispatchWheel(25);

    expect(latestControls?.phase).toBe("work");

    const freshBurstEvent = dispatchWheel(20);
    expect(freshBurstEvent.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("contact");
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

    vi.advanceTimersByTime(100);
    act(() => {
      latestControls?.unlock();
    });
    dispatchWheel(40);

    vi.advanceTimersByTime(150);
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

    vi.advanceTimersByTime(250);
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
    vi.advanceTimersByTime(250);
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

    vi.advanceTimersByTime(400);
    const transitionEvent = dispatchWheel(41);

    expect(transitionEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");

    act(() => {
      machine?.update(1_000);
      syncSnapshot?.();
    });

    vi.advanceTimersByTime(100);
    const boundaryEvent = dispatchWheel(41);

    expect(boundaryEvent.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("does not navigate through wheel input while the flow transition cooldown is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
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

    const cooldownEvent = dispatchWheel(41);

    expect(cooldownEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");

    act(() => {
      machine?.update(500);
      syncSnapshot?.();
    });

    vi.advanceTimersByTime(201);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("uses a reversing event as the first delta of a new burst", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchWheel(30);
    dispatchWheel(-41);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("allows at most one accepted navigation in a same-direction wheel burst", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40, cooldown: 0 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>,
      undefined,
      { transitionDurationMs: 1, cooldownMs: 0 }
    );

    const accepted = dispatchWheel(41);
    act(() => {
      machine?.update(1);
      syncSnapshot?.();
    });
    vi.advanceTimersByTime(100);
    const momentum = dispatchWheel(41);

    expect(accepted.defaultPrevented).toBe(true);
    expect(momentum.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
    vi.useRealTimers();
  });

  it("preserves consumed wheel burst state across semantically equivalent inline ignore options", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    function InlineIgnoreWheelInputProbe() {
      useWheelInput<TestPhase>({
        threshold: 40,
        cooldown: 0,
        ignore: ["[data-flow-ignore]"]
      });

      return null;
    }

    renderFlow(
      <>
        <InlineIgnoreWheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>,
      undefined,
      { transitionDurationMs: 1, cooldownMs: 0 }
    );

    const accepted = dispatchWheel(41);
    act(() => {
      machine?.update(1);
      syncSnapshot?.();
    });
    vi.advanceTimersByTime(100);
    const momentum = dispatchWheel(41);

    expect(accepted.defaultPrevented).toBe(true);
    expect(momentum.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
    vi.useRealTimers();
  });

  it("starts a new wheel burst after inactivity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40, cooldown: 0 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>,
      undefined,
      { transitionDurationMs: 1, cooldownMs: 0 }
    );

    dispatchWheel(41);
    act(() => {
      machine?.update(1);
      syncSnapshot?.();
    });
    vi.advanceTimersByTime(201);
    dispatchWheel(41);

    expect(latestControls?.phase).toBe("contact");
    vi.useRealTimers();
  });

  it("clears stale accumulation when the wheel event target changes", () => {
    const firstTarget = document.createElement("div");
    const secondTarget = document.createElement("div");
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(30, windowTarget, { target: firstTarget as unknown as EventTarget });
    dispatchWheel(11, windowTarget, { target: secondTarget as unknown as EventTarget });

    expect(latestControls?.phase).toBe("intro");

    dispatchWheel(30, windowTarget, { target: secondTarget as unknown as EventTarget });

    expect(latestControls?.phase).toBe("work");
  });

  it("clears stale accumulation after ignored or actionable targets", () => {
    const ignored = document.createElement("div");
    ignored.setAttribute("class", "ignore-wheel");
    const button = document.createElement("button");
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40, ignore: [".ignore-wheel"] }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(30);
    dispatchWheel(41, windowTarget, { target: ignored as unknown as EventTarget });
    dispatchWheel(11);

    expect(latestControls?.phase).toBe("intro");

    dispatchWheel(5);
    dispatchWheel(41, windowTarget, { target: button as unknown as EventTarget });
    dispatchWheel(11);

    expect(latestControls?.phase).toBe("intro");
  });

  it("clears rejected threshold-crossing accumulation without preventing default", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(-30);
    const rejected = dispatchWheel(-11);
    dispatchWheel(1);

    expect(rejected.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
  });

  it("does not retain pending accumulation across effect replacement or target changes", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe
          options={{ target: firstTarget as unknown as HTMLElement, threshold: 40 }}
        />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(30, firstTarget);

    renderFlow(
      <>
        <WheelInputProbe
          options={{ target: secondTarget as unknown as HTMLElement, threshold: 40 }}
        />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchWheel(11, secondTarget);

    expect(latestControls?.phase).toBe("intro");
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
