"use client";

import { useContext, useEffect, useRef } from "react";
import type { FlowControls, FlowMachine } from "../core/types";
import { FlowContext, FlowMachineContext } from "../react/FlowContext";
import {
  isEditableOrActionableTarget,
  resolveInputTarget,
  shouldIgnoreInputEvent
} from "./inputUtils";
import type { FlowInputTarget } from "./inputUtils";
import { navigateAndSyncIfAccepted } from "./navigationAcceptance";

const DEFAULT_THRESHOLD = 40;
const DEFAULT_AXIS = "y";
const DEFAULT_COOLDOWN = 0;
const WHEEL_BURST_INACTIVITY_MS = 200;
const WHEEL_DELTA_PIXEL_MULTIPLIER = 1;
const WHEEL_DELTA_LINE_MULTIPLIER = 16;
const WHEEL_DELTA_PAGE_MULTIPLIER = 800;

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

function getWheelDeltaMultiplier(deltaMode: number): number {
  switch (deltaMode) {
    case 1:
      return WHEEL_DELTA_LINE_MULTIPLIER;
    case 2:
      return WHEEL_DELTA_PAGE_MULTIPLIER;
    case 0:
    default:
      return WHEEL_DELTA_PIXEL_MULTIPLIER;
  }
}

function getNormalizedWheelDelta(event: WheelEvent, axis: "x" | "y"): number {
  const delta = axis === "x" ? event.deltaX : event.deltaY;

  return delta * getWheelDeltaMultiplier(event.deltaMode);
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

    let accumulatedDelta = 0;
    let lastRelevantEventAt: number | null = null;
    let lastEventTarget: EventTarget | null = null;
    let hasLastEventTarget = false;
    let hasConsumedBurst = false;
    let activeBurstDirection: "next" | "prev" | null = null;

    const resetBurst = (): void => {
      accumulatedDelta = 0;
      lastRelevantEventAt = null;
      lastEventTarget = null;
      hasLastEventTarget = false;
      hasConsumedBurst = false;
      activeBurstDirection = null;
    };

    const handleWheel: EventListener = (event): void => {
      const wheelEvent = event as WheelEvent;

      if (
        shouldIgnoreInputEvent(wheelEvent, ignore) ||
        isEditableOrActionableTarget(wheelEvent.target)
      ) {
        resetBurst();
        return;
      }

      const delta = getNormalizedWheelDelta(wheelEvent, axis);

      if (delta === 0) {
        return;
      }

      const now = Date.now();
      const direction = delta > 0 ? "next" : "prev";
      const eventTarget = wheelEvent.target;

      if (lastRelevantEventAt !== null && now - lastRelevantEventAt > WHEEL_BURST_INACTIVITY_MS) {
        resetBurst();
      }

      if (hasLastEventTarget && eventTarget !== lastEventTarget) {
        resetBurst();
      }

      if (activeBurstDirection !== null && direction !== activeBurstDirection) {
        resetBurst();
      }

      lastRelevantEventAt = now;
      lastEventTarget = eventTarget;
      hasLastEventTarget = true;
      activeBurstDirection = direction;

      if (hasConsumedBurst) {
        return;
      }

      accumulatedDelta += delta;

      if (accumulatedDelta <= threshold && accumulatedDelta >= -threshold) {
        return;
      }

      const navigationDirection = accumulatedDelta > threshold ? "next" : "prev";
      accumulatedDelta = 0;
      const currentFlow = flowRef.current;

      if (currentFlow.isLocked || currentFlow.isTransitioning) {
        return;
      }

      if (navigationDirection === "prev" && currentFlow.phaseIndex === 0) {
        return;
      }

      if (lastNavigationAtRef.current !== null && now - lastNavigationAtRef.current < cooldown) {
        return;
      }

      const accepted = navigateAndSyncIfAccepted(
        machineRef.current,
        syncSnapshotRef.current,
        navigationDirection
      );

      if (!accepted) {
        return;
      }

      lastNavigationAtRef.current = now;
      hasConsumedBurst = true;

      if (preventDefault) {
        wheelEvent.preventDefault();
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
    options.threshold,
    machineContext
  ]);
}
