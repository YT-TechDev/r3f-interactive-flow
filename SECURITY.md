# Security Policy

## Supported Versions

Security fixes are prioritized for the latest released version.

| Version | Supported |
| ------- | --------- |
| latest  | Yes       |

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub Issues.

If you believe you have found a vulnerability, please use GitHub Private Vulnerability Reporting if available.

When reporting, include:

- A clear description of the issue
- Steps to reproduce
- Affected version or commit
- Any relevant proof of concept

We will review and address security reports as soon as reasonably possible.

## Release Supply Chain

Production npm publishing should use the manual GitHub Actions Trusted Publishing workflow with OIDC and provenance instead of long-lived npm tokens. Maintainers should keep package version updates, changelog edits, git tags, and GitHub Releases as separate explicit release actions. See `docs/release.md` for the release contract and the external npm/GitHub owner settings required before an OIDC publish.
