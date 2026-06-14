"use client";

import { useFrame } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import type { FlowDirection } from "../core/types";
import { FlowContext } from "../react/FlowContext";

export type FlowFrameState<TPhase extends string> = {
  phase: TPhase;
  phaseIndex: number;
  progress: number;
  direction: FlowDirection;
  isTransitioning: boolean;
};

export type FlowFrameCallback<TPhase extends string> = (
  state: FlowFrameState<TPhase>,
  delta: number
) => void;

export function useFlowFrame<TPhase extends string>(callback: FlowFrameCallback<TPhase>): void {
  const context = useContext(FlowContext);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  if (context === null) {
    throw new Error("useFlowFrame must be used inside FlowProvider.");
  }

  const { machine, syncSnapshot } = context;

  useFrame((_, delta) => {
    const before = machine.getSnapshot();

    machine.update(delta * 1000);

    const after = machine.getSnapshot();

    callbackRef.current(
      {
        phase: after.phase as TPhase,
        phaseIndex: after.phaseIndex,
        progress: after.progress,
        direction: after.direction,
        isTransitioning: after.isTransitioning
      },
      delta
    );

    if (before.isTransitioning && !after.isTransitioning) {
      syncSnapshot();
    }
  });
}
