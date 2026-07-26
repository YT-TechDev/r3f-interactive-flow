import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine transition regressions", () => {
  it("locks the exact accepted-navigation snapshot matrix for next, prev, and non-adjacent goTo", () => {
    const nextMachine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100
    });

    expect(nextMachine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    expect(nextMachine.next()).toBe(true);

    expect(nextMachine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    const prevMachine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "contact",
      transitionDurationMs: 100
    });

    expect(prevMachine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    expect(prevMachine.prev()).toBe(true);

    expect(prevMachine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });

    const goToMachine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100
    });

    expect(goToMachine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    // intro (index 0) -> goTo("contact") (index 2): a non-adjacent forward skip.
    expect(goToMachine.goTo("contact")).toBe(true);

    expect(goToMachine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("locks the exact active-transition and completion snapshot lifecycle for a representative transition", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
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

    expect(machine.next()).toBe(true);

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

    const completedSnapshot = machine.getSnapshot();

    expect(completedSnapshot).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(100);

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
  });

  it("keeps isSettling out of the public snapshot shape and type", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 50
    });

    machine.next();

    const snapshot = machine.getSnapshot();

    expect(Object.keys(snapshot).sort()).toEqual([
      "direction",
      "isLocked",
      "isTransitioning",
      "phase",
      "phaseIndex",
      "progress"
    ]);
    expect(snapshot).not.toHaveProperty("isSettling");

    // @ts-expect-error isSettling is an internal machine signal, not part of the public FlowSnapshot type.
    const isSettlingOnSnapshot = snapshot.isSettling;
    void isSettlingOnSnapshot;
  });

  it("keeps the full snapshot stable when prev is rejected at the first phase boundary", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    const boundarySnapshot = machine.getSnapshot();

    expect(machine.prev()).toBe(false);

    expect(machine.getSnapshot()).toEqual(boundarySnapshot);

    expect(machine.next()).toBe(true);

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

    expect(machine.next()).toBe(false);

    expect(machine.getSnapshot()).toEqual(boundarySnapshot);

    expect(machine.prev()).toBe(true);

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

    expect(machine.next()).toBe(true);
    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    // goTo targeting the current phase is rejected.
    expect(machine.goTo("work")).toBe(false);

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(299);
    expect(machine.next()).toBe(false);

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(1);
    expect(machine.next()).toBe(true);

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

    // prev at the first phase and next at the last phase are both rejected.
    expect(firstPhaseMachine.prev()).toBe(false);
    expect(lastPhaseMachine.next()).toBe(false);

    expect(firstPhaseMachine.getSnapshot()).toEqual(firstPhaseSnapshot);
    expect(lastPhaseMachine.getSnapshot()).toEqual(lastPhaseSnapshot);
  });

  it("accepts next, prev, and goTo only when the machine is idle and in bounds", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100
    });

    expect(machine.next()).toBe(true);
    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true
    });

    machine.update(100);
    expect(machine.prev()).toBe(true);
    expect(machine.getSnapshot()).toMatchObject({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "prev",
      isTransitioning: true
    });

    machine.update(100);
    expect(machine.goTo("contact")).toBe(true);
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

    expect(machine.goTo("work")).toBe(false);

    expect(machine.getSnapshot()).toEqual(snapshot);
    expect(snapshot).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    expect(machine.next()).toBe(true);

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
    const lockedMachine = createFlowMachine<"intro" | "work" | "missing">({
      phases: ["intro", "work"]
    });

    transitioningMachine.next();
    transitioningMachine.update(50);
    lockedMachine.lock();

    const idleSnapshot = idleMachine.getSnapshot();
    const transitioningSnapshot = transitioningMachine.getSnapshot();
    const lockedSnapshot = lockedMachine.getSnapshot();

    expect(() => idleMachine.goTo("missing")).toThrow(/Unknown phase/);
    expect(() => transitioningMachine.goTo("missing")).toThrow(/Unknown phase/);
    // Unknown-target validation runs before the manual lock check too.
    expect(() => lockedMachine.goTo("missing")).toThrow(/Unknown phase/);
    expect(idleMachine.getSnapshot()).toEqual(idleSnapshot);
    expect(transitioningMachine.getSnapshot()).toEqual(transitioningSnapshot);
    expect(lockedMachine.getSnapshot()).toEqual(lockedSnapshot);
  });

  it("rejects next, prev, and goTo while a transition is active", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 200
    });

    expect(machine.next()).toBe(true);
    machine.update(50);

    const activeTransitionSnapshot = machine.getSnapshot();

    expect(machine.next()).toBe(false);
    expect(machine.prev()).toBe(false);
    expect(machine.goTo("contact")).toBe(false);

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);

    machine.update(50);
    machine.update(200);
    expect(machine.next()).toBe(true);

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

    expect(machine.next()).toBe(false);
    expect(machine.goTo("contact")).toBe(false);

    expect(machine.getSnapshot()).toEqual(lockedSnapshot);

    machine.unlock();
    expect(machine.goTo("contact")).toBe(true);

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

    expect(machine.next()).toBe(true);
    machine.lock();
    machine.update(100);

    const lockedCompletedSnapshot = machine.getSnapshot();

    expect(machine.next()).toBe(false);

    expect(machine.getSnapshot()).toEqual(lockedCompletedSnapshot);

    machine.unlock();
    expect(machine.next()).toBe(true);

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

    expect(machine.next()).toBe(true);
    const transitioningSnapshot = machine.getSnapshot();

    expect(machine.goTo("contact")).toBe(false);

    expect(machine.getSnapshot()).toEqual(transitioningSnapshot);

    machine.update(100);
    expect(machine.goTo("contact")).toBe(true);

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

    expect(machine.next()).toBe(true);
    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    expect(machine.next()).toBe(false);
    machine.update(299);
    expect(machine.next()).toBe(false);

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(1);
    expect(machine.next()).toBe(true);

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

    machine.update(299);
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
    machine.update(299);
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
    machine.update(299);
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

  it("runs the full cooldown after transition completion for shorter equal and longer durations", () => {
    for (const [duration, cooldown] of [
      [700, 250],
      [300, 300],
      [100, 300]
    ] as const) {
      const machine = createFlowMachine({
        phases: ["intro", "work", "contact"] as const,
        transition: { duration, cooldown }
      });

      machine.next();
      expect(machine.isSettling).toBe(true);
      machine.update(duration);
      expect(machine.getSnapshot()).toMatchObject({
        phase: "work",
        progress: 1,
        direction: "none",
        isTransitioning: false
      });
      expect(machine.isSettling).toBe(cooldown > 0);

      machine.next();
      expect(machine.phase).toBe("work");
      machine.update(cooldown - 1);
      machine.next();
      expect(machine.phase).toBe("work");
      machine.update(1);
      expect(machine.isSettling).toBe(false);
      machine.next();
      expect(machine.getSnapshot()).toMatchObject({ phase: "contact", isTransitioning: true });
    }
  });

  it("allocates frame overshoot chronologically to post-completion cooldown", () => {
    const exactBoundary = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: { duration: 100, cooldown: 300 }
    });
    exactBoundary.next();
    exactBoundary.update(100);
    exactBoundary.next();
    expect(exactBoundary.phase).toBe("work");
    exactBoundary.update(300);
    exactBoundary.next();
    expect(exactBoundary.phase).toBe("contact");

    const smallerOvershoot = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: { duration: 100, cooldown: 300 }
    });
    smallerOvershoot.next();
    smallerOvershoot.update(150);
    smallerOvershoot.next();
    expect(smallerOvershoot.phase).toBe("work");
    smallerOvershoot.update(249);
    smallerOvershoot.next();
    expect(smallerOvershoot.phase).toBe("work");
    smallerOvershoot.update(1);
    smallerOvershoot.next();
    expect(smallerOvershoot.phase).toBe("contact");

    for (const elapsed of [400, 450]) {
      const machine = createFlowMachine({
        phases: ["intro", "work", "contact"] as const,
        transition: { duration: 100, cooldown: 300 }
      });
      machine.next();
      machine.update(elapsed);
      machine.next();
      expect(machine.phase).toBe("contact");
    }
  });

  it("matches single large updates and equivalent smaller updates", () => {
    const single = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: { duration: 100, cooldown: 300 }
    });
    const multiple = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: { duration: 100, cooldown: 300 }
    });

    single.next();
    multiple.next();
    single.update(250);
    multiple.update(80);
    multiple.update(20);
    multiple.update(150);

    single.next();
    multiple.next();
    expect(single.getSnapshot()).toEqual(multiple.getSnapshot());
    expect(single.isSettling).toBe(multiple.isSettling);

    single.update(150);
    multiple.update(100);
    multiple.update(50);
    expect(single.getSnapshot()).toEqual(multiple.getSnapshot());
    expect(single.isSettling).toBe(multiple.isSettling);
    expect(single.isSettling).toBe(false);

    single.next();
    multiple.next();
    expect(single.getSnapshot()).toEqual(multiple.getSnapshot());
  });

  it("supports zero-duration transitions with provider cooldown semantics", () => {
    const positiveCooldown = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 0,
      cooldownMs: 300
    });

    // An accepted zero-duration navigation still returns true even though it settles synchronously.
    expect(positiveCooldown.next()).toBe(true);

    const acceptedZeroDurationSnapshot = {
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    };

    expect(positiveCooldown.getSnapshot()).toEqual(acceptedZeroDurationSnapshot);
    expect(positiveCooldown.isSettling).toBe(true);

    // Rejected navigation up to the exact cooldown boundary must not mutate the snapshot.
    positiveCooldown.update(299);
    expect(positiveCooldown.next()).toBe(false);
    expect(positiveCooldown.getSnapshot()).toEqual(acceptedZeroDurationSnapshot);
    expect(positiveCooldown.isSettling).toBe(true);

    // The same navigation is accepted at the exact cooldown boundary, and isSettling clears.
    positiveCooldown.update(1);
    expect(positiveCooldown.isSettling).toBe(false);
    expect(positiveCooldown.next()).toBe(true);
    expect(positiveCooldown.phase).toBe("contact");

    const zeroCooldown = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: { duration: 0, cooldown: 0 }
    });
    expect(zeroCooldown.next()).toBe(true);
    expect(zeroCooldown.isSettling).toBe(false);
    expect(zeroCooldown.next()).toBe(true);
    expect(zeroCooldown.getSnapshot()).toMatchObject({ phase: "contact", progress: 1 });

    const byPhase = createFlowMachine({
      phases: ["intro", "work"] as const,
      transition: { duration: 100, byPhase: { intro: { duration: 0 } } }
    });
    expect(byPhase.next()).toBe(true);
    expect(byPhase.getSnapshot()).toMatchObject({ phase: "work", progress: 1 });
  });

  it("resolves non-adjacent goTo directly to the accepted target with the exact accepted snapshot, forward and reverse", () => {
    const forwardMachine = createFlowMachine({
      phases: ["intro", "overview", "detail", "contact"] as const,
      transitionDurationMs: 500
    });

    // intro (index 0) -> goTo("contact") (index 3): a direct two-index skip, accepted forward.
    expect(forwardMachine.goTo("contact")).toBe(true);

    expect(forwardMachine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 3,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    const reverseMachine = createFlowMachine({
      phases: ["intro", "overview", "detail", "contact"] as const,
      initialPhase: "contact",
      transitionDurationMs: 500
    });

    // contact (index 3) -> goTo("overview") (index 1): a direct two-index skip, accepted reverse.
    expect(reverseMachine.goTo("overview")).toBe(true);

    expect(reverseMachine.getSnapshot()).toEqual({
      phase: "overview",
      phaseIndex: 1,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("resolves transition.byPhase strictly from the source phase during non-adjacent goTo, proving forward and reverse duration, cooldown, and easing", () => {
    // Legacy, global, and byPhase fields are all deliberately distinct so an
    // incorrect fallback level or an incorrect (target-phase) source selection
    // produces an observably different progress or cooldown-boundary result.
    const machine = createFlowMachine({
      phases: ["intro", "overview", "detail", "contact"] as const,
      transitionDurationMs: 700,
      cooldownMs: 700,
      easing: () => 0,
      transition: {
        duration: 500,
        cooldown: 500,
        easing: (progress) => progress,
        byPhase: {
          intro: { duration: 200, cooldown: 300, easing: (progress) => progress * progress },
          contact: { duration: 400, cooldown: 600, easing: (progress) => Math.sqrt(progress) },
          overview: { duration: 900, cooldown: 900, easing: () => 1 }
        }
      }
    });

    // Forward: source "intro" must select intro's byPhase, not contact's (the target).
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 3,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(100);

    // intro duration 200ms, easing progress*progress: raw 0.5 -> 0.25.
    // Using contact's byPhase (duration 400, sqrt) instead would produce 0.5.
    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      progress: 0.25,
      isTransitioning: true
    });

    machine.update(100);

    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 3,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    const completedForwardSnapshot = machine.getSnapshot();

    // intro's cooldown is 300ms; navigation stays rejected up to the exact boundary.
    machine.update(299);
    expect(machine.goTo("overview")).toBe(false);

    expect(machine.getSnapshot()).toEqual(completedForwardSnapshot);

    machine.update(1);

    // Reverse: source "contact" must select contact's byPhase, not overview's (the target).
    expect(machine.goTo("overview")).toBe(true);

    expect(machine.getSnapshot()).toEqual({
      phase: "overview",
      phaseIndex: 1,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(100);

    // contact duration 400ms, easing sqrt: raw 0.25 -> 0.5.
    // Using overview's byPhase (duration 900, constant 1) instead would produce 1
    // while the transition is still active.
    expect(machine.getSnapshot()).toMatchObject({
      phase: "overview",
      progress: 0.5,
      isTransitioning: true
    });

    machine.update(300);

    expect(machine.getSnapshot()).toEqual({
      phase: "overview",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    const completedReverseSnapshot = machine.getSnapshot();

    // contact's cooldown is 600ms; navigation stays rejected up to the exact boundary.
    machine.update(599);
    expect(machine.goTo("intro")).toBe(false);

    expect(machine.getSnapshot()).toEqual(completedReverseSnapshot);

    machine.update(1);
    expect(machine.goTo("intro")).toBe(true);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "intro",
      direction: "prev",
      isTransitioning: true
    });
  });

  it("locks the exact custom monotonic easing lifecycle from accepted start through raw completion", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000,
      easing: (progress) => progress * progress
    });

    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
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

    // raw progress 0.5, quadratic easing: 0.5 * 0.5 = 0.25.
    machine.update(500);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    // Raw completion forces progress to 1 regardless of the easing curve.
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

  it("follows finite non-monotonic easing output, including a mid-transition decrease, until raw completion forces progress to 1", () => {
    // Deterministic finite easing whose output decreases between two increasing
    // raw progress samples (0.25 -> 0.6, 0.5 -> 0.2), while staying within [0, 1].
    const nonMonotonicEasing = (progress: number): number => {
      if (progress < 0.5) {
        return 0.6;
      }

      if (progress < 1) {
        return 0.2;
      }

      return 1;
    };

    const machine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 1000,
      easing: nonMonotonicEasing
    });

    machine.next();

    // raw progress 0.25 -> eased 0.6.
    machine.update(250);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      progress: 0.6,
      direction: "next",
      isTransitioning: true
    });

    // raw progress 0.75 -> eased 0.2, a decrease from the prior sample.
    machine.update(500);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "work",
      progress: 0.2,
      direction: "next",
      isTransitioning: true
    });

    // Raw completion still forces progress to 1 and ends the transition.
    machine.update(250);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps provider cooldown elapsing and the completed snapshot stable when manually locked during cooldown, accepting navigation only once both unlocked and cooldown-complete", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: { duration: 100, cooldown: 300 }
    });

    machine.next();
    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    expect(completedSnapshot).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    // Lock while provider cooldown is still counting down.
    machine.lock();

    expect(machine.getSnapshot()).toEqual({ ...completedSnapshot, isLocked: true });
    expect(machine.isSettling).toBe(true);

    // Cooldown keeps elapsing while locked; the rest of the snapshot stays stable.
    machine.update(200);

    expect(machine.getSnapshot()).toEqual({ ...completedSnapshot, isLocked: true });
    expect(machine.isSettling).toBe(true);

    // Unlocking before the cooldown boundary does not permit navigation yet.
    machine.unlock();
    machine.update(99);
    expect(machine.next()).toBe(false);

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
    expect(machine.isSettling).toBe(true);

    // Navigation is accepted only once both the manual lock is cleared and
    // provider cooldown has completed.
    machine.update(1);
    expect(machine.isSettling).toBe(false);
    expect(machine.next()).toBe(true);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("keeps navigation rejected when the manual lock is re-applied and never cleared through the cooldown boundary", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transition: { duration: 100, cooldown: 300 }
    });

    machine.next();
    machine.update(100);
    machine.lock();
    machine.update(300);

    const lockedAfterCooldownSnapshot = machine.getSnapshot();

    expect(lockedAfterCooldownSnapshot).toMatchObject({
      phase: "work",
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });
    expect(machine.isSettling).toBe(false);

    expect(machine.next()).toBe(false);

    expect(machine.getSnapshot()).toEqual(lockedAfterCooldownSnapshot);

    machine.unlock();
    expect(machine.next()).toBe(true);

    expect(machine.getSnapshot()).toMatchObject({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });
});
