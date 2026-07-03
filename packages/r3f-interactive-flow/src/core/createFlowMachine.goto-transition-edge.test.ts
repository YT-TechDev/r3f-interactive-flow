import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine goTo transition edge cases", () => {
  it("keeps current-phase goTo as a full-snapshot no-op without opening a cooldown gate", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      transitionDurationMs: 300,
      cooldownMs: 500
    });
    const idleSnapshot = machine.getSnapshot();

    machine.goTo("work");
    machine.update(250);

    expect(machine.getSnapshot()).toEqual(idleSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("resolves a first-to-final goTo jump to the requested final phase", () => {
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

    machine.update(400);

    expect(machine.getSnapshot()).toEqual({
      phase: "summary",
      phaseIndex: 3,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("resolves a final-to-first goTo jump to the requested first phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact", "summary"] as const,
      initialPhase: "summary",
      transitionDurationMs: 400
    });

    machine.goTo("intro");

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(400);

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps active-transition goTo requests from changing target, direction, progress, or lock state", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact", "summary"] as const,
      transitionDurationMs: 800,
      cooldownMs: 300
    });

    machine.goTo("summary");
    machine.update(200);
    machine.lock();

    const lockedActiveSnapshot = machine.getSnapshot();

    machine.goTo("intro");
    machine.goTo("contact");
    machine.goTo("summary");

    expect(machine.getSnapshot()).toEqual(lockedActiveSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "summary",
      phaseIndex: 3,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: true
    });

    machine.unlock();
    machine.update(600);

    expect(machine.getSnapshot()).toEqual({
      phase: "summary",
      phaseIndex: 3,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps cooldown-blocked goTo requests from changing the completed transition snapshot", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact", "summary"] as const,
      transitionDurationMs: 200,
      cooldownMs: 500
    });

    machine.goTo("summary");
    machine.update(200);

    const completedSnapshot = machine.getSnapshot();

    machine.goTo("intro");
    machine.goTo("contact");
    machine.update(299);
    machine.goTo("intro");

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "summary",
      phaseIndex: 3,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(1);
    machine.goTo("intro");

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
  });
});
