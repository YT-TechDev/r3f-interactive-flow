import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine transition boundary behavior", () => {
  it("keeps the completed final-phase transition snapshot stable when next is repeated", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 400
    });

    machine.goTo("contact");
    machine.update(400);

    const finalPhaseSnapshot = machine.getSnapshot();

    expect(finalPhaseSnapshot).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.next();
    machine.next();
    machine.update(200);

    expect(machine.getSnapshot()).toEqual(finalPhaseSnapshot);
  });

  it("keeps an idle final-phase snapshot stable when next is repeated", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "contact",
      transitionDurationMs: 400
    });
    const finalPhaseSnapshot = machine.getSnapshot();

    machine.next();
    machine.next();
    machine.update(200);

    expect(machine.getSnapshot()).toEqual(finalPhaseSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps the completed first-phase transition snapshot stable when prev is repeated", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "contact",
      transitionDurationMs: 400
    });

    machine.goTo("intro");
    machine.update(400);

    const firstPhaseSnapshot = machine.getSnapshot();

    expect(firstPhaseSnapshot).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.prev();
    machine.prev();
    machine.update(200);

    expect(machine.getSnapshot()).toEqual(firstPhaseSnapshot);
  });

  it("keeps an idle first-phase snapshot stable when prev is repeated", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 400
    });
    const firstPhaseSnapshot = machine.getSnapshot();

    machine.prev();
    machine.prev();
    machine.update(200);

    expect(machine.getSnapshot()).toEqual(firstPhaseSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });
});
