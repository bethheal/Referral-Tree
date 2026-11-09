# AngelFoods Business Rules Approval

**Owner approval recorded:** 2026-11-04. Recommended defaults are approved for implementation. Real payments, commissions, and withdrawals remain disabled until provider credentials, KYC, and payout operations are separately configured and verified.

## How to use this document

Each decision has a concrete recommendation, viable alternative, effect, and activation status. An owner may approve a recommendation, choose an alternative, or amend it. Only an item marked **Approved for implementation** may enable its related rule.

## 1. Membership model

| Item | Decision |
| --- | --- |
| Question | What are the plans, access states, and activation rules? |
| Known information | Free is seven days; Silver GHS 70, Gold GHS 700, Step 3 GHS 7,000; payments are one-time. |
| Recommended default | Persist a seven-day Free membership at registration. Use server time and states: `FREE_ACTIVE`, `FREE_EXPIRED`, `UPGRADE_PENDING`, `ACTIVE`, `PROGRESSION_INCOMPLETE`, `ELIGIBLE_FOR_NEXT_STEP`, `PENDING_REVIEW`, `SUSPENDED`, `REVERSED`. Automatically activate a paid step only after a verified payment and all approved eligibility rules. |
| Alternative | Require admin review for every paid upgrade. |
| Consequence | Automatic activation reduces support work but depends on verified provider events. Manual review delays access and requires staffing/audit. |
| Database/app effect | Versioned plan records, memberships with timestamps/status/payment link, access-policy service, notifications. |
| Safely implement now | Trial state and read-only access calculation: yes. Paid activation: no. |
| Owner approval before activation | Yes, for paid-step eligibility and review exception policy. |
| Status | Recommended, awaiting approval |

### Gold package question

| Item | Decision |
| --- | --- |
| Question | Does Gold include a product package? |
| Known information | The briefs conflict: one says undecided, another says Gold includes a package. Package contents are not defined. |
| Recommended default | Treat membership and package purchase as separate transactions until a named package, quantity, fulfilment method, tax/shipping, and refund terms are approved. |
| Alternatives | Gold includes a specified package; or Gold grants an optional discounted package. |
| Consequence | Separate transactions prevent accidental stock/fulfilment obligations. Included-package activation must atomically create an entitlement/order. |
| Database/app effect | Optional future `membershipPlanPackage` entitlement and order snapshot. |
| Safely implement now | Catalogue/package data model: yes. Bundling: no. |
| Owner approval before activation | Yes. |
| Status | Recommended, awaiting approval |

### Seven-level progression question

| Item | Decision |
| --- | --- |
| Question | What precisely means “complete seven levels”? |
| Known information | Four-wide network is described as 4, 16, 64, 256, 1,024, and 4,096 members below a base member. |
| Recommended default | A step is complete only when every required position at levels 1–6 below the member is occupied by a qualifying member whose payment for the relevant step is confirmed and not reversed. The seventh displayed level is the final qualifying depth, giving 4 + 16 + 64 + 256 + 1,024 + 4,096 = 5,460 qualifying downline positions. The member’s own registration is not a network level. |
| Alternatives | Count occupied positions regardless of paid membership; or count successful qualifying transactions rather than active status. |
| Consequence | The recommendation avoids progression based on inactive/unpaid/refunded accounts, but makes completion substantially harder and requires immutable qualification snapshots. |
| Database/app effect | Configurable qualification policy, ancestry query/index, progress counts by level, membership/payment status checks. |
| Safely implement now | Reporting of raw depth: yes. Progression enforcement: no. |
| Owner approval before activation | Yes. |
| Status | Recommended, awaiting approval |

**Worked example:** A has 4 direct qualifying members, 16 qualifying grandchildren, through 4,096 qualifying members at sixth downline depth. A has 5,460 qualifying network positions and may become eligible for the next step. If one payment at depth four is reversed, A is no longer complete until that position is again qualifying. No upgrade is auto-created until this rule is approved.

## 2. Referral and assisted registrations

