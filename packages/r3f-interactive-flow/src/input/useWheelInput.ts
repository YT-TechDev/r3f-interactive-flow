"use client";

import { useContext, useEffect, useRef } from "react";
import type { FlowControls, FlowMachine } from "../core/types";
import { FlowContext, FlowMachineContext } from "../react/FlowContext";
import { resolveInputTarget, shouldIgnoreInputEvent } from "./inputUtils";
import type { FlowInputTarget } from "./inputUtils";
import { navigateAndSyncIfAccepted } from "./navigationAcceptance";

const DEFAULT_THRESHOLD = 40;
const DEFAULT_AXIS = "y";
const DEFAULT_COOLDOWN = 0;

export type { FlowInputTarget } from "./inputUtils";

export type UseWheelInputOptions = {
  target?: FlowInputTarget;
  threshold?: number;
  axis?: "x" | "y";
  cooldown?: number;
  enabled?: boolean;
  preventDefault?: boolean;
  ignore?: readonly string[];
};

function getWheelDelta(event: WheelEvent, axis: "x" | "y"): number {
  return axis === "x" ? event.deltaX : event.deltaY;
}

function validateCooldown(cooldown: number): void {
  if (!Number.isFinite(cooldown) || cooldown < 0) {
    throw new Error("useWheelInput cooldown must be a finite non-negative number.");
  }
}

function validateThreshold(threshold: number): void {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("useWheelInput threshold must be a finite non-negative number.");
  }
}

export function useWheelInput<TPhase extends string>(options: UseWheelInputOptions = {}): void {
  const flow = useContext(FlowContext);
  const machineContext = useContext(FlowMachineContext);

  if (flow === null || machineContext === null) {
    throw new Error("useFlow must be used inside FlowProvider.");
  }

  const typedFlow = flow as unknown as FlowControls<TPhase>;
  const machine = machineContext.machine as unknown as FlowMachine<TPhase>;
  const syncSnapshot = machineContext.syncSnapshot;
  const flowRef = useRef<FlowControls<TPhase>>(typedFlow);
  const machineRef = useRef(machine);
  const syncSnapshotRef = useRef(syncSnapshot);
  const lastNavigationAtRef = useRef<number | null>(null);
  useEffect(() => {
    flowRef.current = typedFlow;
    machineRef.current = machine;
    syncSnapshotRef.current = syncSnapshot;
  }, [typedFlow, machine, syncSnapshot]);

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const eventTarget = resolveInputTarget(options.target);

    if (eventTarget === null) {
      return;
    }

    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    const axis = options.axis ?? DEFAULT_AXIS;
    const cooldown = options.cooldown ?? DEFAULT_COOLDOWN;
    const ignore = options.ignore ?? [];
    const preventDefault = options.preventDefault ?? true;
    validateCooldown(cooldown);
    validateThreshold(threshold);

    const handleWheel: EventListener = (event): void => {
      const wheelEvent = event as WheelEvent;

      if (shouldIgnoreInputEvent(wheelEvent, ignore)) {
        return;
      }

      if (preventDefault) {
        wheelEvent.preventDefault();
      }

      const currentFlow = flowRef.current;

      if (currentFlow.isLocked || currentFlow.isTransitioning) {
        return;
      }

      const delta = getWheelDelta(wheelEvent, axis);

      if (delta <= threshold && delta >= -threshold) {
        return;
      }

      if (delta < -threshold && currentFlow.phaseIndex === 0) {
        return;
      }

      const now = Date.now();

      if (lastNavigationAtRef.current !== null && now - lastNavigationAtRef.current < cooldown) {
        return;
      }

      const accepted = navigateAndSyncIfAccepted(
        machineRef.current,
        syncSnapshotRef.current,
        delta > threshold ? "next" : "prev"
      );

      if (accepted) {
        lastNavigationAtRef.current = now;
      }
    };

    eventTarget.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      eventTarget.removeEventListener("wheel", handleWheel);
    };
  }, [
    options.axis,
    options.cooldown,
    options.enabled,
    options.ignore,
    options.preventDefault,
    options.target,
    options.threshold
  ]);
}
