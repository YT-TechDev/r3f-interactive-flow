import React, { act, useContext } from "react";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlowControls } from "../core/types";
import { FlowMachineContext } from "./FlowContext";
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

function ConsistencyProbe({
  onRender
}: {
  onRender: (snapshot: RenderedSnapshot & { progressHook: number }) => void;
}) {
  const controls = useFlow<TestPhase>();
  const progress = useFlowProgress();
  const snapshot = {
    phase: controls.phase,
    phaseIndex: controls.phaseIndex,
    progress: controls.progress,
    progressHook: progress,
    direction: controls.direction,
    isTransitioning: controls.isTransitioning,
    isLocked: controls.isLocked
  };

  onRender(snapshot);

  return <output data-testid="consistency">{JSON.stringify(snapshot)}</output>;
}

function MachineProbe({
  onRender
}: {
  onRender: (value: NonNullable<React.ContextType<typeof FlowMachineContext>>) => void;
}) {
  const value = useContext(FlowMachineContext);

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

  it("resolves the initial snapshot from the configured initial phase", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />, "work");

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    expect(container.textContent).toContain('"phase":"work"');
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

  it("does not navigate while locked and resumes navigation after unlock", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />);

    act(() => {
      latestControls?.lock();
      latestControls?.next();
      latestControls?.goTo("contact");
    });

    expect(latestControls).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });
    expect(getRenderedSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });

    act(() => {
      latestControls?.unlock();
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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

  it("keeps hook snapshots stable after current-phase and boundary no-op navigation", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestSnapshot: (RenderedSnapshot & { progressHook: number }) | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ConsistencyProbe onRender={(snapshot) => (latestSnapshot = snapshot)} />
      </>
    );

    const initialSnapshot = latestSnapshot;

    act(() => {
      latestControls?.goTo("intro");
      latestControls?.prev();
    });

    expect(latestSnapshot).toEqual(initialSnapshot);
    expect(latestSnapshot?.progressHook).toBe(latestSnapshot?.progress);
    expect(latestSnapshot).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      progressHook: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps hook progress consistent through manual lock and unlock", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestSnapshot: (RenderedSnapshot & { progressHook: number }) | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ConsistencyProbe onRender={(snapshot) => (latestSnapshot = snapshot)} />
      </>
    );

    act(() => {
      latestControls?.lock();
    });

    expect(latestSnapshot).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      progressHook: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });
    expect(latestSnapshot?.progressHook).toBe(latestSnapshot?.progress);

    act(() => {
      latestControls?.unlock();
    });

    expect(latestSnapshot).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      progressHook: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    expect(latestSnapshot?.progressHook).toBe(latestSnapshot?.progress);
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;

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
    let context: NonNullable<React.ContextType<typeof FlowMachineContext>> | undefined;
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

  it("renders children without a Canvas wrapper", () => {
    renderFlow(<output data-testid="child">plain child</output>);

    expect(container.textContent).toBe("plain child");
  });

  it("does not require browser globals at module import time", async () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

    vi.resetModules();

    try {
      Reflect.deleteProperty(globalThis, "window");
      Reflect.deleteProperty(globalThis, "document");

      await expect(import("./FlowProvider")).resolves.toHaveProperty("FlowProvider");
    } finally {
      if (windowDescriptor !== undefined) {
        Object.defineProperty(globalThis, "window", windowDescriptor);
      }

      if (documentDescriptor !== undefined) {
        Object.defineProperty(globalThis, "document", documentDescriptor);
      }

      vi.resetModules();
    }
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

// Deterministic requestAnimationFrame clock used only for the provider-owned
// clock tests below. It is installed per test and removed afterwards so the
// suites above keep running with no requestAnimationFrame available.
const frameCallbacks = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let frameNow = 0;

function installFrameClock(): void {
  frameCallbacks.clear();
  nextFrameId = 1;
  frameNow = 0;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = nextFrameId++;
    frameCallbacks.set(id, callback);

    return id;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    frameCallbacks.delete(id);
  };
}

