"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createFlowMachine } from "../core/createFlowMachine";
import type { EasingFunction } from "../core/easing";
import type { FlowControls, FlowSnapshot, FlowTransitionOptions } from "../core/types";
import { FlowContext, FlowMachineContext } from "./FlowContext";
import type { FlowContextValue, FlowMachineContextValue } from "./FlowContext";

export type FlowProviderProps<TPhase extends string> = {
  phases: readonly TPhase[];
  initialPhase?: TPhase;
  transitionDurationMs?: number;
  cooldownMs?: number;
  easing?: EasingFunction;
  transition?: FlowTransitionOptions<TPhase>;
  children: ReactNode;
};

export function FlowProvider<TPhase extends string>({
  phases,
  initialPhase,
  transitionDurationMs,
  cooldownMs,
  easing,
  transition,
  children
}: FlowProviderProps<TPhase>): ReactNode {
  const [machine] = useState(() => {
    return createFlowMachine({
      phases,
      ...(initialPhase !== undefined ? { initialPhase } : {}),
      ...(transitionDurationMs !== undefined ? { transitionDurationMs } : {}),
      ...(cooldownMs !== undefined ? { cooldownMs } : {}),
      ...(easing !== undefined ? { easing } : {}),
      ...(transition !== undefined ? { transition } : {})
    });
  });

  const [snapshot, setSnapshot] = useState<FlowSnapshot<TPhase>>(() => machine.getSnapshot());

  // Single provider-owned transition clock. The machine is advanced by exactly
  // one requestAnimationFrame loop while it is settling (an active transition or
  // a remaining cooldown), independent of how many useFlowFrame consumers exist.
  const frameHandleRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const tickRef = useRef<(now: number) => void>(() => undefined);

  const stopClock = useCallback(() => {
    if (frameHandleRef.current !== null) {
      const cancelFrame = globalThis.cancelAnimationFrame;

      if (typeof cancelFrame === "function") {
        cancelFrame(frameHandleRef.current);
      }

      frameHandleRef.current = null;
    }

    lastFrameTimeRef.current = null;
  }, []);

  const scheduleFrame = useCallback(() => {
    const requestFrame = globalThis.requestAnimationFrame;

    if (typeof requestFrame !== "function") {
      frameHandleRef.current = null;

      return;
    }

    frameHandleRef.current = requestFrame((now) => {
      tickRef.current(now);
    });
  }, []);

  const syncSnapshot = useCallback(() => {
    setSnapshot(machine.getSnapshot());
  }, [machine]);

  const advanceClock = useCallback(
    (now: number) => {
      const lastFrameTime = lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      const deltaMs = lastFrameTime === null ? 0 : Math.max(0, now - lastFrameTime);

      const before = machine.getSnapshot();
      machine.update(deltaMs);
      const after = machine.getSnapshot();

      // Synchronize the React snapshot on every frame that advances a
      // transition, including the completion frame, so DOM consumers
      // (useFlowProgress and useFlow().progress) move continuously from 0 to 1.
      // Cooldown-only frames skip React work while the boolean is unchanged;
      // synchronize only the exact expiry boundary.
      if (
        before.isTransitioning ||
        after.isTransitioning ||
        before.isCoolingDown !== after.isCoolingDown
      ) {
        setSnapshot(after);
      }

      if (machine.isSettling) {
        scheduleFrame();
      } else {
        frameHandleRef.current = null;
        lastFrameTimeRef.current = null;
      }
    },
    [machine, scheduleFrame]
  );

  useEffect(() => {
    tickRef.current = advanceClock;
  }, [advanceClock]);

  const ensureClockRunning = useCallback(() => {
    if (frameHandleRef.current !== null) {
      return;
    }

    if (!machine.isSettling) {
      return;
    }

    lastFrameTimeRef.current = null;
    scheduleFrame();
  }, [machine, scheduleFrame]);

  // Synchronize the React snapshot at discrete lifecycle boundaries and, when a
  // navigation has left the machine settling, make sure the clock is running.
  const requestSync = useCallback(() => {
    syncSnapshot();
    ensureClockRunning();
  }, [ensureClockRunning, syncSnapshot]);

  useEffect(() => {
    requestSync();
  }, [requestSync]);

  // Stop the clock when this provider instance unmounts. Applying new
  // configuration intentionally means remounting FlowProvider with a new React
  // key, so stale clock work must not survive that unmount/remount boundary.
  useEffect(() => {
    return () => {
      stopClock();
    };
  }, [stopClock]);

  const controls = useMemo<FlowControls<TPhase>>(
    () => ({
      ...snapshot,
      isCoolingDown: snapshot.isCoolingDown,
      next: () => {
        const accepted = machine.next();
        requestSync();

        return accepted;
      },
      prev: () => {
        const accepted = machine.prev();
        requestSync();

        return accepted;
      },
      goTo: (phase) => {
        const accepted = machine.goTo(phase);
        requestSync();

        return accepted;
      },
      lock: () => {
        machine.lock();
        requestSync();
      },
      unlock: () => {
        machine.unlock();
        requestSync();
      }
    }),
    [machine, requestSync, snapshot]
  );

  const machineContextValue = useMemo<FlowMachineContextValue<TPhase>>(
    () => ({
      machine,
      syncSnapshot: requestSync
    }),
    [machine, requestSync]
  );

  return (
    <FlowMachineContext.Provider
      value={machineContextValue as unknown as FlowMachineContextValue<string>}
    >
      <FlowContext.Provider value={controls as unknown as FlowContextValue<string>}>
        {children}
      </FlowContext.Provider>
    </FlowMachineContext.Provider>
  );
}
