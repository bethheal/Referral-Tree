# AngelFoods production readiness audit

**Audit date:** 2026-10-22  
**Scope:** Current working tree at audit time. The tree contained extensive pre-existing uncommitted changes; these were preserved.  
**Recommendation:** **RED — not ready for production.** No production deployment, production database access, payment transaction, or live migration was performed.

## 1. Executive assessment

The repository contains substantial groundwork: an Expo SDK 54 client, a Node HTTP API, a broad Prisma schema and migrations, user/admin authentication logic, local JSON and PostgreSQL paths, and guarded development integration scripts. However, this is not a production-capable release yet. The backend explicitly throws during startup in `NODE_ENV=production`; the release build also fails without a real HTTPS `EXPO_PUBLIC_API_BASE_URL`. PostgreSQL functionality is a subset of the legacy JSON API, product ordering/checkout and withdrawals are incomplete or deliberately disabled, and the client still stores order state on-device. Operational controls (production migration rollout, monitoring, backup/restore proof and deployment automation) are not evidenced in the repository.

The current state is useful for continued development and safe non-production testing, but it cannot be signed off for production, especially where customer funds, paid memberships, referrals or personal data are involved.

## 2. Findings

### P0 — Production backend cannot start

- **Severity:** Critical
- **Affected:** `backend/src/config/env.ts`, `backend/src/server.ts`, `backend/src/services/prismaClient.ts`
- **Evidence:** Production environment validation unconditionally throws `Production startup is blocked until the PostgreSQL adapter and reviewed migrations are installed.` after checking required values. The Prisma runtime selector accepts a production target, but the startup guard prevents it from serving requests. This is a positive fail-closed gate, but it also means production runtime has not been implemented/verified.
- **Impact:** No production API can launch from this source state. Simply removing the guard would expose partially implemented PostgreSQL routes and is unsafe.
- **Recommended fix:** Complete parity decisions for every production route, validate production connection pooling/TLS/timeouts, deploy migrations through a reviewed pipeline, then replace the unconditional guard only after staging end-to-end verification.
- **Dependencies / regression risk:** Requires provider credentials and a staging environment; route gaps and schema/migration mismatch risk. Do not unblock by bypassing the guard.

### P0 — Release build requires an unset deployment endpoint

- **Severity:** Critical
- **Affected:** `components/backendApi.ts`, root `package.json`
- **Evidence:** `npm run build` ran `expo export --platform web && npm run backend:typecheck` and failed during static rendering with `A valid HTTPS EXPO_PUBLIC_API_BASE_URL is required for release builds.` No endpoint was supplied. Expo documentation was requested at the SDK 54 URL; the documentation browser redirected to the current `latest` URL, so SDK-specific documentation could not be confirmed from that browser response. The installed Expo package is `~54.0.35`, React Native `0.81.5`, React `19.1.0`, and Expo Router `~6.0.24`, consistent with the SDK 54 generation.
- **Impact:** No release export has been produced. The configured production API itself is also blocked (P0 above).
- **Recommended fix:** Publish only after a real HTTPS staging/prod API endpoint and matching Expo public configuration are provisioned; run native Android/iOS release builds and smoke tests too.
- **Dependencies / regression risk:** Requires deployment config and a functioning API; avoid substituting localhost or a placeholder in a release build.

### P0 — Financial and commerce flows are not end-to-end

- **Severity:** Critical
- **Affected:** `backend/src/routes/postgresRouter.ts`, `backend/src/services/membershipService.ts`, `backend/src/services/financialService.ts`, `app/dashboard/{MembershipPlans,products,cart,orders,payments,earnings}.tsx`
- **Evidence:** Backend README explicitly says PostgreSQL membership checkout/webhooks and withdrawals fail closed pending credentials/rules; product/order/checkout APIs are not complete, and PostgreSQL order/invoice APIs are read-only. PostgreSQL route code returns `503` for unconfigured financial actions and `501` for unimplemented admin actions; Flutterwave sandbox handling is explicitly unconfigured on the PostgreSQL path. Client orders use device AsyncStorage. Schema models for products, orders and payments do not establish that the client can create or pay for them.
- **Impact:** Screens must not be interpreted as a working commerce or payout product. There is no verified provider settlement, idempotent order lifecycle or payout reconciliation in the live persistence path.
- **Recommended fix:** Define approved price/tax/refund/commission/withdrawal rules; implement provider sandbox flows with signed webhook verification, idempotency, reconciliation and ledger invariants; implement server-owned cart/order/stock flows; connect mobile to those endpoints and verify duplicates, retries and provider failures.
- **Dependencies / regression risk:** Merchant account, legal/business rules, provider sandbox and end-to-end QA. Financial state changes can cause duplicate charges, incorrect entitlement or loss of funds.

