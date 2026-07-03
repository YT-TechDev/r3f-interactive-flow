import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine lock and unlock transition behavior", () => {
  it("ignores every navigation method while manually locked without changing the idle snapshot", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 300
    });

    machine.lock();

    const lockedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();
    machine.update(150);

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

  it("keeps phase state stable when unlock is called before a later valid navigation", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 300
    });

    machine.lock();
    machine.next();
    machine.unlock();

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
  });

  it("preserves the active transition snapshot when locked navigation is ignored", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 500
    });

    machine.next();
    machine.update(200);
    machine.lock();

    const lockedTransitionSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();

    expect(machine.getSnapshot()).toEqual(lockedTransitionSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.4,
      direction: "next",
      isTransitioning: true,
      isLocked: true
    });
  });

  it("does not let unlock trigger navigation or re-enter an active transition", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 400
    });

    machine.next();
    machine.update(100);
    machine.lock();
    machine.unlock();

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.goTo("contact");
    machine.prev();

    expect(machine.getSnapshot()).toEqual(activeTransitionSnapshot);
  });

  it("continues a locked active transition and allows later navigation only after unlock", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 400
    });

    machine.next();
    machine.update(100);
    machine.lock();
    machine.update(300);

    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: true
    });

    const lockedCompletedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual(lockedCompletedSnapshot);

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
});
