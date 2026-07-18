"use client";

import { createContext } from "react";
import type { FlowControls, FlowMachine } from "../core/types";

export type FlowContextValue<TPhase extends string = string> = FlowControls<TPhase>;

export type FlowMachineContextValue<TPhase extends string = string> = {
  machine: FlowMachine<TPhase>;
  syncSnapshot: () => void;
};

export const FlowContext = createContext<FlowContextValue<string> | null>(null);
export const FlowMachineContext = createContext<FlowMachineContextValue<string> | null>(null);
