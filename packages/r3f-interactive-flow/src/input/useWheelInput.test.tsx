import React, { act } from "react";
import type { ReactNode, RefObject } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import { FlowProvider } from "../react/FlowProvider";
import { useFlow } from "../react/useFlow";
import { useWheelInput } from "./useWheelInput";
import type { UseWheelInputOptions } from "./useWheelInput";

type ListenerRecord = {
  listener: EventListenerOrEventListenerObject;
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

  dispatchEvent(event: MinimalWheelEvent): boolean {
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
    WheelEvent: MinimalWheelEvent,
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

function WheelInputProbe({ options = {} }: { options?: UseWheelInputOptions }) {
  useWheelInput<TestPhase>(options);

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
      root?.unmount();
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
