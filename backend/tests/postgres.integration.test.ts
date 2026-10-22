import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "../src/server.ts";
import { prisma } from "../src/services/prismaClient.ts";
import { createId, hashPassword, hashSessionToken, signToken } from "../src/utils/crypto.ts";
import { decryptTotpSecret, generateTotpCode, hashRecoveryCode } from "../src/utils/totp.ts";

if (process.env.DATABASE_TARGET !== "angelfoods-dev" || process.env.NEON_BRANCH !== "angelfoods-dev") {
  throw new Error("PostgreSQL integration tests may run only against angelfoods-dev.");
}
const endpointId = process.env.NEON_ENDPOINT_ID;
const databaseUrl = process.env.DATABASE_URL;
if (!endpointId || !databaseUrl || !new URL(databaseUrl).hostname.startsWith(`${endpointId}-pooler.`)) {
  throw new Error("PostgreSQL integration tests require the approved Neon pooled endpoint.");
}

const userId = createId("integration-user");
const referralCode = `IT${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const adminId = createId("integration-admin");
const adminReferralCode = `IT${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const superAdminId = createId("integration-super-admin");
const superAdminReferralCode = `IT${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const financeAdminId = createId("integration-finance-admin");
const financeAdminReferralCode = `IT${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const otherUserId = createId("integration-other-user");
const otherReferralCode = `IT${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const orderId = createId("integration-order");
const invoiceId = createId("integration-invoice");
const orderNumber = `IT-${randomUUID()}`;
const invoiceNumber = `ITI-${randomUUID()}`;
const email = `integration-${randomUUID()}@example.invalid`;
const adminEmail = `integration-admin-${randomUUID()}@example.invalid`;
const superAdminEmail = `integration-super-admin-${randomUUID()}@example.invalid`;
const financeAdminEmail = `integration-finance-admin-${randomUUID()}@example.invalid`;
const password = `test-${randomUUID()}-Pass!`;
const adminPassword = `admin-${randomUUID()}-Pass!`;
const superAdminPassword = `super-admin-${randomUUID()}-Pass!`;
const financeAdminPassword = `finance-admin-${randomUUID()}-Pass!`;
const token = signToken({ sub: userId, role: "USER" });
const otherToken = signToken({ sub: otherUserId, role: "USER" });
let server: ReturnType<typeof createServer> | undefined;
let restartProbe: ChildProcess | undefined;

const startRestartProbe = () => new Promise<number>((resolve, reject) => {
  const child = spawn(process.execPath, ["--experimental-strip-types", "tests/postgresRestartProbe.ts"], {
    cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "ignore"],
  });
  restartProbe = child;
  let output = "";
  const timer = setTimeout(() => reject(new Error("Backend process restart probe timed out.")), 15_000);
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
    const match = output.match(/^(\d+)\r?\n/);
    if (match) {
      clearTimeout(timer);
      resolve(Number(match[1]));
    }
  });
  child.once("error", () => {
    clearTimeout(timer);
    reject(new Error("Backend process restart probe could not start."));
  });
  child.once("exit", () => {
    if (!output.match(/^(\d+)\r?\n/)) {
      clearTimeout(timer);
      reject(new Error("Backend process restart probe exited before becoming ready."));
    }
  });
});

const run = async () => {
  await prisma.user.create({
    data: {
      id: userId,
      fullName: "Integration Test User",
      email,
      passwordHash: hashPassword(password),
      referralCode,
      role: "USER",
      status: "ACTIVE",
      profile: { create: {} },
      preferences: { create: {} },
      sessions: { create: { tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } },
    },
  });
  await prisma.user.create({
    data: { id: adminId, fullName: "Integration Test Admin", email: adminEmail, passwordHash: hashPassword(adminPassword), referralCode: adminReferralCode, role: "ADMIN", status: "ACTIVE", profile: { create: {} }, preferences: { create: {} } },
  });
  await prisma.user.create({
    data: { id: superAdminId, fullName: "Integration Test Super Admin", email: superAdminEmail, passwordHash: hashPassword(superAdminPassword), referralCode: superAdminReferralCode, role: "SUPER_ADMIN", status: "ACTIVE", profile: { create: {} }, preferences: { create: {} } },
  });
  await prisma.user.create({
    data: { id: financeAdminId, fullName: "Integration Test Finance Admin", email: financeAdminEmail, passwordHash: hashPassword(financeAdminPassword), referralCode: financeAdminReferralCode, role: "FINANCE_ADMIN", status: "ACTIVE", profile: { create: {} }, preferences: { create: {} } },
  });
  await prisma.user.create({
    data: { id: otherUserId, fullName: "Integration Other User", email: `integration-other-${randomUUID()}@example.invalid`, passwordHash: hashPassword(password), referralCode: otherReferralCode, role: "USER", status: "ACTIVE", profile: { create: {} }, preferences: { create: {} }, sessions: { create: { tokenHash: hashSessionToken(otherToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } } },
  });
  await prisma.productOrder.create({ data: {
    id: orderId, userId, orderNumber, status: "PENDING_PAYMENT", currency: "GHS",
    subtotalMinor: 1250n, totalMinor: 1250n,
    items: { create: { id: createId("integration-order-item"), skuSnapshot: "TEST-SKU", nameSnapshot: "Test item", quantity: 1, unitPriceMinor: 1250n, lineTotalMinor: 1250n, currency: "GHS" } },
  } });
  await prisma.invoice.create({ data: {
    id: invoiceId, userId, orderId, invoiceNumber, status: "ISSUED", currency: "GHS",
    subtotalMinor: 1250n, totalMinor: 1250n,
  } });

  server = createServer();
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
  });

  const ready = await request("/ready");
  assert.equal(ready.status, 200);
  assert.equal((await ready.json() as { storage: string }).storage, "postgresql-prisma");

  const auth = { Authorization: `Bearer ${token}` };
  const profileResponse = await request("/api/me/profile", { headers: auth });
  assert.equal(profileResponse.status, 200);
  const profile = await profileResponse.json() as { fullName: string; membershipTier: string };
  assert.equal(profile.fullName, "Integration Test User");
  assert.equal(profile.membershipTier, "free");

  const patchResponse = await request("/api/me/profile", {
    method: "PATCH", headers: auth,
    body: JSON.stringify({ fullName: "Persisted Integration User", dateOfBirth: "2000-01-01", language: "fr", theme: "dark" }),
  });
  assert.equal(patchResponse.status, 200);
  const persisted = await patchResponse.json() as { fullName: string; dateOfBirth: string; preferences: { language: string; theme: string } };
  assert.equal(persisted.fullName, "Persisted Integration User");
  assert.equal(persisted.dateOfBirth, "2000-01-01");
  assert.deepEqual(persisted.preferences, { language: "fr", theme: "dark" });

  const invalidAge = await request("/api/me/profile", { method: "PATCH", headers: auth, body: JSON.stringify({ dateOfBirth: "2010-01-01" }) });
  assert.equal(invalidAge.status, 400);
  const storedUser = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true, preferences: true } });
  assert.equal(storedUser.fullName, "Persisted Integration User");
  assert.equal(storedUser.profile?.dateOfBirth?.toISOString().slice(0, 10), "2000-01-01");
  assert.equal(storedUser.preferences?.language, "fr");

  const forbiddenAdmin = await request("/api/admin/access", { headers: auth });
  assert.equal(forbiddenAdmin.status, 403);
  const deniedAdminRoutes: Array<{ path: string; method?: string; body?: unknown }> = [
    { path: "/api/admin/access" },
    { path: "/api/admin/dashboard/summary" },
    { path: "/api/admin/users" },
    { path: "/api/admin/audit-log" },
    { path: "/api/admin/memberships" },
    { path: "/api/admin/payments" },
    { path: "/api/admin/payment-events" },
    { path: "/api/admin/referrals" },
    { path: "/api/admin/ledger" },
    { path: "/api/admin/withdrawals" },
    { path: "/api/admin/products" },
    { path: "/api/admin/orders" },
    { path: "/api/admin/invoices" },
    { path: "/api/admin/notifications" },
    { path: "/api/admin/security" },
    { path: "/api/admin/security/admins/test/mfa/reset", method: "POST", body: {} },
    { path: "/api/admin/approvals" },
    { path: `/api/admin/users/${userId}` },
    { path: `/api/admin/users/${userId}/sessions/revoke`, method: "POST", body: { reason: "Unauthorized session revocation" } },
    { path: "/api/admin/products", method: "POST", body: { sku: "NOPE", name: "Nope", priceMinor: "100", reason: "Unauthorized product write" } },
    { path: "/api/admin/payment-events/test/reconcile", method: "POST", body: {} },
    { path: "/api/admin/orders/test/status", method: "PATCH", body: { status: "DELIVERED" } },
    { path: "/api/admin/notifications/broadcast", method: "POST", body: { title: "No", body: "No" } },
    { path: `/api/admin/users/${userId}/role`, method: "PATCH", body: { role: "ADMIN", reason: "Unauthorized test action" } },
    { path: `/api/admin/users/${userId}/status`, method: "PATCH", body: { status: "SUSPENDED", reason: "Unauthorized test action" } },
    { path: "/api/admin/cash-outs/test/approve", method: "POST", body: {} },
    { path: "/api/admin/auth/mfa/setup", method: "POST", body: {} },
    { path: "/api/admin/auth/mfa/verify", method: "POST", body: { code: "123456" } },
    { path: "/api/admin/not-implemented" },
  ];
  for (const endpoint of deniedAdminRoutes) {
    const denied = await request(endpoint.path, { method: endpoint.method ?? "GET", headers: auth, ...(endpoint.body ? { body: JSON.stringify(endpoint.body) } : {}) });
    assert.equal(denied.status, 403, `Expected 403 for ordinary user on ${endpoint.method ?? "GET"} ${endpoint.path}`);
  }
  const userCannotAdminLogin = await request("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(userCannotAdminLogin.status, 403);

  const ordersResponse = await request("/api/me/orders", { headers: auth });
  assert.equal(ordersResponse.status, 200);
  const orders = await ordersResponse.json() as { count: number; rows: Array<{ id: string; total: number; items: Array<{ name: string }> }> };
  assert.equal(orders.count, 1);
  assert.equal(orders.rows[0]?.id, orderId);
  assert.equal(orders.rows[0]?.total, 12.5);
  assert.equal(orders.rows[0]?.items[0]?.name, "Test item");
  const otherAuth = { Authorization: `Bearer ${otherToken}` };
  const otherUserOrder = await request(`/api/me/orders/${orderId}`, { headers: otherAuth });
  assert.equal(otherUserOrder.status, 404);
  const invoicesResponse = await request("/api/me/invoices", { headers: auth });
  assert.equal(invoicesResponse.status, 200);
  const invoices = await invoicesResponse.json() as { count: number; rows: Array<{ id: string; total: number }> };
  assert.equal(invoices.count, 1);
  assert.equal(invoices.rows[0]?.id, invoiceId);
  assert.equal(invoices.rows[0]?.total, 12.5);
  const otherUserInvoice = await request(`/api/me/invoices/${invoiceId}`, { headers: otherAuth });
  assert.equal(otherUserInvoice.status, 404);

  const login = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200);
  const loginPayload = await login.json() as { token: string };
  assert.ok(loginPayload.token);
  const loggedOut = await request("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${loginPayload.token}` } });
  assert.equal(loggedOut.status, 200);
  const revoked = await request("/api/me/profile", { headers: { Authorization: `Bearer ${loginPayload.token}` } });
  assert.equal(revoked.status, 401);

  const adminLogin = await request("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  assert.equal(adminLogin.status, 200);
  const challenge = await adminLogin.json() as { token: string; mfaSetupRequired: boolean };
  assert.equal(challenge.mfaSetupRequired, true);
  const challengeHeaders = { Authorization: `Bearer ${challenge.token}` };
  const challengeDenied = await request("/api/admin/access", { headers: challengeHeaders });
  assert.equal(challengeDenied.status, 403);
  const setupResponse = await request("/api/admin/auth/mfa/setup", { method: "POST", headers: challengeHeaders });
  assert.equal(setupResponse.status, 200);
  const setup = await setupResponse.json() as { secret: string };
  assert.ok(setup.secret);
  const verifyResponse = await request("/api/admin/auth/mfa/verify", { method: "POST", headers: challengeHeaders, body: JSON.stringify({ code: generateTotpCode(setup.secret) }) });
  assert.equal(verifyResponse.status, 200);
  const mfaResult = await verifyResponse.json() as { verified: boolean; recoveryCodes: string[] };
  assert.equal(mfaResult.verified, true);
  assert.equal(mfaResult.recoveryCodes.length, 10);
  const storedRole = await prisma.user.findUniqueOrThrow({ where: { id: adminId }, select: { role: true } });
  assert.equal(storedRole.role, "ADMIN");
  const storedFactor = await prisma.mfaFactor.findFirstOrThrow({ where: { userId: adminId, method: "TOTP", revokedAt: null } });
  assert.ok(storedFactor.secretCiphertext, "Encrypted MFA factor was not persisted.");
  assert.ok(storedFactor.secretCiphertext !== setup.secret && decryptTotpSecret(storedFactor.secretCiphertext) === setup.secret, "MFA encryption-at-rest verification failed.");
  const storedRecovery = await prisma.mfaRecoveryCode.findUniqueOrThrow({ where: { codeHash: hashRecoveryCode(mfaResult.recoveryCodes[1]!) } });
  assert.ok(storedRecovery.userId === adminId && storedRecovery.codeHash !== mfaResult.recoveryCodes[1], "Hashed recovery-code persistence verification failed.");
  const storedAdminSession = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(challenge.token) } });
  assert.ok(storedAdminSession.mfaVerifiedAt && storedAdminSession.tokenHash !== challenge.token, "Verified session hash persistence check failed.");
  const enrollmentAudit = await prisma.auditLog.findFirst({ where: { actorUserId: adminId, action: "ADMIN_MFA_ENROLLED" } });
  assert.ok(enrollmentAudit);
  const adminAccess = await request("/api/admin/access", { headers: challengeHeaders });
  assert.equal(adminAccess.status, 200);
  const adminSummary = await request("/api/admin/dashboard/summary", { headers: challengeHeaders });
  assert.equal(adminSummary.status, 200);
  for (const path of ["/api/admin/memberships", "/api/admin/payments", "/api/admin/payment-events", "/api/admin/referrals", "/api/admin/ledger", "/api/admin/products", "/api/admin/orders", "/api/admin/invoices", "/api/admin/notifications", "/api/admin/approvals", `/api/admin/users/${userId}`]) {
    const result = await request(path, { headers: challengeHeaders });
    assert.equal(result.status, 200, `Expected admin read access for ${path}`);
  }
  const adminSecurityDenied = await request("/api/admin/security", { headers: challengeHeaders });
  assert.equal(adminSecurityDenied.status, 403, "Admin without SYSTEM_CONFIGURE must not read security administration.");
  const adminCannotGrantRole = await request(`/api/admin/users/${userId}/role`, { method: "PATCH", headers: challengeHeaders, body: JSON.stringify({ role: "ADMIN", reason: "Test unauthorized role grant" }) });
  assert.equal(adminCannotGrantRole.status, 403);

  const financeAdminLogin = await request("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email: financeAdminEmail, password: financeAdminPassword }) });
  assert.equal(financeAdminLogin.status, 200);
  const financeChallenge = await financeAdminLogin.json() as { token: string; mfaSetupRequired: boolean };
  assert.equal(financeChallenge.mfaSetupRequired, true);
  const financePreMfaAccess = await request("/api/admin/access", { headers: { Authorization: `Bearer ${financeChallenge.token}` } });
  assert.equal(financePreMfaAccess.status, 403, "Every provisioned administrator role must complete MFA before access.");

  const superLogin = await request("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email: superAdminEmail, password: superAdminPassword }) });
  assert.equal(superLogin.status, 200);
  const superChallenge = await superLogin.json() as { token: string; mfaSetupRequired: boolean };
  assert.equal(superChallenge.mfaSetupRequired, true);
  const superHeaders = { Authorization: `Bearer ${superChallenge.token}` };
  const preMfaMutation = await request("/api/admin/products", { method: "POST", headers: superHeaders, body: JSON.stringify({ sku: "MFA-TEST", name: "MFA test", priceMinor: "100", reason: "Pre MFA must fail" }) });
  assert.equal(preMfaMutation.status, 403);
  const superSetupResponse = await request("/api/admin/auth/mfa/setup", { method: "POST", headers: superHeaders });
  assert.equal(superSetupResponse.status, 200);
  const superSetup = await superSetupResponse.json() as { secret: string };
  const superVerifyResponse = await request("/api/admin/auth/mfa/verify", { method: "POST", headers: superHeaders, body: JSON.stringify({ code: generateTotpCode(superSetup.secret) }) });
  assert.equal(superVerifyResponse.status, 200);
  const securityOverview = await request("/api/admin/security", { headers: superHeaders });
  assert.equal(securityOverview.status, 200);
  for (const [path, method, body] of [
    ["/api/admin/payment-events/test/reconcile", "POST", {}],
    ["/api/admin/orders/test/status", "PATCH", { status: "DELIVERED" }],
    ["/api/admin/notifications/broadcast", "POST", { title: "No", body: "No" }],
    ["/api/admin/security/admins/test/mfa/reset", "POST", {}],
  ] as const) {
    const disabled = await request(path, { method, headers: superHeaders, body: JSON.stringify(body) });
    assert.equal(disabled.status, 503, `Expected fail-closed result for ${method} ${path}`);
  }

  const roleRequestResponse = await request(`/api/admin/users/${userId}/role`, { method: "PATCH", headers: superHeaders, body: JSON.stringify({ role: "ADMIN", reason: "Integration approval workflow test" }) });
  assert.equal(roleRequestResponse.status, 202);
  const roleRequest = await roleRequestResponse.json() as { approvalRequired: boolean; approval: { id: string; status: string } };
  assert.equal(roleRequest.approvalRequired, true);
  assert.equal(roleRequest.approval.status, "PENDING");
  const approvalAudit = await prisma.auditLog.findFirstOrThrow({ where: { targetUserId: userId, action: "ADMIN_ROLE_CHANGE_REQUESTED" } });
  assert.ok(approvalAudit.ipAddress, "Approval request audit row did not capture request IP.");
  assert.equal(approvalAudit.targetType, "USER");
  assert.equal(approvalAudit.targetId, userId);
  const filteredAudit = await request(`/api/admin/audit-log?action=ADMIN_ROLE_CHANGE_REQUESTED&targetId=${encodeURIComponent(userId)}`, { headers: superHeaders });
  assert.equal(filteredAudit.status, 200);
  const filteredAuditPayload = await filteredAudit.json() as { count: number; rows: Array<{ targetId: string }> };
  assert.equal(filteredAuditPayload.count, 1);
  assert.equal(filteredAuditPayload.rows[0]?.targetId, userId);

  const approvalUrl = `/api/admin/approvals/${roleRequest.approval.id}`;
  const decisionBody = JSON.stringify({ decision: "APPROVED", reason: "Independent administrator approval" });
  const concurrentApprovals = await Promise.all([
    request(approvalUrl, { method: "PATCH", headers: challengeHeaders, body: decisionBody }),
    request(approvalUrl, { method: "PATCH", headers: challengeHeaders, body: decisionBody }),
  ]);
  assert.equal(concurrentApprovals.filter((result) => result.status === 200).length, 1, "Exactly one concurrent approval should execute.");
  assert.equal(concurrentApprovals.filter((result) => result.status === 409).length, 1, "A repeated approval must be rejected as a conflict.");
  const promoted = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
  assert.equal(promoted.role, "ADMIN");
  const roleAudit = await prisma.auditLog.findFirstOrThrow({ where: { targetUserId: userId, action: "ADMIN_USER_ROLE_CHANGED" } });
  assert.ok(roleAudit.ipAddress, "Role change audit row did not retain requester IP.");

  const revokeResponse = await request(`/api/admin/users/${otherUserId}/sessions/revoke`, { method: "POST", headers: superHeaders, body: JSON.stringify({ reason: "Integration force session revocation" }) });
  assert.equal(revokeResponse.status, 200);
  const otherSessionRevoked = await request("/api/me/profile", { headers: otherAuth });
  assert.equal(otherSessionRevoked.status, 401);

  const recoveryLogin = await request("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  assert.equal(recoveryLogin.status, 200);
  const recoveryChallenge = await recoveryLogin.json() as { token: string; mfaRequired: boolean };
  assert.equal(recoveryChallenge.mfaRequired, true);
  const recoveryVerify = await request("/api/admin/auth/mfa/verify", { method: "POST", headers: { Authorization: `Bearer ${recoveryChallenge.token}` }, body: JSON.stringify({ code: mfaResult.recoveryCodes[0] }) });
  assert.equal(recoveryVerify.status, 200);

  const failedMfaLogin = await request("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  assert.equal(failedMfaLogin.status, 200);
  const failedChallenge = await failedMfaLogin.json() as { token: string };
  const badCode = generateTotpCode(setup.secret) === "999999" ? "000000" : "999999";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const failed = await request("/api/admin/auth/mfa/verify", { method: "POST", headers: { Authorization: `Bearer ${failedChallenge.token}` }, body: JSON.stringify({ code: badCode }) });
    assert.equal(failed.status, 401);
  }
  const rateLimited = await request("/api/admin/auth/mfa/verify", { method: "POST", headers: { Authorization: `Bearer ${failedChallenge.token}` }, body: JSON.stringify({ code: badCode }) });
  assert.equal(rateLimited.status, 429);

  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  const restartedPort = await startRestartProbe();
  const afterRestart = await fetch(`http://127.0.0.1:${restartedPort}/api/admin/access`, { headers: challengeHeaders });
  assert.equal(afterRestart.status, 200);
  await afterRestart.body?.cancel();
  const logoutAdmin = await fetch(`http://127.0.0.1:${restartedPort}/api/auth/logout`, { method: "POST", headers: challengeHeaders });
  assert.equal(logoutAdmin.status, 200);
  await logoutAdmin.body?.cancel();
  const revokedAdminSession = await fetch(`http://127.0.0.1:${restartedPort}/api/admin/access`, { headers: challengeHeaders });
  assert.equal(revokedAdminSession.status, 401);
  await revokedAdminSession.body?.cancel();
  restartProbe?.kill("SIGTERM");
  await new Promise<void>((resolve) => restartProbe?.once("exit", () => resolve()));
  restartProbe = undefined;
  console.log("PostgreSQL integration passed: admin module RBAC, role/MFA/recovery/session persistence, second-admin approval and concurrent duplicate denial, target/IP-filterable audit, ordinary-user denial on admin routes, order/invoice ownership, fail-closed financial actions, and logout revocation.");
};

try {
  await run();
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (restartProbe && restartProbe.exitCode === null) restartProbe.kill("SIGTERM");
  await prisma.invoice.deleteMany({ where: { id: invoiceId } });
  await prisma.productOrder.deleteMany({ where: { id: orderId } });
  await prisma.adminActionApproval.deleteMany({ where: { OR: [{ requestedByUserId: { in: [adminId, superAdminId] } }, { approvedByUserId: { in: [adminId, superAdminId] } }] } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, adminId, superAdminId, financeAdminId, otherUserId] } } });
  await prisma.$disconnect();
}
