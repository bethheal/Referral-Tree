import assert from "node:assert/strict";
import { resolveMembershipAccess, type MembershipAccessRecord } from "../src/services/membershipAccess.ts";

const now = new Date("2026-11-04T12:00:00.000Z");
const free = (startsAt: string, expiresAt: string, status: MembershipAccessRecord["status"] = "ACTIVE"): MembershipAccessRecord => ({
  code: "FREE", status, startsAt: new Date(startsAt), expiresAt: new Date(expiresAt),
});

assert.deepEqual(
  resolveMembershipAccess([free("2026-11-01T12:00:00.000Z", "2026-11-08T12:00:00.000Z")], now),
  { state: "FREE_ACTIVE", activePlanCode: "FREE", expiresAt: new Date("2026-11-08T12:00:00.000Z"), canPurchase: false },
);
assert.equal(
  resolveMembershipAccess([free("2026-10-20T12:00:00.000Z", "2026-10-27T12:00:00.000Z")], now).state,
  "FREE_EXPIRED",
);
assert.deepEqual(
  resolveMembershipAccess([{ code: "SILVER", status: "ACTIVE", startsAt: now, expiresAt: null }], now),
  { state: "PAID_ACTIVE", activePlanCode: "SILVER", expiresAt: null, canPurchase: true },
);
assert.equal(resolveMembershipAccess([], now).state, "NO_MEMBERSHIP");
console.log("Membership access-state policy tests passed.");
