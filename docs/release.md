# Release checklist

This document is for maintainers preparing a package release.

## Release planning note

Before opening a release-prep PR for any version, confirm there is an up-to-date roadmap or issue that defines the intended scope. Release planning checklists are verification-only: they do not publish, tag, create a GitHub Release, change package versions, or modify release automation by themselves.

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

The `release:check` script runs build, package output verification, typecheck, tests, lint, format, Vite example build, and package dry-run.

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

Do not run these commands unless you intentionally want to publish:

```bash
pnpm release
changeset publish
npm publish
```

## Publishing

When ready to publish:

1. Confirm npm authentication and permissions.
2. Confirm the npm package name is correct.
3. Confirm `release:check` passes.
4. Run:

```bash
pnpm release
```

The release command runs `release:check` before `changeset publish`.

## After publish

- Confirm the package appears on npm.
- Confirm the npm README renders correctly.
- Confirm the published package contents look correct.
- Confirm the GitHub repository remains clean.
- Create a GitHub release or tag only if that is part of the release process.

## If something fails

- Do not apply broad fixes.
- Identify the exact failed command.
- Fix only the smallest related issue.
- Do not change public API, package version, dependencies, or release workflow unless the failure requires it.
- If the failure reveals a larger release/versioning problem, stop and document it before changing architecture.
