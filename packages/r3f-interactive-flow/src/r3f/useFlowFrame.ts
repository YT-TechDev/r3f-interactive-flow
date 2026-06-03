"use client";

import { useFrame } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import { FlowContext } from "../react/FlowContext";

export function useFlowFrame(
  callback: (progress: number, delta: number) => void,
): void {
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

    callbackRef.current(after.progress, delta);

    if (before.isTransitioning && !after.isTransitioning) {
      syncSnapshot();
    }
  });
}
