"use client";

import { useContext, useEffect, useRef } from "react";
import type { FlowControls, FlowMachine } from "../core/types";
import { FlowContext } from "../react/FlowContext";
import { resolveInputTarget } from "./inputUtils";
import type { FlowInputTarget } from "./inputUtils";
import { navigateAndSyncIfAccepted } from "./navigationAcceptance";

const DEFAULT_NEXT_KEYS = ["ArrowDown", "ArrowRight", "PageDown", " "] as const;
const DEFAULT_PREV_KEYS = ["ArrowUp", "ArrowLeft", "PageUp"] as const;

type KeyboardKeyOptions = {
  next?: readonly string[];
  prev?: readonly string[];
};

export type UseKeyboardInputOptions = {
  target?: FlowInputTarget;
  enabled?: boolean;
  preventDefault?: boolean;
  keys?: KeyboardKeyOptions;
  cooldown?: number;
  ignoreWhenTyping?: boolean;
  /** @deprecated Use keys.next. */
  nextKeys?: readonly string[];
  /** @deprecated Use keys.prev. */
  prevKeys?: readonly string[];
};

function resolveKeyboardKeys(options: UseKeyboardInputOptions): {
  nextKeys: readonly string[];
  prevKeys: readonly string[];
} {
  return {
    nextKeys: options.keys?.next ?? options.nextKeys ?? DEFAULT_NEXT_KEYS,
    prevKeys: options.keys?.prev ?? options.prevKeys ?? DEFAULT_PREV_KEYS
  };
}

function validateCooldown(cooldown: number): void {
  if (!Number.isFinite(cooldown) || cooldown < 0) {
    throw new Error("useKeyboardInput cooldown must be a finite, non-negative number.");
  }
}

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
  const context = useContext(FlowContext);

  if (context === null) {
    throw new Error("useFlow must be used inside FlowProvider.");
  }

  const flow = context.controls as unknown as FlowControls<TPhase>;
  const machine = context.machine as unknown as FlowMachine<TPhase>;
  const syncSnapshot = context.syncSnapshot;
  const flowRef = useRef<FlowControls<TPhase>>(flow);
  const machineRef = useRef(machine);
  const syncSnapshotRef = useRef(syncSnapshot);
  const lastNavigationAtRef = useRef<number>(-Infinity);

  const cooldown = options.cooldown ?? 0;
  validateCooldown(cooldown);

  useEffect(() => {
    flowRef.current = flow;
    machineRef.current = machine;
    syncSnapshotRef.current = syncSnapshot;
  }, [flow, machine, syncSnapshot]);

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const preventDefault = options.preventDefault ?? true;
    const ignoreWhenTyping = options.ignoreWhenTyping ?? true;
    const { nextKeys, prevKeys } = resolveKeyboardKeys(options);
    const eventTarget = resolveInputTarget(options.target);

    const handleKeyDown: EventListener = (event): void => {
      const keyboardEvent = event as KeyboardEvent;

      if (keyboardEvent.repeat) {
        return;
      }

      if (ignoreWhenTyping && shouldIgnoreKeyboardEventTarget(keyboardEvent.target)) {
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

      if (!isNextKey && isPrevKey && currentFlow.phaseIndex === 0) {
        return;
      }

      const now = Date.now();

      if (now - lastNavigationAtRef.current < cooldown) {
        return;
      }

      const accepted = navigateAndSyncIfAccepted(
        machineRef.current,
        syncSnapshotRef.current,
        isNextKey ? "next" : "prev"
      );

      if (accepted) {
        lastNavigationAtRef.current = now;
      }
    };

    eventTarget.addEventListener("keydown", handleKeyDown);

    return () => {
      eventTarget.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    cooldown,
    options.enabled,
    options.ignoreWhenTyping,
    options.keys,
    options.nextKeys,
    options.preventDefault,
    options.prevKeys,
    options.target
  ]);
}