### P1 — Two persistence implementations create drift and data-loss risk

- **Severity:** High
- **Affected:** `backend/src/services/database.ts`, `backend/src/routes/router.ts`, `backend/src/routes/postgresRouter.ts`, `backend/src/scripts/importJsonToPostgres.ts`
- **Evidence:** The primary router selects either PostgreSQL or JSON at runtime. JSON writes replace a whole local file synchronously and have no inter-process locking or transaction support; README correctly calls this unsafe for concurrent production writes. PostgreSQL supports only a documented subset of features. A dry-run/import script exists, but no production data import, reconciliation, or cutover has been verified. The Prisma config guards schema writes to local/approved development targets.
- **Impact:** Deploying against the wrong `DATABASE_TARGET` can leave users on local JSON or encounter missing routes; any future cutover can omit or transform legacy records. Existing local JSON files may contain credentials and personal data.
- **Recommended fix:** Keep production fail closed; inventory and classify each local file, test import on a disposable database copy, reconcile per-table counts/checksums and foreign keys, and cut over with a documented rollback/retention plan. Avoid logging JSON row values.
- **Dependencies / regression risk:** Needs a backup of the source and a staging PostgreSQL target. Conversion rules (roles, amounts, orphan rows, dates and legacy revocations) require business review.

### P1 — Authentication and rate limits are not deployment-grade yet

- **Severity:** High
- **Affected:** `backend/src/middleware/rateLimit.ts`, `backend/src/routes/router.ts`, `backend/src/services/authService.ts`, `backend/src/config/env.ts`
- **Evidence:** The rate limiter uses a process-local `Map`, and README states it is unsuitable across multiple instances. It keys on `request.socket.remoteAddress`; a reverse proxy/load balancer can collapse clients to one address unless trusted proxy handling is designed, or be spoofable if proxy headers are later trusted naively. Production startup currently blocks, so this has not been exercised behind the intended host. The config correctly rejects dev secrets/OTP mode and requires HTTPS origins/API URL and Flutterwave settings.
- **Impact:** Distributed deployments can bypass per-process limits or rate-limit unrelated users; login and OTP abuse protection may not hold at scale.
- **Recommended fix:** Use a shared limiter (or gateway rate limits), explicitly configure trusted proxy hops, separate limits by route/account/IP, alert on abuse, and test the hosted topology. Keep secrets in the deployment secret manager.
- **Dependencies / regression risk:** Hosting topology and an external/shared store. Incorrect proxy configuration can weaken origin attribution or block legitimate traffic.

### P1 — Admin and PostgreSQL behavior is only partially verified

- **Severity:** High
- **Affected:** `backend/src/routes/postgresRouter.ts`, `backend/src/services/adminService.ts`, `app/admin/*`, `app/dashboard/admin.tsx`
- **Evidence:** The code includes server-side role checks, MFA/TOTP utilities and a guarded initial-super-admin script; the PostgreSQL integration test covers selected admin role/MFA/session/order ownership paths. The integration test was not run because it is explicitly guarded for a configured `angelfoods-dev` Neon branch and would create/delete remote fixtures. The README identifies several admin actions as unimplemented; a rendered admin UI is not proof of route support.
- **Impact:** The security posture and endpoint parity for real deployment remain unverified. A client-side admin guard cannot replace server authorization.
- **Recommended fix:** Generate a route-to-permission inventory, exercise every implemented action against disposable PostgreSQL, cover every admin role and MFA recovery/revocation path, and hide/disable unsupported controls until their routes exist.
- **Dependencies / regression risk:** Requires non-production DB and provisioned test accounts; admin changes can lock operators out if recovery is not tested.

### P1 — No operational readiness evidence

