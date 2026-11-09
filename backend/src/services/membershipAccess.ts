export type MembershipAccessState =
  | "FREE_ACTIVE"
  | "FREE_EXPIRED"
  | "PAID_ACTIVE"
  | "NO_MEMBERSHIP";

export type MembershipAccessRecord = {
  code: "FREE" | "SILVER" | "GOLD" | "PREMIUM";
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "CANCELLED" | "REVOKED";
  startsAt: Date | null;
  expiresAt: Date | null;
};

export type MembershipAccess = {
  state: MembershipAccessState;
  activePlanCode: MembershipAccessRecord["code"] | null;
  expiresAt: Date | null;
  canPurchase: boolean;
};

const isActiveAt = (membership: MembershipAccessRecord, now: Date) =>
  membership.status === "ACTIVE" &&
  (!membership.startsAt || membership.startsAt <= now) &&
  (!membership.expiresAt || membership.expiresAt > now);

export const resolveMembershipAccess = (
  memberships: readonly MembershipAccessRecord[],
  now = new Date(),
): MembershipAccess => {
  const active = memberships.filter((membership) => isActiveAt(membership, now));
  const paid = active.find((membership) => membership.code !== "FREE");

  if (paid) {
    return {
      state: "PAID_ACTIVE",
      activePlanCode: paid.code,
      expiresAt: paid.expiresAt,
      canPurchase: true,
    };
  }

  const free = active.find((membership) => membership.code === "FREE");
  if (free) {
    return {
      state: "FREE_ACTIVE",
      activePlanCode: "FREE",
      expiresAt: free.expiresAt,
      canPurchase: false,
    };
  }

  const latestFree = memberships
    .filter((membership) => membership.code === "FREE")
    .sort((a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0))[0];

  if (latestFree) {
    return {
      state: "FREE_EXPIRED",
      activePlanCode: null,
      expiresAt: latestFree.expiresAt,
      canPurchase: false,
    };
  }

  return { state: "NO_MEMBERSHIP", activePlanCode: null, expiresAt: null, canPurchase: false };
};
