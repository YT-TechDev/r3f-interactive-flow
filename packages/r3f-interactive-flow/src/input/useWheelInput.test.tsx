import React, { act } from "react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import type { MinimalElement, MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useWheelInput } from "./useWheelInput";
import type { UseWheelInputOptions } from "./useWheelInput";

class MinimalWheelEvent {
  defaultPrevented = false;
  target: EventTarget | MinimalEventTarget | null = null;
  readonly type: string;
  readonly deltaY: number;

  constructor(type: string, eventInitDict: WheelEventInit = {}) {
    this.type = type;
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

function dispatchWheel(
  deltaY: number,
  target: MinimalEventTarget = windowTarget
): MinimalWheelEvent {
  const event = new WheelEvent("wheel", { deltaY }) as MinimalWheelEvent;

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
});
