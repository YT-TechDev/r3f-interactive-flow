# r3f-interactive-flow v0.7.0 Roadmap

## Status after v0.6.0

v0.6.0 is complete as a narrow input stabilization release. The repository documents the v0.6.0 planning and release notes, `r3f-interactive-flow@0.6.0` has been published to npm, and the GitHub Release for v0.6.0 has been created.

Completed v0.6.0 work included:

- v0.6.0 roadmap and release documentation.
- Wheel and touch threshold validation.
- Documentation sync for threshold validation behavior.
- Hook-local cooldown guard tests for ignored or blocked wheel, touch, and keyboard input events.

This roadmap is documentation-only. It does not publish another package version, create tags, create GitHub Releases, add runtime behavior, add dependencies, change release automation, bump package versions, change tests, or expand the public API by itself.

## Goal

Keep v0.7.0 narrow and stabilization-focused after the v0.6.0 input stabilization pass.

The recommended v0.7.0 theme is consumer package confidence and post-release maintenance stabilization. Work should make it easier to trust the installed package shape, documented public exports, example usage, and release-prep checklist boundaries without adding new feature concepts.

v0.7.0 should not become a feature-expansion release.

## Candidate PR-sized tasks

1. Post-v0.6.0 documentation alignment.
   - Align root and package README references after completed v0.6.0 work.
   - Keep status wording conservative and distinguish completed v0.6.0 publish/release actions from future release-prep verification.
2. Package exports / dist output verification hardening.
   - Review package output verification for the current package shape.
   - Prefer small checks that protect existing expected files, exports, and built output behavior.
   - Do not change package versions, dependencies, or release automation as part of planning-only work.
3. Public API and type export confidence checks.
   - Verify the documented public API still matches the package entrypoint.
   - Keep public exports intentional and avoid incidental API expansion.
   - Add or adjust checks only when they protect the current documented API.
4. Vite basic example validation against the current public API.
   - Confirm the example continues to use the current provider and hooks.
   - Keep the example narrow and avoid large template or integration work.
5. Release checklist clarity around release-prep vs actual publish/tag/GitHub Release actions.
   - Clarify which steps are safe release-prep verification.
   - Distinguish package version, changelog, and release-notes update PR work from documentation-only planning work.
   - Keep actual publish, tag, and GitHub Release actions clearly separated from planning and verification work.

## Non-goals

- No runtime dependency additions.
- No public API expansion.
- No visual effects collection.
- No camera presets.
- No shader APIs.
- No animation timelines.
- No router integration.
- No GSAP integration.
- No Framer Motion integration.
- No large templates.
- No package version bump from this planning-only PR.
- No publish, tag, or GitHub Release actions.
- No release automation changes unless explicitly requested.
- No runtime source code changes from roadmap-only work.
- No test changes from roadmap-only work.

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
- `input/` owns browser input hooks.
- Do not mix DOM input logic into R3F scene logic.
- Do not call R3F hooks such as `useFrame` or `useThree` outside Canvas-bound components.
- Do not use React state for values that change every frame unless synchronizing a stable snapshot intentionally.
- Do not access browser APIs at module import time.
- `useFlowFrame` remains Canvas-bound.
- Keep public exports small and intentional.
- Avoid broad rewrites and unrelated file changes.

## Validation guidance

For documentation-only v0.7.0 PRs, run the repository checks that validate formatting and linting:

```bash
pnpm format
pnpm lint
```

For package-output or public-export confidence PRs, add the narrowest relevant package verification command in addition to formatting and linting. Prefer existing scripts over new automation unless the existing checks cannot cover the current package contract.

For Vite basic example validation PRs, add the relevant example build or typecheck command when the PR touches example documentation or example code.

For release checklist documentation PRs, keep validation to formatting and linting unless the documentation references a specific script that should be verified.

Do not run publish, tag, or GitHub Release commands from planning, documentation, or verification-only work. Treat `pnpm release:check` as non-publishing release-prep verification, and reserve `pnpm release` for intentional maintainer publishing only.
