"use client";

import type { RefObject } from "react";

export type FlowInputTarget = RefObject<HTMLElement | null> | HTMLElement | Window;

export function isRefObjectTarget(
  target: FlowInputTarget
): target is RefObject<HTMLElement | null> {
  return typeof target === "object" && target !== null && "current" in target;
}

export function resolveInputTarget(target: FlowInputTarget | undefined): HTMLElement | Window {
  if (target === undefined) {
    return window;
  }

  if (isRefObjectTarget(target)) {
    return target.current ?? window;
  }

  return target;
}

export function shouldIgnoreInputEvent(event: Event, ignore: readonly string[]): boolean {
  const target = event.target;

  if (ignore.length === 0 || typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }

  return ignore.some((selector) => target.closest(selector) !== null);
}
