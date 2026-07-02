# Roadmap: v1.2.5 to v2.0.0

This is the current forward-looking roadmap for `r3f-interactive-flow` after the v1 stabilization line. Older roadmap files remain historical planning documents.

## Direction

`r3f-interactive-flow` should remain a focused utility for phase-based interactive React Three Fiber websites.

"A small, predictable control layer for phase-based interactive React Three Fiber websites, designed to stay readable for humans and AI coding agents."

The AI-friendly direction means the project should improve documentation clarity, small examples, test coverage, predictable behavior, TypeScript safety, public API clarity, maintainability, and an agent-readable project structure. It does not mean adding AI-specific product features or expanding the public API aggressively.

Treat `v1.2.5` through `v1.5.0` as preparation, documentation, tests, examples, and behavior hardening. Treat `v2.0.0` as stabilization and cleanup, not a rewrite or feature expansion release.

## Non-goals

The project should not add these just to feel "AI-era":

- animation timeline system
- camera preset API
- shader/effect collection
- particle system APIs
- GSAP wrapper
- Framer Motion wrapper
- Next.js router integration
- AI codegen CLI
- portfolio templates
- large demo templates
- heavy runtime dependencies
- `@react-three/drei`-style utility collection

The library's value is that it stays small, predictable, and focused.

## Public API policy

Keep the roadmap centered on the existing core public API:

- `FlowProvider`
- `useFlow`
- `useFlowProgress`
- `useFlowFrame`

Do not suggest large public API expansion. Any possible API-impacting work requires maintainer review before implementation.

Before suggesting any breaking change for `v2.0.0`, create a dedicated issue explaining:

- current behavior
- problem with current behavior
- proposed v2 behavior
- affected APIs
- migration path
- why it cannot remain as-is

## Version plan

### v1.2.5 - AI-readable documentation foundation

**Goal:** Make the library understandable from docs alone for both human developers and AI coding agents.

**Scope:**

- README structure
- what the library does
- what the library does not do
- when to use it
- when not to use it
- `FlowProvider` docs
- `useFlow` docs
- `useFlowProgress` docs
- `useFlowFrame` docs
- Canvas-bound hook rules
- DOM input vs R3F scene separation
- common mistakes and anti-patterns
- minimal example cleanup

**Candidate PRs:**

- README direction and scope pass.
- Core API documentation pass for `FlowProvider`, `useFlow`, `useFlowProgress`, and `useFlowFrame`.
- Canvas-bound hook and DOM input separation guide.
- Common mistakes / anti-patterns documentation.
- Minimal example copy clarity pass.

**Public API impact:** None expected.

**Release readiness:** Docs should explain the current library shape without implying features that do not exist.

### v1.3.0 - Core behavior test baseline

**Goal:** Lock expected phase transition behavior with tests.

**Scope:**

- `next` behavior tests
- `prev` behavior tests
- `goTo` behavior tests
- transition state tests
- progress semantics
- direction semantics
- `isTransitioning` semantics
- lock behavior tests
- `lockDuringTransition` behavior tests if applicable
- transition semantics documentation

**Candidate PRs:**

- Core transition navigation test baseline.
- Progress, direction, and transition-state semantics tests.
- Lock and transition-lock behavior coverage.
- Transition semantics documentation update aligned with tests.

**Public API impact:** None expected.

**Release readiness:** Tests should document behavior that maintainers expect to preserve.

### v1.3.x - Input behavior hardening

**Goal:** Make wheel, touch, and keyboard input behavior predictable.

**Scope:**

- wheel input tests
- wheel threshold behavior
- repeated wheel event handling
- touch swipe tests
- small movement filtering
- keyboard input tests
- repeated keydown handling
- cooldown behavior
- lock behavior
- event listener cleanup
- SSR/import safety
- input usage documentation

**Candidate PRs:**

- Wheel threshold, repeat-event, cooldown, and cleanup coverage.
- Touch swipe and small-movement filtering coverage.
- Keyboard repeat, cooldown, lock, and cleanup coverage.
- SSR/import safety validation for input modules.
- Input usage documentation aligned with tested behavior.

