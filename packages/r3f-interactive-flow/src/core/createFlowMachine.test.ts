import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine", () => {
  it("creates an initial snapshot from the first phase by default", () => {
    const machine = createFlowMachine({ phases: ["intro", "work"] as const });

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("uses initialPhase when it is included in phases", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work"
    });

    expect(machine.phase).toBe("work");
    expect(machine.phaseIndex).toBe(1);
  });

  it("throws when phases is empty", () => {
    expect(() => createFlowMachine({ phases: [] })).toThrow(/at least one phase/);
  });

  it("throws when phases has duplicate values", () => {
    expect(() => createFlowMachine({ phases: ["intro", "intro"] as const })).toThrow(
      /duplicate phase/
    );
  });

  it("throws when initialPhase is not included in phases", () => {
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        initialPhase: "missing"
      })
    ).toThrow(/initialPhase/);
  });

  it("moves to the next phase and completes the transition with update", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
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

    machine.update(500);

    expect(machine.progress).toBe(0.5);
    expect(machine.direction).toBe("next");
    expect(machine.isTransitioning).toBe(true);

    machine.update(500);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("does not reduce progress when update receives a negative delta", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000
    });

    machine.next();
    machine.update(500);
    machine.update(-250);

    expect(machine.progress).toBe(0.5);
    expect(machine.direction).toBe("next");
    expect(machine.isTransitioning).toBe(true);
  });

  it(
    "clamps progress and completes when update receives a delta larger than the duration",
    () => {
      const machine = createFlowMachine({
        phases: ["intro", "work"] as const,
        transitionDurationMs: 1000
      });

      machine.next();
      machine.update(1500);

      expect(machine.getSnapshot()).toEqual({
        phase: "work",
        phaseIndex: 1,
        progress: 1,
        direction: "none",
        isTransitioning: false,
        isLocked: false
      });
    }
  );

  it("moves to the previous phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      initialPhase: "work"
    });

    machine.prev();

    expect(machine.phase).toBe("intro");
    expect(machine.phaseIndex).toBe(0);
    expect(machine.direction).toBe("prev");
    expect(machine.isTransitioning).toBe(true);
  });

  it("moves to a specific phase with goTo", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const
    });

    machine.goTo("contact");

    expect(machine.phase).toBe("contact");
    expect(machine.phaseIndex).toBe(2);
    expect(machine.direction).toBe("next");
  });

  it("does nothing when goTo receives the current phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work"
    });

    machine.goTo("work");

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("throws when goTo receives an unknown phase", () => {
    const machine = createFlowMachine<"intro" | "work" | "missing">({
      phases: ["intro", "work"]
    });

    expect(() => machine.goTo("missing")).toThrow(/Unknown phase/);
  });

  it("does nothing when moving beyond the phase bounds", () => {
    const machine = createFlowMachine({ phases: ["intro", "work"] as const });

    machine.prev();

    expect(machine.phase).toBe("intro");
    expect(machine.isTransitioning).toBe(false);

    machine.goTo("work");
    machine.update(1000);
    machine.next();

    expect(machine.phase).toBe("work");
    expect(machine.isTransitioning).toBe(false);
  });

  it("preserves idle state when prev or next are called at boundaries", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000
    });

    machine.prev();

    expect(machine.direction).toBe("none");
    expect(machine.isTransitioning).toBe(false);

    machine.next();
    machine.update(1000);
    machine.next();

    expect(machine.phase).toBe("work");
    expect(machine.direction).toBe("none");
    expect(machine.isTransitioning).toBe(false);
  });

  it("updates isLocked in snapshots when lock and unlock are called", () => {
    const machine = createFlowMachine({ phases: ["intro", "work"] as const });

    machine.lock();

    expect(machine.getSnapshot()).toMatchObject({
      isLocked: true,
      isTransitioning: false
    });

    machine.unlock();

    expect(machine.getSnapshot()).toMatchObject({
      isLocked: false,
      isTransitioning: false
    });
  });

  it("ignores navigation while locked", () => {
    const machine = createFlowMachine({ phases: ["intro", "work"] as const });

    machine.lock();
    machine.next();

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });

    machine.unlock();
    machine.next();

    expect(machine.phase).toBe("work");
    expect(machine.isTransitioning).toBe(true);
  });

  it("continues updating an active transition after lock is called", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000
    });

    machine.next();
    machine.lock();
    machine.update(500);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      progress: 0.5,
      direction: "next",
      isTransitioning: true,
      isLocked: true
    });
  });

  it("keeps navigation blocked while locked after a completed transition", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000
    });

    machine.next();
    machine.lock();
    machine.update(1000);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });
  });

  it("allows navigation again after unlocking a completed transition", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000
    });

    machine.next();
    machine.lock();
    machine.update(1000);
    machine.unlock();
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("ignores new navigation while transitioning", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const
    });

    machine.next();
    machine.next();

    expect(machine.phase).toBe("work");
    expect(machine.phaseIndex).toBe(1);
  });

  it("applies a custom easing function", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000,
      easing: (progress) => progress * progress
    });

    machine.next();
    machine.update(500);

    expect(machine.progress).toBe(0.25);
  });

  it("throws when transitionDurationMs is not positive", () => {
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transitionDurationMs: 0
      })
    ).toThrow(/transitionDurationMs/);
  });

  it("throws when deltaMs is not finite", () => {
    const machine = createFlowMachine({ phases: ["intro", "work"] as const });

    machine.next();

    expect(() => machine.update(Number.NaN)).toThrow(/deltaMs/);
  });
});
