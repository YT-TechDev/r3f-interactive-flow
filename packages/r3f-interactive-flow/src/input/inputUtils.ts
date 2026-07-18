"use client";

import type { RefObject } from "react";

export type FlowInputTarget = RefObject<HTMLElement | null> | HTMLElement | Window;

export function isRefObjectTarget(
  target: FlowInputTarget
): target is RefObject<HTMLElement | null> {
  return typeof target === "object" && target !== null && "current" in target;
}

export function resolveInputTarget(
  target: FlowInputTarget | undefined
): HTMLElement | Window | null {
  if (target === undefined) {
    return window;
  }

  if (isRefObjectTarget(target)) {
    return target.current;
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

function getParentElement(node: Node): Element | null {
  const parent = node.parentNode;

  if (parent !== null && typeof Element !== "undefined" && parent instanceof Element) {
    return parent;
  }

  return null;
}

function isEditableElementSelf(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();

  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  return (element as HTMLElement).isContentEditable === true;
}

function isActionableElementSelf(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();

  if (
    tagName === "button" ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  ) {
    return true;
  }

  if (tagName === "a") {
    return element.getAttribute("href") !== null;
  }

  return false;
}

/**
 * Walks the target and its ancestors to find a native editable field or
 * actionable control (button, link with href, form control, or a
 * contenteditable region), so browser-native behavior for those elements
 * is not suppressed by input hooks. Ancestor lookup lets nested elements
 * (e.g. an icon inside a button) inherit the protection.
 */
export function isEditableOrActionableTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }

  let current: Element | null = target;

  while (current !== null) {
    if (isEditableElementSelf(current) || isActionableElementSelf(current)) {
      return true;
    }

    current = getParentElement(current);
  }

  return false;
}
