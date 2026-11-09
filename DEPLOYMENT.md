# AngelFoods deployment runbook

This runbook prepares a **payments-off** release. It does not authorize a
production deployment, access to a real account, or a money-feature launch.
Keep every `FEATURE_*` money flag set to `false` until written business,
provider, legal, and operational approval is complete.

## 1. Owner actions before staging

1. **OWNER ACTION:** Choose the Node.js host, production Neon project/branch,
   HTTPS API hostname, and Expo/EAS project. Record the responsible operator.
2. **OWNER ACTION:** In the host's secret manager, create `backend/.env.production`
   from [`backend/.env.production.example`](backend/.env.production.example).
   Do not create this file in git or send its values in chat.
3. **OWNER ACTION:** Generate unique values for `JWT_SECRET`, `OTP_PEPPER`, and
   `MFA_ENCRYPTION_KEY`. Use the actual HTTPS API URL and the exact allowed app
   origins. Keep all money flags `false` and leave Flutterwave values blank.
4. **OWNER ACTION:** Set `EXPO_PUBLIC_API_BASE_URL` in the Expo/EAS production
   environment to that same HTTPS API URL. This value is public and will be
   bundled into the client; do not put a secret in an `EXPO_PUBLIC_*` variable.

## 2. Build and validate

Run from the repository root in CI or an isolated build worker:

```powershell
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.json
npm run backend:typecheck
npm run backend:test
$env:EXPO_PUBLIC_API_BASE_URL = "https://api.example.com"
npm run build
```

The build must use a real staging/prod HTTPS API URL, never localhost or a
placeholder. In EAS, configure `EXPO_PUBLIC_API_BASE_URL` in the matching
environment rather than committing a `.env.production` file.

## 3. Migrate a disposable staging database

1. **OWNER ACTION:** Create a disposable staging Neon branch/database, not the
   production database.
2. Put its direct URL and endpoint ID in an isolated backend environment.
3. Review every migration SQL file, then run the migration only with the
   explicit confirmation required by Prisma configuration:

```powershell
Set-Location backend
$env:CONFIRM_DB_MIGRATION = "<approved-non-production-target>"
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma migrate status --schema prisma/schema.prisma
```

Do not run a production migration until Phase 2 has documented and tested the
backup, restore, rollback, and data-copy procedure.

## 4. Start the backend

Configure the host with the values from its secret manager, then start:

```powershell
Set-Location backend
npm ci --omit=dev
npm run start
```

The process must fail instead of starting if it has JSON storage, a non-HTTPS
API/origin, a missing/weak JWT or OTP secret, or database URLs that do not
identify the configured production endpoint.

## 5. Post-start checks

1. **OWNER ACTION:** Confirm the host exposes HTTPS and forwards only the
   intended origin(s).
2. Confirm registration stays unavailable until Phase 3 production SMS is
   configured and tested.
3. Confirm membership checkout, commissions, and withdrawals return their
   existing fail-closed responses with all money flags false.
4. **OWNER ACTION:** Run the Phase 6 physical-device smoke checklist before any
   public release.

## Rollback

Do not roll back schema by editing production data or running destructive
commands. Roll back the application to the previous immutable build, disable
traffic if necessary, and follow the Phase 2 tested restore procedure. Record
the incident, affected release version, and the operator who performed it.
