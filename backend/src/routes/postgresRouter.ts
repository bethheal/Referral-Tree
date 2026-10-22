import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";
import { Prisma } from "../generated/prisma/client.ts";
import { env } from "../config/env.ts";
import { enforceRateLimit } from "../middleware/rateLimit.ts";
import { prisma } from "../services/prismaClient.ts";
import { createId, createOtp, hashOtp, hashPassword, hashSessionToken, nowIso, signToken, verifyPassword, verifyToken } from "../utils/crypto.ts";
import { getRequestContext, HttpError, parsePagination, readJson, sendJson } from "../utils/http.ts";
import { createReferralCode } from "../services/referralService.ts";
import { normalizePhoneNumber } from "../validators/phone.ts";
import { createRecoveryCodes, createTotpSecret, decryptTotpSecret, encryptTotpSecret, hashRecoveryCode, verifyTotp } from "../utils/totp.ts";

const send = (response: ServerResponse, status: number, payload: unknown) => sendJson(response, status, payload);
const ok = (response: ServerResponse, payload: unknown) => send(response, 200, payload);
const created = (response: ServerResponse, payload: unknown) => send(response, 201, payload);
const sessionHours = 12;
const adminRoles = ["ADMIN", "SUPER_ADMIN", "FINANCE_ADMIN", "PRODUCT_MANAGER", "ORDER_MANAGER", "SUPPORT_ADMIN", "AUDITOR"] as const;
const isAdminRole = (role: string) => adminRoles.includes(role as typeof adminRoles[number]);
const minorToMajor = (amountMinor: bigint) => {
  if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER) || amountMinor < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new HttpError("Financial amount is outside the supported range.", 500, "AMOUNT_OUT_OF_RANGE");
  }
  return Number(amountMinor) / 100;
};

const publicUser = (user: {
  id: string; email: string; fullName: string; phoneNumber: string | null; referralCode: string;
}) => ({ id: user.id, email: user.email, fullName: user.fullName, phoneNumber: user.phoneNumber, referralCode: user.referralCode });

const recordSecurityEvent = async (data: {
  userId?: string | null; type: string; ipAddress?: string; userAgent?: string;
}) => prisma.securityEvent.create({
  data: {
    userId: data.userId ?? null,
    type: data.type,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  },
});

const bearer = (request: IncomingMessage) => {
  const value = request.headers.authorization;
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
};

const authenticate = async (request: IncomingMessage, allowAdminMfaChallenge = false) => {
  const token = bearer(request);
  const payload = token ? verifyToken(token) : null;
  if (!token || !payload) throw new HttpError("Invalid or expired session.", 401, "UNAUTHENTICATED");
  const session = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || session.user.status !== "ACTIVE") {
    throw new HttpError("Invalid or expired session.", 401, "INVALID_SESSION");
  }
  if (isAdminRole(session.user.role) && !session.mfaVerifiedAt && !allowAdminMfaChallenge) {
    throw new HttpError("Administrator MFA verification is required.", 403, "ADMIN_MFA_REQUIRED");
  }
  return { token, session, user: session.user };
};

const requireAdmin = async (request: IncomingMessage) => {
  const auth = await authenticate(request);
  if (!isAdminRole(auth.user.role)) {
    throw new HttpError("Admin permission required.", 403, "FORBIDDEN");
  }
  return auth;
};

const requireRecentMfa = (mfaVerifiedAt: Date | null) => {
  if (!mfaVerifiedAt || Date.now() - mfaVerifiedAt.getTime() > 10 * 60 * 1000) {
    throw new HttpError("Verify administrator MFA again before this sensitive action.", 403, "ADMIN_STEP_UP_REQUIRED");
  }
};

const requirePermission = async (
  actor: Awaited<ReturnType<typeof requireAdmin>>,
  permission: "USER_READ" | "USER_MANAGE" | "ROLE_MANAGE" | "PRODUCT_READ" | "PRODUCT_MANAGE" | "ORDER_READ" | "ORDER_MANAGE" | "PAYMENT_READ" | "PAYMENT_RECONCILE" | "AUDIT_READ" | "SYSTEM_CONFIGURE",
) => {
  const grant = await prisma.rolePermission.findUnique({ where: { role_permission: { role: actor.user.role, permission } } });
  if (!grant) throw new HttpError("This administrator role does not have permission for this action.", 403, "FORBIDDEN");
};

const requireAnyPermission = async (actor: Awaited<ReturnType<typeof requireAdmin>>, permissions: Array<"USER_MANAGE" | "ROLE_MANAGE">) => {
  const grants = await prisma.rolePermission.findMany({ where: { role: actor.user.role, permission: { in: permissions } }, select: { permission: true } });
  if (grants.length === 0) throw new HttpError("This administrator role does not have permission for this action.", 403, "FORBIDDEN");
};

const issueSession = async (
  transaction: Prisma.TransactionClient,
  user: { id: string; role: string },
  context: { ipAddress?: string; userAgent?: string },
  mfaVerifiedAt: Date | null = null,
) => {
  const token = signToken({ sub: user.id, role: user.role });
  // Administrator password-only sessions are MFA challenges, not full
  // authenticated sessions. Keep them short until MFA verification succeeds.
  const lifetimeMs = isAdminRole(user.role)
    ? 10 * 60 * 1000
    : sessionHours * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await transaction.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      mfaVerifiedAt,
    },
  });
  return token;
};

const validateName = (input: unknown) => {
  if (typeof input !== "string") throw new HttpError("Full name must be text.", 400, "INVALID_NAME");
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120 || !/^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(name)) {
    throw new HttpError("Enter a valid full name (2–120 characters).", 400, "INVALID_NAME");
  }
  return name;
};

const validateDateOfBirth = (input: unknown) => {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new HttpError("Date of birth must use YYYY-MM-DD format.", 400, "INVALID_DATE_OF_BIRTH");
  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== input) throw new HttpError("Enter a valid date of birth.", 400, "INVALID_DATE_OF_BIRTH");
  const today = new Date().toISOString().slice(0, 10);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const age = todayYear - year - (todayMonth < month || (todayMonth === month && todayDay < day) ? 1 : 0);
  if (input > today) throw new HttpError("Date of birth cannot be in the future.", 400, "INVALID_DATE_OF_BIRTH");
  if (age < 18) throw new HttpError("You must be at least 18 years old.", 400, "MINIMUM_AGE_NOT_MET");
  return date;
};

const profilePayload = async (userId: string) => {
  const [user, profile, preferences, membership] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.membership.findFirst({
      where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
      include: { plan: true }, orderBy: { expiresAt: "desc" },
    }),
  ]);
  return {
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    dateOfBirth: profile?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    profileImageUrl: null,
    membershipTier: membership?.plan.code.toLowerCase() ?? "free",
    preferences: { language: preferences?.language ?? "en", theme: preferences?.theme ?? "system" },
  };
};

