import React, { act, useContext } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FlowControls, FlowMachine } from "../core/types";
import { installMinimalDom } from "../test-utils/minimalDom";
import { createFlowTestHarness } from "../test-utils/renderFlow";
import { FlowMachineContext } from "./FlowContext";
import { useFlow } from "./useFlow";
import { useFlowProgress } from "./useFlowProgress";

installMinimalDom();

const { createRoot } = await import("react-dom/client");

type TestPhase = "intro" | "work" | "contact";

const phases = ["intro", "work", "contact"] as const;
const { getRoot, renderFlow } = createFlowTestHarness<TestPhase>({ createRoot, phases });

function FlowProbe({ onRender }: { onRender: (controls: FlowControls<TestPhase>) => void }) {
  const controls = useFlow<TestPhase>();

  onRender(controls);

  return <output data-testid="flow-progress">{controls.progress}</output>;
}

function ProgressProbe({ onRender }: { onRender: (progress: number) => void }) {
  const progress = useFlowProgress();

  onRender(progress);

  return <output data-testid="progress">{progress}</output>;
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

  onRender(context.machine as FlowMachine<TestPhase>, context.syncSnapshot);

  return null;
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

describe("useFlowProgress", () => {
  it("starts at the provider progress and stays aligned with useFlow during a transition", () => {
    let controls: FlowControls<TestPhase> | undefined;
    let progress: number | undefined;
    let machine: FlowMachine<TestPhase> | undefined;
    let syncSnapshot: (() => void) | undefined;

    renderFlow(
      <>
        <FlowProbe onRender={(nextControls) => (controls = nextControls)} />
        <ProgressProbe onRender={(nextProgress) => (progress = nextProgress)} />
        <MachineProbe
          onRender={(nextMachine, nextSyncSnapshot) => {
            machine = nextMachine;
            syncSnapshot = nextSyncSnapshot;
          }}
        />
      </>,
      undefined,
      { transition: { duration: 100 } }
    );

    expect(progress).toBe(0);
    expect(progress).toBe(controls?.progress);

    act(() => {
      controls?.next();
      machine?.update(40);
      syncSnapshot?.();
    });

    expect(controls).toMatchObject({ phase: "work", progress: 0.4, isTransitioning: true });
    expect(progress).toBe(controls?.progress);

    act(() => {
      machine?.update(60);
      syncSnapshot?.();
    });

    expect(controls).toMatchObject({ phase: "work", progress: 1, isTransitioning: false });
    expect(progress).toBe(controls?.progress);
  });

  it("does not change when navigation is blocked by a phase boundary or lock", () => {
    let controls: FlowControls<TestPhase> | undefined;
    let progress: number | undefined;

    renderFlow(
      <>
        <FlowProbe onRender={(nextControls) => (controls = nextControls)} />
        <ProgressProbe onRender={(nextProgress) => (progress = nextProgress)} />
      </>
    );

    act(() => {
      controls?.prev();
    });

    expect(controls).toMatchObject({ phase: "intro", progress: 0, isTransitioning: false });
    expect(progress).toBe(0);
    expect(progress).toBe(controls?.progress);

    act(() => {
      controls?.lock();
      controls?.next();
      controls?.goTo("contact");
    });

    expect(controls).toMatchObject({ phase: "intro", progress: 0, isLocked: true });
    expect(progress).toBe(0);
    expect(progress).toBe(controls?.progress);
  });

  it("keeps multiple consumers in sync without a Canvas wrapper", () => {
    let firstProgress: number | undefined;
    let secondProgress: number | undefined;
    let controls: FlowControls<TestPhase> | undefined;

    renderFlow(
      <>
        <FlowProbe onRender={(nextControls) => (controls = nextControls)} />
        <ProgressProbe onRender={(progress) => (firstProgress = progress)} />
        <ProgressProbe onRender={(progress) => (secondProgress = progress)} />
      </>
    );

    expect(firstProgress).toBe(0);
    expect(secondProgress).toBe(firstProgress);
    expect(secondProgress).toBe(controls?.progress);

    act(() => {
      controls?.next();
    });

    expect(firstProgress).toBe(secondProgress);
    expect(secondProgress).toBe(controls?.progress);
  });

  it("throws a clear error when rendered outside FlowProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    act(() => {
      getRoot()?.render(
        <ErrorBoundary>
          <ProgressProbe onRender={() => undefined} />
        </ErrorBoundary>
      );
    });

    expect(document.body.textContent).toBe("useFlowProgress must be used inside FlowProvider.");
  });
});
