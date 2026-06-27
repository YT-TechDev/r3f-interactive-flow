import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine transition regressions", () => {
  it("keeps the full snapshot stable when prev is rejected at the first phase boundary", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    const boundarySnapshot = machine.getSnapshot();

    machine.prev();

    expect(machine.getSnapshot()).toEqual(boundarySnapshot);

    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps the full snapshot stable when next is rejected at the last phase boundary", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    machine.goTo("contact");
    machine.update(100);
    machine.update(300);

    const boundarySnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(boundarySnapshot);

    machine.prev();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps the completed snapshot stable when goTo targets the current phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    machine.next();
    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    machine.goTo("work");

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(199);
    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(1);
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

  it("keeps first-phase prev and last-phase next as no-ops", () => {
    const firstPhaseMachine = createFlowMachine({
      phases: ["intro", "work"] as const,
      cooldownMs: 1000
    });
    const lastPhaseMachine = createFlowMachine({
      phases: ["intro", "work"] as const,
      initialPhase: "work",
      cooldownMs: 1000
    });

    const firstPhaseSnapshot = firstPhaseMachine.getSnapshot();
    const lastPhaseSnapshot = lastPhaseMachine.getSnapshot();

    firstPhaseMachine.prev();
    lastPhaseMachine.next();

    expect(firstPhaseMachine.getSnapshot()).toEqual(firstPhaseSnapshot);
    expect(lastPhaseMachine.getSnapshot()).toEqual(lastPhaseSnapshot);
  });

  it("accepts next, prev, and goTo only when the machine is idle and in bounds", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100
    });

    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });

    machine.update(100);
    machine.prev();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "prev",
      isTransitioning: true
    });

    machine.update(100);
    machine.goTo("contact");
    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("keeps same-phase goTo as a no-op that does not start cooldown", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      cooldownMs: 1000
    });

    const snapshot = machine.getSnapshot();

    machine.goTo("work");

    expect(machine.getSnapshot()).toEqual(snapshot);
    expect(snapshot).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("throws for invalid goTo targets without changing idle or transitioning snapshots", () => {
    const idleMachine = createFlowMachine<"intro" | "work" | "missing">({
      phases: ["intro", "work"]
    });
    const transitioningMachine = createFlowMachine<"intro" | "work" | "missing">({
      phases: ["intro", "work"],
      transitionDurationMs: 100
    });

    transitioningMachine.next();
    transitioningMachine.update(50);

    const idleSnapshot = idleMachine.getSnapshot();
    const transitioningSnapshot = transitioningMachine.getSnapshot();

    expect(() => idleMachine.goTo("missing")).toThrow(/Unknown phase/);
    expect(() => transitioningMachine.goTo("missing")).toThrow(/Unknown phase/);
    expect(idleMachine.getSnapshot()).toEqual(idleSnapshot);
    expect(transitioningMachine.getSnapshot()).toEqual(transitioningSnapshot);
  });

  it("rejects next, prev, and goTo while a transition is active", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 200
    });

    machine.next();
    machine.update(50);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.next();
    machine.prev();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);

    machine.update(50);
    machine.update(100);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("rejects navigation while manually locked and resumes after unlock", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const
    });

    machine.lock();
    const lockedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(lockedSnapshot);

    machine.unlock();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps manual lock independent from transition completion", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100
    });

    machine.next();
    machine.lock();
    machine.update(100);

    const lockedCompletedSnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(lockedCompletedSnapshot);

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

  it("uses transition state as the transition lock and clears it at completion", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100
    });

    machine.next();
    const transitioningSnapshot = machine.getSnapshot();

    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(transitioningSnapshot);

    machine.update(100);
    machine.goTo("contact");

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("prevents repeated navigation until cooldown has elapsed", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    machine.next();
    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    machine.next();
    machine.update(199);
    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(1);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("lets transition options take precedence over legacy timing props", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000,
      cooldownMs: 1000,
      easing: () => 0,
      transition: {
        duration: 200,
        cooldown: 300,
        easing: (progress) => progress
      }
    });

    machine.next();
    machine.update(100);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      progress: 0.5,
      isTransitioning: true
    });

    machine.update(100);
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      progress: 1,
      isTransitioning: false
    });

    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    machine.update(99);
    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    machine.update(1);
    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      isTransitioning: true
    });
  });

  it("uses transition byPhase options from the source phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      transition: {
        duration: 1000,
        byPhase: {
          intro: { duration: 100, easing: () => 0 },
          work: { duration: 200, easing: (progress) => progress * progress },
          contact: { duration: 800, easing: () => 1 }
        }
      }
    });

    machine.prev();
    machine.update(100);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "intro",
      progress: 0.25,
      direction: "prev",
      isTransitioning: true
    });
  });

  it("falls back per field when a phase transition override is partial", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000,
      cooldownMs: 1000,
      easing: () => 0,
      transition: {
        cooldown: 300,
        easing: (progress) => progress,
        byPhase: {
          intro: { duration: 200 }
        }
      }
    });

    machine.next();
    machine.update(100);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      progress: 0.5,
      isTransitioning: true
    });

    machine.update(100);
    machine.update(99);
    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    machine.update(1);
    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      isTransitioning: true
    });
  });

  it("starts transition cooldown only after accepted navigation", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: {
        duration: 100,
        cooldown: 300
      }
    });

    machine.prev();
    machine.goTo("intro");
    expect(machine.getSnapshot()).toMatchObject({
      phase: "intro",
      direction: "none",
      isTransitioning: false
    });

    machine.next();
    machine.update(100);
    machine.update(199);
    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      isTransitioning: false
    });

    machine.update(1);
    machine.next();
    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      direction: "next",
      isTransitioning: true
    });
  });
});
