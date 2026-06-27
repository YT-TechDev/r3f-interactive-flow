import React, { act, useContext } from "react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowContext } from "../react/FlowContext";
import type { MinimalElement, MinimalEventTarget } from "../test-utils/minimalDom";
import { installMinimalDom, windowTarget } from "../test-utils/minimalDom";
import { createControlsProbe, createFlowTestHarness } from "../test-utils/renderFlow";
import { useKeyboardInput } from "./useKeyboardInput";
import type { UseKeyboardInputOptions } from "./useKeyboardInput";

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

installMinimalDom({ KeyboardEvent: MinimalKeyboardEvent as typeof globalThis.KeyboardEvent });

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const ControlsProbe = createControlsProbe<TestPhase>();
const { getRoot, renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function KeyboardInputProbe({ options = {} }: { options?: UseKeyboardInputOptions }) {
  useKeyboardInput<TestPhase>(options);

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

function dispatchKeyDown(
  key: string,
  eventInitDict: KeyboardEventInit & { target?: EventTarget | MinimalEventTarget } = {},
  target: MinimalEventTarget = windowTarget
): MinimalKeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, ...eventInitDict }) as MinimalKeyboardEvent;

  act(() => {
    target.dispatchEvent(event);
  });

  return event;
}

describe("useKeyboardInput", () => {
  it("attaches a keydown event listener only when enabled", () => {
    const addEventListenerSpy = vi.spyOn(globalThis, "addEventListener");

    renderFlow(<KeyboardInputProbe options={{ enabled: false }} />);

    expect(addEventListenerSpy).not.toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(windowTarget.listenerCount("keydown")).toBe(0);

    renderFlow(<KeyboardInputProbe />);

    expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(windowTarget.listenerCount("keydown")).toBe(1);
  });

  it.each(["ArrowDown", "ArrowRight", "PageDown", " "])(
    "navigates to the next phase for the default %s key",
    (key) => {
      let latestControls: FlowControls<TestPhase> | undefined;

      renderFlow(
        <>
          <KeyboardInputProbe />
          <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        </>
      );

      dispatchKeyDown(key);

      expect(latestControls?.phase).toBe("work");
      expect(latestControls?.direction).toBe("next");
    }
  );

  it.each(["ArrowUp", "ArrowLeft", "PageUp"])(
    "navigates to the previous phase for the default %s key",
    (key) => {
      let latestControls: FlowControls<TestPhase> | undefined;

      renderFlow(
        <>
          <KeyboardInputProbe />
          <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        </>,
        "work"
      );

      dispatchKeyDown(key);

      expect(latestControls?.phase).toBe("intro");
      expect(latestControls?.direction).toBe("prev");
    }
  );

  it("ignores unmapped keys", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("Enter");

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("ignores repeated keydown events", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("ArrowDown", { repeat: true });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it.each(["input", "textarea", "select"])("ignores events from %s elements", (tagName) => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const editableTarget = document.createElement(tagName);

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("ArrowDown", { target: editableTarget });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("ignores events from contentEditable elements", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const editableTarget = document.createElement("div");
    editableTarget.setAttribute("contenteditable", "true");

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("ArrowDown", { target: editableTarget });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("does not navigate when disabled", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("navigates after being re-enabled", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: true }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );
    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("removes the keydown listener when disabled after being enabled", () => {
    const removeEventListenerSpy = vi.spyOn(globalThis, "removeEventListener");
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(1);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(windowTarget.listenerCount("keydown")).toBe(0);

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("defaults preventDefault to true for mapped keys", () => {
    renderFlow(<KeyboardInputProbe />);

    const event = dispatchKeyDown("ArrowDown");

    expect(event.defaultPrevented).toBe(true);
  });

  it("does not call preventDefault when preventDefault is false", () => {
    renderFlow(<KeyboardInputProbe options={{ preventDefault: false }} />);

    const event = dispatchKeyDown("ArrowDown");

    expect(event.defaultPrevented).toBe(false);
  });

  it("respects custom nextKeys and prevKeys", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ nextKeys: ["n"], prevKeys: ["p"] }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("none");

    dispatchKeyDown("n");

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
  });

  it("respects custom previous keys", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ nextKeys: ["n"], prevKeys: ["p"] }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchKeyDown("ArrowUp");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("none");

    dispatchKeyDown("p");

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("does not navigate when the flow is locked", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    act(() => {
      latestControls?.lock();
    });
    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.isLocked).toBe(true);

    act(() => {
      latestControls?.unlock();
    });
    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
    expect(latestControls?.isLocked).toBe(false);
  });

  it("does not navigate when the flow is transitioning", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowDown");
    dispatchKeyDown("ArrowRight");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.isTransitioning).toBe(true);
  });

  it("moves the keydown listener when the target changes", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: firstTarget as unknown as HTMLElement }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("keydown")).toBe(1);
    expect(secondTarget.listenerCount("keydown")).toBe(0);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: secondTarget as unknown as HTMLElement }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("keydown")).toBe(0);
    expect(secondTarget.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown", {}, firstTarget);

    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");

    dispatchKeyDown("ArrowDown", {}, secondTarget);

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("cleans up the keydown event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(globalThis, "removeEventListener");

    renderFlow(<KeyboardInputProbe />);

    expect(windowTarget.listenerCount("keydown")).toBe(1);

    act(() => {
      getRoot()?.unmount();
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(windowTarget.listenerCount("keydown")).toBe(0);
  });

  it("does not require browser APIs at module import time", async () => {
    const originalWindow = globalThis.window;

    vi.resetModules();
    delete (globalThis as Partial<typeof globalThis>).window;

    await expect(import("./useKeyboardInput")).resolves.toHaveProperty("useKeyboardInput");

    Object.assign(globalThis, { window: originalWindow });
  });

  it("can attach directly to a target element", () => {
    const target = document.createElement("div");
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(0);
    const minimalTarget = target as unknown as MinimalElement;

    expect(minimalTarget.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown", {}, minimalTarget);

    expect(latestControls?.phase).toBe("work");
  });

  it("can attach explicitly to window", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: window }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
  });

  it("falls back to window when a target ref is empty", () => {
    const targetRef = { current: null } satisfies RefObject<HTMLElement | null>;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
  });

  it("uses grouped keys.next and keys.prev mappings", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ keys: { next: ["n"], prev: ["p"] } }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchKeyDown("ArrowDown");
    expect(latestControls?.phase).toBe("work");

    dispatchKeyDown("n");
    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
  });

  it("uses grouped keys.prev mappings", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ keys: { next: ["n"], prev: ["p"] } }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchKeyDown("ArrowUp");
    expect(latestControls?.phase).toBe("work");

    dispatchKeyDown("p");
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("prev");
  });

  it("prefers grouped keys over legacy key aliases", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe
          options={{ keys: { next: ["n"], prev: ["p"] }, nextKeys: ["x"], prevKeys: ["y"] }}
        />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchKeyDown("x");
    dispatchKeyDown("y");
    expect(latestControls?.phase).toBe("work");

    dispatchKeyDown("n");
    expect(latestControls?.phase).toBe("contact");
  });

  it("prefers next when a key is mapped to both directions", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ keys: { next: ["k"], prev: ["k"] } }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      "work"
    );

    dispatchKeyDown("k");

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
  });

  it("allows mapped keys from typing targets when ignoreWhenTyping is false", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const input = document.createElement("input");

    renderFlow(
      <>
        <KeyboardInputProbe options={{ ignoreWhenTyping: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("ArrowDown", { target: input });

    expect(event.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");
  });

  it("defaults ignoreWhenTyping to true", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const input = document.createElement("input");

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("ArrowDown", { target: input });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
  });

  it("blocks rapid repeated keyboard navigation with hook-local cooldown", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(1_050);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ cooldown: 100 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowDown");
    dispatchKeyDown("ArrowRight");

    expect(latestControls?.phase).toBe("work");
  });

  it("does not consume hook-local cooldown for locked, repeated, or typing-target key events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;
    const input = document.createElement("input");

    renderFlow(
      <>
        <KeyboardInputProbe options={{ cooldown: 500 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    act(() => {
      latestControls?.lock();
    });
    dispatchKeyDown("ArrowDown");

    vi.setSystemTime(100);
    act(() => {
      latestControls?.unlock();
    });
    dispatchKeyDown("ArrowDown", { repeat: true });

    vi.setSystemTime(250);
    dispatchKeyDown("ArrowDown", { target: input });
    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("does not consume hook-local cooldown for rejected first-boundary keyboard input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ cooldown: 500 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowUp");

    expect(latestControls).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    vi.setSystemTime(250);
    dispatchKeyDown("ArrowDown");

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
    vi.useRealTimers();
  });

  it("does not extend hook-local cooldown for keyboard events ignored while transitioning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ cooldown: 500 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe
          onRender={(renderedMachine, renderedSyncSnapshot) => {
            machine = renderedMachine;
            syncSnapshot = renderedSyncSnapshot;
          }}
        />
      </>
    );

    dispatchKeyDown("ArrowDown");

    vi.setSystemTime(1_400);
    dispatchKeyDown("ArrowDown");

    act(() => {
      machine?.update(1_000);
      syncSnapshot?.();
    });

    vi.setSystemTime(1_500);
    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
    vi.useRealTimers();
  });

  it("does not navigate through keyboard input while the flow transition cooldown is active", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
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

    dispatchKeyDown("ArrowDown");

    act(() => {
      machine?.update(100);
      syncSnapshot?.();
    });

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.isTransitioning).toBe(false);

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");

    act(() => {
      machine?.update(400);
      syncSnapshot?.();
    });

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "throws a clear error for invalid cooldown %s",
    (cooldown) => {
      expect(() => renderFlow(<KeyboardInputProbe options={{ cooldown }} />)).toThrow(
        "useKeyboardInput cooldown must be a finite, non-negative number."
      );
    }
  );

  it("can attach to a provided target element", () => {
    const target = document.createElement("div");
    const targetRef = { current: target } satisfies RefObject<HTMLElement>;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(0);
    const minimalTarget = target as unknown as MinimalElement;

    expect(minimalTarget.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown", {}, minimalTarget);

    expect(latestControls?.phase).toBe("work");
  });
});
