import React, { act } from "react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import type { MinimalElement, MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useTouchInput } from "./useTouchInput";
import type { UseTouchInputOptions } from "./useTouchInput";

type MinimalTouch = {
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

installMinimalDom({ TouchEvent: MinimalTouchEvent as unknown as typeof globalThis.TouchEvent });

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const ControlsProbe = createControlsProbe<TestPhase>();
const touchEventTypes = ["touchstart", "touchmove", "touchend", "touchcancel"] as const;
const { getRoot, renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function TouchInputProbe({ options = {} }: { options?: UseTouchInputOptions }) {
  useTouchInput<TestPhase>(options);

  return null;
}

function dispatchTouch(
  type: string,
  eventInitDict: { changedTouches?: MinimalTouch[]; touches?: MinimalTouch[] } = {},
  target: MinimalEventTarget = windowTarget
): MinimalTouchEvent {
  const event = new MinimalTouchEvent(type, eventInitDict);

  act(() => {
    target.dispatchEvent(event);
  });

  return event;
}

function swipe(startY: number, endY: number, target: MinimalEventTarget = windowTarget): void {
  dispatchTouch("touchstart", { touches: [{ clientY: startY }] }, target);
  dispatchTouch("touchend", { changedTouches: [{ clientY: endY }] }, target);
}

describe("useTouchInput", () => {
  it("attaches touchstart, touchmove, touchend, and touchcancel listeners when enabled", () => {
    const addEventListenerSpy = vi.spyOn(globalThis, "addEventListener");

    renderFlow(<TouchInputProbe />);

    expect(addEventListenerSpy).toHaveBeenCalledWith("touchstart", expect.any(Function), {
      passive: true
    });
    expect(addEventListenerSpy).toHaveBeenCalledWith("touchmove", expect.any(Function), {
      passive: false
    });
    expect(addEventListenerSpy).toHaveBeenCalledWith("touchend", expect.any(Function), {
      passive: true
    });
    expect(addEventListenerSpy).toHaveBeenCalledWith("touchcancel", expect.any(Function), {
      passive: true
    });

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(1);
    }
  });

  it("does not attach listeners when disabled", () => {
    const addEventListenerSpy = vi.spyOn(globalThis, "addEventListener");

    renderFlow(<TouchInputProbe options={{ enabled: false }} />);

    for (const type of touchEventTypes) {
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        type,
        expect.any(Function),
        expect.anything()
      );
      expect(windowTarget.listenerCount(type)).toBe(0);
    }
  });

  it("uses window as the default target", () => {
    renderFlow(<TouchInputProbe />);

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(1);
    }
  });

  it("can attach to a provided target ref", () => {
    const target = document.createElement("div");
    const targetRef = { current: target } satisfies RefObject<HTMLElement>;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(0);
    }

    const minimalTarget = target as unknown as MinimalElement;

    for (const type of touchEventTypes) {
      expect(minimalTarget.listenerCount(type)).toBe(1);
    }

    swipe(100, 49, minimalTarget);

    expect(latestControls?.phase).toBe("work");
  });

  it("cleans up all touch listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(globalThis, "removeEventListener");

    renderFlow(<TouchInputProbe />);

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(1);
    }

    act(() => {
      getRoot()?.unmount();
    });

    for (const type of touchEventTypes) {
      expect(removeEventListenerSpy).toHaveBeenCalledWith(type, expect.any(Function));
      expect(windowTarget.listenerCount(type)).toBe(0);
    }
  });

  it("defaults preventDefault to true for touchmove", () => {
    renderFlow(<TouchInputProbe />);

    const event = dispatchTouch("touchmove");

    expect(event.defaultPrevented).toBe(true);
  });

  it("does not call preventDefault when preventDefault is false", () => {
    renderFlow(<TouchInputProbe options={{ preventDefault: false }} />);

    const event = dispatchTouch("touchmove");

    expect(event.defaultPrevented).toBe(false);
  });

  it("uses the default threshold of 50", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    swipe(100, 50);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    swipe(100, 49);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("swipe up beyond threshold calls next", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    swipe(100, 59);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("swipe down beyond threshold calls prev", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    swipe(100, 141);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("swipes at or within threshold do not navigate", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    swipe(100, 60);
    swipe(100, 140);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("none");
  });

  it("touchcancel resets the stored start position so a later touchend does not navigate accidentally", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchTouch("touchstart", { touches: [{ clientY: 100 }] });
    dispatchTouch("touchcancel");
    dispatchTouch("touchend", { changedTouches: [{ clientY: 0 }] });

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("missing touches[0] on touchstart does not crash or navigate", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(() => {
      dispatchTouch("touchstart", { touches: [] });
      dispatchTouch("touchend", { changedTouches: [{ clientY: 0 }] });
    }).not.toThrow();
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("missing changedTouches[0] on touchend does not crash or navigate", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(() => {
      dispatchTouch("touchstart", { touches: [{ clientY: 100 }] });
      dispatchTouch("touchend", { changedTouches: [] });
    }).not.toThrow();
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("does not navigate when the flow is locked", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    act(() => {
      latestControls?.lock();
    });
    swipe(100, 49);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.isLocked).toBe(true);
  });

  it("does not navigate when the flow is already transitioning", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    swipe(100, 49);
    swipe(100, 49);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.isTransitioning).toBe(true);
  });

  it("does not require browser APIs at module import time", async () => {
    const originalWindow = globalThis.window;

    vi.resetModules();
    delete (globalThis as Partial<typeof globalThis>).window;

    await expect(import("./useTouchInput")).resolves.toHaveProperty("useTouchInput");

    Object.assign(globalThis, { window: originalWindow });
  });
});
