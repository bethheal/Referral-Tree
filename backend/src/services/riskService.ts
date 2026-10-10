import type { Database, User } from "../models/types.ts";
import { createId, nowIso } from "../utils/crypto.ts";

export const recordRegistrationRiskSignals = (
  data: Database,
  user: User,
  context?: { ipAddress?: string; userAgent?: string }
) => {
  const signals: string[] = [];

  if (context?.ipAddress) {
    const recentSameIpRegistrations = data.securityEvents.filter(
      (event) =>
        event.type === "ACCOUNT_CREATED" &&
        event.ipAddress === context.ipAddress &&
        Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000
    );

    if (recentSameIpRegistrations.length >= 3) {
      signals.push("MULTIPLE_REGISTRATIONS_SAME_IP");
    }
  }

  if (user.referrerId) {
    const siblingAccounts = data.users.filter(
      (item) => item.referrerId === user.referrerId
    );
    const recentSiblingAccounts = siblingAccounts.filter(
      (item) => Date.now() - new Date(item.createdAt).getTime() < 60 * 60 * 1000
    );

    if (recentSiblingAccounts.length >= 5) {
      signals.push("HIGH_VELOCITY_REFERRALS");
    }
  }

  signals.forEach((signal) => {
    data.securityEvents.push({
      id: createId("security"),
      userId: user.id,
      type: "RISK_FLAG_CREATED",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: { signal },
      createdAt: nowIso(),
    });
  });

  return signals;
};
