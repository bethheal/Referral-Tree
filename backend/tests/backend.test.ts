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
  assert.equal(duplicatePhone.response.status, 400);
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

  const dashboard = await request(baseUrl, "/api/me/dashboard", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.body.stats.totalReferrals, 1);
  assert.equal(dashboard.body.financial.totalPoints, 50);

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
  assert.equal(cashOut.response.status, 201);
  assert.equal(cashOut.body.status, "REQUESTED");

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
  assert.equal(paymentHistory.body.length, 1);

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
  assert.equal(deniedReferral.response.status, 400);
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
  assert.equal(normalUserAdminAttempt.response.status, 400);
  assert.match(normalUserAdminAttempt.body.error, /admin/i);

  const unauthorized = await request(baseUrl, "/api/me/dashboard");
  assert.equal(unauthorized.response.status, 400);
  assert.match(unauthorized.body.error, /authentication/i);
} finally {
  server.close();
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
}

console.log("Backend API/database security slice passed.");