**Public API impact:** None expected.

**Release readiness:** Input behavior should be predictable across normal browser usage and safe to import in SSR environments.

### v1.4.0 - TypeScript hardening

**Goal:** Improve typed phase usage and make the library safer to use in TypeScript projects.

**Scope:**

- typed phases with `as const`
- generic phase typing review
- `goTo` phase typing
- hook return type clarity
- type-focused examples or tests
- typed phases documentation
- avoiding loose `string[]` where possible

**Candidate PRs:**

- Typed phases documentation and examples.
- Type-focused test or typecheck coverage for phase names.
- Review `goTo` and hook return type clarity.
- Identify any type changes that should be deferred to `v2.0.0`.

**Public API impact:** Type-only clarification unless separately approved.

If any type change may break user code, mark it as a v2 candidate instead of silently shipping it in `v1.4.0`.

**Release readiness:** Type guidance should help users avoid accidental loose phase strings without forcing a breaking change.

### v1.5.0 - Recipes and v2 preparation

**Goal:** Provide small copy-paste-friendly recipes and prepare v2 cleanup.

**Scope:**

- basic phase flow recipe
- click to next phase recipe
- wheel navigation recipe
- touch swipe navigation recipe
- keyboard navigation recipe
- DOM overlay + Canvas sync recipe
- `useFlowFrame` scene bridge recipe
- `lockDuringTransition` + cooldown recipe
- typed phases recipe
- v2 preparation notes
- docs/examples alignment audit
- package exports audit

**Candidate PRs:**

- Small recipe set for common usage patterns.
- `useFlowFrame` scene bridge recipe.
- Lock and cooldown recipe.
- Typed phases recipe.
- Docs/examples alignment audit.
- Package exports audit with notes for v2 candidates.

**Public API impact:** None expected.

**Release readiness:** Recipes should stay copy-paste-friendly and avoid turning the project into a template or demo collection.

### v2.0.0 - Stabilized library surface

**Goal:** Finalize the small public API surface, docs, examples, tests, and package exports.

Treat v2 as stabilization and cleanup, not a rewrite.

**Scope:**

- finalized public API surface
- finalized package exports
- finalized README/docs/examples
- regression test baseline
- migration guide if needed
- removal of deprecated behavior only if already documented
- alignment between README, docs, examples, tests, and TypeScript declarations

**Candidate PRs:**

- Public API and package export final review.
- README, docs, examples, tests, and declaration alignment pass.
- Regression test baseline confirmation.
- Migration guide only if a reviewed v2 change requires one.
- Cleanup of previously documented deprecated behavior, if any.

**Public API impact:** Possible only with explicit maintainer review.

Any breaking change requires a dedicated issue explaining the current behavior, the problem with current behavior, proposed v2 behavior, affected APIs, migration path, and why the current behavior cannot remain as-is.

**Release readiness:** v2 should make the existing library surface easier to trust, not broader.

## Suggested GitHub milestones

Do not create milestones as part of this documentation update. When maintainers are ready, use this roadmap to create small milestones matching the version plan:

- `v1.2.5 - AI-readable documentation foundation`
- `v1.3.0 - Core behavior test baseline`
- `v1.3.x - Input behavior hardening`
- `v1.4.0 - TypeScript hardening`
- `v1.5.0 - Recipes and v2 preparation`
- `v2.0.0 - Stabilized library surface`

Each milestone should be split into small PR-sized issues across docs, tests, examples, implementation/fix work, TypeScript/type work, and chore/release-prep work.

## Priority order

1. Documentation foundation and scope clarity.
2. Core behavior test baseline.
3. Input behavior hardening.
4. TypeScript hardening.
5. Copy-paste-friendly recipes and v2 preparation.
6. v2 stabilization, cleanup, and release readiness.

## Out of scope for this roadmap

- Implementing roadmap items.
- Creating GitHub milestones or issues.
- Publishing packages, creating tags, or creating GitHub Releases.
- Adding runtime dependencies.
- Expanding into animation frameworks, visual effects systems, templates, or AI-specific product features.
- Rewriting the library architecture.
