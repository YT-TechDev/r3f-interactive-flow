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

## Trusted Publishing workflow

The preferred production publishing path is the manually dispatched GitHub Actions Trusted Publishing workflow in `.github/workflows/release.yml`. Do not publish from a maintainer machine with a long-lived npm token unless the repository owner has explicitly decided to use the documented fallback for an incident.

The workflow is intentionally manual-only:

- Trigger it with `workflow_dispatch` only.
- Select the `main` branch. The workflow refuses to publish from any other ref.
- Enter the exact confirmation value `publish`.
- Use the `npm` GitHub Environment so repository owners can require approval or other protection before the publish job receives OIDC permissions.
- It installs with `pnpm install --frozen-lockfile`, runs `pnpm audit --prod`, runs the full safe `pnpm release:check`, and then publishes the prepared package with the exact npm CLI through Trusted Publishing.
- It does not use `NODE_AUTH_TOKEN`, `NPM_TOKEN`, registry tokens, or other long-lived npm credentials.

The publishing command in that workflow is an intentional release action. Do not dispatch the workflow from planning, documentation-only, dependency-audit, or verification-only PRs.

### One-time external setup

These settings cannot be committed to the repository. A package owner must configure them before the first OIDC release.

In npm package Trusted Publishers, configure:

- GitHub organization/user: `YT-TechDev`
- Repository: `r3f-interactive-flow`
- Workflow filename: `release.yml`
- GitHub Environment: `npm`
- Allowed action: `npm publish`

In GitHub, configure:

- Create or configure the `npm` Environment.
- Optionally require approval or other environment protection for `npm`.
- Do not store an npm token for this workflow.

Trusted Publishing requires GitHub Actions OIDC. Public-package provenance is generated automatically by npm for publishes from a public GitHub repository through the trusted publishing path; the workflow does not pass `--provenance` through Changesets. Actual OIDC publishing cannot be validated from a pull request because it requires the external npm Trusted Publisher settings and an intentional release dispatch.

### Release contract

Keep these actions separate and explicit:

- Local `pnpm release:check` remains safe verification and does not publish.
- Changesets remains responsible for release preparation such as package version updates and changelog entries.
- Package version updates remain a separate release-prep action.
- Changelog updates remain a separate release-prep action.
- Git tag creation remains a separate maintainer release action.
- GitHub Release creation remains a separate maintainer release action.

For the first Trusted Publishing release, verify one intentional OIDC release end to end. Only after that succeeds, disallow token-based publishing where appropriate and revoke obsolete automation tokens.

## Do not publish accidentally

Do not run these commands from planning, documentation-only, or verification-only PRs. Run them only when maintainers intentionally want to publish:

```bash
pnpm release
changeset publish
npm publish
```

## Publishing

When maintainers are ready to publish:

1. Confirm the npm Trusted Publisher and GitHub `npm` Environment are configured.
2. Confirm the npm package name is correct.
3. Confirm `pnpm release:check` passes locally or in CI.
4. Confirm the package version, changelog entry, and release notes were already prepared in the intended release-prep PR.
5. Confirm this is an intentional npm publish action, not a planning or documentation-only task.
6. Manually dispatch the `Release` workflow from `main` and enter the exact confirmation value `publish`.

The legacy local `pnpm release` command remains a publishing command. It runs `release:check` before `changeset publish`, then publishes the package to npm if authentication and package state allow it. Prefer the Trusted Publishing workflow so the exact npm CLI can exchange GitHub Actions OIDC for publish authorization and npm can generate provenance without a long-lived token.

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
