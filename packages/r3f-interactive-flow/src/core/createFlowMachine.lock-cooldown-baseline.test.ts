import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine lock and cooldown baseline", () => {
  it("keeps the idle snapshot stable when navigation is requested while manually locked", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    machine.lock();

    const lockedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();

    expect(machine.getSnapshot()).toEqual(lockedSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });
  });

  it("allows navigation after manual unlock without changing the public snapshot shape", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 200
    });

    machine.lock();
    machine.next();
    machine.unlock();
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

  it("continues an active transition after lock and ignores new navigation until unlocked", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 400
    });

    machine.next();
    machine.update(100);
    machine.lock();

    const lockedTransitionSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();

    expect(machine.getSnapshot()).toEqual(lockedTransitionSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: true
    });

    machine.update(300);

    const lockedCompletedSnapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(lockedCompletedSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });

    machine.unlock();
    machine.next();

    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("blocks navigation during cooldown until explicit updates advance enough time", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 500
    });

    machine.next();
    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();
    machine.update(299);
    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(101);
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

  it("keeps ignored navigation from extending active transition or cooldown gates", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 200,
      cooldownMs: 500
    });

    machine.next();
    machine.update(100);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);

    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.update(299);
    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(1);
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

  it("treats rapid repeated next calls as a single accepted transition before cooldown", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact", "summary"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    machine.next();
    machine.next();
    machine.next();

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    machine.next();
    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(300);
    machine.next();

    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("does not queue locked navigation while cooldown elapses in the background", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    machine.next();
    machine.update(100);
    machine.lock();

    machine.next();
    machine.goTo("contact");
    machine.update(300);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });

    machine.unlock();

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
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
});
