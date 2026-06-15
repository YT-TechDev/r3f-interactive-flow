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

  it("clamps progress and completes when update receives a delta larger than the duration", () => {
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
  });

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

  it("does not mutate an idle snapshot when goTo receives an unknown phase", () => {
    const machine = createFlowMachine<"intro" | "work" | "missing">({
      phases: ["intro", "work"]
    });
    const snapshot = machine.getSnapshot();

    expect(() => machine.goTo("missing")).toThrow(/Unknown phase/);
    expect(machine.getSnapshot()).toEqual(snapshot);
  });

  it("does not mutate an active transition snapshot when goTo receives an unknown phase", () => {
    const machine = createFlowMachine<"intro" | "work" | "missing">({
      phases: ["intro", "work"],
      transitionDurationMs: 1000
    });

    machine.next();
    machine.update(250);

    const snapshot = machine.getSnapshot();

    expect(() => machine.goTo("missing")).toThrow(/Unknown phase/);
    expect(machine.getSnapshot()).toEqual(snapshot);
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

  it("preserves the full snapshot when prev or next are called at boundaries", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000
    });
    const firstPhaseSnapshot = machine.getSnapshot();

    machine.prev();

    expect(machine.getSnapshot()).toEqual(firstPhaseSnapshot);

    machine.next();
    machine.update(1000);

    const lastPhaseSnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(lastPhaseSnapshot);
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

  it("ignores valid goTo navigation while locked", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const
    });

    machine.lock();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });
  });

  it("continues to throw for invalid goTo targets while locked without mutating state", () => {
    const machine = createFlowMachine<"intro" | "work" | "missing">({
      phases: ["intro", "work"]
    });

    machine.lock();

    const lockedSnapshot = machine.getSnapshot();

    expect(() => machine.goTo("missing")).toThrow(/Unknown phase/);
    expect(machine.getSnapshot()).toEqual(lockedSnapshot);
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

  it("ignores all navigation methods while transitioning", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000
    });

    machine.next();

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.next();
    machine.prev();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("does not restart or extend an active transition when navigation is ignored", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000,
      cooldownMs: 1500
    });

    machine.next();
    machine.update(750);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.prev();
    machine.goTo("contact");
    machine.next();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);

    machine.update(250);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("keeps default navigation behavior unchanged when cooldownMs is omitted", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500
    });

    machine.next();
    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("does not block the next valid navigation after transition completion when cooldownMs is zero", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 0
    });

    machine.next();
    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("blocks valid navigation after transition completion while a positive cooldown is active", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);

    const completedSnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
  });

  it("allows navigation after both transition and cooldown gates are open", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);
    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("starts cooldown on accepted navigation instead of transition completion", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000,
      cooldownMs: 500
    });

    machine.next();
    machine.update(500);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);

    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("does not start cooldown for same-phase goTo navigation", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      cooldownMs: 1000
    });

    machine.goTo("work");
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("preserves the full snapshot when same-phase goTo is rejected", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      cooldownMs: 1000
    });
    const snapshot = machine.getSnapshot();

    machine.goTo("work");

    expect(machine.getSnapshot()).toEqual(snapshot);

    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      direction: "next",
      isTransitioning: true
    });
  });

  it("keeps same-phase goTo a no-op after transition completion without restarting cooldown", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);

    const completedSnapshot = machine.getSnapshot();

    machine.goTo("work");

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("does not start cooldown for first-phase prev or last-phase next navigation", () => {
    const firstPhaseMachine = createFlowMachine({
      phases: ["intro", "work"] as const,
      cooldownMs: 1000
    });
    const lastPhaseMachine = createFlowMachine({
      phases: ["intro", "work"] as const,
      initialPhase: "work",
      cooldownMs: 1000
    });

    firstPhaseMachine.prev();
    firstPhaseMachine.next();

    lastPhaseMachine.next();
    lastPhaseMachine.prev();

    expect(firstPhaseMachine.getSnapshot()).toMatchObject({
      phase: "work",
      direction: "next",
      isTransitioning: true
    });
    expect(lastPhaseMachine.getSnapshot()).toMatchObject({
      phase: "intro",
      direction: "prev",
      isTransitioning: true
    });
  });

  it("keeps boundary navigation a no-op without mutating snapshots or starting cooldown", () => {
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

    firstPhaseMachine.next();
    lastPhaseMachine.prev();

    expect(firstPhaseMachine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
    expect(lastPhaseMachine.getSnapshot()).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "prev",
      isTransitioning: true
    });
  });

  it("does not start cooldown when valid navigation is ignored while locked", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      cooldownMs: 1000
    });

    machine.lock();
    machine.next();
    machine.unlock();
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

  it("does not reset cooldown when valid navigation is ignored while locked", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.lock();
    machine.update(500);
    machine.prev();
    machine.unlock();
    machine.update(500);
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

  it("preserves the full snapshot when valid navigation is rejected while locked", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      cooldownMs: 1000
    });

    machine.lock();

    const lockedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(lockedSnapshot);

    machine.unlock();
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("ignores valid prev during cooldown without mutating snapshot or extending cooldown", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);

    const completedSnapshot = machine.getSnapshot();

    machine.prev();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("ignores valid goTo during cooldown without mutating snapshot or extending cooldown", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);

    const completedSnapshot = machine.getSnapshot();

    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(500);
    machine.goTo("contact");

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("does not reset cooldown when valid navigation is ignored while transitioning", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000,
      cooldownMs: 1500
    });

    machine.next();
    machine.update(500);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);

    machine.update(500);
    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("keeps active transition snapshots stable when navigation is ignored while transitioning", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(250);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.prev();
    machine.goTo("contact");
    machine.next();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);

    machine.update(250);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false
    });

    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("continues to throw for invalid goTo targets without mutating state during cooldown", () => {
    const machine = createFlowMachine<"intro" | "work" | "contact" | "missing">({
      phases: ["intro", "work", "contact"],
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);

    const completedSnapshot = machine.getSnapshot();

    expect(() => machine.goTo("missing")).toThrow(/Unknown phase/);
    expect(machine.getSnapshot()).toEqual(completedSnapshot);
  });

  it("does not reduce cooldown time when update receives a negative delta", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);
    machine.update(-500);

    const completedSnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(500);
    machine.next();

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });
  });

  it("throws when cooldownMs is invalid", () => {
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        cooldownMs: Number.NaN
      })
    ).toThrow(/cooldownMs/);

    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        cooldownMs: Number.POSITIVE_INFINITY
      })
    ).toThrow(/cooldownMs/);

    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        cooldownMs: -1
      })
    ).toThrow(/cooldownMs/);
  });

  it("keeps completed transitions stable after extra updates", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000
    });

    machine.next();
    machine.update(1000);

    const completedSnapshot = machine.getSnapshot();

    machine.update(100);

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
  });

  it("keeps completed transitions stable after extra updates while cooldown elapses", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 500,
      cooldownMs: 1000
    });

    machine.next();
    machine.update(500);

    const completedSnapshot = machine.getSnapshot();

    machine.update(250);
    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(250);
    expect(machine.getSnapshot()).toEqual(completedSnapshot);
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

  it("uses legacy transitionDurationMs, cooldownMs, and easing options", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 200,
      cooldownMs: 400,
      easing: (progress) => progress * progress
    });

    machine.next();
    machine.update(100);

    expect(machine.progress).toBe(0.25);

    machine.update(100);
    machine.next();
    expect(machine.phase).toBe("work");

    machine.update(200);
    machine.next();
    expect(machine.phase).toBe("contact");
  });

  it("lets global transition options override overlapping legacy options per field", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 1000,
      cooldownMs: 1000,
      easing: () => 0,
      transition: {
        duration: 200,
        cooldown: 500,
        easing: (progress) => progress
      }
    });

    machine.next();
    machine.update(100);
    expect(machine.progress).toBe(0.5);

    machine.update(100);
    machine.update(200);
    machine.next();
    expect(machine.phase).toBe("work");

    machine.update(100);
    machine.next();
    expect(machine.phase).toBe("contact");
  });

  it("resolves transition.byPhase options from the source phase for next, prev, and goTo", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: {
        duration: 1000,
        cooldown: 0,
        easing: () => 0,
        byPhase: {
          intro: { duration: 200, easing: (progress) => progress },
          work: { cooldown: 300, easing: (progress) => progress * progress },
          contact: { duration: 400, cooldown: 0, easing: (progress) => progress }
        }
      }
    });

    machine.next();
    machine.update(100);
    expect(machine.progress).toBe(0.5);

    machine.update(100);
    machine.goTo("contact");
    machine.update(500);
    expect(machine.progress).toBe(0.25);

    machine.update(500);
    machine.update(300);
    machine.prev();
    machine.update(200);
    expect(machine.progress).toBe(0.5);
  });

  it("falls back from missing phase transition fields to global, legacy, and defaults per field", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 400,
      cooldownMs: 200,
      easing: (progress) => progress * progress,
      transition: {
        cooldown: 0,
        byPhase: {
          intro: { duration: 200 }
        }
      }
    });

    machine.next();
    machine.update(100);
    expect(machine.progress).toBe(0.25);

    machine.update(100);
    machine.next();
    machine.update(200);
    expect(machine.progress).toBe(0.25);
  });

  it("uses defaults when transition and legacy timing fields are omitted", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transition: {}
    });

    machine.next();
    machine.update(500);

    expect(machine.progress).toBe(0.5);
  });

  it("throws clear errors for invalid global transition values", () => {
    expect(() =>
      createFlowMachine({ phases: ["intro", "work"] as const, transition: { duration: 0 } })
    ).toThrow("transition.duration must be a finite positive number.");
    expect(() =>
      createFlowMachine({ phases: ["intro", "work"] as const, transition: { cooldown: -1 } })
    ).toThrow("transition.cooldown must be a finite number greater than or equal to 0.");
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transition: { easing: "linear" as never }
      })
    ).toThrow("transition.easing must be a function.");
  });

  it("throws clear errors for invalid phase-specific transition values", () => {
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transition: { byPhase: { intro: { duration: Number.NaN } } }
      })
    ).toThrow("transition.byPhase.intro.duration must be a finite positive number.");
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transition: { byPhase: { intro: { cooldown: -1 } } }
      })
    ).toThrow(
      "transition.byPhase.intro.cooldown must be a finite number greater than or equal to 0."
    );
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transition: { byPhase: { intro: { easing: "linear" as never } } }
      })
    ).toThrow("transition.byPhase.intro.easing must be a function.");
  });

  it("clamps custom easing output above one during a transition", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000,
      easing: () => 2
    });

    machine.next();
    machine.update(500);

    expect(machine.getSnapshot()).toMatchObject({
      progress: 1,
      direction: "next",
      isTransitioning: true
    });

    machine.update(500);

    expect(machine.getSnapshot()).toMatchObject({
      progress: 1,
      direction: "none",
      isTransitioning: false
    });
  });

  it("clamps custom easing output below zero during a transition", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000,
      easing: () => -1
    });

    machine.next();
    machine.update(500);

    expect(machine.getSnapshot()).toMatchObject({
      progress: 0,
      direction: "next",
      isTransitioning: true
    });

    machine.update(500);

    expect(machine.getSnapshot()).toMatchObject({
      progress: 1,
      direction: "none",
      isTransitioning: false
    });
  });

  it("throws when transitionDurationMs is not positive", () => {
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transitionDurationMs: 0
      })
    ).toThrow(/transitionDurationMs/);
  });

  it("throws when transitionDurationMs is not finite", () => {
    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transitionDurationMs: Number.NaN
      })
    ).toThrow(/transitionDurationMs/);

    expect(() =>
      createFlowMachine({
        phases: ["intro", "work"] as const,
        transitionDurationMs: Number.POSITIVE_INFINITY
      })
    ).toThrow(/transitionDurationMs/);
  });

  it("throws when deltaMs is not finite", () => {
    const machine = createFlowMachine({ phases: ["intro", "work"] as const });

    machine.next();

    expect(() => machine.update(Number.NaN)).toThrow(/deltaMs/);
  });
});
