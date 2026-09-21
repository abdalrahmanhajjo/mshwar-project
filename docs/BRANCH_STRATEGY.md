# Branch Strategy & Release Policy

## Branch Model

We use a **trunk-based development** model with short-lived feature branches and `main` as the single source of truth.

```
feature/*  ─┐
bugfix/*    ─┼──► main (protected)
hotfix/*    ─┘        │
                      ▼
              staging (auto) ──► production (manual gate)
```

## Branch Definitions

| Branch      | Purpose                   | Protection                                            | Deploy Target                        |
| ----------- | ------------------------- | ----------------------------------------------------- | ------------------------------------ |
| `main`      | Production-ready code     | Required PR reviews, status checks, branch protection | Staging (auto) → Production (manual) |
| `feature/*` | New features              | Must pass CI before merge                             | Preview only                         |
| `bugfix/*`  | Bug fixes                 | Must pass CI before merge                             | Preview only                         |
| `hotfix/*`  | Critical production fixes | Fast-track review                                     | Production (auto)                    |

## Release Strategy

### Pre-release (Feature → Staging)

1. **Feature branch** created from `main`
2. **Open PR** against `main`
3. **CI runs automatically**:
   - `gitleaks` secret scanning
   - Lint, format, type-check
   - Unit tests with ≥80% coverage
   - Migration up/down cycle
   - Cross-tenant isolation tests
   - Build (web + API)
4. **Merge to `main`** triggers:
   - **Staging auto-deploy** (web → Vercel preview, API → staging)
   - **Smoke tests** against staging
   - **Rollback available** on failure
5. **Manual verification** on staging

### Production Promotion

1. **Manual approval** via GitHub Environments → `production`
2. **Production deploy** of both web and API
3. **Health checks** verify deployment
4. **Automatic rollback** if health checks fail

### Hotfix Flow

1. Create `hotfix/*` from `main`
2. Fast-track review
3. Merge to `main`
4. Auto-deploy to staging → Production

## Protected Branch Rules (`main`)

```yaml
# .github/branch-protection.json
required_pull_request_reviews:
  required_approving_review_count: 2
  require_code_owner_reviews: true
  require_last_review_approval: true

status_checks:
  - gitleaks
  - lint-format
  - backend-lint
  - backend-test
  - backend-integration
  - coverage-threshold
  - e2e
  - web-build
  - api-integration

enforce_administrators: true
require_conversation_resolution: true
```

## Environment Strategy

| Environment    | Purpose             | Deploy Trigger    | Rollback                              |
| -------------- | ------------------- | ----------------- | ------------------------------------- |
| **Preview**    | PR previews         | PR opened/updated | Automatic                             |
| **Staging**    | Integration testing | Merge to `main`   | Automatic (< 2 min)                   |
| **Production** | Live users          | Manual approval   | Manual or automatic on health failure |

## Versioning

- **Semantic Versioning** (`MAJOR.MINOR.PATCH`)
- API version is in URL (`/api/v1/`)
- Frontend version is in `package.json`
- Database migrations are versioned via Alembic

## Key Rotation

See [KEY_ROTATION.md](../docs/KEY_ROTATION.md)

## Incident Response

1. **Rollback**: redeploy the previous web/API version
2. **Database**: migrations are forward-only — ship a fix-forward migration, or restore a backup /
   point-in-time recovery after a deliberate decision (never automatic)
3. **Secrets exposed**: Rotate immediately via platform secret store
4. **Communication**: Post-incident review within 48 hours
