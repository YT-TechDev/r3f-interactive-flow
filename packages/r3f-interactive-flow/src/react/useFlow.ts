"use client";

import type { FlowControls } from "../core/types";

export function useFlow<TPhase extends string>(): FlowControls<TPhase> {
  throw new Error("useFlow must be used inside a configured FlowProvider.");
}