const membershipState = async (userId: string) => {
  const [membership, payment] = await Promise.all([
    prisma.membership.findFirst({ where: { userId }, include: { plan: true }, orderBy: { createdAt: "desc" } }),
    prisma.payment.findFirst({ where: { userId, targetType: "MEMBERSHIP" }, include: { membershipPayment: { include: { plan: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    membership: membership ? {
      id: membership.id, userId, plan: membership.plan.code.toLowerCase(), status: membership.status,
      paymentReference: membership.membershipPaymentId ?? "", startsAt: membership.startsAt?.toISOString() ?? "",
      expiresAt: membership.expiresAt?.toISOString() ?? "", updatedAt: membership.updatedAt.toISOString(),
    } : null,
    latestPayment: payment ? {
      amount: Number(payment.amountMinor) / 100,
      createdAt: payment.createdAt.toISOString(),
      plan: payment.membershipPayment?.plan.code.toLowerCase() ?? "",
      reference: payment.reference,
      status: payment.status,
    } : null,
  };
};

const requireDevOtp = () => {
  if (!env.otpDevMode || env.environment === "production") {
    throw new HttpError("OTP delivery is not configured. Registration is unavailable.", 503, "OTP_DELIVERY_NOT_CONFIGURED");
  }
};

const registerOtp = async (request: IncomingMessage, response: ServerResponse) => {
  requireDevOtp();
  const input = await readJson<{ email?: unknown; fullName?: unknown; password?: unknown; phoneNumber?: unknown; referralCode?: unknown }>(request);
  if (typeof input.fullName !== "string" || typeof input.email !== "string" || typeof input.password !== "string" || typeof input.phoneNumber !== "string") {
    throw new HttpError("Registration details are invalid.");
  }
  if (input.fullName.length > 120 || input.email.length > 254 || input.password.length > 256) throw new HttpError("Registration details exceed the allowed length.");
  const fullName = validateName(input.fullName);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError("Enter a valid email address.");
  if (input.password.length < 8) throw new HttpError("Password must be at least 8 characters.");
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const referralCode = typeof input.referralCode === "string" && input.referralCode.trim() ? input.referralCode.trim().toUpperCase() : null;
  if (input.referralCode !== undefined && typeof input.referralCode !== "string") throw new HttpError("Referral code is invalid.");
  const [emailExists, phoneExists, referrer] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { phoneNumber }, select: { id: true } }),
    referralCode ? prisma.user.findUnique({ where: { referralCode }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (emailExists) throw new HttpError("This email is already registered.", 409, "EMAIL_EXISTS");
  if (phoneExists) throw new HttpError("This phone number is already registered.", 409, "PHONE_EXISTS");
  if (referralCode && !referrer) throw new HttpError("Referral code was not found.", 404, "REFERRAL_NOT_FOUND");
  const active = await prisma.registrationAttempt.findFirst({ where: { OR: [{ email }, { phoneNumber }], purpose: "REGISTRATION", status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (active && active.resendAvailableAt.getTime() > Date.now()) throw new HttpError("Please wait before requesting another OTP.", 429, "OTP_COOLDOWN");
  const otp = createOtp();
  const now = new Date();
  const attemptId = active?.id ?? createId("registration");
  const attemptData = {
    fullName, email, phoneNumber, passwordHash: hashPassword(input.password), referralCode, otpHash: hashOtp(otp),
    purpose: "REGISTRATION" as const, status: "PENDING" as const, otpAttempts: 0,
    otpExpiresAt: new Date(now.getTime() + env.otpTtlSeconds * 1000),
    resendAvailableAt: new Date(now.getTime() + env.otpResendCooldownSeconds * 1000),
    createdAt: now, verifiedAt: null,
  };
  if (active) await prisma.registrationAttempt.update({ where: { id: active.id }, data: attemptData });
  else await prisma.registrationAttempt.create({ data: { id: attemptId, ...attemptData } });
  created(response, { registrationId: attemptId, otp });
};

const completeRegistration = async (request: IncomingMessage, response: ServerResponse) => {
  requireDevOtp();
  const input = await readJson<{ otp?: unknown; registrationId?: unknown }>(request);
  if (typeof input.registrationId !== "string" || input.registrationId.length > 100 || typeof input.otp !== "string" || !/^\d{6}$/.test(input.otp)) {
    throw new HttpError("Registration verification details are invalid.");
  }
  const attempt = await prisma.registrationAttempt.findFirst({ where: { id: input.registrationId, purpose: "REGISTRATION", status: "PENDING" } });
  if (!attempt) throw new HttpError("Registration was not found.", 404, "NOT_FOUND");
  if (attempt.otpExpiresAt.getTime() < Date.now()) throw new HttpError("OTP has expired.", 400, "OTP_EXPIRED");
  if (attempt.otpAttempts >= env.otpMaxAttempts) throw new HttpError("Too many incorrect OTP attempts.", 429, "OTP_ATTEMPTS_EXCEEDED");
  if (attempt.otpHash !== hashOtp(input.otp)) {
    await prisma.registrationAttempt.updateMany({ where: { id: attempt.id, status: "PENDING", otpAttempts: { lt: env.otpMaxAttempts } }, data: { otpAttempts: { increment: 1 } } });
    throw new HttpError("Incorrect OTP.", 400, "OTP_INVALID");
  }
  const context = getRequestContext(request);
  const result = await prisma.$transaction(async (tx) => {
    const [emailExists, phoneExists, referrer, codes] = await Promise.all([
      tx.user.findUnique({ where: { email: attempt.email }, select: { id: true } }),
      attempt.phoneNumber ? tx.user.findUnique({ where: { phoneNumber: attempt.phoneNumber }, select: { id: true } }) : null,
      attempt.referralCode ? tx.user.findUnique({ where: { referralCode: attempt.referralCode }, select: { id: true } }) : null,
      tx.user.findMany({ select: { referralCode: true } }),
    ]);
    if (emailExists) throw new HttpError("This email is already registered.", 409, "EMAIL_EXISTS");
    if (phoneExists) throw new HttpError("This phone number is already registered.", 409, "PHONE_EXISTS");
    if (attempt.referralCode && !referrer) throw new HttpError("Referral code was not found.", 404, "REFERRAL_NOT_FOUND");
    const now = new Date();
    const id = createId("user");
    const referralCode = createReferralCode(attempt.fullName, new Set(codes.map((row) => row.referralCode)));
    const user = await tx.user.create({ data: {
      id, fullName: attempt.fullName, email: attempt.email, phoneNumber: attempt.phoneNumber, phoneVerifiedAt: now,
      passwordHash: attempt.passwordHash, referralCode, sponsorId: referrer?.id ?? null, placementParentId: referrer?.id ?? null,
      role: "USER", status: "ACTIVE", createdAt: now,
    } });
    await Promise.all([
      tx.profile.create({ data: { userId: id } }),
      tx.userPreferences.create({ data: { userId: id } }),
      tx.securityEvent.create({ data: { userId: id, type: "ACCOUNT_CREATED", ipAddress: context.ipAddress, userAgent: context.userAgent } }),
      tx.registrationAttempt.delete({ where: { id: attempt.id } }),
    ]);
    const token = await issueSession(tx, user, context);
    return { token, user: publicUser(user) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  created(response, result);
};

const login = async (request: IncomingMessage, response: ServerResponse, admin = false) => {
  const input = await readJson<{ email?: unknown; password?: unknown }>(request);
  if (typeof input.email !== "string" || typeof input.password !== "string" || input.email.length > 254 || input.password.length > 256) {
    throw new HttpError("Email or password is invalid.", 401, "LOGIN_FAILED");
  }
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const context = getRequestContext(request);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    await recordSecurityEvent({ userId: user?.id, type: admin ? "ADMIN_LOGIN_DENIED" : "LOGIN_FAILED", ...context });
    throw new HttpError("Login failed. Check email or password.", 401, "LOGIN_FAILED");
  }
  if (user.status !== "ACTIVE") throw new HttpError("Account is not active.", 403, "ACCOUNT_INACTIVE");
  if (admin && !isAdminRole(user.role)) {
    await recordSecurityEvent({ userId: user.id, type: "ADMIN_LOGIN_DENIED", ...context });
    throw new HttpError("Administrator access is not enabled for this account.", 403, "ADMIN_ACCESS_DENIED");
  }
  if (!admin && user.role !== "USER") throw new HttpError("Use administrator sign-in for this account.", 403, "ADMIN_LOGIN_REQUIRED");
  if (admin) {
    const factors = await prisma.mfaFactor.findMany({ where: { userId: user.id, method: "TOTP", revokedAt: null, verifiedAt: { not: null } }, select: { id: true } });
    const result = await prisma.$transaction(async (tx) => {
      await tx.securityEvent.create({ data: { userId: user.id, type: factors.length ? "ADMIN_PASSWORD_VERIFIED" : "ADMIN_MFA_ENROLLMENT_REQUIRED", ipAddress: context.ipAddress, userAgent: context.userAgent } });
      return issueSession(tx, user, context);
    });
    return ok(response, { token: result, user: publicUser(user), mfaRequired: factors.length > 0, mfaSetupRequired: factors.length === 0 });
  }
  const token = await prisma.$transaction(async (tx) => {
    await tx.securityEvent.create({ data: { userId: user.id, type: "LOGIN_SUCCESS", ipAddress: context.ipAddress, userAgent: context.userAgent } });
    return issueSession(tx, user, context);
  });
  ok(response, { token, user: publicUser(user) });
};

const beginAdminMfaSetup = async (request: IncomingMessage, response: ServerResponse) => {
  enforceRateLimit(`admin-mfa-setup:${request.socket.remoteAddress ?? "unknown"}`, 5, 60_000);
  const { user, session } = await authenticate(request, true);
  if (!isAdminRole(user.role)) throw new HttpError("Admin permission required.", 403, "FORBIDDEN");
  if (session.mfaVerifiedAt) throw new HttpError("MFA is already verified for this session.", 409, "MFA_ALREADY_VERIFIED");
  const verified = await prisma.mfaFactor.findFirst({ where: { userId: user.id, method: "TOTP", verifiedAt: { not: null }, revokedAt: null } });
  if (verified) throw new HttpError("An MFA factor is already active; enter its code to sign in.", 409, "MFA_ALREADY_ENROLLED");
  const key = process.env.MFA_ENCRYPTION_KEY;
  if (!key) throw new HttpError("Administrator MFA encryption is not configured.", 503, "MFA_NOT_CONFIGURED");
  const secret = createTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  const pending = await prisma.mfaFactor.findFirst({ where: { userId: user.id, method: "TOTP", verifiedAt: null, revokedAt: null } });
  if (pending) await prisma.mfaFactor.update({ where: { id: pending.id }, data: { secretCiphertext: encrypted } });
  else await prisma.mfaFactor.create({ data: { userId: user.id, method: "TOTP", secretCiphertext: encrypted, label: "Authenticator app" } });
  const label = encodeURIComponent(`AngelFoods:${user.email}`);
  const issuer = encodeURIComponent("AngelFoods");
  return ok(response, {
    secret,
    otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    instructions: "Add this key to an authenticator app, then enter its current six-digit code to finish setup. Store the recovery codes shown after verification.",
  });
};

const verifyAdminMfa = async (request: IncomingMessage, response: ServerResponse) => {
  const { user, session } = await authenticate(request, true);
  if (!isAdminRole(user.role)) throw new HttpError("Admin permission required.", 403, "FORBIDDEN");
  if (session.mfaVerifiedAt) throw new HttpError("MFA is already verified for this session.", 409, "MFA_ALREADY_VERIFIED");
  enforceRateLimit(`admin-mfa-verify:${session.id}`, 8, 5 * 60_000);
  const input = await readJson<{ code?: unknown }>(request);
  if (typeof input.code !== "string" || input.code.length > 100) throw new HttpError("Enter a valid authenticator or recovery code.", 400, "INVALID_MFA_CODE");
  const now = new Date();
  const factor = await prisma.mfaFactor.findFirst({ where: { userId: user.id, method: "TOTP", revokedAt: null, verifiedAt: { not: null } }, orderBy: { createdAt: "asc" } });
  const pending = factor ?? await prisma.mfaFactor.findFirst({ where: { userId: user.id, method: "TOTP", revokedAt: null, verifiedAt: null }, orderBy: { createdAt: "asc" } });
  if (!pending?.secretCiphertext) throw new HttpError("Set up administrator MFA before continuing.", 409, "MFA_SETUP_REQUIRED");
  let setupCompleted = false;
  let valid = false;
  let recoveryCodeId: string | null = null;
  if (/^\d{6}$/.test(input.code)) {
    try { valid = verifyTotp(decryptTotpSecret(pending.secretCiphertext), input.code); }
    catch { throw new HttpError("Administrator MFA encryption is not configured correctly.", 503, "MFA_NOT_CONFIGURED"); }
  } else {
    const recoveryCodeHash = hashRecoveryCode(input.code.trim().toUpperCase());
    const recovery = await prisma.mfaRecoveryCode.findUnique({ where: { codeHash: recoveryCodeHash } });
    if (recovery && recovery.userId === user.id && !recovery.usedAt) {
      recoveryCodeId = recovery.id;
      valid = true;
    }
  }
  if (!valid) {
    await recordSecurityEvent({ userId: user.id, type: "ADMIN_MFA_FAILED", ...getRequestContext(request) });
    throw new HttpError("The authenticator or recovery code is incorrect.", 401, "MFA_INVALID");
  }
  setupCompleted = !pending.verifiedAt;
  const recoveryCodes = setupCompleted ? createRecoveryCodes() : [];
  await prisma.$transaction(async (tx) => {
    if (recoveryCodeId) {
      const consumed = await tx.mfaRecoveryCode.updateMany({ where: { id: recoveryCodeId, userId: user.id, usedAt: null }, data: { usedAt: now } });
      if (consumed.count !== 1) throw new HttpError("The recovery code has already been used.", 401, "MFA_INVALID");
    }
    await tx.mfaFactor.update({ where: { id: pending.id }, data: { verifiedAt: pending.verifiedAt ?? now, lastUsedAt: now } });
    await tx.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: now, expiresAt: new Date(Date.now() + sessionHours * 60 * 60 * 1000) } });
    if (setupCompleted) {
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((code) => ({ userId: user.id, codeHash: hashRecoveryCode(code) })) });
      await tx.auditLog.create({ data: { actorUserId: user.id, targetUserId: user.id, targetType: "USER", targetId: user.id, action: "ADMIN_MFA_ENROLLED", oldValue: { mfaEnabled: false }, newValue: { mfaEnabled: true, method: "TOTP" }, reason: "Administrator enrolled a TOTP factor.", ipAddress: getRequestContext(request).ipAddress } });
    }
    await tx.securityEvent.create({ data: { userId: user.id, type: "ADMIN_MFA_VERIFIED", ipAddress: getRequestContext(request).ipAddress, userAgent: getRequestContext(request).userAgent } });
  });
  return ok(response, { verified: true, recoveryCodes: setupCompleted ? recoveryCodes : undefined });
};

const updateProfile = async (request: IncomingMessage, response: ServerResponse) => {
  const { user } = await authenticate(request);
  const input = await readJson<Record<string, unknown>>(request);
  const allowed = new Set(["fullName", "dateOfBirth", "language", "theme"]);
  if (Object.keys(input).some((key) => !allowed.has(key)) || Object.keys(input).length === 0) throw new HttpError("Only name, date of birth, language, and theme can be changed here.", 400, "INVALID_PROFILE_FIELDS");
  const [profile, preferences] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.userPreferences.findUnique({ where: { userId: user.id } }),
  ]);
  const name = Object.hasOwn(input, "fullName") ? validateName(input.fullName) : user.fullName;
  const dob = Object.hasOwn(input, "dateOfBirth") ? validateDateOfBirth(input.dateOfBirth) : profile?.dateOfBirth ?? null;
  const language = Object.hasOwn(input, "language") ? input.language : preferences?.language ?? "en";
  const theme = Object.hasOwn(input, "theme") ? input.theme : preferences?.theme ?? "system";
  if (language !== "en" && language !== "fr") throw new HttpError("Language must be English or French.", 400, "INVALID_LANGUAGE");
  if (theme !== "light" && theme !== "dark" && theme !== "system") throw new HttpError("Theme must be light, dark, or system.", 400, "INVALID_THEME");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { fullName: name } });
    await tx.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, dateOfBirth: dob }, update: { dateOfBirth: dob } });
    await tx.userPreferences.upsert({ where: { userId: user.id }, create: { userId: user.id, language, theme }, update: { language, theme } });
    if (name !== user.fullName) await tx.auditLog.create({ data: { actorUserId: user.id, targetUserId: user.id, action: "PROFILE_NAME_UPDATED" } });
  });
  ok(response, await profilePayload(user.id));
};

