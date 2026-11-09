# Database and Migration Guide

## Safety

- Use separate approved development and production database URLs/targets.
- JSON is local development/testing only; production blocks it.
- Never commit environment files, secrets, payment credentials, or database URLs.
- Use reviewed Prisma migrations; never use `prisma db push`.

## Development workflow

```powershell
npm run db:check:dev --prefix backend
npm run prisma:validate --prefix backend
```

Review migration SQL first. Only then set the exact approved non-production confirmation target and run the reviewed migration command:

```powershell
$env:CONFIRM_DB_MIGRATION = 'angelfoods-dev'
```

Never run migration/reset/import/seed against production without explicit approval.

## Migration and cutover rules

- Prefer additive migrations and batch backfills; preserve history.
- Use transactions for financial, referral, membership, order, and payment writes.
- Test empty install, supported prior-schema upgrade, and representative import in staging.
- For JSON cutover: secure backup, dry run, disposable import, reconcile counts/foreign keys, freeze writes, final backup/import/validate, explicit approval, then retain read-only rollback source.

## Backup/recovery

Before production configure encrypted backups/PITR, owners, retention, RPO/RTO, access controls, and a documented timed restore drill.
