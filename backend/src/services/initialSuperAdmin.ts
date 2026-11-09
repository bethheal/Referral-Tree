import type { Prisma } from "../generated/prisma/client.ts";
import { createId, hashPassword } from "../utils/crypto.ts";
import { createReferralCode } from "./referralService.ts";

export type InitialSuperAdminInput = { email: string; name: string; password: string };

export const validateInitialSuperAdminInput = (input: {
  email?: string;
  confirmation?: string;
  name?: string;
  password?: string;
  mfaEncryptionKey?: string;
}): InitialSuperAdminInput => {
  if (!input.mfaEncryptionKey || Buffer.from(input.mfaEncryptionKey, "base64").length !== 32) {
    throw new Error("Configure a base64-encoded 32-byte MFA_ENCRYPTION_KEY before creating the initial admin.");
  }
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim().replace(/\s+/g, " ");
  const password = input.password;
  const confirmation = input.confirmation?.trim().toLowerCase();
  if (!email || confirmation !== email || !name || !password) {
    throw new Error("Set ADMIN_EMAIL, CONFIRM_ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD in the trusted backend environment.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("ADMIN_EMAIL is invalid.");
  if (name.length < 2 || name.length > 120) throw new Error("ADMIN_NAME must be 2 to 120 characters.");
  if (password.length < 12 || password.length > 256) throw new Error("ADMIN_PASSWORD must be 12 to 256 characters.");
  return { email, name, password };
};

// Must be called inside a Prisma transaction. The transaction-scoped advisory
// lock serializes bootstrap attempts across processes without a schema change.
// The two integer keys form a stable, application-specific lock namespace.
export const provisionInitialSuperAdmin = async (
  tx: Prisma.TransactionClient,
  input: InitialSuperAdminInput,
) => {
  const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>`
    WITH held_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(1095122756, 1398095954)
    )
    SELECT COUNT(*) > 0 AS acquired FROM held_lock
  `;
  if (lock[0]?.acquired !== true) {
    throw new Error("Unable to acquire the initial super-admin provisioning lock.");
  }

  const [existing, administratorCount, codes] = await Promise.all([
    tx.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    // In the current Role enum, USER is the only non-administrator role.
    // Counting every other role also fails closed if another role is added.
    tx.user.count({ where: { role: { not: "USER" } } }),
    tx.user.findMany({ select: { referralCode: true } }),
  ]);
  if (existing) throw new Error("An account already exists with this email.");
  if (administratorCount > 0) {
    throw new Error("An administrator already exists; initial Super Admin provisioning requires an administrator-free database.");
  }

  const timestamp = new Date();
  const account = await tx.user.create({ data: {
    id: createId("user"),
    email: input.email,
    fullName: input.name,
    phoneNumber: null,
    passwordHash: hashPassword(input.password),
    referralCode: createReferralCode(input.name, new Set(codes.map((item) => item.referralCode))),
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    createdAt: timestamp,
    profile: { create: {} },
    preferences: { create: {} },
  } });
  await tx.auditLog.create({ data: {
    actorUserId: null,
    targetUserId: account.id,
    action: "INITIAL_SUPER_ADMIN_PROVISIONED",
    newValue: { role: "SUPER_ADMIN" },
    reason: "Initial super-admin created by a trusted backend operator.",
  } });
  await tx.securityEvent.create({ data: { userId: account.id, type: "INITIAL_SUPER_ADMIN_PROVISIONED" } });
  return account;
};