const dashboard = async (userId: string) => {
  const [user, ledgers, withdrawals, allReferrals, directReferrals, leads, activity] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.ledgerEntry.findMany({ where: { userId } }),
    prisma.withdrawalRequest.findMany({ where: { userId } }),
    prisma.$queryRaw<Array<{ id: string }>>`WITH RECURSIVE network(id) AS (SELECT "id" FROM "User" WHERE "sponsorId" = ${userId} UNION SELECT u."id" FROM "User" u JOIN network n ON u."sponsorId" = n.id) SELECT id FROM network`,
    prisma.user.findMany({ where: { sponsorId: userId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, fullName: true, status: true, createdAt: true, _count: { select: { sponsoredUsers: true } } } }),
    prisma.lead.count({ where: { ownerUserId: userId } }),
    prisma.securityEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const sum = (entries: typeof ledgers) => entries.reduce((total, item) => total + Number(item.amountMinor) / 100, 0);
  const availableCredits = sum(ledgers.filter((item) => item.currency === "GHS" && item.state === "AVAILABLE"));
  const reserved = withdrawals.filter((item) => !["PAID", "REJECTED", "FAILED", "REVERSED"].includes(item.status)).reduce((total, item) => total + Number(item.amountMinor) / 100, 0);
  return {
    account: publicUser(user),
    financial: {
      availableBalance: Math.max(availableCredits - reserved, 0), cashOutRequested: reserved,
      paidOut: sum(ledgers.filter((item) => item.type === "WITHDRAWAL_PAYOUT" && item.state === "PAID")),
      pendingEarnings: sum(ledgers.filter((item) => item.currency === "GHS" && item.state === "PENDING")),
      potentialEarnings: 0, totalEarnings: sum(ledgers.filter((item) => item.currency === "GHS" && item.state !== "VOID")),
      totalPoints: sum(ledgers.filter((item) => item.currency === "POINTS" && item.state !== "VOID")),
    },
    referralLink: `${process.env.API_BASE_URL ?? "http://localhost:3001"}/register?ref=${user.referralCode}`,
    stats: { totalLeads: leads, totalReferrals: allReferrals.length },
    referralPreview: directReferrals.map((item) => ({ id: item.id, fullName: item.fullName, status: item.status, joinedAt: item.createdAt.toISOString(), directReferrals: item._count.sponsoredUsers })),
    recentActivity: activity.map((item) => ({ id: item.id, type: item.type, createdAt: item.createdAt.toISOString() })),
  };
};

const adminSummary = async () => {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const nonSuperAdminRoles = adminRoles.filter((role) => role !== "SUPER_ADMIN");
  const [total, active, pendingVerification, suspended, admins, superAdmins, memberships, pendingPayments, paidPayments, failedPayments, pendingCashOuts, failedLogins, deniedLogins] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "PENDING_VERIFICATION" } }), prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { role: { in: nonSuperAdminRoles } } }),
    prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
    prisma.membership.findMany({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } }, include: { plan: true } }),
    prisma.payment.count({ where: { targetType: "MEMBERSHIP", status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.payment.count({ where: { targetType: "MEMBERSHIP", status: "PAID" } }),
    prisma.payment.count({ where: { targetType: "MEMBERSHIP", status: "FAILED" } }),
    prisma.withdrawalRequest.count({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW"] } } }),
    prisma.securityEvent.count({ where: { type: "LOGIN_FAILED", createdAt: { gte: dayAgo } } }),
    prisma.securityEvent.count({ where: { type: "ADMIN_LOGIN_DENIED", createdAt: { gte: dayAgo } } }),
  ]);
  const countPlan = (code: string) => memberships.filter((item) => item.plan.code.toLowerCase() === code).length;
  return {
    accounts: { total, active, pendingVerification, suspended, admins, superAdmins },
    memberships: { totalActive: memberships.length, byPlan: { silver: countPlan("silver"), gold: countPlan("gold"), premium: countPlan("premium") }, pendingPayments, successfulPayments: paidPayments, failedPayments },
    cashOuts: { pendingReview: pendingCashOuts },
    security: { failedLoginsLast24Hours: failedLogins, deniedAdminLoginsLast24Hours: deniedLogins },
  };
};

const listAdminUsers = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const rawSearch = url.searchParams.get("search")?.trim();
  if (rawSearch && rawSearch.length > 100) throw new HttpError("Search query is too long.", 400, "INVALID_SEARCH");
  const where = rawSearch ? { OR: [
    { fullName: { contains: rawSearch, mode: "insensitive" as const } },
    { email: { contains: rawSearch, mode: "insensitive" as const } },
    { phoneNumber: { contains: rawSearch } },
  ] } : {};
  const [count, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { memberships: { where: { status: "ACTIVE", expiresAt: { gt: new Date() } }, include: { plan: true }, orderBy: { expiresAt: "desc" }, take: 1 } } }),
  ]);
  return { count, limit, offset, rows: rows.map((user) => ({
    id: user.id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber,
    role: user.role, status: user.status, membershipTier: user.memberships[0]?.plan.code.toLowerCase() ?? "free",
    membershipExpiresAt: user.memberships[0]?.expiresAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), referrerId: user.sponsorId,
  })) };
};

const adminAuditLog = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const action = url.searchParams.get("action")?.trim();
  const actorUserId = url.searchParams.get("actorUserId")?.trim();
  const targetId = (url.searchParams.get("targetId") ?? url.searchParams.get("targetUserId"))?.trim();
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  if (action && (action.length > 80 || !/^[A-Z0-9_]+$/.test(action))) throw new HttpError("Audit action filter is invalid.", 400, "INVALID_FILTER");
  if ((actorUserId && actorUserId.length > 120) || (targetId && targetId.length > 120)) throw new HttpError("Audit target filter is invalid.", 400, "INVALID_FILTER");
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (since) { const value = new Date(since); if (!Number.isFinite(value.getTime())) throw new HttpError("Since date is invalid.", 400, "INVALID_FILTER"); createdAt.gte = value; }
  if (until) { const value = new Date(until); if (!Number.isFinite(value.getTime())) throw new HttpError("Until date is invalid.", 400, "INVALID_FILTER"); createdAt.lte = value; }
  if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) throw new HttpError("Audit date range is invalid.", 400, "INVALID_FILTER");
  const where: Prisma.AuditLogWhereInput = { ...(action ? { action } : {}), ...(actorUserId ? { actorUserId } : {}), ...(targetId ? { OR: [{ targetId }, { targetUserId: targetId }] } : {}), ...(Object.keys(createdAt).length ? { createdAt } : {}) };
  const [count, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
  ]);
  return { count, limit, offset, rows: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) };
};

