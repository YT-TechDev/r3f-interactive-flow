# v1.0.0 Stabilization Roadmap

`v1.0.0` is the final stabilization milestone for the current `r3f-interactive-flow` foundation.

The goal is to finalize confidence in the existing phase, input, transition, React provider, package, documentation, example, and R3F frame bridge behavior before treating the current library direction as stable.

This release should not broaden the library into a general animation framework. Work should stay small, reviewable, and focused on final reliability.

## Goals

- Confirm the existing public API is intentional and documented.
- Confirm phase transition behavior is predictable.
- Confirm no-op, boundary, lock, cooldown, and active-transition behavior remains stable.
- Confirm wheel, touch, and keyboard input behavior is documented and covered.
- Confirm `FlowProvider`, `useFlow`, `useFlowProgress`, and `useFlowFrame` remain consistent.
- Confirm package exports, peer dependencies, and package output are release-ready.
- Keep examples minimal and focused on correct usage.

## Non-goals

`v1.0.0` should not add:

- visual effects APIs
- camera presets
- shader APIs
- particle or morph APIs
- animation timelines
- router integration
- Next.js-specific integration
- GSAP integration
- Framer Motion integration
- visual editors
- large demo templates
- full website templates
- new runtime dependencies

## Suggested final checks

- Public export audit
- README and package README consistency check
- Basic example validation
- Input hook behavior check
- Core machine behavior check
- React provider behavior check
- R3F frame bridge behavior check
- Package output verification
- Release readiness validation

## Candidate PR slices

Keep each PR small and reviewable.

1. Public API and export consistency audit.
2. README / package README final usage consistency pass.
3. Minimal example final polish.
4. Final input hook edge coverage if any gap remains.
5. Final release readiness documentation.
6. Version bump and release.

## Scope guard

No broad rewrites should be included in `v1.0.0`.

Any source change should be justified by a concrete stability issue, test gap, package issue, or documentation mismatch. Do not expand the public API, add dependencies, change release automation, or publish, tag, or create a GitHub Release as part of roadmap-only work.
