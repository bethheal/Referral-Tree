import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client.ts";

type LegacyRow = Record<string, unknown>;
type LegacyData = Record<string, LegacyRow[] | string[] | undefined>;

const sourcePath = path.resolve(
  process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "dev-db.json"),
);
const apply = process.argv.includes("--apply");

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const requiredString = (row: LegacyRow, key: string) => {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid_${key}`);
  }
  return value;
};

const dateValue = (value: unknown, fallback = new Date()) => {
  const date = value instanceof Date ? value : new Date(typeof value === "string" ? value : fallback);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_date");
  return date;
};

const minorUnits = (value: unknown, currency: string): bigint => {
  if (typeof value !== "number" && typeof value !== "string") throw new Error("invalid_amount");
  const text = String(value);
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("amount_has_unsupported_precision");
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  if (currency === "POINTS" && Number(fraction) !== 0) throw new Error("fractional_points_not_supported");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const result = negative ? -minor : minor;
  return currency === "POINTS" ? (negative ? -BigInt(whole) : BigInt(whole)) : result;
};

const normalizePlan = (value: unknown) => {
  if (typeof value !== "string") throw new Error("invalid_plan");
  const plan = value.toUpperCase();
  if (!["FREE", "SILVER", "GOLD", "PREMIUM"].includes(plan)) throw new Error("invalid_plan");
  return plan as "FREE" | "SILVER" | "GOLD" | "PREMIUM";
};

const normalizeRole = (value: unknown) => {
  if (value === "USER") return "USER" as const;
  // Existing administrator credentials are never copied into development.
  return null;
};

const normalizeStatus = (value: unknown) => {
  if (["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"].includes(String(value))) return String(value);
  return "PENDING_VERIFICATION";
};

const hashFile = (contents: Buffer) => crypto.createHash("sha256").update(contents).digest("hex");
const safeJson = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
};

const readRows = (data: LegacyData, key: string): LegacyRow[] => {
  const value = data[key];
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as LegacyRow[]) : [];
};

if (!fs.existsSync(sourcePath)) fail(`JSON import source was not found: ${sourcePath}`);

const originalBytes = fs.readFileSync(sourcePath);
let legacy: LegacyData;
try {
  legacy = JSON.parse(originalBytes.toString("utf8")) as LegacyData;
} catch {
  fail("JSON import source is not valid JSON.");
}

const users = readRows(legacy!, "users");
const registrations = readRows(legacy!, "registrations");
const ledger = readRows(legacy!, "ledger");
const cashOuts = readRows(legacy!, "cashOuts");
const auditLogs = readRows(legacy!, "auditLogs");
const securityEvents = readRows(legacy!, "securityEvents");
const notifications = [...readRows(legacy!, "notification"), ...readRows(legacy!, "messages")];
const leads = readRows(legacy!, "leads");
const membershipPayments = readRows(legacy!, "membershipPayments");
const memberships = readRows(legacy!, "memberships");
const revokedSessions = Array.isArray(legacy!.revokedSessions)
  ? (legacy!.revokedSessions.filter((value): value is string => typeof value === "string"))
  : [];

const importedUserRows: LegacyRow[] = [];
const skippedAdminCount = users.filter((row) => normalizeRole(row.role) === null).length;
const invalidRows: Record<string, number> = {};
const countInvalid = (entity: string) => { invalidRows[entity] = (invalidRows[entity] ?? 0) + 1; };
const userIds = new Set<string>();

for (const row of users) {
  if (normalizeRole(row.role) === null) continue;
  try {
    const id = requiredString(row, "id");
    const email = requiredString(row, "email").trim().toLowerCase();
    const referralCode = requiredString(row, "referralCode").trim().toUpperCase();
    const passwordHash = requiredString(row, "passwordHash");
    userIds.add(id);
    importedUserRows.push({
      id,
      fullName: requiredString(row, "fullName").trim(),
      email,
      phoneNumber: typeof row.phoneNumber === "string" ? row.phoneNumber : null,
      passwordHash,
      referralCode,
      sponsorId: typeof row.referrerId === "string" ? row.referrerId : null,
      placementParentId: typeof row.referrerId === "string" ? row.referrerId : null,
      role: "USER",
      status: normalizeStatus(row.status),
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      createdAt: dateValue(row.createdAt),
      updatedAt: dateValue(row.updatedAt ?? row.createdAt),
    });
  } catch (error) {
    countInvalid(`users:${error instanceof Error ? error.message : "invalid"}`);
  }
}

// Do not transfer live OTP material; the current local challenges are expired and
// must be restarted through the verified production delivery channel.
const skippedRegistrationCount = registrations.length;
const usableRegistrations = 0;
const knownPlans = new Set<string>();
for (const row of membershipPayments) {
  try { knownPlans.add(normalizePlan(row.plan)); } catch { countInvalid("membershipPayments:invalid_plan"); }
}
for (const row of memberships) {
  try { knownPlans.add(normalizePlan(row.plan)); } catch { countInvalid("memberships:invalid_plan"); }
}

const report = {
  source: path.basename(sourcePath),
  dryRun: !apply,
  totals: {
    userRows: users.length,
    importableUsers: importedUserRows.length,
    skippedAdministratorAccounts: skippedAdminCount,
    registrationAttempts: registrations.length,
    skippedRegistrationAttempts: skippedRegistrationCount,
    usableRegistrationAttempts: usableRegistrations,
    ledgerEntries: ledger.length,
    withdrawals: cashOuts.length,
    auditLogs: auditLogs.length,
    securityEvents: securityEvents.length,
    notifications: notifications.length,
    leads: leads.length,
    membershipPayments: membershipPayments.length,
    memberships: memberships.length,
    revokedSessionHashes: revokedSessions.length,
    products: 0,
    productOrders: 0,
    invoices: 0,
  },
  draftPlanPlaceholdersNeeded: [...knownPlans],
  invalidRows,
};

if (!apply) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const target = process.env.DATABASE_TARGET;
const neonBranch = process.env.NEON_BRANCH;
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (target === "production" || neonBranch === "production") {
  fail("Import requires an explicitly configured local or non-production Neon target.");
}
if (!databaseUrl) {
  throw new Error("Import requires an explicitly configured local or non-production Neon target.");
}

const databaseHost = new URL(databaseUrl).hostname;
if (target === "local") {
  if (databaseHost !== "localhost" && databaseHost !== "127.0.0.1") fail("Local import target must use localhost.");
} else if (target === "angelfoods-dev") {
  const expectedEndpoint = process.env.NEON_ENDPOINT_ID;
  if (neonBranch !== "angelfoods-dev" || !expectedEndpoint || !databaseHost.startsWith(`${expectedEndpoint}.`)) {
    fail("Neon import target does not match the approved angelfoods-dev branch.");
  }
} else {
  fail("DATABASE_TARGET must be local or angelfoods-dev.");
}

const backupPath = `${sourcePath}.pre-postgres-import`;
if (!fs.existsSync(backupPath)) fs.copyFileSync(sourcePath, backupPath, fs.constants.COPYFILE_EXCL);
if (hashFile(fs.readFileSync(sourcePath)) !== hashFile(originalBytes)) {
  fail("The source JSON changed during import preparation; import was stopped.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });
const toPlanId = (code: string) => `legacy-plan-${code.toLowerCase()}-v1`;

const main = async () => {
  const databaseIdentity = await prisma.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
  if (databaseIdentity[0]?.database !== "neondb" && target === "angelfoods-dev") {
    fail("Connected Neon database name did not match the expected development database.");
  }

  const created: Record<string, number> = {};
  await prisma.$transaction(async (tx) => {
  const run = async (entity: string, create: (transaction: Prisma.TransactionClient) => Promise<{ count: number }>) => {
    created[entity] = (await create(tx)).count;
  };

  const priorPlanRows = await tx.membershipPlan.findMany({ select: { id: true, code: true, version: true } });
  const existingPlanIds = new Map(priorPlanRows.map((plan) => [`${plan.code}:1`, plan.id]));
  for (const code of knownPlans) {
    if (existingPlanIds.has(`${code}:1`)) continue;
    const id = toPlanId(code);
    await tx.membershipPlan.createMany({
      data: [{ id, code: code as "FREE" | "SILVER" | "GOLD" | "PREMIUM", version: 1, displayName: code[0] + code.slice(1).toLowerCase(), priceMinor: 0n, currency: "GHS", durationDays: null, benefits: {}, status: "DRAFT", effectiveFrom: null, effectiveUntil: null }],
      skipDuplicates: true,
    });
    existingPlanIds.set(`${code}:1`, id);
  }
  const planIdFor = (code: unknown) => {
    const normalized = normalizePlan(code);
    const id = existingPlanIds.get(`${normalized}:1`);
    if (!id) throw new Error("missing_plan_placeholder");
    return id;
  };

  await run("users", (tx) => tx.user.createMany({
    data: importedUserRows.map((row) => ({
      ...row,
      sponsorId: typeof row.sponsorId === "string" && userIds.has(row.sponsorId) ? row.sponsorId : null,
      placementParentId: typeof row.placementParentId === "string" && userIds.has(row.placementParentId) ? row.placementParentId : null,
    })) as never,
    skipDuplicates: true,
  }));

  const profileRows = importedUserRows.flatMap((row) => {
    const source = users.find((user) => user.id === row.id);
    if (!source) return [];
    const dateOfBirth = typeof source.dateOfBirth === "string" ? dateValue(source.dateOfBirth) : null;
    return [{ userId: String(row.id), dateOfBirth, profileImageKey: typeof source.profileImageKey === "string" ? source.profileImageKey : null }];
  });
  await run("profiles", (tx) => tx.profile.createMany({ data: profileRows as never, skipDuplicates: true }));

  const preferences = importedUserRows.flatMap((row) => {
    const source = users.find((user) => user.id === row.id);
    if (!source) return [];
    const language = source.languagePreference === "fr" ? "fr" : "en";
    const theme = ["light", "dark", "system"].includes(String(source.themePreference)) ? String(source.themePreference) : "system";
    return [{ userId: String(row.id), language, theme }];
  });
  await run("preferences", (tx) => tx.userPreferences.createMany({ data: preferences as never, skipDuplicates: true }));

  const paymentPairs = membershipPayments.flatMap((row) => {
    try {
      if (!userIds.has(requiredString(row, "userId"))) return [];
      const id = requiredString(row, "id");
      const planId = planIdFor(row.plan);
      const status = ["PENDING", "PAID", "FAILED"].includes(String(row.status)) ? String(row.status) : "FAILED";
      const reference = requiredString(row, "reference");
      const currency = typeof row.currency === "string" ? row.currency : "GHS";
      return [{
        purchase: { id, userId: String(row.userId), planId, createdAt: dateValue(row.createdAt) },
        payment: {
          id: `legacy-payment-${id}`,
          userId: String(row.userId),
          targetType: "MEMBERSHIP",
          membershipPaymentId: id,
          productOrderId: null,
          provider: "FLUTTERWAVE",
          reference,
          providerTransactionId: typeof row.flutterwaveTransactionId === "string" && row.flutterwaveTransactionId ? row.flutterwaveTransactionId : null,
          amountMinor: minorUnits(row.amount, currency),
          currency,
          status,
          idempotencyKey: null,
          createdAt: dateValue(row.createdAt),
          updatedAt: dateValue(row.updatedAt ?? row.createdAt),
          paidAt: typeof row.paidAt === "string" ? dateValue(row.paidAt) : null,
        },
      }];
    } catch (error) {
      countInvalid(`membershipPayments:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  for (const pair of paymentPairs) {
    const purchaseResult = await tx.membershipPayment.createMany({ data: [pair.purchase] as never, skipDuplicates: true });
    const paymentResult = await tx.payment.createMany({ data: [pair.payment] as never, skipDuplicates: true });
    created.membershipPayments = (created.membershipPayments ?? 0) + purchaseResult.count;
    created.payments = (created.payments ?? 0) + paymentResult.count;
  }

  const membershipRows = memberships.flatMap((row) => {
    try {
      if (!userIds.has(requiredString(row, "userId"))) return [];
      const referenced = paymentPairs.find((pair) => pair.payment.reference === row.paymentReference);
      return [{
        id: requiredString(row, "id"),
        userId: String(row.userId),
        planId: planIdFor(row.plan),
        status: ["ACTIVE", "EXPIRED", "CANCELLED", "REVOKED", "PENDING"].includes(String(row.status)) ? String(row.status) : "EXPIRED",
        membershipPaymentId: referenced?.purchase.id ?? null,
        startsAt: typeof row.startsAt === "string" ? dateValue(row.startsAt) : null,
        expiresAt: typeof row.expiresAt === "string" ? dateValue(row.expiresAt) : null,
        createdAt: dateValue(row.startsAt ?? row.updatedAt),
        updatedAt: dateValue(row.updatedAt ?? row.startsAt),
      }];
    } catch (error) {
      countInvalid(`memberships:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  await run("memberships", (tx) => tx.membership.createMany({ data: membershipRows as never, skipDuplicates: true }));

  const ledgerRows = ledger.flatMap((row) => {
    try {
      if (!userIds.has(requiredString(row, "userId"))) return [];
      const currency = typeof row.currency === "string" ? row.currency : "GHS";
      const typeMap: Record<string, string> = { COMMISSION: "COMMISSION", POINTS: "POINTS", CASH_OUT: "WITHDRAWAL_RESERVATION", ADJUSTMENT: "ADJUSTMENT", REVERSAL: "REVERSAL" };
      const stateMap: Record<string, string> = { POTENTIAL: "PENDING", PENDING: "PENDING", AVAILABLE: "AVAILABLE", PAID: "PAID", VOID: "VOID" };
      return [{
        id: requiredString(row, "id"),
        userId: String(row.userId),
        type: typeMap[String(row.type)] ?? "ADJUSTMENT",
        state: stateMap[String(row.state)] ?? "VOID",
        amountMinor: minorUnits(row.amount, currency),
        currency,
        description: typeof row.description === "string" ? row.description : "Imported legacy entry",
        referenceId: requiredString(row, "referenceId"),
        sourceType: "LEGACY_IMPORT",
        sourceId: String(row.id),
        payoutEligible: false,
        createdAt: dateValue(row.createdAt),
      }];
    } catch (error) {
      countInvalid(`ledger:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  await run("ledger", (tx) => tx.ledgerEntry.createMany({ data: ledgerRows as never, skipDuplicates: true }));

  const withdrawalRows = cashOuts.flatMap((row) => {
    try {
      if (!userIds.has(requiredString(row, "userId"))) return [];
      const statusMap: Record<string, string> = { REQUESTED: "REQUESTED", UNDER_REVIEW: "UNDER_REVIEW", APPROVED: "APPROVED", PROCESSING: "PROCESSING", PAID: "PAID", REJECTED: "REJECTED" };
      return [{
        id: requiredString(row, "id"), userId: String(row.userId),
        amountMinor: minorUnits(row.amount, typeof row.currency === "string" ? row.currency : "GHS"),
        feeMinor: 0n, currency: "GHS", status: statusMap[String(row.status)] ?? "FAILED",
        reservationEntryId: ledger.some((entry) => entry.id === row.ledgerEntryId) ? String(row.ledgerEntryId) : null,
        createdAt: dateValue(row.createdAt), updatedAt: dateValue(row.updatedAt ?? row.createdAt),
      }];
    } catch (error) {
      countInvalid(`withdrawals:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  await run("withdrawals", (tx) => tx.withdrawalRequest.createMany({ data: withdrawalRows as never, skipDuplicates: true }));

  const auditRows = auditLogs.flatMap((row) => {
    try {
      return [{
        id: requiredString(row, "id"),
        actorUserId: typeof row.actorUserId === "string" && userIds.has(row.actorUserId) ? row.actorUserId : null,
        targetUserId: typeof row.targetUserId === "string" && userIds.has(row.targetUserId) ? row.targetUserId : null,
        action: requiredString(row, "action"),
        ...(safeJson(row.oldValue) ? { oldValue: safeJson(row.oldValue) } : {}),
        ...(safeJson(row.newValue) ? { newValue: safeJson(row.newValue) } : {}),
        ...(typeof row.reason === "string" ? { reason: row.reason } : {}),
        createdAt: dateValue(row.createdAt),
      }];
    } catch (error) {
      countInvalid(`auditLogs:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  await run("auditLogs", (tx) => tx.auditLog.createMany({ data: auditRows as never, skipDuplicates: true }));

  const eventRows = securityEvents.flatMap((row) => {
    try {
      return [{
        id: requiredString(row, "id"),
        userId: typeof row.userId === "string" && userIds.has(row.userId) ? row.userId : null,
        type: requiredString(row, "type"),
        ipAddress: typeof row.ipAddress === "string" ? row.ipAddress : null,
        userAgent: typeof row.userAgent === "string" ? row.userAgent : null,
        ...(safeJson(row.metadata) ? { metadata: safeJson(row.metadata) } : {}),
        createdAt: dateValue(row.createdAt),
      }];
    } catch (error) {
      countInvalid(`securityEvents:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  await run("securityEvents", (tx) => tx.securityEvent.createMany({ data: eventRows as never, skipDuplicates: true }));

  const notificationRows = notifications.flatMap((row) => {
    try {
      if (!userIds.has(requiredString(row, "userId"))) return [];
      return [{
        id: requiredString(row, "id"), userId: String(row.userId), title: requiredString(row, "title"),
        body: requiredString(row, "body"), createdAt: dateValue(row.createdAt),
        readAt: typeof row.readAt === "string" ? dateValue(row.readAt) : null,
      }];
    } catch (error) {
      countInvalid(`notifications:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  await run("notifications", (tx) => tx.notification.createMany({ data: notificationRows as never, skipDuplicates: true }));

  const leadRows = leads.flatMap((row) => {
    try {
      if (!userIds.has(requiredString(row, "ownerUserId"))) return [];
      const leadStatus = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"].includes(String(row.status)) ? String(row.status) : "NEW";
      return [{
        id: requiredString(row, "id"), ownerUserId: String(row.ownerUserId),
        displayName: requiredString(row, "displayName"), status: leadStatus,
        potentialMinor: row.potentialValue === undefined ? null : minorUnits(row.potentialValue, "GHS"),
        currency: row.potentialValue === undefined ? null : "GHS",
        createdAt: dateValue(row.createdAt),
      }];
    } catch (error) {
      countInvalid(`leads:${error instanceof Error ? error.message : "invalid"}`);
      return [];
    }
  });
  await run("leads", (tx) => tx.lead.createMany({ data: leadRows as never, skipDuplicates: true }));

  await run("legacyRevokedTokens", (tx) => tx.legacyRevokedToken.createMany({
    data: revokedSessions.map((tokenHash) => ({ tokenHash, revokedAt: new Date() })) as never,
    skipDuplicates: true,
  }));
  });

  const after = hashFile(fs.readFileSync(sourcePath));
  if (after !== hashFile(originalBytes)) throw new Error("JSON source changed; original file must be restored and reconciliation reviewed.");
  console.log(JSON.stringify({ ...report, dryRun: false, created }, null, 2));
};

if (!apply) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: "json_import_failed", message: error instanceof Error ? error.message : "Import failed." }));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
