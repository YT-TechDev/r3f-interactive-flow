import { describe, expect, it } from "vitest";

import { createFlowMachine } from "./createFlowMachine";

describe("createFlowMachine cooldown ignored navigation hardening", () => {
  it("exposes the complete provider cooldown lifecycle without redefining lock state", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });

    expect(machine.isCoolingDown).toBe(false);
    expect(machine.getSnapshot().isCoolingDown).toBe(false);

    expect(machine.next()).toBe(true);
    machine.update(99);
    expect(machine.getSnapshot()).toMatchObject({
      isTransitioning: true,
      isCoolingDown: false
    });

    machine.update(1);
    expect(machine.getSnapshot()).toMatchObject({
      isTransitioning: false,
      isCoolingDown: true
    });
    expect(machine.next()).toBe(false);

    const coolingSnapshot = machine.getSnapshot();
    expect(machine.goTo("contact")).toBe(false);
    expect(machine.getSnapshot()).toEqual(coolingSnapshot);

    machine.lock();
    machine.update(299);
    expect(machine.getSnapshot()).toMatchObject({ isCoolingDown: true, isLocked: true });

    machine.update(1);
    expect(machine.getSnapshot()).toMatchObject({ isCoolingDown: false, isLocked: true });
    machine.unlock();

    const freshMachine = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });
    expect(freshMachine.getSnapshot().isCoolingDown).toBe(false);
  });

  it("handles zero duration, zero cooldown, and a large update delta", () => {
    const immediate = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 0,
      cooldownMs: 300
    });

    expect(immediate.next()).toBe(true);
    expect(immediate.getSnapshot().isCoolingDown).toBe(true);
    immediate.update(300);
    expect(immediate.getSnapshot().isCoolingDown).toBe(false);

    const noCooldown = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 100,
      cooldownMs: 0
    });
    noCooldown.next();
    noCooldown.update(100);
    expect(noCooldown.getSnapshot().isCoolingDown).toBe(false);

    const consumedInOneUpdate = createFlowMachine({
      phases: ["intro", "work"] as const,
      transitionDurationMs: 100,
      cooldownMs: 300
    });
    consumedInOneUpdate.next();
    consumedInOneUpdate.update(400);
    expect(consumedInOneUpdate.getSnapshot()).toMatchObject({
      isTransitioning: false,
      isCoolingDown: false
    });
  });

  it("does not reset or extend cooldown when valid navigation is ignored during cooldown", () => {
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

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(499);
    machine.goTo("contact");

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

  it("does not let boundary navigation open a cooldown gate by itself", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "contact",
      transitionDurationMs: 100,
      cooldownMs: 500
    });

    const boundarySnapshot = machine.getSnapshot();

    machine.next();
    machine.update(499);
    machine.prev();

    expect(boundarySnapshot).toEqual({
      phase: "contact",
      phaseIndex: 2,
      progress: 0,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });
    expect(machine.getSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 0,
      direction: "prev",
      isTransitioning: true,
      isLocked: false
    });
  });

  it("does not reset or extend cooldown when boundary navigation is ignored during cooldown", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      initialPhase: "work",
      transitionDurationMs: 100,
      cooldownMs: 500
    });

    machine.prev();
    machine.update(100);

    const completedSnapshot = machine.getSnapshot();

    machine.prev();
    machine.goTo("intro");

    expect(machine.getSnapshot()).toEqual(completedSnapshot);
    expect(machine.getSnapshot()).toEqual({
      phase: "intro",
      phaseIndex: 0,
      progress: 1,
      direction: "none",
      isTransitioning: false,
      isLocked: false
    });

    machine.update(499);
    machine.prev();
    machine.next();

    expect(machine.getSnapshot()).toEqual(completedSnapshot);

    machine.update(1);
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

  it("does not let locked navigation bypass cooldown or mutate transition state", () => {
    const machine = createFlowMachine({
      phases: ["intro", "work", "contact"] as const,
      transitionDurationMs: 100,
      cooldownMs: 500
    });

    machine.next();
    machine.update(100);
    machine.lock();

    const lockedCooldownSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();
    machine.unlock();
    machine.goTo("contact");

    expect(machine.getSnapshot()).toEqual({
      ...lockedCooldownSnapshot,
      isLocked: false
    });

    machine.lock();
    machine.update(500);

    const elapsedLockedSnapshot = machine.getSnapshot();

    machine.next();
    machine.goTo("contact");
    machine.prev();

    expect(machine.getSnapshot()).toEqual(elapsedLockedSnapshot);

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
});
