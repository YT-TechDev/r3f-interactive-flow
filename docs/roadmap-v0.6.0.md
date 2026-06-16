# r3f-interactive-flow v0.6.0 Roadmap

## Status

v0.5.0 release-prep and release-notes work is complete in this repository. The repository documents v0.5.0 as a narrow documentation and example stabilization release, but this roadmap does not claim npm publishing, git tag creation, or GitHub Release creation.

v0.6.0 planning starts from that completed documentation baseline. This roadmap is documentation-only: it does not publish, tag, release, add runtime behavior, add dependencies, change release automation, bump package versions, or expand the public API by itself.

## Goal

Keep v0.6.0 narrow and stabilization-focused. The release should align documentation after the v0.5.0 release-notes pass, harden input hook option validation where behavior is already intended, and add targeted lifecycle tests only where real gaps are found.

v0.6.0 should not become a feature-expansion release.

## Priorities

- Align post-v0.5.0 documentation so current planning points to this roadmap.
- Review wheel, touch, and keyboard input hook option handling for invalid or edge-case configuration.
- Harden option validation only when the desired behavior is clear from the existing API shape and tests.
- Add targeted lifecycle tests for wheel, touch, and keyboard input hooks only where coverage gaps exist.
- Preserve the current public API, package structure, and dependency footprint.

## Non-goals

- No public API expansion unless separately approved.
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
- No package version bumps from planning-only work.
- No release automation changes unless explicitly requested.
- No npm publishing, GitHub Release creation, or tag creation from roadmap-only work.

## Candidate PR-sized tasks

1. Align README and package documentation references after the completed v0.5.0 release-notes pass.
2. Audit input hook option validation for wheel, touch, and keyboard hooks without changing public option names.
3. Add focused tests for invalid option values only when existing behavior is ambiguous or under-covered.
4. Add focused lifecycle tests for listener setup, cleanup, disabled state, cooldown interaction, and lock behavior only where gaps exist.
5. Clarify documentation when examples imply unsupported integrations or feature expansion.
6. Keep each implementation PR small enough to review independently.

## Documentation alignment checklist

- [x] Root README points future work to this v0.6.0 planning document.
- [x] v0.5.0 release notes remain the documented summary of completed release-prep and release-notes work.
- [x] Documentation avoids claiming npm publishing, git tag creation, or GitHub Release creation unless those actions are already documented as completed.
- [x] Planning language keeps v0.6.0 focused on stabilization rather than feature expansion.
- [x] Public API examples remain centered on the documented provider and hooks.

## Input hardening checklist

Use this checklist to decide whether a v0.6.0 implementation PR is justified:

- [ ] The gap affects existing wheel, touch, or keyboard input behavior.
- [ ] The expected behavior follows from the current documented API.
- [ ] The change does not require new public options, new exports, or a package dependency.
- [ ] The change can be covered by a targeted test.
- [ ] The implementation stays inside the existing `input/`, `react/`, `r3f/`, and `core/` boundaries.

## Lifecycle test candidates

Prefer tests that protect concrete behavior over broad snapshots or incidental implementation details:

- Listener registration and cleanup when an input hook mounts and unmounts.
- Disabled input hooks avoiding listener side effects where applicable.
- Wheel delta threshold and direction handling around boundary values.
- Touch start, move, end, cancel, and threshold behavior where gaps exist.
- Keyboard next/previous key handling with configured key maps.
- Input behavior while navigation is locked or cooldown is active.

Do not add tests just to increase coverage numbers. Add them when they document a real lifecycle or validation behavior that could regress.

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

For runtime input hardening PRs, add the smallest relevant test command from the package scripts in addition to formatting and linting.

Do not run publish, tag, or GitHub Release commands from roadmap-only work.
