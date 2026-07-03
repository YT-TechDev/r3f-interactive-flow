import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine transition lifecycle baseline", () => {
  it("starts from a settled initial snapshot", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000
    });

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("moves through the next transition lifecycle", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000
    });

    machine.next();

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(250);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(750);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(100);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("moves through the prev transition lifecycle", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      transitionDurationMs: 800
    });

    machine.prev();

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(200);

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0.25,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(600);

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("moves through the goTo transition lifecycle", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact", "summary"] as const,
      transitionDurationMs: 400
    });

    machine.goTo("summary");

    expect(machine.getSnapshot()).toEqual({
      phase: "summary",
      phaseIndex: 3,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(100);

    expect(machine.getSnapshot()).toEqual({
      phase: "summary",
      phaseIndex: 3,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(300);

    expect(machine.getSnapshot()).toEqual({
      phase: "summary",
      phaseIndex: 3,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });
});
