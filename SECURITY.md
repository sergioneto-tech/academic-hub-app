# Security Policy

## Supported version

The Academic Hub is a private, continuously deployed application. Security fixes are applied to the current production version on the `main` branch.

## Reporting a vulnerability

Do not open a public issue containing credentials, tokens, personal data, exploit details, or other sensitive information.

Use GitHub's private vulnerability reporting/security advisory channel for this repository when available. If that channel is unavailable, contact the repository owner privately and provide only the minimum information needed to reproduce the issue.

A useful report includes:

- affected component and version;
- steps to reproduce;
- expected and observed behaviour;
- security impact;
- evidence with secrets and personal data redacted.

Do not include production credentials, student data, access tokens, database dumps, or unredacted logs.

## Repository security rules

- Secrets belong in GitHub Environments/Secrets and never in tracked files.
- Production changes should go through a branch and pull request with successful quality checks.
- Supabase production credentials must keep the minimum permissions required by CI.
- Security-sensitive migrations and Edge Functions must be reviewed together with their RLS/authentication impact.
- Dependency and GitHub Actions updates are monitored by Dependabot.
