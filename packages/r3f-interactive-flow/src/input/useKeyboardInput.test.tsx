import React, { act, useContext, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { FlowMachineContext } from "../react/FlowContext";
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
  const context = useContext(FlowMachineContext);

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

  it("does not validate keyboard navigation options or attach listeners while disabled", () => {
    expect(() =>
      renderFlow(
        <KeyboardInputProbe
          options={{
            enabled: false,
            cooldown: -1
          }}
        />
      )
    ).not.toThrow();

    expect(windowTarget.listenerCount("keydown")).toBe(0);
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

  it("does not replay disabled keyboard input or duplicate listeners after re-enable", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowDown");
    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("intro");
    expect(windowTarget.listenerCount("keydown")).toBe(0);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: true }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(latestControls?.phase).toBe("intro");
    expect(windowTarget.listenerCount("keydown")).toBe(1);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: false }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );
    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: true }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(1);

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
    const lockedEvent = dispatchKeyDown("ArrowDown");

    expect(lockedEvent.defaultPrevented).toBe(false);
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
    const transitioningEvent = dispatchKeyDown("ArrowRight");

    expect(transitioningEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.isTransitioning).toBe(true);
  });

  it("does not navigate or prevent default for the first phase boundary", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("ArrowUp");

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("does not navigate or prevent default for the last phase boundary", () => {
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
      { transitionDurationMs: 100, cooldownMs: 0 }
    );

    act(() => {
      machine?.goTo("contact");
      machine?.update(100);
      syncSnapshot?.();
    });

    const event = dispatchKeyDown("ArrowDown");

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("contact");
  });

  it("does not navigate or prevent default for Space activation on a button", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const button = document.createElement("button");

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown(" ", { target: button });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("does not navigate or prevent default for a mapped Enter key on a button", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const button = document.createElement("button");

    renderFlow(
      <>
        <KeyboardInputProbe options={{ keys: { next: ["Enter"], prev: [] } }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("Enter", { target: button });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("does not navigate or prevent default for a mapped Enter key on a link with href", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const link = document.createElement("a");
    link.setAttribute("href", "#");

    renderFlow(
      <>
        <KeyboardInputProbe options={{ keys: { next: ["Enter"], prev: [] } }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("Enter", { target: link });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("protects native activation from a descendant of a button", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const button = document.createElement("button");
    const icon = document.createElement("span");
    button.appendChild(icon);

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown(" ", { target: icon });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("protects native activation from a descendant of a link with href", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const link = document.createElement("a");
    link.setAttribute("href", "#");
    const label = document.createElement("span");
    link.appendChild(label);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ keys: { next: ["Enter"], prev: [] } }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("Enter", { target: label });

    expect(event.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("intro");
    expect(latestControls?.direction).toBe("none");
  });

  it("still navigates and prevents default for default Space on a non-actionable target", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown(" ");

    expect(event.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("still navigates and prevents default for a mapped Enter key on a non-actionable target", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    const container = document.createElement("div");

    renderFlow(
      <>
        <KeyboardInputProbe options={{ keys: { next: ["Enter"], prev: [] } }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    const event = dispatchKeyDown("Enter", { target: container });

    expect(event.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("triggers exactly one accepted navigation per accepted keydown event", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let machine: FlowMachine<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(renderedMachine) => (machine = renderedMachine)} />
      </>
    );

    const nextSpy = machine ? vi.spyOn(machine, "next") : undefined;
    dispatchKeyDown("ArrowDown");

    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(latestControls?.phase).toBe("work");
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

  it("moves the keydown listener when a target ref points to a new element", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    const targetRef = { current: firstTarget as unknown as HTMLElement };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("keydown")).toBe(1);
    expect(secondTarget.listenerCount("keydown")).toBe(0);

    targetRef.current = secondTarget as unknown as HTMLElement;
    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef, cooldown: 1 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );
    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef, cooldown: 1 }} />
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

  it("re-enables keyboard input on the current target ref only", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    const targetRef = { current: firstTarget as unknown as HTMLElement };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: false, target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("keydown")).toBe(0);

    targetRef.current = secondTarget as unknown as HTMLElement;
    renderFlow(
      <>
        <KeyboardInputProbe options={{ enabled: true, target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(firstTarget.listenerCount("keydown")).toBe(0);
    expect(secondTarget.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown", {}, firstTarget);
    expect(latestControls?.phase).toBe("intro");

    dispatchKeyDown("ArrowDown", {}, secondTarget);
    expect(latestControls?.phase).toBe("work");
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

  it("does not navigate from keydown events after the input hook unmounts", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    expect(windowTarget.listenerCount("keydown")).toBe(0);

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("work");
    expect(latestControls?.direction).toBe("next");
  });

  it("does not require browser APIs at module import time", async () => {
    const originalWindow = globalThis.window;
    const originalHTMLElement = globalThis.HTMLElement;

    vi.resetModules();
    delete (globalThis as Partial<typeof globalThis>).window;
    delete (globalThis as Partial<typeof globalThis>).HTMLElement;

    try {
      await expect(import("./useKeyboardInput")).resolves.toHaveProperty("useKeyboardInput");
    } finally {
      Object.assign(globalThis, { window: originalWindow, HTMLElement: originalHTMLElement });
    }
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

  it("does not fall back to window when an explicit target ref is empty", () => {
    const targetRef: RefObject<HTMLElement | null> = { current: null };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(0);

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("intro");

    act(() => {
      getRoot()?.unmount();
    });

    expect(windowTarget.listenerCount("keydown")).toBe(0);
  });

  it("attaches on a later relevant effect run after an explicit ref resolves", () => {
    const target = document.createElement("div") as unknown as MinimalElement;
    const targetRef: RefObject<HTMLElement | null> = { current: null };
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef, cooldown: 0 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(0);
    expect(target.listenerCount("keydown")).toBe(0);

    targetRef.current = target as unknown as HTMLElement;
    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: targetRef, cooldown: 1 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    expect(windowTarget.listenerCount("keydown")).toBe(0);
    expect(target.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown", {}, target);

    expect(latestControls?.phase).toBe("work");
  });

  it("resolves a React element ref in the effect after commit", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let attachedTarget: MinimalElement | undefined;

    function RefTimingProbe() {
      const targetRef = useRef<HTMLDivElement | null>(null);
      useKeyboardInput<TestPhase>({ target: targetRef });

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

    expect(windowTarget.listenerCount("keydown")).toBe(0);
    expect(attachedTarget?.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown", {}, attachedTarget);

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

    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ cooldown: 100 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>
    );

    dispatchKeyDown("ArrowDown");
    vi.advanceTimersByTime(50);
    const cooldownEvent = dispatchKeyDown("ArrowRight");

    expect(cooldownEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");
    vi.useRealTimers();
  });

  it("uses monotonic elapsed time for keyboard cooldown across wall-clock jumps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <KeyboardInputProbe options={{ cooldown: 500 }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      undefined,
      { transitionDurationMs: 0, cooldownMs: 0 }
    );

    const accepted = dispatchKeyDown("ArrowDown");
    expect(accepted.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");

    vi.setSystemTime(1_000_000);
    const forwardJumpEvent = dispatchKeyDown("ArrowDown");
    expect(forwardJumpEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");

    vi.setSystemTime(0);
    vi.advanceTimersByTime(500);
    const boundaryEvent = dispatchKeyDown("ArrowDown");
    expect(boundaryEvent.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("contact");
    vi.useRealTimers();
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
    const lockedEvent = dispatchKeyDown("ArrowDown");

    vi.advanceTimersByTime(100);
    act(() => {
      latestControls?.unlock();
    });
    const repeatEvent = dispatchKeyDown("ArrowDown", { repeat: true });

    vi.advanceTimersByTime(150);
    const typingEvent = dispatchKeyDown("ArrowDown", { target: input });
    dispatchKeyDown("ArrowDown");

    expect(lockedEvent.defaultPrevented).toBe(false);
    expect(repeatEvent.defaultPrevented).toBe(false);
    expect(typingEvent.defaultPrevented).toBe(false);
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

    vi.advanceTimersByTime(250);
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

  it("does not consume hook-local cooldown for rejected last-boundary keyboard input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
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
      </>,
      undefined,
      { transitionDurationMs: 100, cooldownMs: 0 }
    );

    act(() => {
      machine?.goTo("contact");
      machine?.update(100);
      syncSnapshot?.();
    });

    dispatchKeyDown("ArrowDown");

    expect(latestControls).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    vi.advanceTimersByTime(250);
    dispatchKeyDown("ArrowUp");

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      direction: "prev",
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

    vi.advanceTimersByTime(400);
    const transitionEvent = dispatchKeyDown("ArrowDown");

    expect(transitionEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");

    act(() => {
      machine?.update(1_000);
      syncSnapshot?.();
    });

    vi.advanceTimersByTime(100);
    const boundaryEvent = dispatchKeyDown("ArrowDown");

    expect(boundaryEvent.defaultPrevented).toBe(true);
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

    const cooldownEvent = dispatchKeyDown("ArrowDown");

    expect(cooldownEvent.defaultPrevented).toBe(false);
    expect(latestControls?.phase).toBe("work");

    act(() => {
      machine?.update(500);
      syncSnapshot?.();
    });

    dispatchKeyDown("ArrowDown");

    expect(latestControls?.phase).toBe("contact");
    expect(latestControls?.direction).toBe("next");
  });

  it("keeps the keydown listener across fresh outer options rerenders with stable dependencies", () => {
    const target = document.createElement("div") as unknown as MinimalElement;
    const addEventListenerSpy = vi.spyOn(target, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(target, "removeEventListener");
    const keys = { next: ["n"], prev: ["p"] };
    let latestControls: FlowControls<TestPhase> | undefined;

    function FreshOptionsProbe({ tick }: { tick: number }) {
      void tick;
      useKeyboardInput<TestPhase>({
        cooldown: 0,
        enabled: true,
        ignoreWhenTyping: true,
        keys,
        preventDefault: true,
        target: target as unknown as HTMLElement
      });

      return <ControlsProbe onRender={(controls) => (latestControls = controls)} />;
    }

    renderFlow(<FreshOptionsProbe tick={0} />, undefined, {
      transitionDurationMs: 0,
      cooldownMs: 0
    });

    expect(target.listenerCount("keydown")).toBe(1);
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

    renderFlow(<FreshOptionsProbe tick={1} />, undefined, {
      transitionDurationMs: 0,
      cooldownMs: 0
    });

    expect(target.listenerCount("keydown")).toBe(1);
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).not.toHaveBeenCalled();

    const accepted = dispatchKeyDown("n", {}, target);

    expect(accepted.defaultPrevented).toBe(true);
    expect(latestControls?.phase).toBe("work");
  });

  it.each([
    {
      label: "grouped keys",
      createOptions: () => ({ keys: { next: ["n"], prev: ["p"] } })
    },
    {
      label: "legacy key arrays",
      createOptions: () => ({ nextKeys: ["n"], prevKeys: ["p"] })
    }
  ] satisfies Array<{
    label: string;
    createOptions: () => Pick<UseKeyboardInputOptions, "keys" | "nextKeys" | "prevKeys">;
  }>)(
    "preserves hook-local cooldown across equivalent inline $label rerenders",
    ({ createOptions }) => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      const addEventListenerSpy = vi.spyOn(globalThis, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(globalThis, "removeEventListener");
      let latestControls: FlowControls<TestPhase> | undefined;

      function InlineKeysProbe({ tick }: { tick: number }) {
        void tick;
        useKeyboardInput<TestPhase>({
          ...createOptions(),
          cooldown: 500
        });

        return <ControlsProbe onRender={(controls) => (latestControls = controls)} />;
      }

      try {
        renderFlow(<InlineKeysProbe tick={0} />, undefined, {
          transitionDurationMs: 0,
          cooldownMs: 0
        });

        const acceptedAtZero = dispatchKeyDown("n");

        expect(acceptedAtZero.defaultPrevented).toBe(true);
        expect(latestControls?.phase).toBe("work");
        expect(windowTarget.listenerCount("keydown")).toBe(1);
        const addKeydownCallsBeforeRerender = addEventListenerSpy.mock.calls.filter(
          ([type]) => type === "keydown"
        ).length;
        const removeKeydownCallsBeforeRerender = removeEventListenerSpy.mock.calls.filter(
          ([type]) => type === "keydown"
        ).length;

        renderFlow(<InlineKeysProbe tick={1} />, undefined, {
          transitionDurationMs: 0,
          cooldownMs: 0
        });

        expect(windowTarget.listenerCount("keydown")).toBe(1);
        expect(addEventListenerSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(
          addKeydownCallsBeforeRerender + 1
        );
        expect(
          removeEventListenerSpy.mock.calls.filter(([type]) => type === "keydown")
        ).toHaveLength(removeKeydownCallsBeforeRerender + 1);

        vi.advanceTimersByTime(499);
        const cooldownEvent = dispatchKeyDown("n");

        expect(cooldownEvent.defaultPrevented).toBe(false);
        expect(latestControls?.phase).toBe("work");

        vi.advanceTimersByTime(1);
        const acceptedAtCooldown = dispatchKeyDown("n");

        expect(acceptedAtCooldown.defaultPrevented).toBe(true);
        expect(latestControls?.phase).toBe("contact");
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it("does not resample a mutable target ref without an actual effect dependency change", () => {
    const firstTarget = document.createElement("div") as unknown as MinimalElement;
    const secondTarget = document.createElement("div") as unknown as MinimalElement;
    const targetRef = { current: firstTarget as unknown as HTMLElement };
    let latestControls: FlowControls<TestPhase> | undefined;

    function RefTargetProbe({ tick }: { tick: number }) {
      void tick;
      useKeyboardInput<TestPhase>({ target: targetRef });

      return <ControlsProbe onRender={(controls) => (latestControls = controls)} />;
    }

    renderFlow(<RefTargetProbe tick={0} />, undefined, {
      transitionDurationMs: 0,
      cooldownMs: 0
    });

    expect(firstTarget.listenerCount("keydown")).toBe(1);
    expect(secondTarget.listenerCount("keydown")).toBe(0);

    targetRef.current = secondTarget as unknown as HTMLElement;
    renderFlow(<RefTargetProbe tick={1} />, undefined, {
      transitionDurationMs: 0,
      cooldownMs: 0
    });

    expect(firstTarget.listenerCount("keydown")).toBe(1);
    expect(secondTarget.listenerCount("keydown")).toBe(0);

    dispatchKeyDown("ArrowDown", {}, secondTarget);
    expect(latestControls?.phase).toBe("intro");

    dispatchKeyDown("ArrowDown", {}, firstTarget);
    expect(latestControls?.phase).toBe("work");
  });

  it("keeps direct-target keydown listeners after DOM detachment until effect cleanup", () => {
    const parent = document.createElement("div") as unknown as MinimalElement;
    const target = document.createElement("div") as unknown as MinimalElement;
    let latestControls: FlowControls<TestPhase> | undefined;
    parent.appendChild(target);

    renderFlow(
      <>
        <KeyboardInputProbe options={{ target: target as unknown as HTMLElement }} />
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
      </>,
      undefined,
      { transitionDurationMs: 0, cooldownMs: 0 }
    );

    expect(target.listenerCount("keydown")).toBe(1);

    parent.removeChild(target);

    expect(target.listenerCount("keydown")).toBe(1);

    dispatchKeyDown("ArrowDown", {}, target);

    expect(latestControls?.phase).toBe("work");

    act(() => {
      getRoot()?.unmount();
    });

    expect(target.listenerCount("keydown")).toBe(0);
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
