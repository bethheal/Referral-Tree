# Angel Foods Backend

This backend owns sensitive Angel Foods business logic: registration, phone uniqueness, OTP verification, authentication, referral assignment, authorization, ledger balances, cash-out validation, and audit/security events.

Run locally:

```bash
cd backend
copy .env.example .env
npm run dev
```

The current implementation uses a file-backed development database so the API can run without adding frontend dependencies. `prisma/schema.prisma` defines the relational production model and constraints that should be used when moving to a managed database.
