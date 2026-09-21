# Security, privacy and trust

Epic: MSHWAR-13 · Last reviewed: September 2026

This folder explains how Mshwar protects its users, and how to keep it that way.

| Topic                                      | Document                                                                     | Story      |
| ------------------------------------------ | ---------------------------------------------------------------------------- | ---------- |
| Who can call each endpoint                 | [authorization.md](authorization.md), [route-policies.md](route-policies.md) | MSHWAR-108 |
| Database login role and row-level security | [database-roles.md](database-roles.md)                                       | MSHWAR-108 |
| Audit log                                  | [audit-log.md](audit-log.md)                                                 | MSHWAR-109 |
| Rate limits and the AI spending ceiling    | [rate-limits.md](rate-limits.md)                                             | MSHWAR-110 |
| Logs, request IDs and Sentry               | [logging-and-monitoring.md](logging-and-monitoring.md)                       | MSHWAR-111 |
| File uploads and ImageKit                  | [uploads.md](uploads.md)                                                     | MSHWAR-112 |
| Legal documents, consent and cookies       | [privacy-and-consent.md](privacy-and-consent.md)                             | MSHWAR-113 |
| Threat model                               | [threat-model.md](threat-model.md)                                           | MSHWAR-114 |
| Security review and findings               | [review-2026-09.md](review-2026-09.md)                                       | MSHWAR-114 |

## Checks that run on every pull request

| Check                                      | Where              | Fails the build when                                                      |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------------------- |
| Secret scanning (gitleaks)                 | `ci.yml`           | a secret is committed                                                     |
| Python lint with security rules (ruff `S`) | `api.yml`          | an unsafe pattern is used                                                 |
| Python dependency audit (pip-audit)        | `api.yml`          | an API dependency has a known vulnerability                               |
| API tests as the restricted database role  | `api.yml`          | an endpoint or function needs more rights than production has             |
| Route policy table                         | `api.yml` (pytest) | a route has no access policy, or the published table is stale             |
| Web dependency audit (pnpm audit)          | `security.yml`     | a production web dependency has a known vulnerability (moderate or worse) |
| Static analysis (Semgrep)                  | `security.yml`     | an error-level finding appears                                            |
| Container scan (Trivy)                     | `security.yml`     | an API or web image has a fixable high or critical vulnerability          |

`security.yml` also runs every Monday, so new advisories are caught even when nobody is pushing.
Dependabot (`.github/dependabot.yml`) opens update pull requests for Python, npm, Docker and GitHub Actions.
Major version updates are not proposed automatically; they need a planned upgrade.

## Reporting a vulnerability

Please don't open a public issue. Contact the maintainers privately through the contact details on the
website, with steps to reproduce. Don't test against real users' data.
