import { describe, expect, it } from "vitest";

import { clamp01, linear } from "./easing";

describe("clamp01", () => {
  it("keeps values inside the 0..1 range", () => {
    expect(clamp01(0.25)).toBe(0.25);
  });

  it("clamps values below 0", () => {
    expect(clamp01(-1)).toBe(0);
  });

  it("clamps values above 1", () => {
    expect(clamp01(2)).toBe(1);
  });
});

describe("linear", () => {
  it("returns clamped linear progress", () => {
    expect(linear(0.5)).toBe(0.5);
    expect(linear(-0.5)).toBe(0);
    expect(linear(1.5)).toBe(1);
  });
});
