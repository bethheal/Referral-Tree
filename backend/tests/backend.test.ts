import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbFile = path.join(os.tmpdir(), `angelfoods-backend-${Date.now()}.json`);
process.env.DATABASE_FILE = dbFile;
process.env.JWT_SECRET = "test-secret-with-enough-length";
process.env.OTP_DEV_MODE = "true";
process.env.OTP_RESEND_COOLDOWN_SECONDS = "0";
process.env.MIN_CASH_OUT = "10";

const { createServer } = await import("../src/server.ts");
const { db } = await import("../src/services/database.ts");

const server = createServer();

const listen = () =>
  new Promise<number>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      assert(address && typeof address === "object");
      resolve(address.port);
    });
  });

const request = async (
  baseUrl: string,
  pathName: string,
  options: RequestInit = {}
) => {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();

  return { body, response };
};

const port = await listen();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const firstOtp = await request(baseUrl, "/api/auth/register/request-otp", {
    body: JSON.stringify({
      email: "jennifer@example.com",
      fullName: "Jennifer Angel",
      password: "Password123!",
      phoneNumber: "+233 55 000 0001",
      role: "ADMIN",
    }),
    method: "POST",
  });
  assert.equal(firstOtp.response.status, 201);
  assert.equal(typeof firstOtp.body.otp, "string");

  const firstRegistration = await request(baseUrl, "/api/auth/register/verify", {
    body: JSON.stringify({
      otp: firstOtp.body.otp,
      registrationId: firstOtp.body.registrationId,
    }),
    method: "POST",
  });
  assert.equal(firstRegistration.response.status, 201);
  assert.equal(firstRegistration.body.user.role, undefined);
  assert.equal(firstRegistration.body.user.status, undefined);
  assert.equal(db.data.users.find((user: { id: string }) =>
    user.id === firstRegistration.body.user.id
  )?.role, "USER");
  const firstToken = firstRegistration.body.token;
  const referralCode = firstRegistration.body.user.referralCode;

  const duplicatePhone = await request(
    baseUrl,
    "/api/auth/register/request-otp",
    {
      body: JSON.stringify({
        email: "copy@example.com",
        fullName: "Copy Account",
        password: "Password123!",
        phoneNumber: "+233550000001",
      }),
      method: "POST",
    }
  );
  assert.equal(duplicatePhone.response.status, 409);
  assert.match(duplicatePhone.body.error, /phone number/i);

  const secondOtp = await request(baseUrl, "/api/auth/register/request-otp", {
    body: JSON.stringify({
      email: "ama@example.com",
      fullName: "Ama Referral",
      password: "Password123!",
      phoneNumber: "+233 55 000 0002",
      referralCode,
    }),
    method: "POST",
  });
  assert.equal(secondOtp.response.status, 201);

  const secondRegistration = await request(baseUrl, "/api/auth/register/verify", {
    body: JSON.stringify({
      otp: secondOtp.body.otp,
      registrationId: secondOtp.body.registrationId,
    }),
    method: "POST",
  });
  assert.equal(secondRegistration.response.status, 201);

  const login = await request(baseUrl, "/api/auth/login", {
    body: JSON.stringify({
      email: "jennifer@example.com",
      password: "Password123!",
    }),
    method: "POST",
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.body.user.role, undefined);
  const deniedAdminLogin = await request(baseUrl, "/api/admin/auth/login", {
    body: JSON.stringify({ email: "jennifer@example.com", password: "Password123!" }),
    method: "POST",
  });
  assert.equal(deniedAdminLogin.response.status, 403);

  const dashboard = await request(baseUrl, "/api/me/dashboard", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.body.stats.totalReferrals, 1);
  assert.equal(dashboard.body.financial.totalPoints, 0);

  const profile = await request(baseUrl, "/api/me/profile", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.fullName, "Jennifer Angel");
  assert.equal(profile.body.membershipTier, "free");
  assert.equal(profile.body.id, undefined);
  assert.equal(profile.body.role, undefined);

  const profileUpdate = await request(baseUrl, "/api/me/profile", {
    body: JSON.stringify({ fullName: "  Zoë O’Connor-Smith  ", language: "fr", theme: "dark" }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(profileUpdate.response.status, 200);
  assert.equal(profileUpdate.body.fullName, "Zoë O’Connor-Smith");
  assert.equal(profileUpdate.body.preferences.language, "fr");
  assert.equal(profileUpdate.body.preferences.theme, "dark");

  const invalidName = await request(baseUrl, "/api/me/profile", {
    body: JSON.stringify({ fullName: "  " }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(invalidName.response.status, 400);
  assert.equal(invalidName.body.code, "INVALID_NAME");

  const minorBirthday = new Date();
  minorBirthday.setUTCFullYear(minorBirthday.getUTCFullYear() - 17);
  const invalidAge = await request(baseUrl, "/api/me/profile", {
    body: JSON.stringify({ dateOfBirth: minorBirthday.toISOString().slice(0, 10) }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(invalidAge.response.status, 400);
  assert.equal(invalidAge.body.code, "MINIMUM_AGE_NOT_MET");

  const exactBirthday = new Date();
  exactBirthday.setUTCFullYear(exactBirthday.getUTCFullYear() - 18);
  const validAge = await request(baseUrl, "/api/me/profile", {
    body: JSON.stringify({ dateOfBirth: exactBirthday.toISOString().slice(0, 10) }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(validAge.response.status, 200);
  assert.equal(validAge.body.dateOfBirth, exactBirthday.toISOString().slice(0, 10));

  const massAssignment = await request(baseUrl, "/api/me/profile", {
    body: JSON.stringify({ role: "ADMIN", membershipTier: "premium" }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(massAssignment.response.status, 400);

  const preferenceRead = await request(baseUrl, "/api/me/profile", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(preferenceRead.body.preferences.language, "fr");
  assert.equal(preferenceRead.body.preferences.theme, "dark");

  db.data.memberships.push({
    id: "test-gold-membership",
    userId: firstRegistration.body.user.id,
    plan: "gold",
    status: "ACTIVE",
    paymentReference: "verified-test-payment",
    startsAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
  });
  db.save();
  const goldProfile = await request(baseUrl, "/api/me/profile", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(goldProfile.body.membershipTier, "gold");

  db.data.notification.push({
    id: "test-owned-notification",
    userId: firstRegistration.body.user.id,
    title: "Test notice",
    body: "Account update",
    createdAt: new Date().toISOString(),
    readAt: null,
  });
  db.data.notification.push({
    id: "test-other-notification",
    userId: secondRegistration.body.user.id,
    title: "Private notice",
    body: "Another account update",
    createdAt: new Date().toISOString(),
    readAt: null,
  });
  db.save();
  const notifications = await request(baseUrl, "/api/me/notification", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(notifications.body.count, 1);
  const markOwnNotification = await request(baseUrl, "/api/me/notification/test-owned-notification/read", {
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(markOwnNotification.response.status, 200);
  const deniedOtherNotification = await request(baseUrl, "/api/me/notification/test-other-notification/read", {
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(deniedOtherNotification.response.status, 404);

  const adminAccess = await request(baseUrl, "/api/admin/access", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(adminAccess.response.status, 403);

  db.data.ledger.push({
    id: "test-available-ledger",
    userId: firstRegistration.body.user.id,
    type: "COMMISSION",
    state: "AVAILABLE",
    amount: 100,
    currency: "GHS",
    description: "Approved referral commission",
    referenceId: "test-approved-commission",
    createdAt: new Date().toISOString(),
  });
  db.save();

  const cashOut = await request(baseUrl, "/api/me/cash-outs", {
    body: JSON.stringify({ amount: 25 }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "POST",
  });
  assert.equal(cashOut.response.status, 503);
  assert.equal(cashOut.body.code, "FINANCIAL_RULES_UNCONFIGURED");

  const account = await request(baseUrl, "/api/me/account", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(account.response.status, 200);
  assert.equal(account.body.phoneNumber, "+233550000001");
  assert.equal(account.body.passwordHash, undefined);

  const paymentHistory = await request(baseUrl, "/api/me/payment-history", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(paymentHistory.response.status, 200);
  assert.equal(paymentHistory.body.length, 0);

  const accountHistory = await request(baseUrl, "/api/me/account-history", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(accountHistory.response.status, 200);
  assert.ok(accountHistory.body.length >= 1);

  const referralDetail = await request(
    baseUrl,
    `/api/me/referrals/${secondRegistration.body.user.id}`,
    {
      headers: { Authorization: `Bearer ${firstToken}` },
    }
  );
  assert.equal(referralDetail.response.status, 200);
  assert.equal(referralDetail.body.fullName, "Ama Referral");

  const unrelatedOtp = await request(baseUrl, "/api/auth/register/request-otp", {
    body: JSON.stringify({
      email: "unrelated@example.com",
      fullName: "Unrelated User",
      password: "Password123!",
      phoneNumber: "+233 55 000 0003",
    }),
    method: "POST",
  });
  const unrelatedRegistration = await request(
    baseUrl,
    "/api/auth/register/verify",
    {
      body: JSON.stringify({
        otp: unrelatedOtp.body.otp,
        registrationId: unrelatedOtp.body.registrationId,
      }),
      method: "POST",
    }
  );
  const deniedReferral = await request(
    baseUrl,
    `/api/me/referrals/${unrelatedRegistration.body.user.id}`,
    {
      headers: { Authorization: `Bearer ${firstToken}` },
    }
  );
  assert.equal(deniedReferral.response.status, 403);
  assert.match(deniedReferral.body.error, /denied/i);

  const normalUserAdminAttempt = await request(
    baseUrl,
    `/api/admin/cash-outs/${cashOut.body.id}/status`,
    {
      body: JSON.stringify({ status: "APPROVED" }),
      headers: { Authorization: `Bearer ${firstToken}` },
      method: "POST",
    }
  );
  assert.equal(normalUserAdminAttempt.response.status, 403);
  assert.match(normalUserAdminAttempt.body.error, /admin/i);

  const firstUserRecord = db.data.users.find((user: { id: string }) =>
    user.id === firstRegistration.body.user.id
  );
  assert(firstUserRecord);
  firstUserRecord.role = "ADMIN";
  db.save();
  const permittedAdminLogin = await request(baseUrl, "/api/admin/auth/login", {
    body: JSON.stringify({ email: "jennifer@example.com", password: "Password123!" }),
    method: "POST",
  });
  assert.equal(permittedAdminLogin.response.status, 200);
  assert.equal(permittedAdminLogin.body.user.role, undefined);
  const authorizedAdminAccess = await request(baseUrl, "/api/admin/access", {
    headers: { Authorization: `Bearer ${permittedAdminLogin.body.token}` },
  });
  assert.equal(authorizedAdminAccess.response.status, 200);
  assert.equal(authorizedAdminAccess.body.authorized, true);

  const adminUsersList = await request(baseUrl, "/api/admin/users", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(adminUsersList.response.status, 200);
  assert.equal(adminUsersList.body.count, 3);
  assert.equal(adminUsersList.body.rows[0].passwordHash, undefined);

  const adminCannotGrantRole = await request(baseUrl, `/api/admin/users/${secondRegistration.body.user.id}/role`, {
    body: JSON.stringify({ role: "ADMIN", reason: "Attempted unauthorized promotion" }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(adminCannotGrantRole.response.status, 403);

  firstUserRecord.role = "SUPER_ADMIN";
  db.save();
  const summary = await request(baseUrl, "/api/admin/dashboard/summary", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(summary.response.status, 200);
  assert.equal(summary.body.accounts.superAdmins, 1);
  assert.ok(summary.body.security.deniedAdminLoginsLast24Hours >= 1);

  const promoteMember = await request(baseUrl, `/api/admin/users/${secondRegistration.body.user.id}/role`, {
    body: JSON.stringify({ role: "ADMIN", reason: "Approved staff access" }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(promoteMember.response.status, 200);
  assert.equal(promoteMember.body.user.role, "ADMIN");

  const selfPromotion = await request(baseUrl, `/api/admin/users/${firstUserRecord.id}/role`, {
    body: JSON.stringify({ role: "ADMIN", reason: "Self demotion attempt" }),
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "PATCH",
  });
  assert.equal(selfPromotion.response.status, 400);

  const adminAudit = await request(baseUrl, "/api/admin/audit-log", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(adminAudit.response.status, 200);
  assert.ok(adminAudit.body.rows.some((entry: { action: string }) => entry.action === "ADMIN_USER_ROLE_CHANGED"));

  firstUserRecord.role = "USER";
  db.save();
  const revokedAdminRole = await request(baseUrl, "/api/admin/dashboard/summary", {
    headers: { Authorization: `Bearer ${permittedAdminLogin.body.token}` },
  });
  assert.equal(revokedAdminRole.response.status, 403);

  const unauthorized = await request(baseUrl, "/api/me/dashboard");
  assert.equal(unauthorized.response.status, 401);
  assert.match(unauthorized.body.error, /authentication/i);

  const malformedToken = await request(baseUrl, "/api/me/dashboard", {
    headers: { Authorization: "Bearer not.a.valid.jwt" },
  });
  assert.equal(malformedToken.response.status, 401);

  const oversizedPayload = await request(baseUrl, "/api/auth/login", {
    body: JSON.stringify({ email: "x".repeat(40_000), password: "x" }),
    method: "POST",
  });
  assert.equal(oversizedPayload.response.status, 413);

  const notFound = await request(baseUrl, "/missing");
  assert.equal(notFound.response.status, 404);

  const jsonReadiness = await request(baseUrl, "/ready");
  assert.equal(jsonReadiness.response.status, 200);
  assert.deepEqual(jsonReadiness.body, {
    status: "ready",
    storage: "development-json",
    productionReady: false,
  });

  const allowedOrigin = await fetch(`${baseUrl}/health`, {
    headers: { Origin: "http://localhost:8081" },
  });
  assert.equal(allowedOrigin.status, 200);
  assert.equal(allowedOrigin.headers.get("access-control-allow-origin"), "http://localhost:8081");

  const blockedOrigin = await fetch(`${baseUrl}/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(blockedOrigin.status, 403);
  assert.equal(blockedOrigin.headers.get("access-control-allow-origin"), null);

  const invalidPagination = await request(baseUrl, "/api/me/leads?limit=51", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(invalidPagination.response.status, 400);

  const logout = await request(baseUrl, "/api/auth/logout", {
    headers: { Authorization: `Bearer ${firstToken}` },
    method: "POST",
  });
  assert.equal(logout.response.status, 200);
  assert.equal(logout.body.loggedOut, true);
  const afterLogout = await request(baseUrl, "/api/me/profile", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(afterLogout.response.status, 401);
} finally {
  server.close();
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
}

console.log("Backend API/database security slice passed.");