| Item | Decision |
| --- | --- |
| Question | How do sponsor, placement, direct credit, help, and commission differ? |
| Known information | An upline may help a direct downline; helper receives the commission; assisted people do not occupy positions under the helped member. |
| Recommended default | A signup always has an immutable sponsor/referral source. For an assisted signup, set sponsor, placement parent, referred-by, and direct-referral credit to the helper; record the helped member in `assistedBy`/assistance audit metadata only. It does not count toward the helped member’s direct-four or level completion. It may count toward the helper only if the owner separately approves that flag. |
| Alternative | Place the signup under the helped member while paying helper a service commission. |
| Consequence | Recommendation is consistent with “not placed under B”; it prevents hidden credits to B. The alternative changes B’s network and requires different commission policy. |
| Database/app effect | Preserve `sponsorId`, `placementParentId`; add `referredById`, `assistedById`, `networkPosition`, `referralSource`, `countsTowardLevelCompletion` only through reviewed migration. |
| Safely implement now | Service interfaces/audit design and read-only diagrams: yes. Placement writes: no. |
| Owner approval before activation | Yes. |
| Status | Recommended, awaiting approval |

### Assisted-referral worked example

Assume A is B’s direct upline and A registers C, D, E, F using A’s own referral code because B is inactive.

| Concept | A | B | C/D/E/F |
| --- | --- | --- | --- |
| Sponsor / placement parent | A | A’s existing sponsor/placement | A |
| Direct-referral credit | Four credits, if approved | No credit | N/A |
| Network position | A’s direct level | No child positions added | Directly below A |
| Assistance audit | Helper and registrar | Help recipient | Assisted-by A; assistance target B recorded |
| Commission recipient | A under approved qualifying policy | None merely because assistance occurred | Their own future uplines follow policy |
| B progression credit | N/A | None | N/A |

No historical commission is rewritten if staff later correct a relationship; a correction is an audited, effective-from-now administrative event unless an approved remediation workflow explicitly says otherwise.

## 3. Commission policy

| Item | Decision |
| --- | --- |
| Question | What Step 1 schedule should be configured? |
| Known information | Suggested per confirmed Step 1 payment: direct 25; then 10, 5, 2, 2, 1 GHS. The alternate description yields 100 + 160 + 320 + 512 + 2,048 + 4,096 = GHS 7,236 for a full network. |
| Recommended default | Use the distance-from-payer schedule at referral depths 1–6: 25, 10, 5, 2, 2, 1 GHS. A payer earns nothing from their own payment. Only an active, Silver-qualified upline can receive; an ineligible upline’s share passes to the next eligible upline only if explicitly approved, otherwise becomes company revenue. Hold commissions seven days before availability. |
| Alternatives | Hold an ineligible upline share for a defined cure period; or send it immediately to company revenue. |
| Consequence | This matches the supplied GHS 7,236 network total when each downline payment yields the stated depth payout. It does not define Step 2/3 schedules. |
| Database/app effect | Versioned commission rules, source payment reference, unique distribution key, ledger reference, status, effective date, audit. |
| Safely implement now | Schema/service framework in disabled/draft mode: yes. Real generation: no. |
| Owner approval before activation | Yes, including ineligible-upline treatment. |
| Status | Recommended, awaiting approval |

**Step 1 worked example:** If Z pays Silver and its qualified uplines are A (distance 1), B (2), C (3), D (4), E (5), F (6), credits are GHS 25, 10, 5, 2, 2, 1 respectively: GHS 45 total. If only A and B qualify, the remaining GHS 10/5/2/2/1 allocation follows the approved fallback rule; it must not be silently paid twice.

| Item | Decision |
| --- | --- |
| Question | What are Step 2 and Step 3 commissions? |
| Known information | GHS 250 and GHS 2,000 are mentioned, but recipient/depth/type are not defined. |
| Recommended default | Treat each as a draft, direct-referral-only amount with no active rule and zero deeper-level payouts until a complete policy is approved. |
| Alternative | Approve a complete depth/rate schedule for each step. |
| Consequence | Prevents accidental overpayment. |
| Database/app effect | Supports configured empty/deactivated schedules. |
| Safely implement now | Draft configuration only. |
| Owner approval before activation | Yes. |
| Status | Blocked |

## 4. Points and wallet

