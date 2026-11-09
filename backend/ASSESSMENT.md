# AngelFoods implementation status

Last checked: 2026-10-22. This is a development-readiness snapshot, not production sign-off.

## Architecture

- Mobile/web client: Expo SDK 54, React Native, TypeScript, Expo Router.
- API: Node.js 22 HTTP server with TypeScript stripping. `npm run dev` loads `.env.development.local` and selects Prisma 7/PostgreSQL for the configured development target. JSON storage remains available through the explicit `npm run dev:json` command.
- Data: PostgreSQL Prisma schema and versioned SQL migrations. The migration guard allows `local` or the explicitly approved `angelfoods-dev` Neon endpoint and blocks production migration commands.
- Auth: bearer sessions stored by hash; ordinary signup cannot assign roles. Admin accounts are provisioned by a trusted backend script. Admin sign-in requires TOTP MFA, encrypted factor secrets, hashed one-time recovery codes, and recent MFA for sensitive changes.

## Verified in this pass

- Neon `angelfoods-dev` is the only remote database branch modified. All five repository migrations are applied; `prisma migrate status` reported the schema up to date. The production branch was not contacted for data changes.
- The guarded JSON import was applied to `angelfoods-dev`: 1 eligible user, profile, preferences, 1 audit event, 19 security events, and 1 revoked-session hash were created. The admin account and 3 pending registrations were skipped by policy. The source file is unchanged, its pre-import backup SHA-256 matches, and `npm run db:reconcile:dev` reports all source-backed rows matched. The source had no ledger, withdrawal, membership, order, product, or invoice rows.
- PostgreSQL integration passed for registration OTP, profile/session persistence, order/invoice ownership, fail-closed membership/cash-out requests, admin MFA/RBAC/recovery, audit, concurrent approvals, and logout revocation. Test-created rows are removed in `finally`.
- Backend unit/config tests, Prisma validation, TypeScript typecheck, and the PostgreSQL migration status check passed. Frontend lint was not rerun in this follow-up.
- Root release build was attempted and stopped during Expo static rendering because `EXPO_PUBLIC_API_BASE_URL` is not configured as a valid HTTPS backend URL.
- Admin permissions are seeded least-privilege: `SUPER_ADMIN` alone receives `ROLE_MANAGE`; standard admin roles do not.

## Feature status

| Area | Status | Remaining work |
| --- | --- | --- |
| Member authentication/profile/preferences | Partially implemented and verified against dev PostgreSQL | Production OTP delivery, password reset, distributed rate limiting, full mobile flow/recovery handling |
| Admin authentication | Backend MFA flow and protected routes verified against dev DB | Provision an actual initial admin using a trusted terminal; deploy with HTTPS and a persistent 32-byte MFA key; complete admin management APIs/UI |
| Referrals | Sponsor relationships and authorized paginated descendant reads persist | Placement rules and frontend visualization integration remain incomplete |
| Membership | Membership status read is persisted | Prices/policies unapproved; checkout and webhook processing are fail-closed in PostgreSQL runtime |
| Orders/invoices | PostgreSQL read/list/detail endpoints now verified with ownership-denial integration cases | No API for creating orders/invoices, no checkout flow, and Expo order screen still reads device AsyncStorage |
| Product catalog/cart/checkout | Schema exists | No complete PostgreSQL product/catalog/cart/checkout API or end-to-end UI integration verified |
| Wallet, rewards, cash-outs | Financial tables/schema exist | Cash-out and payout actions are disabled; reward/commission rules need approval; no real transaction has been run |
| Notifications | PostgreSQL list and owned read-state mutations exist | Delivery provider and full navigation coverage need verification |
| Uploads/profile images | Not complete | Persistent storage provider and authenticated upload endpoints are not configured |
| Operations | Dev server health/readiness exists | Production host, valid API URL, monitoring, alerting, backups and restore drill are not verified |

## Risks and required decisions

- No production deployment, production DB, backup restore, monitoring, or disaster-recovery exercise has been verified. Do not treat build or integration tests as production readiness.
- `EXPO_PUBLIC_API_BASE_URL` must point at the deployed HTTPS API before the release build can succeed. Do not set a placeholder URL.
- Production `MFA_ENCRYPTION_KEY` must be a durable secret from a secret manager. Loss of this key prevents decrypting admin TOTP seeds. The local dev key is not a production secret.
- Current process-local rate limiting is not shared across server instances and should be replaced with a distributed limiter before horizontal scaling.
- PostgreSQL registration is testable only with the explicitly enabled development OTP mode; production registration remains unavailable until a real OTP delivery provider is configured.
- Payment checkout, webhooks, commissions, withdrawals, and payout review remain disabled until the merchant account, sandbox credentials, approved prices, and written rules are supplied and tested.
- Client-side product/cart/admin sample data still exists. It must not be presented as durable server data until corresponding protected APIs are implemented and connected.
- Set recovery-point/recovery-time objectives, data retention, privacy notice, Ghana privacy/legal obligations, and support process before launch.

## Safe development commands

From `backend/`:

```powershell
npm run dev:postgres
npm run test
npm run typecheck
npm run prisma:validate
npm run test:postgres:dev
npm run db:import:dry-run
npm run db:reconcile:dev
```

`npm run db:import:apply:dev` is restricted to the explicitly configured `angelfoods-dev` branch. Review its dry-run first; administrator credentials and pending OTP registrations are intentionally excluded.

The `test:postgres:dev` script is guarded to `angelfoods-dev` and uses disposable test users. Apply migrations only after reviewing SQL, with `DATABASE_TARGET=angelfoods-dev`, `NEON_BRANCH=angelfoods-dev`, the expected endpoint ID, and `CONFIRM_DB_MIGRATION=angelfoods-dev` set. Never use these commands against production.

## Release decision

**NO-GO for production.** Dev persistence and the initial admin-auth security slice are verified, but the production API URL, OTP delivery, operational controls, order/invoice/product backend, storage, and payment/financial rules are incomplete or unverified.
