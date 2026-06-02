"use client";

import { useContext } from "react";
import type { FlowControls } from "../core/types";
import { FlowContext } from "./FlowContext";

export function useFlow<TPhase extends string>(): FlowControls<TPhase> {
  const context = useContext(FlowContext);

  if (context === null) {
    throw new Error("useFlow must be used inside FlowProvider.");
  }

  return context.controls as FlowControls<TPhase>;
}
