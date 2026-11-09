# AngelFoods Implementation Plan

Preserve the existing Expo/Node/Prisma architecture. Financial flows remain disabled until approved.

## Phase 1 — audit and owner decisions (current)

1. Maintain this plan, the readiness audit, pending-decision register, and `BUSINESS_RULES_APPROVAL.md` as the source of decision status.
2. Obtain explicit approval for every item that activates money movement, membership progression, or referral placement.
3. Do not begin large schema/feature changes until relevant decisions are marked **Approved for implementation**.

## P0 — safety baseline

1. Review/commit current implementation work coherently.
2. Retain PostgreSQL-only production and guarded JSON development mode.
3. Map screens to supported backend routes and label unsupported controls.
4. Create staging secrets, shared rate limits, monitoring, readiness, backups, and restore drills.

## P1 — identity and access

1. Add configurable FREE plan with server-time start/expiry (7 days).
2. Return calculated `FREE`, `FREE_EXPIRED`, `SILVER`, `GOLD`, and `STEP3` access state.
3. Enforce purchase/restricted actions server-side; UI mirrors response.
4. Add upgrade notification/reminder policy and production OTP/account recovery after provider approval.

## P2 — referrals

1. Preserve sponsor, placement parent, referral source, and assisted-by independently.
2. After placement approval, add a scalable ancestry model (closure table/materialized path).
3. Enforce direct-four, cycle prevention, super-admin correction/audit, and level-one-to-seven reports.
4. Test inactive and helped-signup cases.

## P3 — catalogue/admin

1. Implement final permission matrix.
2. Add package entities/content snapshots and member-only backend purchase rule.
3. Complete orders/invoices after refund/cancellation policy approval.

## P4 — financial engine (blocked)

1. Versioned super-admin policy tables for plans, commissions, and reserves.
2. Provider sandbox initiation, webhook signatures, idempotency, reconciliation.
3. Immutable wallet ledger and transactional entitlement/order changes.
4. Commission holds, reversals, separation-of-duties withdrawal approval.

## P5 — release

Migrate/test staging, build Android/iOS against HTTPS API, perform payment replay/security/backup drills, and complete the release checklist.