const listAdminMemberships = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const status = url.searchParams.get("status")?.trim();
  if (status && !["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "REVOKED"].includes(status)) throw new HttpError("Membership status filter is invalid.", 400, "INVALID_FILTER");
  const where = status ? { status: status as Prisma.MembershipWhereInput["status"] } : {};
  const [count, rows] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { user: { select: { id: true, fullName: true, email: true } }, plan: { select: { code: true, displayName: true, version: true } } } }),
  ]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, status: row.status, plan: row.plan, user: row.user, startsAt: row.startsAt?.toISOString() ?? null, expiresAt: row.expiresAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() })) };
};

const listAdminPayments = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const status = url.searchParams.get("status")?.trim();
  const targetType = url.searchParams.get("targetType")?.trim();
  if (status && !["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED", "REVERSED"].includes(status)) throw new HttpError("Payment status filter is invalid.", 400, "INVALID_FILTER");
  if (targetType && !["MEMBERSHIP", "PRODUCT_ORDER"].includes(targetType)) throw new HttpError("Payment target filter is invalid.", 400, "INVALID_FILTER");
  const where = { ...(status ? { status: status as Prisma.PaymentWhereInput["status"] } : {}), ...(targetType ? { targetType: targetType as Prisma.PaymentWhereInput["targetType"] } : {}) };
  const [count, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { user: { select: { id: true, fullName: true, email: true } }, events: { orderBy: { receivedAt: "desc" }, take: 5, select: { id: true, providerEventId: true, eventType: true, transactionId: true, payloadHash: true, signatureVerified: true, processingStatus: true, receivedAt: true, processedAt: true } } } }),
  ]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, reference: row.reference, providerTransactionId: row.providerTransactionId, targetType: row.targetType, provider: row.provider, amountMinor: row.amountMinor.toString(), currency: row.currency, status: row.status, user: row.user, createdAt: row.createdAt.toISOString(), paidAt: row.paidAt?.toISOString() ?? null, events: row.events.map((event) => ({ ...event, receivedAt: event.receivedAt.toISOString(), processedAt: event.processedAt?.toISOString() ?? null })) })) };
};

const listAdminPaymentEvents = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const status = url.searchParams.get("status")?.trim();
  if (status && !["RECEIVED", "VERIFIED", "PROCESSING", "PROCESSED", "IGNORED", "FAILED"].includes(status)) throw new HttpError("Payment event status filter is invalid.", 400, "INVALID_FILTER");
  const where: Prisma.PaymentEventWhereInput = status ? { processingStatus: status as Prisma.PaymentEventWhereInput["processingStatus"] } : { processingStatus: { in: ["RECEIVED", "FAILED"] } };
  const [count, rows] = await Promise.all([
    prisma.paymentEvent.count({ where }),
    prisma.paymentEvent.findMany({ where, orderBy: { receivedAt: "desc" }, skip: offset, take: limit, include: { payment: { select: { id: true, reference: true, status: true, amountMinor: true, currency: true, user: { select: { id: true, fullName: true, email: true } } } } } }),
  ]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, provider: row.provider, providerEventId: row.providerEventId, eventType: row.eventType, transactionId: row.transactionId, payloadHash: row.payloadHash, signatureVerified: row.signatureVerified, processingStatus: row.processingStatus, receivedAt: row.receivedAt.toISOString(), processedAt: row.processedAt?.toISOString() ?? null, payment: row.payment ? { ...row.payment, amountMinor: row.payment.amountMinor.toString() } : null })) };
};

const listAdminReferrals = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const [count, rows] = await Promise.all([
    prisma.user.count({ where: { sponsorId: { not: null } } }),
    prisma.user.findMany({ where: { sponsorId: { not: null } }, orderBy: { createdAt: "desc" }, skip: offset, take: limit, select: { id: true, fullName: true, status: true, createdAt: true, sponsor: { select: { id: true, fullName: true, email: true } }, _count: { select: { sponsoredUsers: true } } } }),
  ]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, fullName: row.fullName, status: row.status, joinedAt: row.createdAt.toISOString(), sponsor: row.sponsor, directReferrals: row._count.sponsoredUsers })) };
};

const listAdminLedger = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const userId = url.searchParams.get("userId")?.trim();
  if (userId && userId.length > 120) throw new HttpError("User filter is invalid.", 400, "INVALID_FILTER");
  const where = userId ? { userId } : {};
  const [count, rows] = await Promise.all([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { user: { select: { id: true, fullName: true, email: true } } } }),
  ]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, type: row.type, state: row.state, amountMinor: row.amountMinor.toString(), currency: row.currency, description: row.description, referenceId: row.referenceId, sourceType: row.sourceType, sourceId: row.sourceId, payoutEligible: row.payoutEligible, createdAt: row.createdAt.toISOString(), user: row.user })) };
};

const listAdminProducts = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const search = url.searchParams.get("search")?.trim();
  if (search && search.length > 100) throw new HttpError("Search query is too long.", 400, "INVALID_SEARCH");
  const where = search ? { OR: [{ sku: { contains: search, mode: "insensitive" as const } }, { name: { contains: search, mode: "insensitive" as const } }] } : {};
  const [count, rows] = await Promise.all([prisma.product.count({ where }), prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit })]);
  return { count, limit, offset, rows: rows.map((row) => ({ ...row, priceMinor: row.priceMinor.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), archivedAt: row.archivedAt?.toISOString() ?? null })) };
};

const listAdminOrders = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const status = url.searchParams.get("status")?.trim();
  if (status && !["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "READY_FOR_PICKUP", "DELIVERED", "CANCELLED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status)) throw new HttpError("Order status filter is invalid.", 400, "INVALID_FILTER");
  const where = status ? { status: status as Prisma.ProductOrderWhereInput["status"] } : {};
  const [count, rows] = await Promise.all([prisma.productOrder.count({ where }), prisma.productOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { user: { select: { id: true, fullName: true, email: true } }, items: true, invoices: { select: { id: true, invoiceNumber: true, status: true, totalMinor: true, currency: true } }, statusHistory: { orderBy: { createdAt: "desc" }, take: 5 } } })]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, orderNumber: row.orderNumber, status: row.status, currency: row.currency, subtotalMinor: row.subtotalMinor.toString(), taxMinor: row.taxMinor.toString(), discountMinor: row.discountMinor.toString(), shippingMinor: row.shippingMinor.toString(), totalMinor: row.totalMinor.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), user: row.user, items: row.items.map((item) => ({ id: item.id, sku: item.skuSnapshot, name: item.nameSnapshot, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor.toString(), lineTotalMinor: item.lineTotalMinor.toString(), currency: item.currency })), invoices: row.invoices.map((invoice) => ({ ...invoice, totalMinor: invoice.totalMinor.toString() })), statusHistory: row.statusHistory.map((history) => ({ ...history, createdAt: history.createdAt.toISOString() })) })) };
};

const listAdminInvoices = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const [count, rows] = await Promise.all([prisma.invoice.count(), prisma.invoice.findMany({ orderBy: { issuedAt: "desc" }, skip: offset, take: limit, include: { user: { select: { id: true, fullName: true, email: true } }, order: { select: { id: true, orderNumber: true, status: true } } } })]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, invoiceNumber: row.invoiceNumber, status: row.status, currency: row.currency, subtotalMinor: row.subtotalMinor.toString(), taxMinor: row.taxMinor.toString(), discountMinor: row.discountMinor.toString(), shippingMinor: row.shippingMinor.toString(), totalMinor: row.totalMinor.toString(), issuedAt: row.issuedAt.toISOString(), paidAt: row.paidAt?.toISOString() ?? null, user: row.user, order: row.order })) };
};

const listAdminNotifications = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const [count, rows] = await Promise.all([prisma.notificationDelivery.count(), prisma.notificationDelivery.findMany({ orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { notification: { select: { id: true, title: true, body: true, createdAt: true } }, user: { select: { id: true, fullName: true, email: true } } } })]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, channel: row.channel, status: row.status, attemptCount: row.attemptCount, lastErrorCode: row.lastErrorCode, sentAt: row.sentAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), notification: { ...row.notification, createdAt: row.notification.createdAt.toISOString() }, user: row.user })) };
};

const adminSecurityOverview = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const [count, admins] = await Promise.all([prisma.user.count({ where: { role: { not: "USER" } } }), prisma.user.findMany({ where: { role: { not: "USER" } }, orderBy: { createdAt: "asc" }, skip: offset, take: limit, select: { id: true, fullName: true, email: true, role: true, status: true, mfaFactors: { where: { verifiedAt: { not: null }, revokedAt: null }, select: { id: true, method: true, label: true, verifiedAt: true, lastUsedAt: true } }, sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true, lastSeenAt: true, userAgent: true, ipAddress: true, mfaVerifiedAt: true } } } })]);
  return { count, limit, offset, rows: admins.map((admin) => ({ id: admin.id, fullName: admin.fullName, email: admin.email, role: admin.role, status: admin.status, mfaEnabled: admin.mfaFactors.length > 0, mfaFactors: admin.mfaFactors.map((factor) => ({ ...factor, verifiedAt: factor.verifiedAt?.toISOString() ?? null, lastUsedAt: factor.lastUsedAt?.toISOString() ?? null })), sessions: admin.sessions.map((session) => ({ ...session, createdAt: session.createdAt.toISOString(), expiresAt: session.expiresAt.toISOString(), lastSeenAt: session.lastSeenAt?.toISOString() ?? null, mfaVerifiedAt: session.mfaVerifiedAt?.toISOString() ?? null })) })) };
};

