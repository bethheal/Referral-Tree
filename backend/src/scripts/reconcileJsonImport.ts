import fs from "node:fs";
import path from "node:path";
import { prisma } from "../services/prismaClient.ts";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

type LegacyRow = Record<string, unknown>;
type LegacyData = Record<string, unknown>;

const database = validateDatabaseEnvironment();
if (database.target !== "angelfoods-dev") throw new Error("JSON reconciliation is restricted to angelfoods-dev.");

const sourcePath = path.resolve(
  process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "dev-db.json"),
);
if (!fs.existsSync(sourcePath)) throw new Error("JSON import source was not found.");
const legacy = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as LegacyData;
const rows = (key: string): LegacyRow[] => Array.isArray(legacy[key])
  ? (legacy[key] as unknown[]).filter((row): row is LegacyRow => !!row && typeof row === "object")
  : [];
const strings = (key: string): string[] => Array.isArray(legacy[key])
  ? (legacy[key] as unknown[]).filter((value): value is string => typeof value === "string")
  : [];
const idRows = (key: string) => rows(key).flatMap((row) => typeof row.id === "string" ? [row.id] : []);
const required = (row: LegacyRow, key: string) => typeof row[key] === "string" && Boolean((row[key] as string).trim());
const importableUsers = rows("users").filter((row) => row.role === "USER" &&
  ["id", "email", "fullName", "passwordHash", "referralCode"].every((key) => required(row, key)));
const importableUserIds = [...new Set(importableUsers.flatMap((row) => typeof row.id === "string" ? [row.id] : []))];

const minorUnits = (value: unknown, currency: string) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value);
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  if (currency === "POINTS" && Number(fraction) !== 0) return null;
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return currency === "POINTS" ? (negative ? -BigInt(whole) : BigInt(whole)) : (negative ? -amount : amount);
};

const main = async () => {
  const database = await prisma.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
  if (database[0]?.database !== "neondb") throw new Error("Connected database name does not match the expected development database.");

  const mappings: Array<{ entity: string; ids: string[]; count: (ids: string[]) => Promise<number> }> = [
    { entity: "users", ids: importableUserIds, count: (ids) => prisma.user.count({ where: { id: { in: ids } } }) },
    { entity: "ledgerEntries", ids: idRows("ledger"), count: (ids) => prisma.ledgerEntry.count({ where: { id: { in: ids } } }) },
    { entity: "withdrawals", ids: idRows("cashOuts"), count: (ids) => prisma.withdrawalRequest.count({ where: { id: { in: ids } } }) },
    { entity: "membershipPayments", ids: idRows("membershipPayments"), count: (ids) => prisma.membershipPayment.count({ where: { id: { in: ids } } }) },
    { entity: "memberships", ids: idRows("memberships"), count: (ids) => prisma.membership.count({ where: { id: { in: ids } } }) },
    { entity: "auditLogs", ids: idRows("auditLogs"), count: (ids) => prisma.auditLog.count({ where: { id: { in: ids } } }) },
    { entity: "securityEvents", ids: idRows("securityEvents"), count: (ids) => prisma.securityEvent.count({ where: { id: { in: ids } } }) },
  ];
  const collections = await Promise.all(mappings.map(async ({ entity, ids, count }) => ({
    entity,
    sourceRows: ids.length,
    matchedRows: ids.length ? await count([...new Set(ids)]) : 0,
  })));

  const sourceAvailable = new Map<string, bigint>();
  for (const row of rows("ledger")) {
    if (row.state !== "AVAILABLE" || typeof row.userId !== "string" || !importableUserIds.includes(row.userId)) continue;
    const currency = typeof row.currency === "string" ? row.currency : "GHS";
    const amount = minorUnits(row.amount, currency);
    if (amount === null) continue;
    const key = `${row.userId}:${currency}`;
    sourceAvailable.set(key, (sourceAvailable.get(key) ?? 0n) + amount);
  }
  const dbLedger = importableUserIds.length
    ? await prisma.ledgerEntry.groupBy({
        by: ["userId", "currency"],
        where: { userId: { in: importableUserIds }, state: "AVAILABLE" },
        _sum: { amountMinor: true },
      })
    : [];
  const databaseAvailable = new Map(dbLedger.map((row) => [`${row.userId}:${row.currency}`, row._sum.amountMinor ?? 0n]));
  const balanceKeys = new Set([...sourceAvailable.keys(), ...databaseAvailable.keys()]);
  const walletBalancesMatch = [...balanceKeys].every((key) => sourceAvailable.get(key) === databaseAvailable.get(key));

  const revokedHashes = strings("revokedSessions");
  const matchedRevokedHashes = revokedHashes.length
    ? await prisma.legacyRevokedToken.count({ where: { tokenHash: { in: revokedHashes } } })
    : 0;
  const sourceOrderIds = idRows("productOrders");
  const matchedSourceOrders = sourceOrderIds.length
    ? await prisma.productOrder.count({ where: { id: { in: sourceOrderIds } } })
    : 0;
  const totals = {
    collections,
    walletBalanceGroups: balanceKeys.size,
    walletBalancesMatch,
    revokedSessionHashes: { sourceRows: revokedHashes.length, matchedRows: matchedRevokedHashes },
    orders: { sourceRows: sourceOrderIds.length, matchedRows: matchedSourceOrders },
  };
  const reconciled = collections.every((row) => row.sourceRows === row.matchedRows) &&
    matchedRevokedHashes === revokedHashes.length && walletBalancesMatch &&
    matchedSourceOrders === sourceOrderIds.length;
  console.log(JSON.stringify({ event: "json_postgres_reconciliation", branch: "angelfoods-dev", reconciled, ...totals }, null, 2));
  if (!reconciled) process.exitCode = 2;
};

main()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: "json_postgres_reconciliation_failed", message: error instanceof Error ? error.message : "Reconciliation failed." }));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
