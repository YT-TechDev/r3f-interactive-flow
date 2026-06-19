# Release checklist

This document is for maintainers preparing a package release.

## Release planning note

Before opening a release-prep PR for any version, confirm there is an up-to-date roadmap or issue that defines the intended scope. Planning and documentation PRs are verification-only: they should clarify scope, checklist expectations, and known release state without publishing packages, creating git tags, creating GitHub Releases, changing package versions, or modifying release automation.

Keep these release activities separate:

- **Safe release-prep verification:** run local checks, inspect package output, review docs, and confirm the expected package contents. `pnpm release:check` belongs in this category; it performs verification and package dry-run work only.
- **Package version/update PR work:** update the package version, changelog, and release notes only when the release-prep task explicitly calls for those changes.
- **Actual npm publish:** run `pnpm release` only when maintainers are intentionally ready to publish the already-prepared package to npm.
- **Actual git tag creation:** create release tags only as an explicit maintainer release action, not from planning, checklist, or documentation-only work.
- **Actual GitHub Release creation:** create the GitHub Release only as an explicit maintainer release action after the release notes are final and the release process calls for it.

## Before release

- Work from the latest `main`.
- Confirm all intended PRs are merged.
- Confirm the package version in `packages/r3f-interactive-flow/package.json` is correct.
- Confirm `packages/r3f-interactive-flow/CHANGELOG.md` includes the release entry.
- Confirm the GitHub release notes draft exists in `docs/releases/` for the release version.
- Confirm the public API is intentional and documented.
- Confirm no unrelated files are changed.

## Local verification

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

The `release:check` script runs build, package output verification, typecheck, tests, lint, format, Vite example build, and package dry-run. It is safe release-prep verification: it does not publish to npm, create git tags, create GitHub Releases, change package versions, or modify release automation.

For an additional direct package dry-run:

```bash
pnpm --filter r3f-interactive-flow pack:dry-run
```

If running npm pack directly:

```bash
cd packages/r3f-interactive-flow
npm pack --dry-run
```

The package output should include:

- `dist/`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `package.json`

The built `dist/index.js` and `dist/index.cjs` outputs should preserve the `"use client"` directive.

## Do not publish accidentally

Do not run these commands from planning, documentation-only, or verification-only PRs. Run them only when maintainers intentionally want to publish:

```bash
pnpm release
changeset publish
npm publish
```

## Publishing

When maintainers are ready to publish:

1. Confirm npm authentication and permissions.
2. Confirm the npm package name is correct.
3. Confirm `release:check` passes.
4. Confirm the package version, changelog entry, and release notes were already prepared in the intended release-prep PR.
5. Confirm this is an intentional npm publish action, not a planning or documentation-only task.
6. Run:

```bash
pnpm release
```

The `release` command is a publishing command. It runs `release:check` before `changeset publish`, then publishes the package to npm if authentication and package state allow it.

## After publish

- Confirm the package appears on npm.
- Confirm the npm README renders correctly.
- Confirm the published package contents look correct.
- Confirm the GitHub repository remains clean.
- Create a git tag only when the release process explicitly calls for the tag.
- Create a GitHub Release only when the release process explicitly calls for the release record.
- Keep the tag and GitHub Release steps separate from planning, documentation-only, and verification-only PRs.

## If something fails

- Do not apply broad fixes.
- Identify the exact failed command.
- Fix only the smallest related issue.
- Do not change public API, package version, dependencies, or release workflow unless the failure requires it.
- If the failure reveals a larger release/versioning problem, stop and document it before changing architecture.
