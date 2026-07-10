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

  const { machine } = context;

  // The FlowProvider owns the single transition clock. This hook only reads the
  // current machine snapshot and runs the user callback, so any number of
  // consumers observe a consistent snapshot within the same frame without
  // advancing the machine.
  useFrame((_, delta) => {
    const snapshot = machine.getSnapshot();

    callbackRef.current(
      {
        phase: snapshot.phase as TPhase,
        phaseIndex: snapshot.phaseIndex,
        progress: snapshot.progress,
        direction: snapshot.direction,
        isTransitioning: snapshot.isTransitioning
      },
      delta
    );
  });
}
