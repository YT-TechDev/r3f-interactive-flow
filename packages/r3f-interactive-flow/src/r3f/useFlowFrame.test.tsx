import React, { act } from "react";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import { FlowProvider } from "../react/FlowProvider";
import { useFlow } from "../react/useFlow";
import { useFlowFrame } from "./useFlowFrame";
import type { FlowFrameCallback } from "./useFlowFrame";

const useFrameMock = vi.hoisted(() => vi.fn());

vi.mock("@react-three/fiber", () => ({
  useFrame: useFrameMock
}));

type FrameCallback = (state: unknown, delta: number) => void;

class MinimalNode {
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

  addEventListener(): void {}

  removeEventListener(): void {}

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
    SVGElement: MinimalElement
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
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });

  container.remove();
  vi.restoreAllMocks();
  useFrameMock.mockClear();
});

function getRegisteredFrame(index = 0): FrameCallback {
  const frame = useFrameMock.mock.calls[index]?.[0];

  expect(frame).toEqual(expect.any(Function));

  return frame as FrameCallback;
}

function ControlsProbe({ onRender }: { onRender: (controls: FlowControls<TestPhase>) => void }) {
  const controls = useFlow<TestPhase>();

  onRender(controls);

  return (
    <output data-testid="snapshot">
      {JSON.stringify({
        phase: controls.phase,
        phaseIndex: controls.phaseIndex,
        progress: controls.progress,
        direction: controls.direction,
        isTransitioning: controls.isTransitioning,
        isLocked: controls.isLocked
      })}
    </output>
  );
}

function FrameProbe({ onFrame }: { onFrame: FlowFrameCallback<TestPhase> }) {
  useFlowFrame(onFrame);

  return null;
}

function renderFlow(children: ReactNode, transitionDurationMs = 1000) {
  act(() => {
    root?.render(
      <FlowProvider phases={phases} transitionDurationMs={transitionDurationMs}>
        {children}
      </FlowProvider>
    );
  });
}

class ErrorBoundary extends React.Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message !== null) {
      return <output data-testid="error">{this.state.message}</output>;
    }

    return this.props.children;
  }
}

describe("useFlowFrame", () => {
  it("registers a frame callback through React Three Fiber useFrame", () => {
    renderFlow(<FrameProbe onFrame={() => undefined} />);

    expect(useFrameMock).toHaveBeenCalled();
    expect(useFrameMock.mock.calls.at(-1)?.[0]).toEqual(expect.any(Function));
  });

  it("updates the machine in milliseconds and calls the user callback with post-update progress and delta seconds", () => {
    const onFrame = vi.fn();
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <FrameProbe onFrame={onFrame} />
      </>
    );

    act(() => {
      latestControls?.next();
    });

    act(() => {
      getRegisteredFrame()(undefined, 0.25);
    });

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(Object.keys(onFrame.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
      "direction",
      "isTransitioning",
      "phase",
      "phaseIndex",
      "progress"
    ]);
    expect(onFrame).toHaveBeenLastCalledWith(
      {
        phase: "work",
        phaseIndex: 1,
        progress: 0.25,
        direction: "next",
        isTransitioning: true
      },
      0.25
    );
    expect(container.textContent).toContain('"progress":0');
    expect(container.textContent).toContain('"isTransitioning":true');
  });

  it("uses the latest callback ref after rerender without calling a stale callback", () => {
    const initialCallback = vi.fn();
    const latestCallback = vi.fn();

    renderFlow(<FrameProbe onFrame={initialCallback} />);

    const firstRegisteredFrame = getRegisteredFrame();

    renderFlow(<FrameProbe onFrame={latestCallback} />);

    act(() => {
      firstRegisteredFrame(undefined, 0.1);
    });

    expect(initialCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
    expect(latestCallback).toHaveBeenLastCalledWith(
      {
        phase: "intro",
        phaseIndex: 0,
        progress: 0,
        direction: "none",
        isTransitioning: false
      },
      0.1
    );
  });

  it("syncs the React snapshot when an active transition completes", () => {
    const onFrame = vi.fn();
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <FrameProbe onFrame={onFrame} />
      </>,
      1000
    );

    act(() => {
      latestControls?.next();
    });

    expect(container.textContent).toContain('"progress":0');
    expect(container.textContent).toContain('"isTransitioning":true');

    act(() => {
      getRegisteredFrame()(undefined, 0.5);
    });

    expect(onFrame).toHaveBeenLastCalledWith(
      {
        phase: "work",
        phaseIndex: 1,
        progress: 0.5,
        direction: "next",
        isTransitioning: true
      },
      0.5
    );
    expect(container.textContent).toContain('"progress":0');
    expect(container.textContent).toContain('"isTransitioning":true');

    act(() => {
      getRegisteredFrame()(undefined, 0.5);
    });

    expect(onFrame).toHaveBeenLastCalledWith(
      {
        phase: "work",
        phaseIndex: 1,
        progress: 1,
        direction: "none",
        isTransitioning: false
      },
      0.5
    );
    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    expect(container.textContent).toContain('"progress":1');
    expect(container.textContent).toContain('"isTransitioning":false');
  });

  it("reports the completed target phase when a large frame delta finishes a transition", () => {
    const onFrame = vi.fn();
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <FrameProbe onFrame={onFrame} />
      </>,
      1000
    );

    act(() => {
      latestControls?.next();
    });

    expect(container.textContent).toContain('"phase":"work"');
    expect(container.textContent).toContain('"phaseIndex":1');
    expect(container.textContent).toContain('"progress":0');
    expect(container.textContent).toContain('"direction":"next"');
    expect(container.textContent).toContain('"isTransitioning":true');

    act(() => {
      getRegisteredFrame()(undefined, 1.5);
    });

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenLastCalledWith(
      {
        phase: "work",
        phaseIndex: 1,
        progress: 1,
        direction: "none",
        isTransitioning: false
      },
      1.5
    );
    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    expect(container.textContent).toContain('"phase":"work"');
    expect(container.textContent).toContain('"phaseIndex":1');
    expect(container.textContent).toContain('"progress":1');
    expect(container.textContent).toContain('"direction":"none"');
    expect(container.textContent).toContain('"isTransitioning":false');
  });

  it("keeps completed transition state stable on the frame after completion", () => {
    const onFrame = vi.fn();
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <FrameProbe onFrame={onFrame} />
      </>,
      1000
    );

    act(() => {
      latestControls?.next();
    });

    act(() => {
      getRegisteredFrame()(undefined, 1.5);
    });

    expect(onFrame).toHaveBeenLastCalledWith(
      {
        phase: "work",
        phaseIndex: 1,
        progress: 1,
        direction: "none",
        isTransitioning: false
      },
      1.5
    );

    act(() => {
      getRegisteredFrame()(undefined, 0.016);
    });

    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onFrame).toHaveBeenLastCalledWith(
      {
        phase: "work",
        phaseIndex: 1,
        progress: 1,
        direction: "none",
        isTransitioning: false
      },
      0.016
    );
    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    expect(container.textContent).toContain('"phase":"work"');
    expect(container.textContent).toContain('"phaseIndex":1');
    expect(container.textContent).toContain('"progress":1');
    expect(container.textContent).toContain('"direction":"none"');
    expect(container.textContent).toContain('"isTransitioning":false');
  });

  it("throws a clear error when rendered outside FlowProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    act(() => {
      root?.render(
        <ErrorBoundary>
          <FrameProbe onFrame={() => undefined} />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).toBe("useFlowFrame must be used inside FlowProvider.");
  });
});
