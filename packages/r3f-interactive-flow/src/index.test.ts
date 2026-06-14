import { describe, expect, it } from "vitest";

import * as publicApi from ".";
import type {
  FlowFrameCallback,
  FlowFrameState,
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
});
