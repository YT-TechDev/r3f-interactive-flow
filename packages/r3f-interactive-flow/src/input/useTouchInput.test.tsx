import React, { act } from "react";
import type { ReactNode, RefObject } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import { FlowProvider } from "../react/FlowProvider";
import { useFlow } from "../react/useFlow";
import { useTouchInput } from "./useTouchInput";
import type { UseTouchInputOptions } from "./useTouchInput";

type ListenerRecord = {
  listener: EventListenerOrEventListenerObject;
};

type MinimalTouch = {
  clientY: number;
};

class MinimalEventTarget {
  private listeners = new Map<string, ListenerRecord[]>();

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    // React passes listener options here; the minimal target only needs to retain listeners.
    _listenerOptions?: AddEventListenerOptions | boolean
  ): void {
    void _listenerOptions;

    if (listener === null) {
      return;
    }

    this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener }]);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) {
      return;
    }

    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((record) => record.listener !== listener)
    );
  }

  dispatchEvent(event: MinimalTouchEvent): boolean {
    event.target = this;

    for (const { listener } of this.listeners.get(event.type) ?? []) {
      if (typeof listener === "function") {
        listener.call(this, event as unknown as Event);
      } else {
        listener.handleEvent(event as unknown as Event);
      }
    }

    return !event.defaultPrevented;
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }

  clearListeners(): void {
    this.listeners.clear();
  }
}

class MinimalNode extends MinimalEventTarget {
  childNodes: MinimalNode[] = [];
  nodeType = 0;
  nodeName = "";
  ownerDocument: MinimalDocument | null = null;
  parentNode: MinimalNode | null = null;

  appendChild(node: MinimalNode): MinimalNode {
    this.childNodes.push(node);
    node.parentNode = this;

    return node;
  }

  append(...nodes: MinimalNode[]): void {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }

  insertBefore(node: MinimalNode, beforeNode: MinimalNode | null): MinimalNode {
    const index = beforeNode === null ? -1 : this.childNodes.indexOf(beforeNode);

    if (index === -1) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;

    return node;
  }

  removeChild(node: MinimalNode): MinimalNode {
    this.childNodes = this.childNodes.filter((child) => child !== node);
    node.parentNode = null;

    return node;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    const text = this.ownerDocument?.createTextNode(value) ?? new MinimalText(value);
    this.childNodes = [text];
    text.parentNode = this;
  }
}

class MinimalText extends MinimalNode {
  data: string;

  constructor(data: string) {
    super();
    this.data = data;
    this.nodeType = 3;
    this.nodeName = "#text";
  }

  override get textContent(): string {
    return this.data;
  }

  override set textContent(value: string) {
    this.data = value;
  }
}

class MinimalElement extends MinimalNode {
  attributes: Record<string, string> = {};
  namespaceURI = "http://www.w3.org/1999/xhtml";
  style: Record<string, string> = {};
  tagName: string;

  constructor(tagName: string) {
    super();
    this.nodeType = 1;
    this.nodeName = tagName.toUpperCase();
    this.tagName = this.nodeName;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
  }
}

class MinimalDocument extends MinimalNode {
  body: MinimalElement;
  defaultView = globalThis;
  documentElement: MinimalElement;

  constructor() {
    super();
    this.nodeType = 9;
    this.nodeName = "#document";
    this.ownerDocument = this;
    this.documentElement = this.createElement("html");
    this.body = this.createElement("body");
  }

  createElement(tagName: string): MinimalElement {
    const element = new MinimalElement(tagName);
    element.ownerDocument = this;

    return element;
  }

  createElementNS(namespaceURI: string, tagName: string): MinimalElement {
    const element = this.createElement(tagName);
    element.namespaceURI = namespaceURI;

    return element;
  }

  createTextNode(data: string): MinimalText {
    const text = new MinimalText(data);
    text.ownerDocument = this;

    return text;
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

const windowTarget = new MinimalEventTarget();

function installMinimalDom(): void {
  const document = new MinimalDocument();

  Object.assign(globalThis, {
    document,
    window: globalThis,
    Document: MinimalDocument,
    Element: MinimalElement,
    HTMLElement: MinimalElement,
    HTMLIFrameElement: class MinimalHTMLIFrameElement extends MinimalElement {},
    Node: MinimalNode,
    SVGElement: MinimalElement,
    TouchEvent: MinimalTouchEvent,
    addEventListener: windowTarget.addEventListener.bind(windowTarget),
    removeEventListener: windowTarget.removeEventListener.bind(windowTarget),
    dispatchEvent: windowTarget.dispatchEvent.bind(windowTarget)
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "node" }
  });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
}

installMinimalDom();

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const touchEventTypes = ["touchstart", "touchmove", "touchend", "touchcancel"] as const;

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  windowTarget.clearListeners();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });

  container.remove();
  windowTarget.clearListeners();
  vi.restoreAllMocks();
});

function ControlsProbe({ onRender }: { onRender: (controls: FlowControls<TestPhase>) => void }) {
  const controls = useFlow<TestPhase>();

  onRender(controls);

  return <output data-testid="phase">{controls.phase}</output>;
}

function TouchInputProbe({ options = {} }: { options?: UseTouchInputOptions }) {
  useTouchInput<TestPhase>(options);

  return null;
}

function renderFlow(children: ReactNode, initialPhase?: TestPhase) {
  act(() => {
    root?.render(
      <FlowProvider phases={phases} {...(initialPhase !== undefined ? { initialPhase } : {})}>
        {children}
      </FlowProvider>
    );
  });
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
      root?.unmount();
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
