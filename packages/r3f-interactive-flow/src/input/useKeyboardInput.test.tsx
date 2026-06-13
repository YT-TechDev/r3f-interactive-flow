import React, { act } from "react";
import type { ReactNode, RefObject } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import { FlowProvider } from "../react/FlowProvider";
import { useFlow } from "../react/useFlow";
import { useKeyboardInput } from "./useKeyboardInput";
import type { UseKeyboardInputOptions } from "./useKeyboardInput";

type ListenerRecord = {
  listener: EventListenerOrEventListenerObject;
};

class MinimalEventTarget {
  private listeners = new Map<string, ListenerRecord[]>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
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

  dispatchEvent(event: MinimalKeyboardEvent): boolean {
    event.target ??= this;

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
  isContentEditable = false;
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

    if (name === "contenteditable") {
      this.isContentEditable = value !== "false";
    }
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];

    if (name === "contenteditable") {
      this.isContentEditable = false;
    }
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
    KeyboardEvent: MinimalKeyboardEvent,
    Node: MinimalNode,
    SVGElement: MinimalElement,
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

function KeyboardInputProbe({ options = {} }: { options?: UseKeyboardInputOptions }) {
  useKeyboardInput<TestPhase>(options);

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

  it("cleans up the keydown event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(globalThis, "removeEventListener");

    renderFlow(<KeyboardInputProbe />);

    expect(windowTarget.listenerCount("keydown")).toBe(1);

    act(() => {
      root?.unmount();
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
