import React, { act, useContext } from "react";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import { FlowContext } from "./FlowContext";
import type { FlowProviderProps } from "./FlowProvider";
import { FlowProvider } from "./FlowProvider";
import { useFlow } from "./useFlow";
import { useFlowProgress } from "./useFlowProgress";

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

type RenderedSnapshot = Pick<
  FlowControls<TestPhase>,
  "phase" | "phaseIndex" | "progress" | "direction" | "isTransitioning" | "isLocked"
>;

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
});

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

function ProgressProbe({ onRender }: { onRender: (progress: number) => void }) {
  const progress = useFlowProgress();

  onRender(progress);

  return <output data-testid="progress">{progress}</output>;
}

function MachineProbe({
  onRender
}: {
  onRender: (value: NonNullable<React.ContextType<typeof FlowContext>>) => void;
}) {
  const value = useContext(FlowContext);

  if (value === null) {
    throw new Error("missing FlowContext");
  }

  onRender(value);

  return null;
}

function renderFlow(
  children: ReactNode,
  initialPhase?: TestPhase,
  props?: Partial<Omit<FlowProviderProps<TestPhase>, "children" | "phases" | "initialPhase">>
) {
  act(() => {
    const providerProps = {
      phases,
      ...(initialPhase !== undefined ? { initialPhase } : {}),
      ...props
    };

    root?.render(<FlowProvider {...providerProps}>{children}</FlowProvider>);
  });
}

