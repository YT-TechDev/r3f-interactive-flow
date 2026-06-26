import { describe, expect, it, vi } from "vitest";

import * as publicApi from ".";
import type {
  FlowFrameCallback,
  FlowFrameState,
  FlowInputTarget,
  FlowTransitionBaseOptions,
  FlowTransitionOptions,
  UseKeyboardInputOptions,
  UseTouchInputOptions,
  UseWheelInputOptions
} from ".";

const expectedRuntimeExports = [
  "FlowProvider",
  "useFlow",
  "useFlowFrame",
  "useFlowProgress",
  "useKeyboardInput",
  "useTouchInput",
  "useWheelInput"
];

describe("public API", () => {
  it("exposes the expected runtime exports", () => {
    expect(Object.keys(publicApi).sort()).toEqual(expectedRuntimeExports);

    for (const exportName of expectedRuntimeExports) {
      expect(publicApi[exportName as keyof typeof publicApi]).toBeTypeOf("function");
    }
  });

  it("does not require browser APIs at module import time", async () => {
    const originalWindow = globalThis.window;

    vi.resetModules();

    try {
      delete (globalThis as Partial<typeof globalThis>).window;

      await expect(import(".")).resolves.toHaveProperty("useWheelInput");
    } finally {
      Object.assign(globalThis, { window: originalWindow });
    }
  });

  it("exposes flow frame types", () => {
    const state: FlowFrameState<"intro"> = {
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false
    };
    const callback: FlowFrameCallback<"intro"> = (frameState, delta) => {
      expect(frameState).toBe(state);
      expect(delta).toBe(0.1);
    };

    callback(state, 0.1);
  });

  it("exposes the public input target type", () => {
    const element = {} as HTMLElement;
    const elementTarget: FlowInputTarget = element;
    const windowTarget: FlowInputTarget = {} as Window;
    const refTarget: FlowInputTarget = { current: element };
    const nullableRefTarget: FlowInputTarget = { current: null };

    expect(elementTarget).toBe(element);
    expect(windowTarget).toBeTypeOf("object");
    expect(refTarget.current).toBe(element);
    expect(nullableRefTarget.current).toBeNull();
  });

  it("exposes documented input hook option types", () => {
    const inputTarget: FlowInputTarget = { current: {} as HTMLElement };

    const ignoredSelectors = ["[data-flow-ignore]", "input"] as const;
    const wheelOptions: UseWheelInputOptions = {
      target: inputTarget,
      threshold: 40,
      axis: "y",
      cooldown: 250,
      enabled: true,
      preventDefault: true,
      ignore: ignoredSelectors
    };

    const touchOptions: UseTouchInputOptions = {
      target: inputTarget,
      threshold: 50,
      axis: "x",
      cooldown: 300,
      enabled: true,
      preventDefault: true,
      ignore: ignoredSelectors
    };

    const groupedKeyboardOptions: UseKeyboardInputOptions = {
      target: inputTarget,
      keys: {
        next: ["ArrowDown", "PageDown"],
        prev: ["ArrowUp", "PageUp"]
      },
      cooldown: 400,
      ignoreWhenTyping: true,
      enabled: true,
      preventDefault: true
    };

    const compatibilityKeyboardOptions: UseKeyboardInputOptions = {
      target: inputTarget,
      nextKeys: ["ArrowRight"],
      prevKeys: ["ArrowLeft"],
      cooldown: 500,
      ignoreWhenTyping: false,
      enabled: true,
      preventDefault: true
    };

    expect(wheelOptions.axis).toBe("y");
    expect(wheelOptions.cooldown).toBe(250);
    expect(wheelOptions.ignore).toBe(ignoredSelectors);
    expect(touchOptions.axis).toBe("x");
    expect(touchOptions.cooldown).toBe(300);
    expect(touchOptions.ignore).toBe(ignoredSelectors);
    expect(groupedKeyboardOptions.keys?.next).toEqual(["ArrowDown", "PageDown"]);
    expect(groupedKeyboardOptions.keys?.prev).toEqual(["ArrowUp", "PageUp"]);
    expect(compatibilityKeyboardOptions.nextKeys).toEqual(["ArrowRight"]);
    expect(compatibilityKeyboardOptions.prevKeys).toEqual(["ArrowLeft"]);
  });

  it("exposes transition option types", () => {
    const baseOptions: FlowTransitionBaseOptions = {
      duration: 1000,
      cooldown: 500,
      easing: (progress) => progress
    };
    const options: FlowTransitionOptions<"intro" | "work"> = {
      ...baseOptions,
      byPhase: {
        intro: { duration: 1600 }
      }
    };

    expect(options.byPhase?.intro?.duration).toBe(1600);
  });
});
