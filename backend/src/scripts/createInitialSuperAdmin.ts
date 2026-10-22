import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { createId, hashPassword } from "../utils/crypto.ts";
import { createReferralCode } from "../services/referralService.ts";

const target = process.env.DATABASE_TARGET;
const branch = process.env.NEON_BRANCH;
const endpointId = process.env.NEON_ENDPOINT_ID;
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (target === "production" || branch === "production") throw new Error("Initial admin bootstrap is blocked for production.");
if (!connectionString || (target !== "local" && target !== "angelfoods-dev")) throw new Error("Set DATABASE_TARGET and DATABASE_URL for a non-production database.");
const host = new URL(connectionString).hostname;
if (target === "local" && !["localhost", "127.0.0.1"].includes(host)) throw new Error("DATABASE_TARGET=local requires a localhost database URL.");
if (target === "angelfoods-dev" && (branch !== "angelfoods-dev" || !endpointId || !host.startsWith(`${endpointId}.`))) throw new Error("Database URL does not match the approved angelfoods-dev migration endpoint.");
if (!process.env.MFA_ENCRYPTION_KEY || Buffer.from(process.env.MFA_ENCRYPTION_KEY, "base64").length !== 32) throw new Error("Configure a base64-encoded 32-byte MFA_ENCRYPTION_KEY before creating the initial admin.");

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim().replace(/\s+/g, " ");
const password = process.env.ADMIN_PASSWORD;
const confirmation = process.env.CONFIRM_ADMIN_EMAIL?.trim().toLowerCase();
if (!email || confirmation !== email || !name || !password) throw new Error("Set ADMIN_EMAIL, CONFIRM_ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD in the trusted backend environment.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("ADMIN_EMAIL is invalid.");
if (name.length < 2 || name.length > 120) throw new Error("ADMIN_NAME must be 2 to 120 characters.");
if (password.length < 12 || password.length > 256) throw new Error("ADMIN_PASSWORD must be 12 to 256 characters.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const [existing, superAdminCount, codes] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
    prisma.user.findMany({ select: { referralCode: true } }),
  ]);
  if (existing) throw new Error("An account already exists with this email.");
  if (superAdminCount > 0) throw new Error("A super-admin already exists; use the authenticated role-management process.");
  const userId = createId("user");
  const timestamp = new Date();
  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.user.create({ data: {
      id: userId, email, fullName: name, phoneNumber: null,
      passwordHash: hashPassword(password),
      referralCode: createReferralCode(name, new Set(codes.map((item) => item.referralCode))),
      role: "SUPER_ADMIN", status: "ACTIVE", createdAt: timestamp,
      profile: { create: {} }, preferences: { create: {} },
    } });
    await tx.auditLog.create({ data: {
      actorUserId: null, targetUserId: account.id,
      action: "INITIAL_SUPER_ADMIN_PROVISIONED",
      newValue: { role: "SUPER_ADMIN" },
      reason: "Initial super-admin created by a trusted backend operator.",
    } });
    await tx.securityEvent.create({ data: { userId: account.id, type: "INITIAL_SUPER_ADMIN_PROVISIONED" } });
    return account;
  });
  console.log(JSON.stringify({ event: "initial_super_admin_created", email: user.email, nextStep: "Sign in and complete authenticator MFA enrollment before accessing admin APIs." }));
} finally {
  await prisma.$disconnect();
}