function getRenderedSnapshot(): RenderedSnapshot {
  return JSON.parse(container.textContent) as RenderedSnapshot;
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

describe("FlowProvider and hooks", () => {
  it("provides the initial phase snapshot from phases", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    expect(latestControls).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    expect(container.textContent).toContain('"phase":"intro"');
  });

  it("returns the expected controls shape from useFlow", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    expect(Object.keys(latestControls ?? {}).sort()).toEqual([
      "direction",
      "goTo",
      "isLocked",
      "isTransitioning",
      "lock",
      "next",
      "phase",
      "phaseIndex",
      "prev",
      "progress",
      "unlock"
    ]);
    expect(latestControls?.next).toEqual(expect.any(Function));
    expect(latestControls?.prev).toEqual(expect.any(Function));
    expect(latestControls?.goTo).toEqual(expect.any(Function));
    expect(latestControls?.lock).toEqual(expect.any(Function));
    expect(latestControls?.unlock).toEqual(expect.any(Function));
  });

  it("updates React snapshot state when next is called", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    act(() => {
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
    expect(container.textContent).toContain('"phase":"work"');
  });

  it("updates React snapshot state when goTo is called", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    act(() => {
      latestControls?.goTo("contact");
    });

    expect(latestControls).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
    expect(container.textContent).toContain('"phase":"contact"');
  });

  it("updates isLocked when lock and unlock are called", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    act(() => {
      latestControls?.lock();
    });

    expect(latestControls?.isLocked).toBe(true);
    expect(container.textContent).toContain('"isLocked":true');

    act(() => {
      latestControls?.unlock();
    });

    expect(latestControls?.isLocked).toBe(false);
    expect(container.textContent).toContain('"isLocked":false');
  });

  it("returns the current provider progress from useFlowProgress", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestProgress: number | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ProgressProbe onRender={(progress) => (latestProgress = progress)} />
      </>
    );

    expect(latestProgress).toBe(0);
    expect(latestProgress).toBe(latestControls?.progress);

    act(() => {
      latestControls?.next();
    });

    expect(latestProgress).toBe(0);
    expect(latestProgress).toBe(latestControls?.progress);
  });

  it("keeps useFlowProgress aligned with useFlow progress during transitions", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestProgress: number | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ProgressProbe onRender={(progress) => (latestProgress = progress)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      undefined,
      { transition: { duration: 100 } }
    );

    act(() => {
      latestControls?.next();
      context?.machine.update(40);
      context?.syncSnapshot();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 0.4,
      isTransitioning: true
    });
    expect(latestProgress).toBe(latestControls?.progress);
  });

  it("returns completed transition progress from useFlowProgress", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestProgress: number | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ProgressProbe onRender={(progress) => (latestProgress = progress)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      undefined,
      { transition: { duration: 100 } }
    );

    act(() => {
      latestControls?.next();
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 1,
      isTransitioning: false
    });
    expect(latestProgress).toBe(1);
    expect(latestProgress).toBe(latestControls?.progress);
  });

  it("does not change useFlowProgress for same-phase or boundary no-op navigation", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestProgress: number | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ProgressProbe onRender={(progress) => (latestProgress = progress)} />
      </>
    );

    expect(latestProgress).toBe(0);

    act(() => {
      latestControls?.goTo("intro");
      latestControls?.prev();
    });

    expect(latestControls).toMatchObject({
      phase: "intro",
      progress: 0,
      isTransitioning: false
    });
    expect(latestProgress).toBe(0);
    expect(latestProgress).toBe(latestControls?.progress);
  });

  it("keeps the React snapshot stable when prev is called at the first phase", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    const initialSnapshot = getRenderedSnapshot();

    act(() => {
      latestControls?.prev();
    });

    expect(getRenderedSnapshot()).toEqual(initialSnapshot);
    expect(latestControls).toMatchObject(initialSnapshot);

    act(() => {
      latestControls?.next();
    });

    expect(getRenderedSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps the React snapshot stable when next is called at the last phase", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      undefined,
      { transition: { duration: 100 } }
    );

    act(() => {
      latestControls?.goTo("contact");
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    const completedSnapshot = getRenderedSnapshot();

    act(() => {
      latestControls?.next();
    });

    expect(getRenderedSnapshot()).toEqual(completedSnapshot);
    expect(latestControls).toMatchObject(completedSnapshot);

    act(() => {
      latestControls?.prev();
    });

    expect(getRenderedSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps the completed React snapshot stable when goTo targets the current phase", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      undefined,
      { transition: { duration: 100 } }
    );

    act(() => {
      latestControls?.next();
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    const completedSnapshot = getRenderedSnapshot();

    act(() => {
      latestControls?.goTo("work");
    });

    expect(getRenderedSnapshot()).toEqual(completedSnapshot);
    expect(latestControls).toMatchObject(completedSnapshot);
  });

  it("accepts transition options and passes them to the core machine", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      undefined,
      {
        transition: {
          duration: 200,
          easing: (progress) => progress * progress
        }
      }
    );

    act(() => {
      latestControls?.next();
    });

    act(() => {
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 0.25,
      isTransitioning: true
    });
  });

  it("passes transition cooldown through the provider", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      undefined,
      {
        transition: {
          duration: 100,
          cooldown: 300
        }
      }
    );

    act(() => {
      latestControls?.next();
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    act(() => {
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    act(() => {
      context?.machine.update(199);
      context?.syncSnapshot();
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    act(() => {
      context?.machine.update(1);
      context?.syncSnapshot();
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "contact",
      isTransitioning: true
    });
  });

  it("uses transition byPhase options from the source phase through the provider", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      "work",
      {
        transition: {
          duration: 1000,
          byPhase: {
            intro: { duration: 100, easing: () => 0 },
            work: { duration: 200, easing: (progress) => progress * progress },
            contact: { duration: 800, easing: () => 1 }
          }
        }
      }
    );

    act(() => {
      latestControls?.prev();
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    expect(latestControls).toMatchObject({
      phase: "intro",
      progress: 0.25,
      direction: "prev",
      isTransitioning: true
    });
  });

  it("keeps legacy timing props working through the provider", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;

    renderFlow(<MachineProbe onRender={(value) => (context = value)} />, undefined, {
      transitionDurationMs: 200,
      easing: (progress) => progress * progress
    });

    act(() => {
      context?.machine.next();
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    expect(context?.machine.progress).toBe(0.25);
  });

  it("lets transition props take precedence over legacy timing props through the provider", () => {
    let context: NonNullable<React.ContextType<typeof FlowContext>> | undefined;
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <MachineProbe onRender={(value) => (context = value)} />
      </>,
      undefined,
      {
        transitionDurationMs: 1000,
        cooldownMs: 1000,
        easing: () => 0,
        transition: {
          duration: 200,
          cooldown: 300,
          easing: (progress) => progress
        }
      }
    );

    act(() => {
      latestControls?.next();
      context?.machine.update(100);
      context?.syncSnapshot();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 0.5,
      isTransitioning: true
    });

    act(() => {
      context?.machine.update(100);
      context?.syncSnapshot();
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    act(() => {
      context?.machine.update(99);
      context?.syncSnapshot();
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    act(() => {
      context?.machine.update(1);
      context?.syncSnapshot();
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "contact",
      isTransitioning: true
    });
  });

  it("throws a clear error when useFlow is rendered outside FlowProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    act(() => {
      root?.render(
        <ErrorBoundary>
          <ControlsProbe onRender={() => undefined} />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).toBe("useFlow must be used inside FlowProvider.");
  });

  it("throws a clear error when useFlowProgress is rendered outside FlowProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    act(() => {
      root?.render(
        <ErrorBoundary>
          <ProgressProbe onRender={() => undefined} />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).toBe("useFlowProgress must be used inside FlowProvider.");
  });
});
