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
import { recordRegistrationRiskSignals } from "./riskService.ts";
import { HttpError } from "../utils/http.ts";

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
  if (
    typeof input?.fullName !== "string" ||
    typeof input?.email !== "string" ||
    typeof input?.password !== "string" ||
    typeof input?.phoneNumber !== "string" ||
    (input.referralCode !== undefined && typeof input.referralCode !== "string")
  ) {
    throw new HttpError("Registration details are invalid.");
  }
  if (input.fullName.length > 120 || input.email.length > 254 || input.password.length > 256) {
    throw new HttpError("Registration details exceed the allowed length.");
  }

  const email = normalizeEmail(input.email);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);

  if (!input.fullName.trim()) throw new HttpError("Full name is required.");
  if (!email.includes("@")) throw new HttpError("Enter a valid email address.");
  if (input.password.length < 8) {
    throw new HttpError("Password must be at least 8 characters.");
  }

  if (data.users.some((user) => user.phoneNumber === phoneNumber)) {
    throw new HttpError("This phone number is already registered.", 409, "PHONE_EXISTS");
  }

  if (data.users.some((user) => user.email === email)) {
    throw new HttpError("This email is already registered.", 409, "EMAIL_EXISTS");
  }

  findReferrer(data, input.referralCode);

  const existing = data.registrations.find(
    (attempt) => attempt.phoneNumber === phoneNumber || attempt.email === email
  );
  const now = Date.now();

  if (existing && new Date(existing.resendAvailableAt).getTime() > now) {
    throw new HttpError("Please wait before requesting another OTP.", 429, "OTP_COOLDOWN");
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
  if (
    typeof input?.registrationId !== "string" ||
    typeof input?.otp !== "string" ||
    input.registrationId.length > 100 ||
    !/^\d{6}$/.test(input.otp)
  ) {
    throw new HttpError("Registration verification details are invalid.");
  }
  const attempt = data.registrations.find(
    (registration) => registration.id === input.registrationId
  );

  if (!attempt) throw new HttpError("Registration was not found.", 404, "NOT_FOUND");
  if (new Date(attempt.otpExpiresAt).getTime() < Date.now()) {
    throw new HttpError("OTP has expired.", 400, "OTP_EXPIRED");
  }
  if (attempt.otpAttempts >= env.otpMaxAttempts) {
    throw new HttpError("Too many incorrect OTP attempts.", 429, "OTP_ATTEMPTS_EXCEEDED");
  }

  if (attempt.otpHash !== hashOtp(input.otp)) {
    attempt.otpAttempts += 1;
    throw new HttpError("Incorrect OTP.", 400, "OTP_INVALID");
  }

  if (data.users.some((user) => user.phoneNumber === attempt.phoneNumber)) {
    throw new HttpError("This phone number is already registered.", 409, "PHONE_EXISTS");
  }
  if (data.users.some((user) => user.email === attempt.email)) {
    throw new HttpError("This email is already registered.", 409, "EMAIL_EXISTS");
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
  if (
    typeof input?.email !== "string" ||
    typeof input?.password !== "string" ||
    input.email.length > 254 ||
    input.password.length > 256
  ) {
    throw new HttpError("Email or password is invalid.", 401, "LOGIN_FAILED");
  }
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
    throw new HttpError("Login failed. Check email or password.", 401, "LOGIN_FAILED");
  }

  if (user.status !== "ACTIVE") {
    throw new HttpError("Account is not active.", 403, "ACCOUNT_INACTIVE");
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

export const loginAdmin = (
  data: Database,
  input: { email: string; password: string },
  context?: { ipAddress?: string; userAgent?: string },
) => {
  const auth = login(data, input, context);
  const account = data.users.find((user) => user.id === auth.user.id);
  if (!account || !["ADMIN", "SUPER_ADMIN"].includes(account.role)) {
    data.securityEvents.push({
      id: createId("security"),
      userId: account?.id ?? null,
      type: "ADMIN_LOGIN_DENIED",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      createdAt: nowIso(),
    });
    throw new HttpError("Administrator access is not enabled for this account.", 403, "ADMIN_ACCESS_DENIED");
  }
  return auth;
};

export const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  referralCode: user.referralCode,
  referrerId: user.referrerId,
  createdAt: user.createdAt,
});
