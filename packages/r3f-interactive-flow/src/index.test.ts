import { describe, expect, it, vi } from "vitest";

import * as publicApi from ".";
import type {
  FlowFrameCallback,
  FlowFrameState,
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

  it("exposes input hook option types", () => {
    const wheelOptions: UseWheelInputOptions = {
      threshold: 40,
      enabled: true,
      preventDefault: true
    };

    const touchOptions: UseTouchInputOptions = {
      threshold: 50,
      enabled: true,
      preventDefault: true
    };

    const keyboardOptions: UseKeyboardInputOptions = {
      nextKeys: ["ArrowDown"],
      prevKeys: ["ArrowUp"],
      enabled: true,
      preventDefault: true
    };

    expect(wheelOptions.threshold).toBe(40);
    expect(touchOptions.threshold).toBe(50);
    expect(keyboardOptions.nextKeys).toEqual(["ArrowDown"]);
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
