# Contributing Guide

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm 9+
- Python 3.11+
- Docker and Docker Compose
- PostgreSQL 17
- Redis 7

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd mshwar
   ```

2. **Set up environment files**

   ```bash
   cp services/api/.env.example services/api/.env.local
   cp apps/web/.env.example apps/web/.env.local
   ```

   Edit `.env.local` files with your local credentials. **Never commit these files.**

3. **Install dependencies**

   ```bash
   pnpm install
   pip install -r services/api/requirements-dev.txt   # Python 3.11
   ```

4. **Start services**

   ```bash
   docker compose up --build
   ```

5. **Run migrations**
   Docker Compose applies them automatically. Without Docker:

   ```bash
   export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar
   pnpm --filter api migrate
   ```

## Commit Convention

We use **Conventional Commits**:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code change without feature fix
- `test:` adding or updating tests
- `ci:` CI/CD changes
- `chore:` maintenance

## Pull Request Process

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/my-feature main
   ```

2. **Ensure all checks pass**:
   - `ruff check`, `ruff format`, `mypy`
   - `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck`
   - All unit tests with ≥80% coverage
   - Migration up/down cycle passes
   - Cross-tenant isolation tests pass
   - `gitleaks` secret scanning passes

3. **Open a PR** against `main` with:
   - Clear description of changes
   - Link to related issue
   - Screenshots for UI changes
   - Test results

4. **Wait for review** — 2 approvals required

5. **Merge** — triggers staging deployment

6. **Verify staging** before promoting to production

## Secret Management

- **Never commit secrets** in any form
- Use `.env.local` for local development
- Use **platform secret store** (Vercel Env Variables, AWS Secrets Manager) for staging/production
- Run `gitleaks` before every commit
- If a secret is accidentally committed, **rotate it immediately**

## Testing

### Backend Tests

```bash
cd services/api
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar_test
PYTHONPATH=services/api python3 -m pytest tests/ -v --cov=app --cov-fail-under=80
```

### Frontend Tests

```bash
cd apps/web
pnpm run test
pnpm run test:e2e
pnpm run test:coverage
```

## Environment-Specific Configuration

| Environment | Env File          | Database      | Deploy                       |
| ----------- | ----------------- | ------------- | ---------------------------- |
| Local       | `.env.local`      | Local Docker  | `docker compose up`          |
| Staging     | `.env.staging`    | Staging DB    | Auto-deploy on merge to main |
| Production  | `.env.production` | Production DB | Manual approval required     |

## Key Rotation

See [KEY_ROTATION.md](../docs/KEY_ROTATION.md) for detailed procedures.

## Rollback

If a deployment fails:

1. **Web**: Automatic Vercel rollback or manual via `vercel rollback`
2. **API**: redeploy the previous image
3. **Database**: migrations are forward-only. Ship a fix-forward migration, or restore from backup /
   point-in-time recovery after a deliberate decision. Never edit an applied migration.

## Questions?

Contact the platform team or check [BRANCH_STRATEGY.md](../docs/BRANCH_STRATEGY.md).
