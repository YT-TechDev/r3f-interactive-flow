"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { FlowControls } from "../core/types";
import { useFlow } from "../react/useFlow";

const DEFAULT_THRESHOLD = 40;

export type UseWheelInputOptions = {
  target?: RefObject<HTMLElement | null>;
  threshold?: number;
  enabled?: boolean;
  preventDefault?: boolean;
};

export function useWheelInput<TPhase extends string>(
  options: UseWheelInputOptions = {}
): void {
  const flow = useFlow<TPhase>();
  const flowRef = useRef<FlowControls<TPhase>>(flow);

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

    const handleWheel = (event: WheelEvent): void => {
      if (preventDefault) {
        event.preventDefault();
      }

      const currentFlow = flowRef.current;

      if (currentFlow.isLocked || currentFlow.isTransitioning) {
        return;
      }

      if (event.deltaY > threshold) {
        currentFlow.next();
        return;
      }

      if (event.deltaY < -threshold) {
        currentFlow.prev();
      }
    };

    eventTarget.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      eventTarget.removeEventListener("wheel", handleWheel);
    };
  }, [options.enabled, options.preventDefault, options.target, options.threshold]);
}
