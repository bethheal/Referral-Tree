# Testing and Release Checklist

## Local checks

```powershell
npm run backend:typecheck
npm run backend:test
npm run prisma:validate --prefix backend
npm run lint
```

Current result: first three pass; lint has eight warnings and no errors.

## Required coverage

- Phone/database uniqueness, OTP, sessions/logout/recovery/rate limits.
- Server-time FREE expiry/access restriction.
- Referral cap, levels, loops, assisted signup, correction audit.
- Step gating, direct/wallet payment, payment signature/replay/reversal/reconciliation.
- Commission totals/holds/fallback/reversal and ledger/reserve invariants.
- Withdrawal permissions/self-approval/payout failure.
- Package/order/stock/refund permissions and concurrency.
- Admin MFA/RBAC/escalation prevention/audit.

## Release gates

- [ ] HTTPS staging API configured for release build.
- [ ] SDK-compatible dependency validation and Android/iOS builds smoke-tested.
- [ ] Staging migrations tested from empty and prior baseline.
- [ ] Guarded PostgreSQL integration tests pass on isolated data.
- [ ] Payment provider sandbox/webhook/reconciliation tests pass.
- [ ] Shared limits, logging, error tracking, readiness, backup/restore verified.
- [ ] Security/privacy/legal review complete.
- [ ] Owner decisions resolved or affected features remain disabled.

Never mark mocked, skipped, or failed checks as passed.
