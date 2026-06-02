"use client";

import { createContext } from "react";
import type { FlowControls, FlowMachine } from "../core/types";

export type FlowContextValue<TPhase extends string = string> = {
  controls: FlowControls<TPhase>;
  machine: FlowMachine<TPhase>;
  syncSnapshot: () => void;
};

export const FlowContext = createContext<FlowContextValue<string> | null>(null);
