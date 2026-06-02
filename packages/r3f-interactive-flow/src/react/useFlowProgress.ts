"use client";

import { useContext } from "react";
import { FlowContext } from "./FlowContext";

export function useFlowProgress(): number {
  const context = useContext(FlowContext);

  if (context === null) {
    throw new Error("useFlowProgress must be used inside FlowProvider.");
  }

  return context.controls.progress;
}
