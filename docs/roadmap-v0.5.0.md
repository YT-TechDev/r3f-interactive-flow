# r3f-interactive-flow v0.5.0 Roadmap

## Status

`r3f-interactive-flow@0.4.0` has been published.

v0.5.0 planning is open. This roadmap is documentation-only: it does not publish, tag, release, add runtime behavior, add dependencies, change package versions, or expand the public API by itself.

## Goal

Keep v0.5.0 narrow and stabilization-focused. The release should align documentation with the published v0.4.0 behavior, review examples for accuracy, clarify integration guidance, and add small reliability tests only when real gaps are found.

v0.5.0 should not become a feature-expansion release.

## Priorities

- Align root documentation, package documentation, release notes, and roadmap references after the v0.4.0 publication.
- Review examples for accuracy against the current public API and documented behavior.
- Improve maintainability of documentation and validation guidance.
- Clarify Next.js Client Component usage where React hooks or browser input hooks are used.
- Review package export and peer dependency documentation for accuracy.
- Add small reliability tests only when review finds a real behavior gap.

## Non-goals

- No public API expansion.
- No new runtime dependencies.
- No visual effects collection.
- No particle API.
- No camera preset API.
- No shader API.
- No animation timeline system.
- No router integration.
- No GSAP integration.
- No Framer Motion integration.
- No large templates.
- No release automation changes unless explicitly requested.
- No npm publishing, GitHub Release creation, or tag creation from roadmap-only work.

## Candidate PR-sized tasks

1. Align post-v0.4.0 status wording across README, release notes, and roadmap documentation.
2. Review Next.js examples and snippets for clear Client Component boundaries.
3. Review peer dependency and package export documentation against the package manifest.
4. Review example code for stale imports, stale option names, or behavior that conflicts with tested navigation guards.
5. Add targeted reliability tests only when a concrete, reproducible gap is identified.
6. Trim or clarify documentation that implies unplanned visual, router, or animation features.

## Documentation alignment checklist

- [x] Root README points current planning to this v0.5.0 roadmap and Issue #110.
- [x] Historical v0.4.0 release notes read as published release notes, not a release-prep draft.
- [x] Historical v0.4.0 roadmap clearly points current planning to v0.5.0.
- [x] Release checklist remains reusable for future versions.
- [x] Documentation avoids implying that planning PRs publish packages, create tags, create GitHub Releases, or change automation.
- [x] Public API examples stay centered on the documented provider and hooks.
- [x] Peer dependency ranges are documented consistently with the package manifest.

## Example review checklist

- [x] Examples use `FlowProvider` with stable phases and configuration.
- [x] DOM input hooks remain outside R3F scene logic.
- [x] R3F hooks remain inside Canvas-bound components.
- [x] Next.js snippets that use hooks or browser input are clearly Client Components.
- [x] Examples do not imply visual effects, camera presets, shader APIs, animation timelines, router integration, GSAP integration, or Framer Motion integration.
- [x] Example validation commands are documented only when they exist and are expected to pass.

## Completed v0.5.0 stabilization docs pass

The documentation/example review pass has completed these stabilization items without changing runtime code, example source, package versions, dependencies, release automation, tags, GitHub Releases, or npm publishing:

- Root README public API/export alignment.
- `examples/vite-basic/README.md` coverage for the basic Vite example.
- Next.js Client Component boundary clarification.
- Root README validation matrix by PR type.
- Package README validation guidance synchronized with the root README.

This does not mean v0.5.0 is ready to release. A separate release-prep review should still verify the final package state before any versioning, publishing, tag, or GitHub Release work.

## Reliability follow-up policy

Reliability work is allowed only when review finds a real gap in the existing behavior or tests. Keep follow-up PRs small and focused. No new reliability test task has been identified from the documentation/example review pass yet.

When adding a reliability test:

- Prefer tests before behavior changes when practical.
- Document the behavior being protected.
- Avoid broad refactors.
- Do not expand the public API unless a separate issue explicitly approves it.
- Do not add dependencies unless separately justified.

## Architecture rules to preserve

Keep the existing package structure:

```txt
packages/r3f-interactive-flow/
  src/
    core/
    react/
    r3f/
    input/
```

Rules:

- `core/` stays React-independent.
- `react/` owns provider, context, and hooks.
- `r3f/` owns Canvas-bound frame bridge hooks.
- `input/` owns browser input handling.
- Do not mix DOM input logic into R3F scene logic.
- Do not call R3F hooks such as `useFrame` or `useThree` outside Canvas-bound components.
- Do not use React state for values that change every frame unless synchronizing a stable snapshot intentionally.
- Keep public exports small and intentional.
- Avoid broad rewrites and unrelated file changes.

## Validation guidance

For documentation-only PRs, run the repository checks that validate formatting and linting:

```bash
pnpm format
pnpm lint
```

For release-prep or package-output work, use the maintainer checklist in [docs/release.md](release.md) instead of publishing directly.

Do not run publish, tag, or GitHub Release commands from roadmap-only work.
