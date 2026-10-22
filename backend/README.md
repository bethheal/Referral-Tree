# AngelFoods Backend

Node.js 22+ HTTP API with a development JSON adapter and a Prisma 7/PostgreSQL runtime. JSON storage is for local development and tests only; it is not safe for concurrent production writes.

## Local JSON development

```powershell
Copy-Item .env.example .env
npm run dev
```

Use `OTP_DEV_MODE=true` only on a private development machine. Do not use it in a deployed environment.

## PostgreSQL development

Create `backend/.env.development.local` using the approved `angelfoods-dev` pooled and direct Neon URLs, `DATABASE_TARGET=angelfoods-dev`, `NEON_BRANCH=angelfoods-dev`, the endpoint identifier, and a local `MFA_ENCRYPTION_KEY`. Do not commit the file or paste its contents into logs or chat.

```powershell
npm run prisma:validate
npm run prisma:check:dev
npm run dev:postgres
```

Migrations require a separate reviewed command with the explicit `CONFIRM_DB_MIGRATION=angelfoods-dev` target. The Prisma config blocks production migration commands and validates the Neon endpoint. Application queries should use the pooled URL; migrations use the direct URL.

The guarded remote integration test creates random member/admin fixtures and removes them in `finally`:

```powershell
npm run test:postgres:dev
```

## Admin account lifecycle

Ordinary registration only creates `USER` accounts. The initial `SUPER_ADMIN` must be provisioned once by an authorized operator in a trusted backend terminal, using `ADMIN_EMAIL`, `CONFIRM_ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD`. The script requires a nonproduction target and an MFA encryption key, refuses a production branch, and refuses to create a second super-admin. It does not print the password. The admin signs in through the Admin login screen using the same email/password identity, then must enroll an authenticator app and save the one-time recovery codes. No admin password is hardcoded in the client or source.

Admin login and sensitive server actions require backend role authorization. MFA secrets are encrypted at rest; recovery codes are stored as hashes. `SUPER_ADMIN` is the only seeded role with `ROLE_MANAGE`. Sensitive role/status changes require a recent MFA check and are audited. The development per-process rate limiter is not suitable across multiple server instances.

## PostgreSQL-backed capabilities

The PostgreSQL runtime currently supports member registration/login/logout, profile and preferences, account/dashboard summaries, membership status reads, referrals, account/payment history reads, order/invoice history and details, lead and notification reads, notification read state, plus the admin login/MFA and user-management slice. User-scoped routes use the authenticated server-side session and ownership checks. Orders and invoices are read-only: there is no PostgreSQL order creation, product catalog or checkout flow yet, and the current Expo orders screen still uses device AsyncStorage.

Membership checkout/webhooks and withdrawals fail closed until merchant sandbox credentials, approved plan pricing, and approved financial rules are configured. Product/order/checkout/invoice APIs, persistent profile-image storage, and OTP email/SMS delivery are not complete. Do not use local sample UI data as proof of server persistence.

## Verification status

The development branch currently has three applied migrations. `ASSESSMENT.md` records the dated integration and build results. The root Expo release build still requires a real HTTPS `EXPO_PUBLIC_API_BASE_URL`; do not put a placeholder there. This project is not production-ready and has not received a production deployment, backup restore drill, or external-payment test.
