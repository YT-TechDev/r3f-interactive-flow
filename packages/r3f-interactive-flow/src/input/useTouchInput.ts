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

const DEFAULT_THRESHOLD = 50;
const DEFAULT_AXIS = "y";
const DEFAULT_COOLDOWN = 0;

export type UseTouchInputOptions = {
  target?: FlowInputTarget;
  threshold?: number;
  axis?: "x" | "y";
  cooldown?: number;
  enabled?: boolean;
  preventDefault?: boolean;
  ignore?: readonly string[];
};

function getTouchClientPosition(touch: Touch, axis: "x" | "y"): number {
  return axis === "x" ? touch.clientX : touch.clientY;
}

function validateCooldown(cooldown: number): void {
  if (!Number.isFinite(cooldown) || cooldown < 0) {
    throw new Error("useTouchInput cooldown must be a finite non-negative number.");
  }
}

function validateThreshold(threshold: number): void {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("useTouchInput threshold must be a finite non-negative number.");
  }
}

export function useTouchInput<TPhase extends string>(options: UseTouchInputOptions = {}): void {
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
  const startPositionRef = useRef<number | null>(null);
  const gestureIgnoredRef = useRef(false);
  const gestureCommittedRef = useRef(false);
  const lastNavigationAtRef = useRef<number | null>(null);
  const ignoreSignature = JSON.stringify(options.ignore ?? []);
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

    const resetTouch = (): void => {
      startPositionRef.current = null;
      gestureIgnoredRef.current = false;
      gestureCommittedRef.current = false;
    };

    const attemptNavigation = (delta: number): boolean => {
      const currentFlow = flowRef.current;

      if (currentFlow.isLocked || currentFlow.isTransitioning) {
        return false;
      }

      if (delta < -threshold && currentFlow.phaseIndex === 0) {
        return false;
      }

      const now = Date.now();

      if (lastNavigationAtRef.current !== null && now - lastNavigationAtRef.current < cooldown) {
        return false;
      }

      const accepted = navigateAndSyncIfAccepted(
        machineRef.current,
        syncSnapshotRef.current,
        delta > threshold ? "next" : "prev"
      );

      if (!accepted) {
        return false;
      }

      lastNavigationAtRef.current = now;

      return true;
    };

    const handleTouchStart: EventListener = (event): void => {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.touches[0];

      gestureIgnoredRef.current =
        shouldIgnoreInputEvent(touchEvent, ignore) ||
        isEditableOrActionableTarget(touchEvent.target);
      gestureCommittedRef.current = false;

      if (touch === undefined) {
        startPositionRef.current = null;
        return;
      }

      startPositionRef.current = getTouchClientPosition(touch, axis);
    };

    const handleTouchMove: EventListener = (event): void => {
      const touchEvent = event as TouchEvent;

      if (startPositionRef.current === null || gestureIgnoredRef.current) {
        return;
      }

      if (gestureCommittedRef.current) {
        if (preventDefault) {
          touchEvent.preventDefault();
        }

        return;
      }

      const touch = touchEvent.touches[0];

      if (touch === undefined) {
        return;
      }

      const delta = startPositionRef.current - getTouchClientPosition(touch, axis);

      if (delta <= threshold && delta >= -threshold) {
        return;
      }

      if (!attemptNavigation(delta)) {
        return;
      }

      gestureCommittedRef.current = true;

      if (preventDefault) {
        touchEvent.preventDefault();
      }
    };

    const handleTouchEnd: EventListener = (event): void => {
      const touchEvent = event as TouchEvent;
      const startPosition = startPositionRef.current;
      const gestureIgnored = gestureIgnoredRef.current;
      const gestureCommitted = gestureCommittedRef.current;

      resetTouch();

      if (startPosition === null || gestureIgnored || gestureCommitted) {
        return;
      }

      const touch = touchEvent.changedTouches[0];

      if (touch === undefined) {
        return;
      }

      const delta = startPosition - getTouchClientPosition(touch, axis);

      if (delta <= threshold && delta >= -threshold) {
        return;
      }

      if (!attemptNavigation(delta)) {
        return;
      }

      if (preventDefault) {
        touchEvent.preventDefault();
      }
    };

    eventTarget.addEventListener("touchstart", handleTouchStart, {
      passive: true
    });
    eventTarget.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });
    eventTarget.addEventListener("touchend", handleTouchEnd, { passive: false });
    eventTarget.addEventListener("touchcancel", resetTouch, { passive: true });

    return () => {
      eventTarget.removeEventListener("touchstart", handleTouchStart);
      eventTarget.removeEventListener("touchmove", handleTouchMove);
      eventTarget.removeEventListener("touchend", handleTouchEnd);
      eventTarget.removeEventListener("touchcancel", resetTouch);
      resetTouch();
    };
  }, [
    options.axis,
    options.cooldown,
    options.enabled,
    ignoreSignature,
    options.preventDefault,
    options.target,
    options.threshold
  ]);
}
