"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { FlowControls } from "../core/types";
import { useFlow } from "../react/useFlow";

const DEFAULT_THRESHOLD = 50;

export type UseTouchInputOptions = {
  target?: RefObject<HTMLElement | null>;
  threshold?: number;
  enabled?: boolean;
  preventDefault?: boolean;
};

export function useTouchInput<TPhase extends string>(options: UseTouchInputOptions = {}): void {
  const flow = useFlow<TPhase>();
  const flowRef = useRef<FlowControls<TPhase>>(flow);
  const startYRef = useRef<number | null>(null);

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
    const preventDefault = options.preventDefault ?? true;
    const eventTarget = options.target?.current ?? window;

    const resetTouch = (): void => {
      startYRef.current = null;
    };

    const handleTouchStart: EventListener = (event): void => {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.touches[0];

      if (touch === undefined) {
        return;
      }

      startYRef.current = touch.clientY;
    };

    const handleTouchMove: EventListener = (event): void => {
      if (preventDefault) {
        event.preventDefault();
      }
    };

    const handleTouchEnd: EventListener = (event): void => {
      const startY = startYRef.current;

      if (startY === null) {
        return;
      }

      resetTouch();

      const touchEvent = event as TouchEvent;
      const touch = touchEvent.changedTouches[0];

      if (touch === undefined) {
        return;
      }

      const currentFlow = flowRef.current;

      if (currentFlow.isLocked || currentFlow.isTransitioning) {
        return;
      }

      const deltaY = startY - touch.clientY;

      if (deltaY > threshold) {
        currentFlow.next();
        return;
      }

      if (deltaY < -threshold) {
        currentFlow.prev();
      }
    };

    eventTarget.addEventListener("touchstart", handleTouchStart, { passive: true });
    eventTarget.addEventListener("touchmove", handleTouchMove, { passive: false });
    eventTarget.addEventListener("touchend", handleTouchEnd, { passive: true });
    eventTarget.addEventListener("touchcancel", resetTouch, { passive: true });

    return () => {
      eventTarget.removeEventListener("touchstart", handleTouchStart);
      eventTarget.removeEventListener("touchmove", handleTouchMove);
      eventTarget.removeEventListener("touchend", handleTouchEnd);
      eventTarget.removeEventListener("touchcancel", resetTouch);
    };
  }, [options.enabled, options.preventDefault, options.target, options.threshold]);
}