function uninstallFrameClock(): void {
  frameCallbacks.clear();
  Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  Reflect.deleteProperty(globalThis, "cancelAnimationFrame");
}

function pendingFrameCount(): number {
  return frameCallbacks.size;
}

// Advance the provider clock by one frame. The first frame after a clock start
// only establishes the time baseline (delta 0); later frames apply deltaMs.
function advanceClock(deltaMs: number): void {
  frameNow += deltaMs;
  const pending = [...frameCallbacks.values()];
  frameCallbacks.clear();

  act(() => {
    for (const callback of pending) {
      callback(frameNow);
    }
  });
}

describe("FlowProvider provider-owned transition clock", () => {
  beforeEach(() => {
    installFrameClock();
  });

  afterEach(() => {
    uninstallFrameClock();
  });

  it("advances React progress continuously through a Canvas-free navigation", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestProgress: number | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ProgressProbe onRender={(progress) => (latestProgress = progress)} />
      </>,
      undefined,
      { transition: { duration: 1000 } }
    );

    // Transition start: React progress is 0 and the machine is transitioning.
    act(() => {
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 0,
      isTransitioning: true
    });
    expect(latestProgress).toBe(0);

    // Intermediate frame: React progress moves strictly between 0 and 1.
    advanceClock(16); // baseline frame establishes the time origin (delta 0)
    advanceClock(250);

    expect(latestControls?.isTransitioning).toBe(true);
    expect(latestControls?.progress).toBeGreaterThan(0);
    expect(latestControls?.progress).toBeLessThan(1);
    expect(latestProgress).toBe(latestControls?.progress);

    // Completion frame: React progress reaches 1 and the transition ends.
    advanceClock(1500);

    expect(latestControls).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false
    });
    expect(latestProgress).toBe(1);
    expect(container.textContent).toContain('"progress":1');
    expect(container.textContent).toContain('"isTransitioning":false');
    expect(pendingFrameCount()).toBe(0);
  });

  it("reports the same in-flight progress to every useFlowProgress consumer", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let firstProgress: number | undefined;
    let secondProgress: number | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ProgressProbe onRender={(progress) => (firstProgress = progress)} />
        <ProgressProbe onRender={(progress) => (secondProgress = progress)} />
      </>,
      undefined,
      { transition: { duration: 1000 } }
    );

    act(() => {
      latestControls?.next();
    });

    advanceClock(16);
    advanceClock(400);

    expect(firstProgress).toBeGreaterThan(0);
    expect(firstProgress).toBeLessThan(1);
    expect(secondProgress).toBe(firstProgress);
    expect(firstProgress).toBe(latestControls?.progress);
  });

  it("keeps stable machine consumers off frame-driven React snapshot updates", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let machineRenderCount = 0;
    const progressFrames: number[] = [];

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ProgressProbe onRender={(progress) => progressFrames.push(progress)} />
        <MachineProbe
          onRender={() => {
            machineRenderCount += 1;
          }}
        />
      </>,
      undefined,
      { transition: { duration: 1000 } }
    );

    expect(machineRenderCount).toBe(1);

    act(() => {
      latestControls?.next();
    });

    // Navigation starts a transition and updates reactive consumers, but the
    // stable machine boundary itself is unchanged.
    expect(machineRenderCount).toBe(1);
    expect(progressFrames.at(-1)).toBe(0);

    advanceClock(16);
    advanceClock(250);
    advanceClock(250);
    advanceClock(1500);

    expect(machineRenderCount).toBe(1);
    expect(progressFrames).toContain(0);
    expect(progressFrames.some((progress) => progress > 0 && progress < 1)).toBe(true);
    expect(progressFrames.at(-1)).toBe(1);
    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 1,
      isTransitioning: false
    });
  });

  it("keeps useFlow().progress and useFlowProgress aligned across every transition frame", () => {
    let latestControls: FlowControls<TestPhase> | undefined;
    let latestSnapshot: (RenderedSnapshot & { progressHook: number }) | undefined;

    renderFlow(
      <>
        <ControlsProbe onRender={(controls) => (latestControls = controls)} />
        <ConsistencyProbe onRender={(snapshot) => (latestSnapshot = snapshot)} />
      </>,
      undefined,
      { transition: { duration: 1000 } }
    );

    act(() => {
      latestControls?.next();
    });

    expect(latestSnapshot?.progressHook).toBe(latestSnapshot?.progress);

    advanceClock(16); // baseline frame (delta 0)

    for (const deltaMs of [100, 150, 250, 500]) {
      advanceClock(deltaMs);
      expect(latestSnapshot?.progressHook).toBe(latestSnapshot?.progress);
    }

    expect(latestSnapshot).toMatchObject({
      phase: "work",
      progress: 1,
      progressHook: 1,
      isTransitioning: false
    });
  });

  it("completes an accepted navigation without a mounted useFlowFrame consumer", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />, undefined, {
      transition: { duration: 1000 }
    });

    act(() => {
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 0,
      isTransitioning: true
    });

    advanceClock(16);
    advanceClock(1500);

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
    // Scheduled clock work is cleaned up after completion.
    expect(pendingFrameCount()).toBe(0);
  });

  it("advances cooldown without a Canvas frame subscriber", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />, undefined, {
      transition: { duration: 100, cooldown: 300 }
    });

    act(() => {
      latestControls?.next();
    });

    // Baseline frame, then finish the 100ms transition; 200ms of cooldown remain.
    advanceClock(16);
    advanceClock(100);

    expect(latestControls).toMatchObject({ phase: "work", isTransitioning: false });
    // The clock keeps running to consume the remaining cooldown.
    expect(pendingFrameCount()).toBe(1);

    // Navigation is still blocked while the cooldown has not elapsed.
    act(() => {
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({ phase: "work", isTransitioning: false });

    // Consume the remaining cooldown purely through the provider clock.
    advanceClock(200);

    expect(pendingFrameCount()).toBe(0);

    act(() => {
      latestControls?.next();
    });

    expect(latestControls).toMatchObject({ phase: "contact", isTransitioning: true });
  });

  it("cancels scheduled clock work when the provider unmounts", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />, undefined, {
      transition: { duration: 1000 }
    });

    act(() => {
      latestControls?.next();
    });

    expect(pendingFrameCount()).toBe(1);

    // Unmount the provider subtree.
    act(() => {
      root?.render(<output data-testid="empty">empty</output>);
    });

    expect(pendingFrameCount()).toBe(0);
  });

  it("does not create duplicate clocks under React Strict Mode setup and cleanup", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    act(() => {
      root?.render(
        <React.StrictMode>
          <FlowProvider phases={phases} transition={{ duration: 1000 }}>
            <ControlsProbe onRender={(controls) => (latestControls = controls)} />
          </FlowProvider>
        </React.StrictMode>
      );
    });

    act(() => {
      latestControls?.next();
    });

    // Exactly one clock is scheduled despite Strict Mode double setup/cleanup.
    expect(pendingFrameCount()).toBe(1);

    advanceClock(16);
    advanceClock(1500);

    expect(latestControls).toMatchObject({
      phase: "work",
      progress: 1,
      isTransitioning: false
    });
    expect(pendingFrameCount()).toBe(0);
  });

  it("stops the old clock when the machine is replaced by a configuration change", () => {
    let latestControls: FlowControls<TestPhase> | undefined;

    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />, undefined, {
      transitionDurationMs: 1000
    });

    act(() => {
      latestControls?.next();
    });

    expect(pendingFrameCount()).toBe(1);

    // Changing timing props replaces the machine; the old clock must not survive.
    renderFlow(<ControlsProbe onRender={(controls) => (latestControls = controls)} />, undefined, {
      transitionDurationMs: 500
    });

    expect(pendingFrameCount()).toBe(0);
    expect(latestControls).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      isTransitioning: false
    });

    // Advancing frames does not resurrect an old clock or throw.
    advanceClock(16);
    advanceClock(1000);

    expect(pendingFrameCount()).toBe(0);
  });
});
