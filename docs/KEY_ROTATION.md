# Key Rotation Runbook

## Overview

All secrets and API keys are rotated through the **platform secret store** (Vercel Environment Variables, AWS Secrets Manager, or equivalent). No secret ever lives in committed files, CI logs, or client bundles.

## Supported Secrets

| Secret Name             | Type        | Rotation Frequency | Stored In             |
| ----------------------- | ----------- | ------------------ | --------------------- |
| `SECRET_KEY`            | Auth        | 90 days            | Platform secret store |
| `DATABASE_URL`          | Database    | 180 days           | Platform secret store |
| `GOOGLE_MAPS_API_KEY`   | Third-party | 180 days           | Platform secret store |
| `STRIPE_SECRET_KEY`     | Payment     | 180 days           | Platform secret store |
| `STRIPE_WEBHOOK_SECRET` | Payment     | 90 days            | Platform secret store |
| `IMAGEKIT_PRIVATE_KEY`  | Third-party | 180 days           | Platform secret store |
| `OPEN_METEO_API_KEY`    | Third-party | 365 days           | Platform secret store |
| `SENTRY_DSN`            | Monitoring  | 365 days           | Platform secret store |
| `POSTHOG_API_KEY`       | Analytics   | 365 days           | Platform secret store |
| `REDIS_URL`             | Cache       | 180 days           | Platform secret store |

## Rotation Procedures

### 1. Rotate Auth Secret (`SECRET_KEY`)

**Impact**: Invalidates all active sessions. Users must re-authenticate.

1. **Generate new key**:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```
2. **Add new key to secret store** alongside the old key
3. **Update all environments**:
   ```bash
   # Vercel
   vercel env add SECRET_KEY production
   vercel env add SECRET_KEY staging

   # Or via AWS Secrets Manager
   aws secretsmanager put-secret-value \
     --secret-id mshwar/production/SECRET_KEY \
     --secret-string '{"new": "...", "old": "..."}'
   ```
4. **Deploy with both keys active** — old key still validates sessions, new key creates new ones
5. **After 24 hours**: Remove old key from secret store
6. **Verify**: Check that all sessions are re-authenticated and no errors occur

**Rollback**: If issues arise, redeploy with old key restored. Sessions will continue working.

### 2. Rotate Database Credentials

**Impact**: Brief connection interruption during switchover.

1. **Generate new credentials** in the database platform
   ```sql
   -- PostgreSQL
   CREATE ROLE mshwar_backend_new WITH LOGIN PASSWORD 'new_password';
   GRANT ALL PRIVILEGES ON DATABASE mshwar_production TO mshwar_backend_new;
   GRANT ALL PRIVILEGES ON SCHEMA app TO mshwar_backend_new;
   ```
2. **Update connection string** in the secret store
   ```bash
   vercel env add DATABASE_URL production
   ```
3. **Deploy** to staging first, then production
4. **Verify** all connections work with new credentials
5. **Remove old credentials** from database
   ```sql
   DROP ROLE mshwar_backend;
   ```
6. **Update `004_security.sql`** to reflect new role name if changed

**Rollback**: Redeploy with old `DATABASE_URL`. No database surgery needed.

### 3. Rotate Third-Party API Keys (Google Maps, Stripe, etc.)

1. **Generate new key** in the provider dashboard
   - Google Cloud Console → APIs & Services → Credentials
   - Stripe Dashboard → Developers → API Keys
2. **Add new key to secret store**
   ```bash
   vercel env add GOOGLE_MAPS_API_KEY production
   ```
3. **Deploy** to staging first
4. **Verify** the new key works by making a test API call
5. **Remove old key** from the provider dashboard
6. **Redeploy** to production

**Rollback**: Add old key back to secret store and redeploy.

### 4. Rotate Monitoring & Analytics Keys

1. **Generate new key** in Sentry/PostHog dashboard
2. **Add to secret store**
3. **Deploy** and verify data flows to new project
4. **Remove old key** from provider dashboard

## Environment-Specific Rotation

### Local Development

- Secrets come from `.env.local` or the local secret store
- Rotate locally using `python-dotenv` or manual `.env.local` update
- **Never commit** `.env.local` changes

### Staging

- Secrets come from Vercel Staging Environment Variables
- Rotate via Vercel CLI or dashboard
- **Always test** in staging before promoting to production

### Production

- Secrets come from Vercel Production Environment Variables
- Requires **manual approval** via GitHub Environments
- **Always rotate** with both old and new keys active for 24 hours

## Automation

### Scheduled Rotation Check

Add a scheduled GitHub Action to remind about upcoming key expirations:

```yaml
# .github/workflows/key-rotation-reminder.yml
name: Key Rotation Reminder
on:
  schedule:
    - cron: "0 9 1 * *" # 1st of every month at 9 AM
jobs:
  check-rotation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check key age
        run: |
          echo "Review key rotation schedule"
          echo "Last rotation date stored in secret store metadata"
```

### Post-Rotation Verification

After any rotation, verify:

- [ ] All services start without errors
- [ ] Health check passes on all environments
- [ ] API responses return valid data
- [ ] No secrets in CI logs or build output
- [ ] No secrets in client bundle (`NEXT_PUBLIC_` only)
- [ ] Cross-tenant RLS policies still enforce isolation

## Audit Trail

Every key rotation is recorded:

- **Who** performed the rotation
- **When** it was done
- **Which environment** was updated
- **Old key ID** (for audit)
- **New key ID** (for audit)
- **Verification status**

Access the audit log via your platform's secret store history.

## Emergency Rotation

If a secret is **compromised**:

1. **Immediately rotate** the compromised key
2. **Revoke** the old key at the provider
3. **Deploy** to all environments simultaneously
4. **Notify** affected users if auth tokens are compromised
5. **Post-incident review** within 24 hours
6. **Document** the incident and lessons learned
