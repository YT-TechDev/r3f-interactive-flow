"use client";

import { useEffect, useRef } from "react";
import type { FlowControls } from "../core/types";
import { useFlow } from "../react/useFlow";
import { resolveInputTarget, shouldIgnoreInputEvent } from "./inputUtils";
import type { FlowInputTarget } from "./inputUtils";

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
  const flow = useFlow<TPhase>();
  const flowRef = useRef<FlowControls<TPhase>>(flow);
  const startPositionRef = useRef<number | null>(null);
  const gestureIgnoredRef = useRef(false);
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
    validateThreshold(threshold);

    const resetTouch = (): void => {
      startPositionRef.current = null;
      gestureIgnoredRef.current = false;
    };

    const handleTouchStart: EventListener = (event): void => {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.touches[0];

      gestureIgnoredRef.current = shouldIgnoreInputEvent(touchEvent, ignore);

      if (touch === undefined) {
        startPositionRef.current = null;
        return;
      }

      startPositionRef.current = getTouchClientPosition(touch, axis);
    };

    const handleTouchMove: EventListener = (event): void => {
      if (gestureIgnoredRef.current || shouldIgnoreInputEvent(event, ignore)) {
        return;
      }

      if (preventDefault) {
        event.preventDefault();
      }
    };

    const handleTouchEnd: EventListener = (event): void => {
      const startPosition = startPositionRef.current;
      const gestureIgnored = gestureIgnoredRef.current || shouldIgnoreInputEvent(event, ignore);

      if (startPosition === null) {
        return;
      }

      resetTouch();

      if (gestureIgnored) {
        return;
      }

      const touchEvent = event as TouchEvent;
      const touch = touchEvent.changedTouches[0];

      if (touch === undefined) {
        return;
      }

      const currentFlow = flowRef.current;

      if (currentFlow.isLocked || currentFlow.isTransitioning) {
        return;
      }

      const delta = startPosition - getTouchClientPosition(touch, axis);

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

    eventTarget.addEventListener("touchstart", handleTouchStart, {
      passive: true
    });
    eventTarget.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });
    eventTarget.addEventListener("touchend", handleTouchEnd, { passive: true });
    eventTarget.addEventListener("touchcancel", resetTouch, { passive: true });

    return () => {
      eventTarget.removeEventListener("touchstart", handleTouchStart);
      eventTarget.removeEventListener("touchmove", handleTouchMove);
      eventTarget.removeEventListener("touchend", handleTouchEnd);
      eventTarget.removeEventListener("touchcancel", resetTouch);
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
