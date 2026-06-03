"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { FlowControls } from "../core/types";
import { useFlow } from "../react/useFlow";

const DEFAULT_NEXT_KEYS = ["ArrowDown", "ArrowRight", "PageDown", " "] as const;
const DEFAULT_PREV_KEYS = ["ArrowUp", "ArrowLeft", "PageUp"] as const;

export type UseKeyboardInputOptions = {
  target?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  preventDefault?: boolean;
  nextKeys?: readonly string[];
  prevKeys?: readonly string[];
};

function shouldIgnoreKeyboardEventTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function useKeyboardInput<TPhase extends string>(
  options: UseKeyboardInputOptions = {}
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

    const preventDefault = options.preventDefault ?? true;
    const nextKeys = options.nextKeys ?? DEFAULT_NEXT_KEYS;
    const prevKeys = options.prevKeys ?? DEFAULT_PREV_KEYS;
    const eventTarget = options.target?.current ?? window;

    const handleKeyDown: EventListener = (event): void => {
      const keyboardEvent = event as KeyboardEvent;

      if (keyboardEvent.repeat) {
        return;
      }

      if (shouldIgnoreKeyboardEventTarget(keyboardEvent.target)) {
        return;
      }

      const isNextKey = nextKeys.includes(keyboardEvent.key);
      const isPrevKey = prevKeys.includes(keyboardEvent.key);

      if (!isNextKey && !isPrevKey) {
        return;
      }

      if (preventDefault) {
        keyboardEvent.preventDefault();
      }

      const currentFlow = flowRef.current;

      if (currentFlow.isLocked || currentFlow.isTransitioning) {
        return;
      }

      if (isNextKey) {
        currentFlow.next();
        return;
      }

      if (isPrevKey) {
        currentFlow.prev();
      }
    };

    eventTarget.addEventListener("keydown", handleKeyDown);

    return () => {
      eventTarget.removeEventListener("keydown", handleKeyDown);
    };
  }, [options.enabled, options.nextKeys, options.preventDefault, options.prevKeys, options.target]);
}
