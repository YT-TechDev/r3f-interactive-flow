import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine transition re-entry baseline", () => {
  it("keeps next requests during an active transition from changing the snapshot or transition timing", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 400,
      cooldownMs: 300
    });

    machine.next();
    machine.update(100);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.next();
    machine.next();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(300);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps prev requests during an active transition from changing the snapshot or reversing direction", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "contact",
      transitionDurationMs: 500
    });

    machine.prev();
    machine.update(200);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.prev();
    machine.next();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.4,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps goTo requests during an active transition from changing the target phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact", "summary"] as const,
      transitionDurationMs: 800
    });

    machine.next();
    machine.update(200);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.goTo("contact");
    machine.goTo("summary");
    machine.goTo("intro");

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps current-phase targets during an active transition as ignored snapshot-stable requests", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 600,
      cooldownMs: 200
    });

    machine.goTo("contact");
    machine.update(150);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps out-of-bounds requests during an active transition as ignored snapshot-stable requests", () => {
    const firstPhaseMachine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 250
    });
    const lastPhaseMachine = createFlowMachine({
      phases: ["intro", "work"] as const,
      initialPhase: "work",
      transitionDurationMs: 250
    });

    firstPhaseMachine.next();
    lastPhaseMachine.prev();
    firstPhaseMachine.update(125);
    lastPhaseMachine.update(125);

    const firstPhaseSnapshot = firstPhaseMachine.getSnapshot();
    const lastPhaseSnapshot = lastPhaseMachine.getSnapshot();

    firstPhaseMachine.next();
    lastPhaseMachine.prev();

    expect(firstPhaseMachine.getSnapshot()).toEqual(firstPhaseSnapshot);
    expect(lastPhaseMachine.getSnapshot()).toEqual(lastPhaseSnapshot);
    expect(firstPhaseMachine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.5,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
    expect(lastPhaseMachine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0.5,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
  });
});