- **Severity:** High
- **Affected:** Repository deployment/operations configuration (none found in the inspected file inventory), `backend/README.md`
- **Evidence:** No deploy workflow, hosting manifest, production health/readiness probe, monitoring/alerting configuration, backup job, restore procedure or rollback runbook appeared in the repository inventory. The README states there has been no production deployment or backup restore drill.
- **Impact:** Incidents, corrupted data, provider outages and failed releases have no verified detection or recovery path.
- **Recommended fix:** Select hosting and ownership; add secret/config inventories, liveness/readiness endpoints, structured redacted logs, metrics/alerts, automated encrypted backups, point-in-time recovery where supported, restore drills, rollback and incident runbooks.
- **Dependencies / regression risk:** Cloud provider, database plan and operational owner. Health checks must distinguish process liveness from DB readiness without exposing sensitive details.

### P2 — Client persistence/network behavior and feature truth need QA

- **Severity:** Medium
- **Affected:** `components/backendApi.ts`, `app/dashboard/*`, `components/cartStore.ts`, `app/dashboard/orderStore.tsx`
- **Evidence:** Client API configuration intentionally rejects release builds without HTTPS. The README says orders remain in AsyncStorage; dashboard feature screens and data modules include UI paths that must be compared against available backend routes. No device-level build, offline/retry test or backend-client contract test was run.
- **Impact:** UI may show stale device-local state or offer controls unsupported by the selected backend runtime; failures may not survive navigation/restart or recover cleanly after network interruption.
- **Recommended fix:** Build a route coverage matrix, connect each supported screen to the real API, add request timeout/cancellation and clear offline/error states, migrate valuable state to server persistence, and run Android/iOS device smoke tests.
- **Dependencies / regression risk:** API contracts and staging endpoint. Changing local state formats can affect existing installs.

### P2 — Database backups, migrations and recovery are unverified

