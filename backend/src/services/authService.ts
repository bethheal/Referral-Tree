import { env } from "../config/env.ts";
import type { Database, RegistrationAttempt, User } from "../models/types.ts";
import {
  createId,
  createOtp,
  hashOtp,
  hashPassword,
  nowIso,
  signToken,
  verifyPassword,
} from "../utils/crypto.ts";
import { normalizePhoneNumber } from "../validators/phone.ts";
import {
  assertNoReferralLoop,
  createReferralCode,
  findReferrer,
} from "./referralService.ts";
import { awardReferralRewards } from "./financialService.ts";
import { recordRegistrationRiskSignals } from "./riskService.ts";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const requestRegistrationOtp = (
  data: Database,
  input: {
    email: string;
    fullName: string;
    password: string;
    phoneNumber: string;
    referralCode?: string;
  }
) => {
  const email = normalizeEmail(input.email);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);

  if (!input.fullName.trim()) throw new Error("Full name is required.");
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (data.users.some((user) => user.phoneNumber === phoneNumber)) {
    throw new Error("This phone number is already registered.");
  }

  if (data.users.some((user) => user.email === email)) {
    throw new Error("This email is already registered.");
  }

  findReferrer(data, input.referralCode);

  const existing = data.registrations.find(
    (attempt) => attempt.phoneNumber === phoneNumber || attempt.email === email
  );
  const now = Date.now();

  if (existing && new Date(existing.resendAvailableAt).getTime() > now) {
    throw new Error("Please wait before requesting another OTP.");
  }

  const otp = createOtp();
  const attempt: RegistrationAttempt = {
    id: existing?.id ?? createId("registration"),
    email,
    fullName: input.fullName.trim(),
    passwordHash: hashPassword(input.password),
    phoneNumber,
    referralCode: input.referralCode?.trim(),
    otpHash: hashOtp(otp),
    otpAttempts: 0,
    otpExpiresAt: new Date(now + env.otpTtlSeconds * 1000).toISOString(),
    resendAvailableAt: new Date(
      now + env.otpResendCooldownSeconds * 1000
    ).toISOString(),
    createdAt: existing?.createdAt ?? nowIso(),
  };

  if (existing) {
    Object.assign(existing, attempt);
  } else {
    data.registrations.push(attempt);
  }

  return {
    registrationId: attempt.id,
    ...(env.otpDevMode ? { otp } : {}),
  };
};

export const completeRegistration = (
  data: Database,
  input: { otp: string; registrationId: string },
  context?: { ipAddress?: string; userAgent?: string }
) => {
  const attempt = data.registrations.find(
    (registration) => registration.id === input.registrationId
  );

  if (!attempt) throw new Error("Registration was not found.");
  if (new Date(attempt.otpExpiresAt).getTime() < Date.now()) {
    throw new Error("OTP has expired.");
  }
  if (attempt.otpAttempts >= env.otpMaxAttempts) {
    throw new Error("Too many incorrect OTP attempts.");
  }

  if (attempt.otpHash !== hashOtp(input.otp)) {
    attempt.otpAttempts += 1;
    throw new Error("Incorrect OTP.");
  }

  if (data.users.some((user) => user.phoneNumber === attempt.phoneNumber)) {
    throw new Error("This phone number is already registered.");
  }
  if (data.users.some((user) => user.email === attempt.email)) {
    throw new Error("This email is already registered.");
  }

  const referrer = findReferrer(data, attempt.referralCode);
  const userId = createId("user");

  assertNoReferralLoop(data, userId, referrer);

  const user: User = {
    id: userId,
    email: attempt.email,
    fullName: attempt.fullName,
    passwordHash: attempt.passwordHash,
    phoneNumber: attempt.phoneNumber,
    referralCode: createReferralCode(
      attempt.fullName,
      new Set(data.users.map((item) => item.referralCode))
    ),
    referrerId: referrer?.id ?? null,
    role: "USER",
    status: "ACTIVE",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  data.users.push(user);
  data.registrations = data.registrations.filter(
    (registration) => registration.id !== attempt.id
  );

  if (referrer) {
    awardReferralRewards(data, referrer, user);
  }

  data.securityEvents.push({
    id: createId("security"),
    userId: user.id,
    type: "ACCOUNT_CREATED",
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    createdAt: nowIso(),
  });

  recordRegistrationRiskSignals(data, user, context);

  return {
    token: signToken({ role: user.role, sub: user.id }),
    user: publicUser(user),
  };
};

export const login = (
  data: Database,
  input: { email: string; password: string },
  context?: { ipAddress?: string; userAgent?: string }
) => {
  const email = normalizeEmail(input.email);
  const user = data.users.find((item) => item.email === email);

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    data.securityEvents.push({
      id: createId("security"),
      userId: user?.id ?? null,
      type: "LOGIN_FAILED",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      createdAt: nowIso(),
    });
    throw new Error("Login failed. Check email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("Account is not active.");
  }

  data.securityEvents.push({
    id: createId("security"),
    userId: user.id,
    type: "LOGIN_SUCCESS",
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    createdAt: nowIso(),
  });

  return {
    token: signToken({ role: user.role, sub: user.id }),
    user: publicUser(user),
  };
};

export const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  referralCode: user.referralCode,
  referrerId: user.referrerId,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});
