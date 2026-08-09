import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import type { MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useWheelInput } from "./useWheelInput";

class MinimalCancelableWheelEvent {
  static readonly DOM_DELTA_PIXEL = 0;
  static readonly DOM_DELTA_LINE = 1;
  static readonly DOM_DELTA_PAGE = 2;

  defaultPrevented = false;
  target: EventTarget | MinimalEventTarget | null = null;
  readonly type: string;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly cancelable: boolean;

  constructor(type: string, eventInitDict: WheelEventInit = {}) {
    this.type = type;
    this.deltaX = eventInitDict.deltaX ?? 0;
    this.deltaY = eventInitDict.deltaY ?? 0;
    this.deltaMode = eventInitDict.deltaMode ?? MinimalCancelableWheelEvent.DOM_DELTA_PIXEL;
    this.cancelable = eventInitDict.cancelable ?? false;
  }

  preventDefault(): void {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

installMinimalDom({ WheelEvent: MinimalCancelableWheelEvent as typeof globalThis.WheelEvent });

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const ControlsProbe = createControlsProbe<TestPhase>();
const { renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function WheelInputProbe(): null {
  useWheelInput<TestPhase>({ threshold: 40 });

  return null;
}

function dispatchCancelableWheel(cancelable: boolean) {
  const event = new WheelEvent("wheel", {
    cancelable,
    deltaY: 41
  }) as MinimalCancelableWheelEvent;
  const preventDefaultSpy = vi.spyOn(event, "preventDefault");

  act(() => {
    windowTarget.dispatchEvent(event);
  });

  return { event, preventDefaultSpy };
}

describe("useWheelInput cancelability", () => {
  it("prevents an accepted cancelable wheel event", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const { event, preventDefaultSpy } = dispatchCancelableWheel(true);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("accepts a non-cancelable wheel event without calling preventDefault", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <WheelInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      undefined,
      { providerKey: "non-cancelable-wheel" }
    );

    const { event, preventDefaultSpy } = dispatchCancelableWheel(false);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });
});
