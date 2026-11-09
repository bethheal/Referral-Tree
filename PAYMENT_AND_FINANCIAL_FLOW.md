# Payment and Financial Flow

## Current status

PostgreSQL membership checkout, webhooks, commissions, and withdrawals are deliberately disabled. Do not bypass these gates.

## Required payment flow

1. Backend validates member/plan/package/price/idempotency key.
2. One transaction creates a unique-reference `PENDING` payment.
3. Verified provider callback/webhook is signature-checked and independently verified.
4. One transaction records immutable event, transitions payment exactly once, grants entitlement/order, and posts eligible ledger entries.
5. Duplicates/out-of-order events must not duplicate payments, commissions, or memberships.
6. Refunds/reversals create compensating ledger/audit entries, never edited history.

## Commission and wallet

- Policy must be versioned: plan, trigger, network depth, amount/rate, qualification, dates, status, hold, fallback, maximum. Super-admin alone can activate/change it, with audit.
- Ledger rows are immutable credits, debits, reservations, releases, payouts, and reversals. Keep pending/available/reserved/paid separate.
- Membership/product wallet debits and resulting entitlement/order must share one transaction.

## Withdrawal flow

Validate approved reserve policy; atomically create request/reservation; prohibit self-approval; mark paid only after provider confirmation; release on rejection/cancellation/failure; compensate provider reversals. All payout/KYC/fee/reserve rules remain unapproved, so withdrawal stays disabled.