| Item | Decision |
| --- | --- |
| Question | What are points worth and where may they be used? |
| Known information | No final points rule exists. |
| Recommended default | Do not activate points. If later approved, points are a non-cash reward balance and cannot be withdrawn, converted, or mixed with GHS without an explicit conversion policy. |
| Alternative | Use points only for rank/progression. |
| Consequence | Prevents an implied monetary liability. |
| Database/app effect | Separate point ledger/currency. |
| Safely implement now | Separate ledger support only. |
| Owner approval before activation | Yes. |
| Status | Recommended, awaiting approval |

Wallet recommendation: use immutable ledger entries for pending commission, approved/available commission, reserve, product spend, withdrawal reservation, payout, adjustment, and reversal. Only audited compensating entries may correct a balance; staff must not edit balances directly.

## 5. Withdrawals

| Item | Decision |
| --- | --- |
| Question | How is the reserve calculated? |
| Known information | Examples: 100→40, 160→40, 320/510→140, 2,046/4,096→400 GHS reserve. The examples do not define boundaries or whether balance is cumulative. |
| Recommended default | Use a versioned, owner-configured reserve table with inclusive minimum/maximum balance ranges. Do not activate a default range from the examples. |
| Alternatives | Fixed tiers; formula; reserve based on current step. |
| Consequence | Table policy is auditable and can change prospectively; a formula can create unexpected discontinuities. |
| Database/app effect | `WithdrawalReservePolicy`/rule version and computed reservation record. |
| Safely implement now | Disabled workflow/data model only. |
| Owner approval before activation | Yes, including minimum/maximum, fees, KYC, provider, timing, cancellation/reversal. |
| Status | Recommended, awaiting approval |

**Illustrative table only:** for a policy whose approved range is GHS 100–160 with reserve GHS 40, a GHS 160 available ledger balance has a maximum withdrawal of GHS 120. For GHS 320 with an approved GHS 140 reserve, maximum withdrawal is GHS 180. These are examples, not activated rules.

Recommended workflow: validate account/KYC/balance → atomically create request plus reservation → different admin reviews → approved manual/provider payout → verify outcome → create payout/release/reversal ledger entry → notify member and reconcile. Real payouts remain disabled.

## 6. Payment provider and packages

| Item | Decision |
| --- | --- |
| Question | Is Flutterwave the approved provider? |
| Known information | It has been considered; no confirmed production provider/credentials/fees/settlement policy. |
| Recommended default | Integrate only a sandbox adapter behind configuration. Production credentials and webhooks remain off until provider is confirmed. |
| Alternative | Choose another provider with the same server-side adapter contract. |
| Consequence | Keeps provider-specific code isolated and retains verified signature/idempotency requirements. |
| Database/app effect | Provider/reference/event records and encrypted environment secrets. |
| Safely implement now | Sandbox architecture/tests without live credentials: yes. |
| Owner approval before activation | Yes. |
| Status | Recommended, awaiting approval |

Products are package-only. Create package catalogue records with editable content/price/status/image/availability. Do not invent contents, shipping, tax, stock, or refund terms; customer paid checkout stays disabled until they are supplied.

## 7. Admin and account policy defaults

| Item | Recommended default | Status |
| --- | --- | --- |
| Admin MFA | Mandatory MFA for every admin/super-admin; recent MFA for sensitive role/referral/financial changes. | Recommended, awaiting approval |
| First super-admin | Guarded, one-time backend provisioning; no client-side promotion. | Implemented and tested in development safeguards |
| Referral corrections | Super-admin only, reason/audit, prospective by default; no silent commission rewrite. | Recommended, awaiting approval |
| Account closure | Deactivate account; retain legally required financial/audit records; anonymize profile fields only after retention/legal approval. | Recommended, awaiting approval |
| Data deletion/export | Build an auditable request process after Ghana/privacy review; never delete ledger/audit evidence solely on request. | Blocked pending legal policy |

## Approval checklist

Before enabling paid features, approve or replace: Free benefits; Gold package treatment; seven-level qualification; assisted-referral counting; Step 1 fallback/hold; all Step 2/3 schedules; points; reserve rules; payout/KYC/fees/provider; package/order/refund rules; MFA and data-retention policies.