const getAdminUserDetail = async (id: string) => {
  if (!id || id.length > 120) throw new HttpError("User id is invalid.", 400, "INVALID_USER_ID");
  const user = await prisma.user.findUnique({ where: { id }, select: {
    id: true, fullName: true, email: true, phoneNumber: true, role: true, status: true,
    createdAt: true, updatedAt: true, sponsorId: true,
    profile: { select: { profileImageKey: true } },
    memberships: { orderBy: { createdAt: "desc" }, take: 10, include: { plan: { select: { code: true, displayName: true } } } },
    mfaFactors: { where: { verifiedAt: { not: null }, revokedAt: null }, select: { id: true, method: true, label: true, verifiedAt: true, lastUsedAt: true } },
    sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true, lastSeenAt: true, userAgent: true, ipAddress: true, mfaVerifiedAt: true } },
  } });
  if (!user) throw new HttpError("User not found.", 404, "NOT_FOUND");
  return { ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), profile: user.profile, memberships: user.memberships.map((item) => ({ id: item.id, status: item.status, plan: item.plan, startsAt: item.startsAt?.toISOString() ?? null, expiresAt: item.expiresAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() })), mfaEnabled: user.mfaFactors.length > 0, mfaFactors: user.mfaFactors.map((factor) => ({ ...factor, verifiedAt: factor.verifiedAt?.toISOString() ?? null, lastUsedAt: factor.lastUsedAt?.toISOString() ?? null })), sessions: user.sessions.map((session) => ({ ...session, createdAt: session.createdAt.toISOString(), expiresAt: session.expiresAt.toISOString(), lastSeenAt: session.lastSeenAt?.toISOString() ?? null, mfaVerifiedAt: session.mfaVerifiedAt?.toISOString() ?? null })) };
};