- **Severity:** High
- **Affected:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/*`, `backend/prisma.config.ts`, operations docs
- **Evidence:** Several migrations and a guard configuration are present. Schema validation was not completed in this audit because command process creation failed. No target database migration status or restore was checked; no production DB was accessed. Migration files are untracked in the current working tree and therefore must be deliberately committed/reviewed before any release.
- **Impact:** Schema correctness and deployment ordering are unproven; restore and rollback capability cannot be assumed from migration files alone.
- **Recommended fix:** Run Prisma validation and migration status on a disposable/local PostgreSQL instance; apply migrations in staging from an empty baseline and from the supported prior baseline; verify constraints and import compatibility; perform a timed backup restore drill.
- **Dependencies / regression risk:** Local disposable PostgreSQL or isolated Neon branch; migration changes can lock tables or invalidate data if not staged.

### P3 — Privacy/compliance and dependency review remain open

- **Severity:** Medium
- **Affected:** User data model and app/backend as a whole; `package-lock.json`, `backend/package-lock.json`
- **Evidence:** The app collects account/contact/profile, referral, security and potentially financial information. The repository lacks a verified privacy/retention/deletion policy, data-processing inventory, consent/legal review or incident procedure in the inspected materials. Lockfiles exist, but no vulnerability scan or license review was executed.
- **Impact:** Applicable consumer, privacy, payment and direct-selling obligations depend on launch jurisdictions and business model and cannot be inferred as satisfied by code.
- **Recommended fix:** Complete jurisdiction-specific legal/privacy review, minimize data and retention, document deletion/export and breach handling, review payment-card scope (use hosted provider checkout; do not store card details), and run a current dependency audit/SBOM process.
- **Dependencies / regression risk:** Business/jurisdiction decisions and organization security policies.

## 3. Feature integration matrix

| Feature | Frontend | API/business logic | PostgreSQL | External integration | Status |
|---|---|---|---|---|---|
| Registration/login/logout | Expo screens wired to API | Implemented in JSON and a PostgreSQL subset; session logic exists | Session persistence present in schema/runtime subset | OTP delivery is not complete; dev OTP is local-only | Partially implemented |
| Profile/preferences | Profile screen and API client | Validation and self-scoped profile service | PostgreSQL profile/preferences supported | Profile image storage absent | Partially implemented |
| Referrals | Referral screens and tree | Referral calculations exist in JSON; limited read paths in PostgreSQL | Schema relationships exist | No external provider | Partially implemented; persistence differs by runtime |
| Dashboard/earnings/commissions | Screens render summary/history | JSON financial summaries; payout paths gated | Ledger schema exists; production parity not demonstrated | No payout integration verified | Partially implemented; not financial-ready |
| Membership plans | Plans UI | JSON membership/payment code and configuration gates | PostgreSQL checkout/webhook is unconfigured | Flutterwave credentials required; no sandbox proof | Partially implemented / fail closed |
| Products/catalog | Product screen | PostgreSQL product/catalog mutation and checkout missing per README | Product schema exists | None verified | Mocked or hardcoded / incomplete |
| Cart/orders | Cart and order screens | PostgreSQL reads only; no order creation/checkout | Order schema exists | Payment workflow unverified | Device-local and partial |
| Payments/history | History UI | Reads supported in part; no verified end-to-end payment | Payment tables exist | Flutterwave runtime path incomplete | Partially implemented |
| Cash-outs/withdrawals | Earnings/payment account screens | Disabled pending business/financial rules | Withdrawal/ledger schema exists | Payout provider not configured | Disabled / incomplete |
| Notifications | Notification screen | Read and mark-read in API paths | PostgreSQL read/state subset | Push/email/SMS delivery absent | Partially implemented; delivery missing |
| Admin login/MFA/user management | Admin login/dashboard screens | Server checks and selected management actions | Admin/RBAC/audit/MFA persistence modeled | Authenticator app only; operations unverified | Partially implemented; integration test not run |
| File uploads | Profile UI may expose image affordance | No upload API confirmed | Image key field only | Storage provider absent | Missing |
| Deployment/monitoring/backups | N/A | Production start intentionally blocked | No production DB verified | Hosting/monitoring/backup provider not defined | Missing |

## 4. Database and persistence audit

- **Is PostgreSQL actually used?** The code has a Prisma 7 PostgreSQL adapter and runtime route selection when `DATABASE_TARGET` and `DATABASE_URL` are set. That proves an implementation path exists, not that production data is currently stored there. The default development adapter is JSON. Production startup is hard-blocked.
- **Schema:** The schema is broad and models unique identities, referrals, sessions, payments, ledger, withdrawals, stock reservations, invoices, audit and security events. Unique/index constraints exist, but full constraints, query plans and migration application were not verified against a running DB.
- **Transactions/concurrency:** PostgreSQL code contains transaction/concurrency handling for selected operations and maps Prisma unique/serialization errors. The JSON implementation is synchronous whole-file replacement with no locking/transaction guarantee. Full transaction coverage for order, payment, ledger and payout lifecycles is absent/unverified.
- **Migrations:** Four migration directories are present in the tree, but no DB migration command was run. Prisma configuration blocks production schema writes. Migration application and rollback must be validated on an isolated target.
- **JSON migration:** A dry-run/import script exists. No existing JSON data was read or imported in this audit; there is no verified reconciliation or cutover. Preserve source backups and validate transformations before any import.
- **Connection configuration:** Runtime expects a pooled `DATABASE_URL`; Prisma migration config prefers `DIRECT_URL`. A Neon endpoint guard exists for the development target. No real connection, TLS, pool sizing, timeout, failover or backup configuration was verified.
- **Backup and restore:** Not verified; README states no restore drill has occurred.

## 5. Security audit summary

- **Authentication:** Password hashing, signed bearer tokens, session records/revocations and admin MFA-related code exist. Production-grade OTP delivery, session expiration/revocation behavior at scale and secret rotation were not externally verified.
- **Authorization:** Route handlers contain server-side user/admin checks and object ownership filters for selected routes. PostgreSQL role changes have explicit permission checks and approval paths. Every endpoint/control pairing still needs systematic coverage; UI checks are not authorization.
- **Validation:** Request size limits, phone/profile validation, pagination limits, CORS allowlists and generic error handling are present. Review every PostgreSQL route and webhook path before launch; the in-memory rate limiter is not multi-instance safe.
- **Secrets:** `.env.example` contains placeholders only; no secret value is reproduced here. Config fails closed for missing production secrets. Environment files are gitignored. No repository secret scan was run.
- **Payments:** Webhook hash verification and provider-specific code exist in the JSON path; PostgreSQL provider processing is explicitly unconfigured. Never activate financial actions before signature, replay/idempotency, reconciliation and authorization tests pass.
- **Uploads/notifications:** No durable upload or delivery provider integration was verified.

## 6. Test and verification report

| Check | Result | Notes |
|---|---|---|
| Repository inventory and working-tree status | Completed | Large pre-existing modified/untracked set preserved. |
| Expo SDK docs at exact v54 URL | Inconclusive | Browser navigation redirected to `versions/latest`; exact v54 documentation content was not obtained. |
| `npm run build` | Failed | Expo web static export stopped because `EXPO_PUBLIC_API_BASE_URL` was not a valid HTTPS deployment URL. Backend typecheck stage did not run because the shell command uses `&&`. |
| `npm run backend:test` | Not run | Unified command process creation failed before the command started (`helper_unknown_error: setup refresh had errors`). |
| Root/backend TypeScript checks | Not run | Same process-creation failure. |
| `prisma validate` | Not run | Same process-creation failure; no DB command was attempted. |
| PostgreSQL integration test | Not run | Explicitly requires the approved `angelfoods-dev` Neon endpoint and creates/deletes fixtures; not safe to run without verified target configuration and authorization. |
| Database migration/status/import | Not run | No database or JSON data touched. |
| Dependency vulnerability scan | Not run | Network/package audit was not attempted. |
| Production deploy/backup restore/payment test | Not run | No external or financially consequential action performed. |

## 7. Prioritized implementation plan

### P0 — Establish a safe staging release path

1. **API runtime:** Finish PostgreSQL endpoint parity and remove the production startup block only after review. Acceptance: production-mode process starts only with validated secrets/DB; readiness checks; user/admin flows pass on staging.
2. **Release configuration:** Supply a real HTTPS staging API URL and produce Expo web plus Android/iOS release builds. Acceptance: clean build, no development URL/secrets embedded, authenticated smoke tests on physical/simulated devices.
3. **Commerce/financial scope:** Decide what launches. Implement or remove/hide unsupported products, orders, memberships and withdrawals. Acceptance: no misleading success UI; sandbox payment lifecycle, replay protection, idempotency and ledger reconciliation pass end-to-end before money features launch.

### P1 — Data, security and operations

1. **Persistence/cutover:** Review migrations/import on isolated PostgreSQL; reconcile source data; document rollback. Acceptance: repeatable migration from supported baseline, row-level reconciliation and tested rollback/recovery plan.
2. **Shared abuse controls:** Add shared rate limiting and proxy trust model. Acceptance: multi-instance tests demonstrate limits cannot be bypassed and client attribution is correct.
3. **Admin authorization:** Complete route-permission matrix and tests for all admin roles/actions. Acceptance: every admin mutation denied by default, audited, MFA/re-auth protected where required, and unsupported controls hidden.
4. **Operations:** Add health/readiness, dashboards, alerts, encrypted backups, restore drill and incident/deployment runbooks. Acceptance: measured restore objectives and successful staging recovery exercise.

### P2 — Mobile, feature completion and QA

1. Replace local-only order state with API-backed order state and migration plan for installed clients.
2. Add integration tests for all supported client routes, offline/retry behavior, account ownership, malformed payloads and rate limits.
3. Finish persistent profile image storage and notification delivery or remove unsupported UI.
4. Run Android and iOS release smoke tests, accessibility checks and supported device/network matrix.

### P3 — Governance and lifecycle

1. Complete privacy/data retention, deletion/export, legal and payment-scope review.
2. Add dependency/SBOM/license review and recurring vulnerability triage.
3. Document scaling limits, incident response, key rotation and release rollback ownership.

## 8. Implementation performed

No application code or production data was modified during this audit. The existing working tree contains extensive user changes, and the highest-severity issues require staging/provider decisions and complete feature verification; changing the production fail-closed gate or financial behavior without those prerequisites would reduce safety. This audit report is the only new deliverable.

## 9. Final sign-off

- **Verified completed:** Repository inspected; production guard and release endpoint gate observed; code and docs confirm deliberate fail-closed financial paths; safe release build attempted.
- **Unresolved critical risks:** Production backend cannot start; release build needs a real HTTPS API URL; payment, order, payout and PostgreSQL route parity are incomplete/unverified.
- **Tests/build:** Release build failed on missing HTTPS API configuration. Backend tests, TypeScript checks, Prisma validation and PostgreSQL tests were not completed.
- **Deployment/migration:** No production deployment or migration was attempted or verified.
- **Backup/restore:** No strategy or restore drill was verified; documentation says none has occurred.
- **Operational readiness:** No verified monitoring, alerting, runbooks or recovery procedure.
- **Recommendation: RED (NOT AT ALL).** Do not launch this working tree in production. Reassess after P0/P1 acceptance criteria are met and end-to-end staging, security, migration and restore evidence is available.
