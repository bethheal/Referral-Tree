import assert from "node:assert/strict";
import type { Database } from "../src/models/types.ts";

process.env.NODE_ENV = "test";
process.env.STORAGE_MODE = "json";
for (const name of ["DATABASE_URL", "DIRECT_URL", "DATABASE_TARGET", "NEON_ENDPOINT_ID"]) {
  delete process.env[name];
}
for (const name of ["SMS_PROVIDER", "SMS_LIVE_DELIVERY_ENABLED", "HUBTEL_CLIENT_ID", "HUBTEL_CLIENT_SECRET", "HUBTEL_SENDER_ID", "HUBTEL_API_BASE_URL"]) {
  delete process.env[name];
}
process.env.JWT_SECRET = "otp-unit-test-secret-long-enough";
process.env.OTP_PEPPER = "otp-unit-test-pepper-long-enough";
process.env.OTP_DEV_MODE = "true";
process.env.OTP_TTL_SECONDS = "600";
process.env.OTP_MAX_ATTEMPTS = "5";
process.env.OTP_RESEND_COOLDOWN_SECONDS = "60";

const { normalizePhoneNumber } = await import("../src/validators/phone.ts");
const { requestRegistrationOtp, completeRegistration } = await import("../src/services/authService.ts");
const { HttpError } = await import("../src/utils/http.ts");
const { hashPassword } = await import("../src/utils/crypto.ts");
const { env } = await import("../src/config/env.ts");
assert.equal(env.smsProvider, "mock", "test defaults to the non-network mock SMS provider");
assert.equal(env.smsLiveDeliveryEnabled, false);

let issuedOtp = "";
const testSmsProvider = {
  assertAvailable() {},
  async send(message: { to: string; content: string }) {
    issuedOtp = message.content.match(/verification code: (\d{6})/i)?.[1] ?? "";
  },
};

const emptyDatabase = (): Database => ({
  users: [], registrations: [], ledger: [], cashOuts: [], auditLogs: [],
  securityEvents: [], notification: [], leads: [], membershipPayments: [], memberships: [],
});

const registrationInput = (overrides: Partial<{
  email: string; phoneNumber: string; fullName: string; password: string;
}> = {}) => ({
  email: "person@example.test",
  fullName: "Test Person",
  password: "Password123!",
  phoneNumber: "055 000 0001",
  ...overrides,
});

const expectCode = async (action: () => unknown, code: string) => {
  await assert.rejects(Promise.resolve().then(action), (error: unknown) =>
    error instanceof HttpError && error.code === code,
  );
};

assert.equal(normalizePhoneNumber("055 000 0001"), "+233550000001");
assert.equal(normalizePhoneNumber("+1 (213) 373-4253"), "+12133734253");
expectCode(() => normalizePhoneNumber("055 000"), "INVALID_PHONE");
expectCode(() => normalizePhoneNumber("Call me at 0550000001"), "INVALID_PHONE");

const duplicateData = emptyDatabase();
duplicateData.users.push({
  id: "existing-user", email: "existing@example.test", fullName: "Existing User",
  phoneNumber: "+233550000001", passwordHash: hashPassword("Password123!"),
  referralCode: "EXISTING", referrerId: null, role: "USER", status: "ACTIVE",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
} as (typeof duplicateData.users)[number]);
await expectCode(() => requestRegistrationOtp(duplicateData, registrationInput(), testSmsProvider), "PHONE_EXISTS");

const cooldownData = emptyDatabase();
const firstChallenge = await requestRegistrationOtp(cooldownData, registrationInput(), testSmsProvider);
const firstChallengeOtp = issuedOtp;
assert.match(firstChallengeOtp, /^\d{6}$/);
await expectCode(
  () => requestRegistrationOtp(cooldownData, registrationInput({ email: "other@example.test" }), testSmsProvider),
  "OTP_COOLDOWN",
);
cooldownData.registrations[0]!.resendAvailableAt = new Date(Date.now() - 1).toISOString();
const resentChallenge = await requestRegistrationOtp(cooldownData, registrationInput(), testSmsProvider);
assert.match(issuedOtp, /^\d{6}$/);
assert.notEqual(cooldownData.registrations[0]!.otpHash, "");
assert.equal(cooldownData.registrations[0]!.otpAttempts, 0);

const expiredData = emptyDatabase();
const expiredChallenge = await requestRegistrationOtp(expiredData, registrationInput(), testSmsProvider);
const expiredOtp = issuedOtp;
expiredData.registrations[0]!.otpExpiresAt = new Date(Date.now() - 1).toISOString();
await expectCode(() => completeRegistration(expiredData, {
  registrationId: expiredChallenge.registrationId, otp: expiredOtp,
}), "OTP_EXPIRED");
assert.equal(expiredData.users.length, 0, "expired OTP must not create or verify a user");

const attemptsData = emptyDatabase();
const attemptsChallenge = await requestRegistrationOtp(attemptsData, registrationInput(), testSmsProvider);
const attemptsOtp = issuedOtp;
const wrongOtp = attemptsOtp === "000000" ? "000001" : "000000";
for (let attempt = 0; attempt < 5; attempt += 1) {
  await expectCode(() => completeRegistration(attemptsData, {
    registrationId: attemptsChallenge.registrationId, otp: wrongOtp,
  }), "OTP_INVALID");
}
assert.equal(attemptsData.registrations[0]!.otpAttempts, 5);
await expectCode(() => completeRegistration(attemptsData, {
  registrationId: attemptsChallenge.registrationId, otp: wrongOtp,
}), "OTP_ATTEMPTS_EXCEEDED");
assert.equal(attemptsData.users.length, 0, "incorrect OTP attempts must not create or verify a user");

const singleUseData = emptyDatabase();
const singleUseChallenge = await requestRegistrationOtp(singleUseData, registrationInput(), testSmsProvider);
const singleUseOtp = issuedOtp;
const created = completeRegistration(singleUseData, {
  registrationId: singleUseChallenge.registrationId, otp: singleUseOtp,
});
assert.equal(created.user.phoneNumber, "+233550000001");
assert.equal(singleUseData.registrations.length, 0);
assert.equal(singleUseData.users.length, 1);
await expectCode(() => completeRegistration(singleUseData, {
  registrationId: singleUseChallenge.registrationId, otp: singleUseOtp,
}), "NOT_FOUND");

console.log("Phone normalization and registration OTP lifecycle tests passed.");
