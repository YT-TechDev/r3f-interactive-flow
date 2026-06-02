"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createFlowMachine } from "../core/createFlowMachine";
import type { EasingFunction } from "../core/easing";
import type { FlowControls, FlowSnapshot } from "../core/types";
import { FlowContext } from "./FlowContext";
import type { FlowContextValue } from "./FlowContext";

export type FlowProviderProps<TPhase extends string> = {
  phases: readonly TPhase[];
  initialPhase?: TPhase;
  transitionDurationMs?: number;
  easing?: EasingFunction;
  children: ReactNode;
};

export function FlowProvider<TPhase extends string>({
  phases,
  initialPhase,
  transitionDurationMs,
  easing,
  children
}: FlowProviderProps<TPhase>): ReactNode {
  const machine = useMemo(() => {
    return createFlowMachine({
      phases,
      ...(initialPhase !== undefined ? { initialPhase } : {}),
      ...(transitionDurationMs !== undefined ? { transitionDurationMs } : {}),
      ...(easing !== undefined ? { easing } : {})
    });
  }, [easing, initialPhase, phases, transitionDurationMs]);

  const [snapshot, setSnapshot] = useState<FlowSnapshot<TPhase>>(() => machine.getSnapshot());

  const syncSnapshot = useCallback(() => {
    setSnapshot(machine.getSnapshot());
  }, [machine]);

  useEffect(() => {
    syncSnapshot();
  }, [syncSnapshot]);

  const controls = useMemo<FlowControls<TPhase>>(
    () => ({
      ...snapshot,
      next: () => {
        machine.next();
        syncSnapshot();
      },
      prev: () => {
        machine.prev();
        syncSnapshot();
      },
      goTo: (phase) => {
        machine.goTo(phase);
        syncSnapshot();
      },
      lock: () => {
        machine.lock();
        syncSnapshot();
      },
      unlock: () => {
        machine.unlock();
        syncSnapshot();
      }
    }),
    [machine, snapshot, syncSnapshot]
  );

  const contextValue = useMemo<FlowContextValue<TPhase>>(
    () => ({
      controls,
      machine,
      syncSnapshot
    }),
    [controls, machine, syncSnapshot]
  );

  return (
    <FlowContext.Provider value={contextValue as FlowContextValue<string>}>
      {children}
    </FlowContext.Provider>
  );
}
