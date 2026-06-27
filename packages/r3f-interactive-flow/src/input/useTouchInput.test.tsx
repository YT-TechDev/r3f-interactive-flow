import React, { act, useContext } from "react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowContext } from "../react/FlowContext";
import type { MinimalElement, MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useTouchInput } from "./useTouchInput";
import type { UseTouchInputOptions } from "./useTouchInput";

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
  dispatchTouch("touchstart", { touches: [{ clientX: 0, clientY: startY }] }, target);
  dispatchTouch("touchend", { changedTouches: [{ clientX: 0, clientY: endY }] }, target);
}

function horizontalSwipe(
  startX: number,
  endX: number,
  target: MinimalEventTarget = windowTarget
): void {
  dispatchTouch("touchstart", { touches: [{ clientX: startX, clientY: 0 }] }, target);
  dispatchTouch("touchend", { changedTouches: [{ clientX: endX, clientY: 0 }] }, target);
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

  it("navigates after being re-enabled", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    swipe(100, 49);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    renderFlow(
      <>
        <TouchInputProbe options={{ enabled: true }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );
    swipe(100, 49);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("removes touch listeners when enabled changes from true to false", () => {
    function ToggleProbe({ enabled }: { enabled: boolean }) {
      useTouchInput<TestPhase>({ enabled });

      return null;
    }

    renderFlow(<ToggleProbe enabled />);

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(1);
    }

    renderFlow(<ToggleProbe enabled={false} />);

    for (const type of touchEventTypes) {
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

  it("falls back to window for an empty target ref and still handles touch navigation", () => {
    const targetRef = { current: null } satisfies RefObject<HTMLElement | null>;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(1);
    }

    swipe(100, 49);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("can attach directly to a provided HTMLElement target", () => {
    const target = document.createElement("div");
    const minimalTarget = target as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ target }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(0);
      expect(minimalTarget.listenerCount(type)).toBe(1);
    }

    swipe(100, 49, minimalTarget);

    expect(latestControls?.phase).toBe("work");
  });

  it("can attach explicitly to window", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ target: window }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    for (const type of touchEventTypes) {
      expect(windowTarget.listenerCount(type)).toBe(1);
    }

    swipe(100, 49);

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

  it("allows a threshold of 0", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ threshold: 0 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    swipe(100, 99);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("touchcancel resets the stored start position so a later touchend does not navigate accidentally", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchTouch("touchstart", { touches: [{ clientX: 0, clientY: 100 }] });
    dispatchTouch("touchcancel");
    dispatchTouch("touchend", { changedTouches: [{ clientX: 0, clientY: 0 }] });

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
      dispatchTouch("touchend", { changedTouches: [{ clientX: 0, clientY: 0 }] });
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
      dispatchTouch("touchstart", { touches: [{ clientX: 0, clientY: 100 }] });
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

    act(() => {
      latestControls?.unlock();
    });
    swipe(100, 49);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
    expect(latestControls?.isLocked).toBe(false);
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

  it("axis y swipe up calls next", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ axis: "y", threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    swipe(100, 59);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("axis y swipe down calls prev", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ axis: "y", threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    swipe(100, 141);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("axis x swipe left calls next", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ axis: "x", threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    horizontalSwipe(100, 59);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("axis x swipe right calls prev", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ axis: "x", threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    horizontalSwipe(100, 141);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("ignores user-provided selector matches without preventing default or navigating", () => {
    const ignored = document.createElement("div");
    const minimalIgnored = ignored as unknown as MinimalElement;
    ignored.setAttribute("class", "ignore-touch");
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ ignore: [".ignore-touch"] }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchTouch("touchstart", { touches: [{ clientX: 0, clientY: 100 }] }, minimalIgnored);
    const moveEvent = dispatchTouch(
      "touchmove",
      { touches: [{ clientX: 0, clientY: 90 }] },
      minimalIgnored
    );
    dispatchTouch("touchend", { changedTouches: [{ clientX: 0, clientY: 0 }] }, minimalIgnored);

    expect(moveEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
  });

  it("keeps preventDefault enabled by default for non-ignored touchmove", () => {
    renderFlow(<TouchInputProbe options={{ ignore: [".ignore-touch"] }} />);

    const event = dispatchTouch("touchmove");

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
        <TouchInputProbe options={{ cooldown: 500 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>,
      undefined,
      { transitionDurationMs: 100 }
    );

    swipe(100, 49);

    act(() => {
      machine?.update(100);
      syncSnapshot?.();
    });

    vi.setSystemTime(250);
    swipe(100, 49);

    expect(latestControls?.phase).toBe("work");

    vi.setSystemTime(500);
    swipe(100, 49);

    expect(latestControls?.phase).toBe("contact");
    vi.useRealTimers();
  });

  it("does not consume hook-local cooldown for locked, threshold, or ignored touch gestures", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    const ignored = document.createElement("div");
    const minimalIgnored = ignored as unknown as MinimalElement;
    ignored.setAttribute("class", "ignore-touch");

    renderFlow(
      <>
        <TouchInputProbe options={{ cooldown: 500, ignore: [".ignore-touch"], threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    act(() => {
      latestControls?.lock();
    });
    swipe(100, 59);

    vi.setSystemTime(100);
    act(() => {
      latestControls?.unlock();
    });
    swipe(100, 60);

    vi.setSystemTime(250);
    swipe(100, 0, minimalIgnored);
    swipe(100, 59);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("does not consume hook-local cooldown for rejected first-boundary touch input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ cooldown: 500, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    swipe(100, 141);

    expect(latestControls).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    vi.setSystemTime(250);
    swipe(100, 59);

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
    vi.useRealTimers();
  });

  it("does not extend hook-local cooldown for touch gestures ignored while transitioning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ cooldown: 500, threshold: 40 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>
    );

    swipe(100, 59);

    vi.setSystemTime(1_400);
    swipe(100, 59);

    act(() => {
      machine?.update(1_000);
      syncSnapshot?.();
    });

    vi.setSystemTime(1_500);
    swipe(100, 59);

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("does not navigate through touch input while the flow transition cooldown is active", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <TouchInputProbe options={{ threshold: 40 }} />
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

    swipe(100, 59);

    act(() => {
      machine?.update(100);
      syncSnapshot?.();
    });

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.isTransitioning).toBe(false);

    swipe(100, 59);

    expect(latestControls?.phase).toBe("work");

    act(() => {
      machine?.update(400);
      syncSnapshot?.();
    });

    swipe(100, 59);

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
  });

  it("removes listeners from the old target when the target changes", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;

    function RetargetingProbe({ target }: { target: HTMLElement }) {
      useTouchInput<TestPhase>({ target });

      return null;
    }

    renderFlow(<RetargetingProbe target={firstTarget as unknown as HTMLElement} />);

    for (const type of touchEventTypes) {
      expect(firstTarget.listenerCount(type)).toBe(1);
    }

    renderFlow(<RetargetingProbe target={secondTarget as unknown as HTMLElement} />);

    for (const type of touchEventTypes) {
      expect(firstTarget.listenerCount(type)).toBe(0);
      expect(secondTarget.listenerCount(type)).toBe(1);
    }
  });

  it("retargets navigation to the new target without leaving active listeners on the old target", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;

    function RetargetingProbe({ target }: { target: HTMLElement }) {
      useTouchInput<TestPhase>({ target });

      return <ControlsProbe onRender={(controls) => (latestControls = controls)} />;
    }

    renderFlow(<RetargetingProbe target={firstTarget as unknown as HTMLElement} />);
    renderFlow(<RetargetingProbe target={secondTarget as unknown as HTMLElement} />);

    swipe(100, 49, firstTarget);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    swipe(100, 49, secondTarget);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("throws a clear error for invalid cooldown values", () => {
    expect(() => renderFlow(<TouchInputProbe options={{ cooldown: -1 }} />)).toThrow(
      "useTouchInput cooldown must be a finite non-negative number."
    );

    expect(() =>
      renderFlow(<TouchInputProbe options={{ cooldown: Number.POSITIVE_INFINITY }} />)
    ).toThrow("useTouchInput cooldown must be a finite non-negative number.");
  });

  it("throws a clear error for invalid threshold values", () => {
    for (const threshold of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
      expect(() => renderFlow(<TouchInputProbe options={{ threshold }} />)).toThrow(
        "useTouchInput threshold must be a finite non-negative number."
      );
    }
  });
});
