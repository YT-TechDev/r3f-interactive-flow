import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine navigation boundary and no-op baseline", () => {
  it("keeps the snapshot stable when next is called at the last phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "contact",
      transitionDurationMs: 100
    });
    const snapshot = machine.getSnapshot();

    machine.next();

    expect(machine.getSnapshot()).toEqual(snapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps the snapshot stable when prev is called at the first phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100
    });
    const snapshot = machine.getSnapshot();

    machine.prev();

    expect(machine.getSnapshot()).toEqual(snapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("keeps the snapshot stable when goTo targets the current phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      transitionDurationMs: 100,
      cooldownMs: 300
    });
    const snapshot = machine.getSnapshot();

    machine.goTo("work");

    expect(machine.getSnapshot()).toEqual(snapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
  });

  it("starts a transition when goTo targets a valid different phase", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      transitionDurationMs: 200
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

    machine.update(100);

    expect(machine.getSnapshot()).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0.5,
      direction: "next",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("ignores rapid repeated navigation calls while a transition is active", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 200
    });

    machine.next();
    machine.update(50);

    const activeTransitionSnapshot = machine.getSnapshot();

    machine.next();
    machine.prev();
    machine.goTo("contact");
    machine.goTo("work");

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

  it("preserves ignored-navigation snapshots until an explicit update advances time", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    machine.next();
    machine.update(100);

    const cooldownSnapshot = machine.getSnapshot();

    machine.next();
    machine.prev();
    machine.goTo("work");

    expect(machine.getSnapshot()).toEqual(cooldownSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(300);
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
