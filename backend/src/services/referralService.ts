import type { Database, User } from "../models/types.ts";

export const createReferralCode = (fullName: string, existingCodes: Set<string>) => {
  const base =
    fullName
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 8)
      .toUpperCase() || "ANGEL";
  let code = `${base}${Math.floor(1000 + Math.random() * 9000)}`;

  while (existingCodes.has(code)) {
    code = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  return code;
};

export const findReferrer = (data: Database, referralCode?: string) => {
  if (!referralCode) return null;

  const referrer = data.users.find(
    (user) => user.referralCode.toUpperCase() === referralCode.toUpperCase()
  );

  if (!referrer) {
    throw new Error("Referral code was not found.");
  }

  if (referrer.status !== "ACTIVE") {
    throw new Error("Referral code is not active.");
  }

  return referrer;
};

export const assertNoReferralLoop = (
  data: Database,
  newUserId: string,
  referrer: User | null
) => {
  const visited = new Set<string>([newUserId]);
  let cursor = referrer;

  while (cursor) {
    if (visited.has(cursor.id)) {
      throw new Error("Referral loop detected.");
    }

    visited.add(cursor.id);
    cursor = cursor.referrerId
      ? data.users.find((user) => user.id === cursor?.referrerId) ?? null
      : null;
  }
};

export const getNetworkUserIds = (data: Database, rootUserId: string) => {
  const ids = new Set<string>();
  const queue = [rootUserId];

  while (queue.length) {
    const current = queue.shift();
    if (!current || ids.has(current)) continue;

    ids.add(current);
    data.users
      .filter((user) => user.referrerId === current)
      .forEach((child) => queue.push(child.id));
  }

  return ids;
};
