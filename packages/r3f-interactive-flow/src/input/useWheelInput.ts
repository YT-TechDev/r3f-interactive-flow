"use client";

import { useEffect, useRef } from "react";
import type { FlowControls } from "../core/types";
import { useFlow } from "../react/useFlow";
import { resolveInputTarget, shouldIgnoreInputEvent } from "./inputUtils";
import type { FlowInputTarget } from "./inputUtils";

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

export function useWheelInput<TPhase extends string>(options: UseWheelInputOptions = {}): void {
  const flow = useFlow<TPhase>();
  const flowRef = useRef<FlowControls<TPhase>>(flow);
  const lastNavigationAtRef = useRef<number | null>(null);

  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    const axis = options.axis ?? DEFAULT_AXIS;
    const cooldown = options.cooldown ?? DEFAULT_COOLDOWN;
    const ignore = options.ignore ?? [];
    const preventDefault = options.preventDefault ?? true;
    const eventTarget = resolveInputTarget(options.target);

    validateCooldown(cooldown);

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

      const now = Date.now();

      if (lastNavigationAtRef.current !== null && now - lastNavigationAtRef.current < cooldown) {
        return;
      }

      lastNavigationAtRef.current = now;

      if (delta > threshold) {
        currentFlow.next();
        return;
      }

      currentFlow.prev();
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
