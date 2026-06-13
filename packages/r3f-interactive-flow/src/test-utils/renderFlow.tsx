import React, { act } from "react";
import type { ReactNode } from "react";
import type { Root, createRoot as createRootType } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";

import type { FlowControls } from "../core/types";
import { FlowProvider } from "../react/FlowProvider";
import { useFlow } from "../react/useFlow";
import { windowTarget } from "./minimalDom";

function ControlsProbeComponent<TPhase extends string>({
  onRender
}: {
  onRender: (controls: FlowControls<TPhase>) => void;
}) {
  const controls = useFlow<TPhase>();

  onRender(controls);

  return <output data-testid="phase">{controls.phase}</output>;
}

export function createControlsProbe<TPhase extends string>() {
  return ControlsProbeComponent<TPhase>;
}

export function createFlowTestHarness<TPhase extends string>({
  createRoot,
  phases
}: {
  createRoot: typeof createRootType;
  phases: readonly TPhase[];
}) {
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

  return {
    getRoot: () => root,
    renderFlow(children: ReactNode, initialPhase?: TPhase): void {
      act(() => {
        root?.render(
          <FlowProvider phases={phases} {...(initialPhase !== undefined ? { initialPhase } : {})}>
            {children}
          </FlowProvider>
        );
      });
    }
  };
}