const updateAdminUser = async (request: IncomingMessage, url: URL, actor: Awaited<ReturnType<typeof requireAdmin>>, targetId: string, action: "role" | "status") => {
  requireRecentMfa(actor.session.mfaVerifiedAt);
  if (!targetId || targetId.length > 120) throw new HttpError("User id is invalid.", 400, "INVALID_USER_ID");
  const body = await readJson<Record<string, unknown>>(request);
  const allowed = action === "role" ? ["role", "reason"] : ["status", "reason"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new HttpError("Request contains unsupported fields.", 400, "INVALID_FIELDS");
  const reasonInput = body.reason;
  if (typeof reasonInput !== "string" || reasonInput.trim().length < 8 || reasonInput.trim().length > 500) throw new HttpError("Reason must be between 8 and 500 characters.", 400, "INVALID_REASON");
  const reason = reasonInput.trim();
  if (action === "role" && actor.user.role !== "SUPER_ADMIN") throw new HttpError("Super-admin permission required.", 403, "FORBIDDEN");
  if (action === "role" && body.role !== "USER" && body.role !== "ADMIN") throw new HttpError("Role must be USER or ADMIN.", 400, "INVALID_ROLE");
  if (action === "status" && body.status !== "ACTIVE" && body.status !== "SUSPENDED") throw new HttpError("Status must be ACTIVE or SUSPENDED.", 400, "INVALID_ACCOUNT_STATUS");
  if (actor.user.id === targetId) throw new HttpError(`You cannot change your own ${action}.`, 400, action === "role" ? "SELF_ROLE_CHANGE_DENIED" : "SELF_STATUS_CHANGE_DENIED");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetId } });
    if (!target) throw new HttpError("User not found.", 404, "NOT_FOUND");
    if (target.role === "SUPER_ADMIN") throw new HttpError("Super-admin accounts cannot be changed here.", 403, "PROTECTED_ADMIN_ACCOUNT");
    if (action === "status" && target.status === "PENDING_VERIFICATION") throw new HttpError("An unverified account cannot be activated or suspended through admin management.", 409, "ACCOUNT_NOT_VERIFIED");
    if (actor.user.role === "ADMIN" && target.role !== "USER") throw new HttpError("Only a super-admin can manage administrator accounts.", 403, "FORBIDDEN");
    const next = action === "role" ? String(body.role) : String(body.status);
    const old = action === "role" ? target.role : target.status;
    let bootstrapRoleChange = false;
    if (next !== old) {
      if (action === "role") {
        // Serialize the bootstrap check so parallel first-admin promotions
        // cannot both bypass the approved second-admin rule.
        const [bootstrapLock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(711902113) AS locked`;
        if (!bootstrapLock?.locked) throw new HttpError("Another administrator role change is being processed. Retry shortly.", 409, "CONCURRENT_UPDATE");
        const activeAdminCount = await tx.user.count({ where: { role: { not: "USER" }, status: "ACTIVE" } });
        const bootstrapException = activeAdminCount === 1 && target.role === "USER" && next === "ADMIN" && actor.user.role === "SUPER_ADMIN";
        bootstrapRoleChange = bootstrapException;
        if (!bootstrapException) {
          const existing = await tx.adminActionApproval.findFirst({ where: { action: "ADMIN_ROLE_CHANGE", targetType: "USER", targetId, status: "PENDING" } });
          if (existing) throw new HttpError("A role change is already awaiting a second administrator.", 409, "APPROVAL_ALREADY_PENDING");
          const approval = await tx.adminActionApproval.create({ data: {
            action: "ADMIN_ROLE_CHANGE", targetType: "USER", targetId,
            payload: { expectedRole: old, role: next }, reason,
            requestedByUserId: actor.user.id, requestIpAddress: getRequestContext(request).ipAddress,
            requestId: request.headers["x-request-id"]?.toString(),
          } });
          await tx.auditLog.create({ data: {
            actorUserId: actor.user.id, targetUserId: target.id, targetType: "USER", targetId: target.id, action: "ADMIN_ROLE_CHANGE_REQUESTED",
            oldValue: { role: old }, newValue: { requestedRole: next, approvalId: approval.id }, reason,
            requestId: request.headers["x-request-id"]?.toString(), ipAddress: getRequestContext(request).ipAddress,
          } });
          return { approvalRequired: true as const, approval: { id: approval.id, status: approval.status, action: approval.action, requestedAt: approval.requestedAt.toISOString() } };
        }
        await tx.user.update({ where: { id: target.id }, data: { role: next as "USER" | "ADMIN" } });
        // Role changes invalidate all old sessions so a demoted account cannot
        // retain privileged access through an already-issued token.
        await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      else {
        await tx.user.update({ where: { id: target.id }, data: { status: next as "ACTIVE" | "SUSPENDED" } });
        if (next === "SUSPENDED") await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditLog.create({ data: {
        actorUserId: actor.user.id, targetUserId: target.id, targetType: "USER", targetId: target.id,
        action: action === "role" ? "ADMIN_USER_ROLE_CHANGED" : "ADMIN_USER_STATUS_CHANGED",
        oldValue: action === "role" ? { role: old } : { status: old },
        newValue: action === "role" ? { role: next, ...(bootstrapRoleChange ? { bootstrapException: true } : {}) } : { status: next },
        reason, requestId: request.headers["x-request-id"]?.toString(),
        ipAddress: getRequestContext(request).ipAddress,
      } });
    }
    const membership = await tx.membership.findFirst({
      where: { userId: target.id, status: "ACTIVE", startsAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { startsAt: "desc" }, include: { plan: true },
    });
    return { id: target.id, fullName: target.fullName, email: target.email, phoneNumber: target.phoneNumber,
      role: action === "role" ? next : target.role, status: action === "status" ? next : target.status,
      membershipTier: membership?.plan.code.toLowerCase() ?? "free", membershipExpiresAt: membership?.expiresAt?.toISOString() ?? null,
      createdAt: target.createdAt.toISOString(), updatedAt: (next === old ? target.updatedAt : new Date()).toISOString(), referrerId: target.sponsorId };
  });
};

const listAdminApprovals = async (url: URL) => {
  const { limit, offset } = parsePagination(url.searchParams);
  const [count, rows] = await Promise.all([
    prisma.adminActionApproval.count({ where: { status: "PENDING" } }),
    prisma.adminActionApproval.findMany({ where: { status: "PENDING" }, orderBy: { requestedAt: "asc" }, skip: offset, take: limit, include: { requester: { select: { id: true, fullName: true, email: true, role: true } } } }),
  ]);
  return { count, limit, offset, rows: rows.map((row) => ({ id: row.id, action: row.action, targetType: row.targetType, targetId: row.targetId, payload: row.payload, reason: row.reason, status: row.status, requestedAt: row.requestedAt.toISOString(), requester: row.requester })) };
};

const decideAdminApproval = async (request: IncomingMessage, actor: Awaited<ReturnType<typeof requireAdmin>>, id: string) => {
  requireRecentMfa(actor.session.mfaVerifiedAt);
  const body = await readJson<Record<string, unknown>>(request);
  if (Object.keys(body).some((key) => !["decision", "reason"].includes(key))) throw new HttpError("Request contains unsupported fields.", 400, "INVALID_FIELDS");
  if (body.decision !== "APPROVED" && body.decision !== "REJECTED") throw new HttpError("Decision must be APPROVED or REJECTED.", 400, "INVALID_DECISION");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 8 || reason.length > 500) throw new HttpError("A decision reason of 8 to 500 characters is required.", 400, "INVALID_REASON");
  if (!id || id.length > 120) throw new HttpError("Approval id is invalid.", 400, "INVALID_APPROVAL_ID");
  return prisma.$transaction(async (tx) => {
    const approval = await tx.adminActionApproval.findUnique({ where: { id } });
    if (!approval) throw new HttpError("Approval request not found.", 404, "NOT_FOUND");
    if (approval.status !== "PENDING") throw new HttpError("This approval request has already been decided.", 409, "APPROVAL_ALREADY_DECIDED");
    if (approval.requestedByUserId === actor.user.id) throw new HttpError("A different administrator must decide this request.", 403, "SEPARATION_OF_DUTIES");
    if (approval.targetType === "USER" && approval.targetId === actor.user.id) throw new HttpError("The affected administrator cannot approve their own role change.", 403, "SEPARATION_OF_DUTIES");
    const now = new Date();
    if (body.decision === "REJECTED") {
      await tx.adminActionApproval.update({ where: { id }, data: { status: "REJECTED", approvedByUserId: actor.user.id, approvalIpAddress: getRequestContext(request).ipAddress, decidedAt: now } });
      await tx.auditLog.create({ data: { actorUserId: actor.user.id, targetUserId: approval.targetType === "USER" ? approval.targetId : null, targetType: approval.targetType, targetId: approval.targetId, action: "ADMIN_APPROVAL_REJECTED", oldValue: { status: "PENDING" }, newValue: { status: "REJECTED", approvalId: id }, reason, requestId: request.headers["x-request-id"]?.toString(), ipAddress: getRequestContext(request).ipAddress } });
      return { id, status: "REJECTED" as const };
    }
    if (approval.action !== "ADMIN_ROLE_CHANGE" || approval.targetType !== "USER") throw new HttpError("This approval action is not supported by the current policy.", 409, "APPROVAL_ACTION_UNSUPPORTED");
    const payload = approval.payload as { expectedRole?: unknown; role?: unknown };
    if (!(["USER", "ADMIN"].includes(String(payload.expectedRole))) || !(["USER", "ADMIN"].includes(String(payload.role)))) throw new HttpError("Stored approval details are invalid.", 409, "INVALID_APPROVAL_PAYLOAD");
    const target = await tx.user.findUnique({ where: { id: approval.targetId } });
    if (!target || target.role !== payload.expectedRole || target.role === "SUPER_ADMIN") throw new HttpError("The target account changed since this request was created.", 409, "APPROVAL_TARGET_CHANGED");
    await tx.user.update({ where: { id: target.id }, data: { role: payload.role as "USER" | "ADMIN" } });
    await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } });
    await tx.adminActionApproval.update({ where: { id }, data: { status: "EXECUTED", approvedByUserId: actor.user.id, approvalIpAddress: getRequestContext(request).ipAddress, decidedAt: now } });
    const nextRole = String(payload.role);
    await tx.auditLog.create({ data: { actorUserId: actor.user.id, targetUserId: target.id, targetType: "USER", targetId: target.id, action: "ADMIN_ROLE_CHANGE_APPROVED", oldValue: { role: target.role, approvalId: id }, newValue: { role: nextRole }, reason, requestId: request.headers["x-request-id"]?.toString(), ipAddress: getRequestContext(request).ipAddress } });
    await tx.auditLog.create({ data: { actorUserId: approval.requestedByUserId, targetUserId: target.id, targetType: "USER", targetId: target.id, action: "ADMIN_USER_ROLE_CHANGED", oldValue: { role: target.role }, newValue: { role: nextRole, approvalId: id }, reason: approval.reason, requestId: approval.requestId, ipAddress: approval.requestIpAddress } });
    return { id, status: "EXECUTED" as const, targetUserId: target.id, role: nextRole };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const revokeUserSessions = async (request: IncomingMessage, actor: Awaited<ReturnType<typeof requireAdmin>>, userId: string) => {
  requireRecentMfa(actor.session.mfaVerifiedAt);
  const body = await readJson<Record<string, unknown>>(request);
  if (Object.keys(body).some((key) => key !== "reason")) throw new HttpError("Request contains unsupported fields.", 400, "INVALID_FIELDS");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 8 || reason.length > 500) throw new HttpError("A reason of 8 to 500 characters is required.", 400, "INVALID_REASON");
  if (!userId || userId.length > 120) throw new HttpError("User id is invalid.", 400, "INVALID_USER_ID");
  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, email: true } });
    if (!target) throw new HttpError("User not found.", 404, "NOT_FOUND");
    const updated = await tx.session.updateMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: actor.user.id, targetUserId: userId, targetType: "USER", targetId: userId, action: "ADMIN_USER_SESSIONS_REVOKED", oldValue: { activeSessions: updated.count }, newValue: { activeSessions: 0 }, reason, requestId: request.headers["x-request-id"]?.toString(), ipAddress: getRequestContext(request).ipAddress } });
    return { user: target, revokedSessions: updated.count };
  });
  return result;
};

const mutateAdminProduct = async (request: IncomingMessage, actor: Awaited<ReturnType<typeof requireAdmin>>, id: string | null) => {
  requireRecentMfa(actor.session.mfaVerifiedAt);
  const body = await readJson<Record<string, unknown>>(request);
  const allowed = ["sku", "name", "description", "imageKey", "priceMinor", "currency", "inventoryCount", "status", "reason"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new HttpError("Request contains unsupported fields.", 400, "INVALID_FIELDS");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 8 || reason.length > 500) throw new HttpError("A reason of 8 to 500 characters is required.", 400, "INVALID_REASON");
  const data: Record<string, unknown> = {};
  if ("sku" in body) { if (typeof body.sku !== "string" || !/^[A-Za-z0-9._-]{2,80}$/.test(body.sku.trim())) throw new HttpError("SKU is invalid.", 400, "INVALID_SKU"); data.sku = body.sku.trim(); }
  if ("name" in body) { if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 160) throw new HttpError("Product name is invalid.", 400, "INVALID_PRODUCT_NAME"); data.name = body.name.trim(); }
  if ("description" in body) { if (typeof body.description !== "string" || body.description.length > 4000) throw new HttpError("Product description is invalid.", 400, "INVALID_DESCRIPTION"); data.description = body.description.trim(); }
  if ("imageKey" in body) { if (body.imageKey !== null && (typeof body.imageKey !== "string" || body.imageKey.length > 500 || body.imageKey.startsWith("file:"))) throw new HttpError("Use a stable stored image key.", 400, "INVALID_IMAGE_KEY"); data.imageKey = body.imageKey; }
  if ("priceMinor" in body) { const price = typeof body.priceMinor === "string" && /^\d{1,14}$/.test(body.priceMinor) ? BigInt(body.priceMinor) : typeof body.priceMinor === "number" && Number.isSafeInteger(body.priceMinor) ? BigInt(body.priceMinor) : -1n; if (price < 0n) throw new HttpError("Price must be a non-negative integer in minor currency units.", 400, "INVALID_PRICE"); data.priceMinor = price; }
  if ("inventoryCount" in body) { if (typeof body.inventoryCount !== "number" || !Number.isInteger(body.inventoryCount) || body.inventoryCount < 0 || body.inventoryCount > 1_000_000) throw new HttpError("Inventory count is invalid.", 400, "INVALID_INVENTORY"); data.inventoryCount = body.inventoryCount; }
  if ("currency" in body) { if (typeof body.currency !== "string" || !/^[A-Z]{3}$/.test(body.currency)) throw new HttpError("Currency must be a three-letter code.", 400, "INVALID_CURRENCY"); data.currency = body.currency; }
  if ("status" in body) { if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(String(body.status))) throw new HttpError("Product status is invalid.", 400, "INVALID_PRODUCT_STATUS"); data.status = body.status; if (body.status === "ARCHIVED") data.archivedAt = new Date(); if (body.status !== "ARCHIVED") data.archivedAt = null; }
  if (!id && (!["sku", "name", "priceMinor"].every((key) => key in data))) throw new HttpError("SKU, name, and price are required.", 400, "MISSING_PRODUCT_FIELDS");
  if (id && Object.keys(data).length === 0) throw new HttpError("No product changes were provided.", 400, "EMPTY_UPDATE");
  return prisma.$transaction(async (tx) => {
    const old = id ? await tx.product.findUnique({ where: { id } }) : null;
    if (id && !old) throw new HttpError("Product not found.", 404, "NOT_FOUND");
    const row = id ? await tx.product.update({ where: { id: id! }, data: data as Prisma.ProductUpdateInput }) : await tx.product.create({ data: data as Prisma.ProductCreateInput });
    const serialize = (product: typeof row) => ({ ...product, priceMinor: product.priceMinor.toString(), createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString(), archivedAt: product.archivedAt?.toISOString() ?? null });
    const oldValue = old ? { sku: old.sku, name: old.name, description: old.description, imageKey: old.imageKey, priceMinor: old.priceMinor.toString(), currency: old.currency, inventoryCount: old.inventoryCount, status: old.status } : null;
    const newValue = serialize(row);
    await tx.productChange.create({ data: { productId: row.id, actorUserId: actor.user.id, oldValue: oldValue ?? Prisma.JsonNull, newValue, reason } });
    await tx.auditLog.create({ data: { actorUserId: actor.user.id, targetType: "PRODUCT", targetId: row.id, action: id ? "ADMIN_PRODUCT_UPDATED" : "ADMIN_PRODUCT_CREATED", oldValue: oldValue ?? Prisma.JsonNull, newValue, reason, requestId: request.headers["x-request-id"]?.toString(), ipAddress: getRequestContext(request).ipAddress } });
    return newValue;
  });
};

export const postgresRoute = async (request: IncomingMessage, response: ServerResponse, url: URL, requestId: string) => {
  const context = getRequestContext(request);
  try {
    if (request.method === "GET" && url.pathname === "/health") return ok(response, { status: "ok", timestamp: nowIso() });
    if (request.method === "GET" && url.pathname === "/ready") {
      const health = await prisma.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
      return ok(response, { status: "ready", database: health[0]?.database, storage: "postgresql-prisma", productionReady: false });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/register/request-otp") return await registerOtp(request, response);
    if (request.method === "POST" && url.pathname === "/api/auth/register/verify") return await completeRegistration(request, response);
    if (request.method === "POST" && url.pathname === "/api/auth/login") return await login(request, response);
    if (request.method === "POST" && url.pathname === "/api/admin/auth/login") return await login(request, response, true);
    if (request.method === "POST" && url.pathname === "/api/admin/auth/mfa/setup") return await beginAdminMfaSetup(request, response);
    if (request.method === "POST" && url.pathname === "/api/admin/auth/mfa/verify") return await verifyAdminMfa(request, response);
    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      const auth = await authenticate(request, true);
      await prisma.session.update({ where: { id: auth.session.id }, data: { revokedAt: new Date() } });
      return ok(response, { loggedOut: true });
    }
    if (request.method === "GET" && url.pathname === "/api/me/profile") {
      const { user } = await authenticate(request);
      return ok(response, await profilePayload(user.id));
    }
    if (request.method === "PATCH" && url.pathname === "/api/me/profile") return await updateProfile(request, response);
    if (request.method === "GET" && url.pathname === "/api/me/account") {
      const { user } = await authenticate(request);
      const sponsor = user.sponsorId ? await prisma.user.findUnique({ where: { id: user.sponsorId }, select: { id: true, fullName: true, referralCode: true } }) : null;
      return ok(response, { ...publicUser(user), referrer: sponsor });
    }
    if (request.method === "GET" && url.pathname === "/api/me/dashboard") {
      const { user } = await authenticate(request);
      return ok(response, await dashboard(user.id));
    }
    if (request.method === "GET" && url.pathname === "/api/me/membership") {
      const { user } = await authenticate(request);
      return ok(response, await membershipState(user.id));
    }
    if (request.method === "POST" && url.pathname === "/api/me/membership/checkout") {
      await authenticate(request);
      throw new HttpError("Membership checkout is disabled until approved prices and sandbox credentials are configured.", 503, "PAYMENTS_NOT_CONFIGURED");
    }
    if (request.method === "POST" && url.pathname === "/api/me/cash-outs") {
      await authenticate(request);
      throw new HttpError("Withdrawals are disabled pending approved eligibility, KYC, payout, fee and review rules.", 503, "FINANCIAL_RULES_UNCONFIGURED");
    }
    if (request.method === "GET" && url.pathname === "/api/me/referrals") {
      const { user } = await authenticate(request);
      const { limit, offset } = parsePagination(url.searchParams);
      const count = await prisma.$queryRaw<Array<{ count: bigint }>>`WITH RECURSIVE network(id) AS (SELECT "id" FROM "User" WHERE "sponsorId" = ${user.id} UNION SELECT u."id" FROM "User" u JOIN network n ON u."sponsorId" = n.id) SELECT count(*) AS count FROM network`;
      const rows = await prisma.$queryRaw<Array<{ id: string; fullName: string; status: string; createdAt: Date; directReferrals: bigint }>>`WITH RECURSIVE network(id, depth) AS (SELECT "id", 1 FROM "User" WHERE "sponsorId" = ${user.id} UNION ALL SELECT u."id", n.depth + 1 FROM "User" u JOIN network n ON u."sponsorId" = n.id) SELECT u."id", u."fullName", u."status"::text, u."createdAt", (SELECT count(*) FROM "User" c WHERE c."sponsorId" = u."id") AS "directReferrals" FROM network n JOIN "User" u ON u."id" = n.id ORDER BY n.depth, u."createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
      return ok(response, { count: Number(count[0]?.count ?? 0), limit, offset, rows: rows.map((row) => ({ id: row.id, fullName: row.fullName, status: row.status, joinedAt: row.createdAt.toISOString(), directReferrals: Number(row.directReferrals) })) });
    }
    const referralMatch = url.pathname.match(/^\/api\/me\/referrals\/([^/]+)$/);
    if (request.method === "GET" && referralMatch) {
      const { user } = await authenticate(request);
      const referralId = decodeURIComponent(referralMatch[1]);
      const authorized = await prisma.$queryRaw<Array<{ id: string }>>`WITH RECURSIVE network(id) AS (SELECT "id" FROM "User" WHERE "sponsorId" = ${user.id} UNION SELECT u."id" FROM "User" u JOIN network n ON u."sponsorId" = n.id) SELECT id FROM network WHERE id = ${referralId} LIMIT 1`;
      if (!authorized.length) throw new HttpError("Referral access denied.", 403, "FORBIDDEN");
      const referral = await prisma.user.findUniqueOrThrow({ where: { id: referralId }, include: { sponsoredUsers: { orderBy: { createdAt: "desc" }, select: { id: true, fullName: true, createdAt: true, status: true } } } });
      return ok(response, { id: referral.id, fullName: referral.fullName, joinedAt: referral.createdAt.toISOString(), referrerId: referral.sponsorId, status: referral.status, directReferrals: referral.sponsoredUsers.map((item) => ({ id: item.id, fullName: item.fullName, joinedAt: item.createdAt.toISOString(), status: item.status })) });
    }
    if (request.method === "GET" && url.pathname === "/api/me/account-history") {
      const { user } = await authenticate(request);
      const [ledger, events] = await Promise.all([
        prisma.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 }),
        prisma.securityEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
      ]);
      const rows = [
        ...ledger.map((item) => ({ id: item.id, amount: Number(item.amountMinor) / 100, category: item.type, date: item.createdAt.toISOString(), detail: item.description, status: item.state, title: item.type.replaceAll("_", " ") })),
        ...events.map((item) => ({ id: item.id, category: "SECURITY", date: item.createdAt.toISOString(), detail: item.type.replaceAll("_", " "), status: "RECORDED", title: item.type.replaceAll("_", " ") })),
      ].sort((a, b) => b.date.localeCompare(a.date));
      return ok(response, rows);
    }
    if (request.method === "GET" && url.pathname === "/api/me/payment-history") {
      const { user } = await authenticate(request);
      const rows = await prisma.withdrawalRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
      return ok(response, rows.map((row) => ({ id: row.id, amount: Number(row.amountMinor) / 100, currency: row.currency, date: row.createdAt.toISOString(), reference: row.reservationEntryId ?? row.id, status: row.status, type: "CASH_OUT" })));
    }
    if (request.method === "GET" && url.pathname === "/api/me/orders") {
      const { user } = await authenticate(request);
      const { limit, offset } = parsePagination(url.searchParams);
      const [count, rows] = await Promise.all([
        prisma.productOrder.count({ where: { userId: user.id } }),
        prisma.productOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { items: true } }),
      ]);
      return ok(response, { count, limit, offset, rows: rows.map((order) => ({
        id: order.id, orderNumber: order.orderNumber, status: order.status, currency: order.currency,
        subtotal: minorToMajor(order.subtotalMinor), tax: minorToMajor(order.taxMinor),
        discount: minorToMajor(order.discountMinor), shipping: minorToMajor(order.shippingMinor),
        total: minorToMajor(order.totalMinor), createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({ id: item.id, sku: item.skuSnapshot, name: item.nameSnapshot, quantity: item.quantity, unitPrice: minorToMajor(item.unitPriceMinor), lineTotal: minorToMajor(item.lineTotalMinor), currency: item.currency })),
      })) });
    }
    const orderMatch = url.pathname.match(/^\/api\/me\/orders\/([^/]+)$/);
    if (request.method === "GET" && orderMatch) {
      const { user } = await authenticate(request);
      const order = await prisma.productOrder.findFirst({ where: { id: decodeURIComponent(orderMatch[1]!), userId: user.id }, include: { items: true, statusHistory: { orderBy: { createdAt: "asc" } } } });
      if (!order) throw new HttpError("Order not found.", 404, "NOT_FOUND");
      return ok(response, { id: order.id, orderNumber: order.orderNumber, status: order.status, currency: order.currency,
        subtotal: minorToMajor(order.subtotalMinor), tax: minorToMajor(order.taxMinor),
        discount: minorToMajor(order.discountMinor), shipping: minorToMajor(order.shippingMinor),
        total: minorToMajor(order.totalMinor), createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({ id: item.id, sku: item.skuSnapshot, name: item.nameSnapshot, quantity: item.quantity, unitPrice: minorToMajor(item.unitPriceMinor), lineTotal: minorToMajor(item.lineTotalMinor), currency: item.currency })),
        statusHistory: order.statusHistory.map((item) => ({ status: item.newStatus, reason: item.reason, createdAt: item.createdAt.toISOString() })) });
    }
    if (request.method === "GET" && url.pathname === "/api/me/invoices") {
      const { user } = await authenticate(request);
      const { limit, offset } = parsePagination(url.searchParams);
      const [count, rows] = await Promise.all([
        prisma.invoice.count({ where: { userId: user.id } }),
        prisma.invoice.findMany({ where: { userId: user.id }, orderBy: { issuedAt: "desc" }, skip: offset, take: limit }),
      ]);
      return ok(response, { count, limit, offset, rows: rows.map((invoice) => ({
        id: invoice.id, invoiceNumber: invoice.invoiceNumber, orderId: invoice.orderId, status: invoice.status, currency: invoice.currency,
        subtotal: minorToMajor(invoice.subtotalMinor), tax: minorToMajor(invoice.taxMinor),
        discount: minorToMajor(invoice.discountMinor), shipping: minorToMajor(invoice.shippingMinor),
        total: minorToMajor(invoice.totalMinor), issuedAt: invoice.issuedAt.toISOString(), paidAt: invoice.paidAt?.toISOString() ?? null,
      })) });
    }
    const invoiceMatch = url.pathname.match(/^\/api\/me\/invoices\/([^/]+)$/);
    if (request.method === "GET" && invoiceMatch) {
      const { user } = await authenticate(request);
      const invoice = await prisma.invoice.findFirst({ where: { id: decodeURIComponent(invoiceMatch[1]!), userId: user.id } });
      if (!invoice) throw new HttpError("Invoice not found.", 404, "NOT_FOUND");
      return ok(response, { id: invoice.id, invoiceNumber: invoice.invoiceNumber, orderId: invoice.orderId, status: invoice.status, currency: invoice.currency,
        subtotal: minorToMajor(invoice.subtotalMinor), tax: minorToMajor(invoice.taxMinor),
        discount: minorToMajor(invoice.discountMinor), shipping: minorToMajor(invoice.shippingMinor),
        total: minorToMajor(invoice.totalMinor), issuedAt: invoice.issuedAt.toISOString(), paidAt: invoice.paidAt?.toISOString() ?? null,
        metadata: invoice.metadata });
    }
    if (request.method === "GET" && url.pathname === "/api/me/leads") {
      const { user } = await authenticate(request);
      const { limit, offset } = parsePagination(url.searchParams);
      const [count, rows] = await Promise.all([prisma.lead.count({ where: { ownerUserId: user.id } }), prisma.lead.findMany({ where: { ownerUserId: user.id }, orderBy: { createdAt: "desc" }, skip: offset, take: limit })]);
      return ok(response, { count, limit, offset, rows: rows.map((row) => ({ ...row, potentialValue: row.potentialMinor === null ? null : Number(row.potentialMinor) / 100, createdAt: row.createdAt.toISOString() })) });
    }
    if (request.method === "GET" && url.pathname === "/api/me/notification") {
      const { user } = await authenticate(request);
      const { limit, offset } = parsePagination(url.searchParams);
      const [count, rows] = await Promise.all([prisma.notification.count({ where: { userId: user.id } }), prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: offset, take: limit })]);
      return ok(response, { count, limit, offset, rows: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null })) });
    }
    const readMatch = url.pathname.match(/^\/api\/me\/notification\/([^/]+)\/read$/);
    if (request.method === "PATCH" && readMatch) {
      const { user } = await authenticate(request);
      const updated = await prisma.notification.updateMany({ where: { id: decodeURIComponent(readMatch[1]), userId: user.id, readAt: null }, data: { readAt: new Date() } });
      const notification = await prisma.notification.findFirst({ where: { id: decodeURIComponent(readMatch[1]), userId: user.id } });
      if (!notification) throw new HttpError("Notification not found.", 404, "NOT_FOUND");
      return ok(response, { id: notification.id, readAt: notification.readAt?.toISOString() ?? null, changed: updated.count > 0 });
    }
    if (request.method === "POST" && url.pathname === "/api/me/notification/read-all") {
      const { user } = await authenticate(request);
      const readAt = new Date();
      await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt } });
      return ok(response, { readAt: readAt.toISOString() });
    }
    if (request.method === "GET" && url.pathname === "/api/admin/access") {
      const { user } = await requireAdmin(request);
      return ok(response, { authorized: true, role: user.role, fullName: user.fullName });
    }
    if (request.method === "GET" && url.pathname === "/api/admin/dashboard/summary") {
      const actor = await requireAdmin(request);
      await requirePermission(actor, "USER_READ");
      return ok(response, await adminSummary());
    }
    if (request.method === "GET" && url.pathname === "/api/admin/memberships") {
      const actor = await requireAdmin(request); await requirePermission(actor, "PAYMENT_READ");
      return ok(response, await listAdminMemberships(url));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payments") {
      const actor = await requireAdmin(request); await requirePermission(actor, "PAYMENT_READ");
      return ok(response, await listAdminPayments(url));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-events") {
      const actor = await requireAdmin(request); await requirePermission(actor, "PAYMENT_READ");
      return ok(response, await listAdminPaymentEvents(url));
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/admin\/payment-events\/[^/]+\/reconcile$/)) {
      const actor = await requireAdmin(request); await requirePermission(actor, "PAYMENT_RECONCILE");
      throw new HttpError("Manual reconciliation is disabled until matching criteria and Flutterwave sandbox verification are approved.", 503, "RECONCILIATION_POLICY_UNCONFIGURED");
    }
    if (request.method === "GET" && url.pathname === "/api/admin/referrals") {
      const actor = await requireAdmin(request); await requirePermission(actor, "USER_READ");
      return ok(response, await listAdminReferrals(url));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/ledger") {
      const actor = await requireAdmin(request); await requirePermission(actor, "PAYMENT_READ");
      return ok(response, await listAdminLedger(url));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/withdrawals") {
      const actor = await requireAdmin(request); await requirePermission(actor, "PAYMENT_READ");
      const { limit, offset } = parsePagination(url.searchParams);
      const [count, rows] = await Promise.all([prisma.withdrawalRequest.count(), prisma.withdrawalRequest.findMany({ orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { user: { select: { id: true, fullName: true, email: true } } } })]);
      return ok(response, { count, limit, offset, rows: rows.map((row) => ({ id: row.id, status: row.status, amountMinor: row.amountMinor.toString(), feeMinor: row.feeMinor.toString(), currency: row.currency, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), user: row.user })) });
    }
    if (request.method === "GET" && url.pathname === "/api/admin/products") {
      const actor = await requireAdmin(request); await requirePermission(actor, "PRODUCT_READ");
      return ok(response, await listAdminProducts(url));
    }
    if (request.method === "POST" && url.pathname === "/api/admin/products") {
      const actor = await requireAdmin(request); await requirePermission(actor, "PRODUCT_MANAGE");
      enforceRateLimit(`admin-mutation:${actor.user.id}`, 20, 60_000);
      return created(response, { product: await mutateAdminProduct(request, actor, null) });
    }
    const adminProductMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (request.method === "PATCH" && adminProductMatch) {
      const actor = await requireAdmin(request); await requirePermission(actor, "PRODUCT_MANAGE");
      enforceRateLimit(`admin-mutation:${actor.user.id}`, 20, 60_000);
      return ok(response, { product: await mutateAdminProduct(request, actor, decodeURIComponent(adminProductMatch[1]!)) });
    }
    if (request.method === "GET" && url.pathname === "/api/admin/orders") {
      const actor = await requireAdmin(request); await requirePermission(actor, "ORDER_READ");
      return ok(response, await listAdminOrders(url));
    }
    if (request.method === "PATCH" && url.pathname.match(/^\/api\/admin\/orders\/[^/]+\/status$/)) {
      const actor = await requireAdmin(request); await requirePermission(actor, "ORDER_MANAGE");
      throw new HttpError("Order status changes are disabled until allowed transitions and payment/refund effects are approved.", 503, "ORDER_TRANSITION_POLICY_UNCONFIGURED");
    }
    if (request.method === "GET" && url.pathname === "/api/admin/invoices") {
      const actor = await requireAdmin(request); await requirePermission(actor, "ORDER_READ");
      return ok(response, await listAdminInvoices(url));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/notifications") {
      const actor = await requireAdmin(request); await requirePermission(actor, "USER_READ");
      return ok(response, await listAdminNotifications(url));
    }
    if (request.method === "POST" && url.pathname === "/api/admin/notifications/broadcast") {
      const actor = await requireAdmin(request); await requirePermission(actor, "SYSTEM_CONFIGURE");
      throw new HttpError("Broadcast delivery is disabled until an audience policy and delivery provider are configured.", 503, "NOTIFICATION_PROVIDER_UNCONFIGURED");
    }
    if (request.method === "GET" && url.pathname === "/api/admin/security") {
      const actor = await requireAdmin(request); await requirePermission(actor, "SYSTEM_CONFIGURE");
      return ok(response, await adminSecurityOverview(url));
    }
    if (request.method === "POST" && url.pathname.match(/^\/api\/admin\/security\/admins\/[^/]+\/mfa\/reset$/)) {
      const actor = await requireAdmin(request); await requirePermission(actor, "SYSTEM_CONFIGURE");
      throw new HttpError("Authenticator recovery is CLI-only and requires an audited server-side reset procedure. No web reset is available.", 503, "CLI_RECOVERY_ONLY");
    }
    if (request.method === "GET" && url.pathname === "/api/admin/approvals") {
      const actor = await requireAdmin(request); await requireAnyPermission(actor, ["ROLE_MANAGE", "USER_MANAGE"]);
      return ok(response, await listAdminApprovals(url));
    }
    const approvalMatch = url.pathname.match(/^\/api\/admin\/approvals\/([^/]+)$/);
    if (request.method === "PATCH" && approvalMatch) {
      const actor = await requireAdmin(request); await requireAnyPermission(actor, ["ROLE_MANAGE", "USER_MANAGE"]);
      enforceRateLimit(`admin-mutation:${actor.user.id}`, 20, 60_000);
      return ok(response, await decideAdminApproval(request, actor, decodeURIComponent(approvalMatch[1]!)));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      const actor = await requireAdmin(request);
      await requirePermission(actor, "USER_READ");
      return ok(response, await listAdminUsers(url));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/audit-log") {
      const actor = await requireAdmin(request);
      await requirePermission(actor, "AUDIT_READ");
      return ok(response, await adminAuditLog(url));
    }
    const userDetailMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (request.method === "GET" && userDetailMatch) {
      const actor = await requireAdmin(request); await requirePermission(actor, "USER_READ");
      return ok(response, { user: await getAdminUserDetail(decodeURIComponent(userDetailMatch[1]!)) });
    }
    const userSessionMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/sessions\/revoke$/);
    if (request.method === "POST" && userSessionMatch) {
      const actor = await requireAdmin(request); await requirePermission(actor, "USER_MANAGE");
      enforceRateLimit(`admin-mutation:${actor.user.id}`, 20, 60_000);
      return ok(response, await revokeUserSessions(request, actor, decodeURIComponent(userSessionMatch[1]!)));
    }
    const userAction = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/(role|status)$/);
    if (request.method === "PATCH" && userAction) {
      const actor = await requireAdmin(request);
      enforceRateLimit(`admin-mutation:${actor.user.id}`, 20, 60_000);
      const action = userAction[2] as "role" | "status";
      await requirePermission(actor, action === "role" ? "ROLE_MANAGE" : "USER_MANAGE");
      const result = await updateAdminUser(request, url, actor, decodeURIComponent(userAction[1]!), action);
      if ("approvalRequired" in result) return send(response, 202, result);
      return ok(response, { user: result });
    }
    if (request.method === "POST" && url.pathname.startsWith("/api/admin/cash-outs/")) {
      await requireAdmin(request);
      throw new HttpError("Withdrawals are disabled pending approved eligibility, KYC, payout, fee and review rules.", 503, "FINANCIAL_RULES_UNCONFIGURED");
    }
    if (url.pathname.startsWith("/api/admin/")) {
      await requireAdmin(request);
      throw new HttpError("Administrator action is not implemented.", 501, "NOT_IMPLEMENTED");
    }
    if (request.method === "POST" && url.pathname.startsWith("/api/webhooks/flutterwave")) throw new HttpError("Flutterwave sandbox processing is not configured for PostgreSQL runtime.", 503, "PAYMENTS_NOT_CONFIGURED");
    throw new HttpError("Not found.", 404, "NOT_FOUND");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError("A record with those details already exists.", 409, "CONFLICT");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new HttpError("This record changed concurrently. Refresh and retry.", 409, "CONCURRENT_UPDATE");
    console.error(JSON.stringify({ requestId, code: "POSTGRES_REQUEST_FAILED", path: url.pathname, errorType: error instanceof Error ? error.name : typeof error, prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined }));
    throw new HttpError("Request failed.", 500, "INTERNAL_ERROR");
  }
};

export const disconnectPostgres = () => prisma.$disconnect();
