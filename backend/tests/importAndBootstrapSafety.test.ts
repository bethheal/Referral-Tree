import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRevokedSessionMigrationTimestamp,
  isImportableLegacyRole,
  isSkippedAdministratorRole,
  mapAuditLogs,
  mapRevokedSessions,
} from "../src/scripts/jsonImportMappers.ts";
import {
  requireDevelopmentImportConfirmation,
  requireDevelopmentImportDatabase,
} from "../src/scripts/jsonImportSafety.ts";

assert.throws(
  () => requireDevelopmentImportConfirmation(true, undefined),
  /CONFIRM_DB_MIGRATION=angelfoods-dev/,
);
assert.throws(
  () => requireDevelopmentImportConfirmation(true, "local"),
  /CONFIRM_DB_MIGRATION=angelfoods-dev/,
);
assert.doesNotThrow(() => requireDevelopmentImportConfirmation(true, "angelfoods-dev"));
assert.doesNotThrow(() => requireDevelopmentImportConfirmation(false, undefined));
assert.doesNotThrow(() => requireDevelopmentImportDatabase("angelfoods-dev", "ep-approved-dev"));
assert.throws(() => requireDevelopmentImportDatabase("local", null), /only for the validated angelfoods-dev/);

// Exercise the actual CLI dry-run with no DB settings. It must complete without
// confirmation and report dryRun=true, proving it exits before DB validation.
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "angelfoods-import-dry-run-"));
const temporaryJsonPath = path.join(temporaryDirectory, "empty.json");
fs.writeFileSync(temporaryJsonPath, "{}", "utf8");
const importerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/scripts/importJsonToPostgres.ts");
const dryRunEnvironment: NodeJS.ProcessEnv = { ...process.env, DATABASE_FILE: temporaryJsonPath };
delete dryRunEnvironment.DATABASE_URL;
delete dryRunEnvironment.DIRECT_URL;
delete dryRunEnvironment.DATABASE_TARGET;
delete dryRunEnvironment.NEON_ENDPOINT_ID;
delete dryRunEnvironment.CONFIRM_DB_MIGRATION;
const dryRun = spawnSync(process.execPath, ["--experimental-strip-types", importerPath], {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: dryRunEnvironment,
  encoding: "utf8",
});
assert.equal(dryRun.status, 0, dryRun.stderr);
assert.equal(JSON.parse(dryRun.stdout).dryRun, true);

for (const confirmation of [undefined, "wrong-target"]) {
  const applyEnvironment: NodeJS.ProcessEnv = { ...dryRunEnvironment };
  if (confirmation === undefined) delete applyEnvironment.CONFIRM_DB_MIGRATION;
  else applyEnvironment.CONFIRM_DB_MIGRATION = confirmation;
  const rejectedApply = spawnSync(process.execPath, ["--experimental-strip-types", importerPath, "--apply"], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    env: applyEnvironment,
    encoding: "utf8",
  });
  assert.equal(rejectedApply.status, 1);
  assert.match(rejectedApply.stderr, /CONFIRM_DB_MIGRATION=angelfoods-dev/);
  assert.doesNotMatch(rejectedApply.stderr, /DATABASE_URL is required/);
}

fs.unlinkSync(temporaryJsonPath);
fs.rmdirSync(temporaryDirectory);

const users = new Set(["user-a"]);
const audit = mapAuditLogs([{
  id: "audit-a",
  actorUserId: "user-a",
  targetUserId: "user-a",
  action: "USER_UPDATED",
  requestId: "req-123",
  ipAddress: "192.0.2.8",
  targetType: "USER",
  targetId: "user-a",
  createdAt: "2026-01-02T03:04:05.000Z",
}], users);
assert.equal(audit.invalidRows.length, 0);
assert.equal(audit.rows[0]?.requestId, "req-123");
assert.equal(audit.rows[0]?.ipAddress, "192.0.2.8");
assert.equal(audit.rows[0]?.targetType, "USER");
assert.equal(audit.rows[0]?.targetId, "user-a");

const skippedAdminTarget = mapAuditLogs([{
  id: "audit-skipped-admin",
  targetUserId: "skipped-admin-a",
  action: "ADMIN_ACTION",
  createdAt: "2026-01-02T03:04:05.000Z",
}], users, new Set(["skipped-admin-a"]));
assert.equal(skippedAdminTarget.invalidRows.length, 0);
assert.equal(skippedAdminTarget.rows[0]?.targetUserId, null);
assert.equal(skippedAdminTarget.rows[0]?.targetType, "USER");
assert.equal(skippedAdminTarget.rows[0]?.targetId, "skipped-admin-a");
assert.deepEqual(skippedAdminTarget.missingTargetReferenceRows, []);
assert.deepEqual(skippedAdminTarget.historicalAdministratorTargetRows, [1]);

const existingAdminTargetMetadata = mapAuditLogs([{
  id: "audit-existing-metadata",
  targetUserId: "skipped-admin-a",
  targetType: "LEGACY_ADMIN",
  targetId: "existing-historical-target",
  action: "ADMIN_ACTION",
  createdAt: "2026-01-02T03:04:05.000Z",
}], users, new Set(["skipped-admin-a"]));
assert.equal(existingAdminTargetMetadata.rows[0]?.targetUserId, null);
assert.equal(existingAdminTargetMetadata.rows[0]?.targetType, "LEGACY_ADMIN");
assert.equal(existingAdminTargetMetadata.rows[0]?.targetId, "existing-historical-target");

const partialAdminTargetMetadata = mapAuditLogs([{
  id: "audit-partial-metadata",
  targetUserId: "skipped-admin-a",
  targetType: "LEGACY_USER",
  action: "ADMIN_ACTION",
  createdAt: "2026-01-02T03:04:05.000Z",
}], users, new Set(["skipped-admin-a"]));
assert.equal(partialAdminTargetMetadata.rows[0]?.targetType, "LEGACY_USER");
assert.equal(partialAdminTargetMetadata.rows[0]?.targetId, "skipped-admin-a");

const partialAdminTargetId = mapAuditLogs([{
  id: "audit-partial-target-id",
  targetUserId: "skipped-admin-a",
  targetId: "existing-historical-target",
  action: "ADMIN_ACTION",
  createdAt: "2026-01-02T03:04:05.000Z",
}], users, new Set(["skipped-admin-a"]));
assert.equal(partialAdminTargetId.rows[0]?.targetType, "USER");
assert.equal(partialAdminTargetId.rows[0]?.targetId, "existing-historical-target");

const missingTargetReference = mapAuditLogs([{
  id: "audit-missing-target",
  targetUserId: "unknown-user-a",
  action: "ACTION",
  createdAt: "2026-01-02T03:04:05.000Z",
}], users, new Set(["skipped-admin-a"]));
assert.equal(missingTargetReference.rows[0]?.targetUserId, null);
assert.equal(missingTargetReference.rows[0]?.targetType, undefined);
assert.equal(missingTargetReference.rows[0]?.targetId, undefined);
assert.deepEqual(missingTargetReference.missingTargetReferenceRows, [1]);
assert.deepEqual(missingTargetReference.historicalAdministratorTargetRows, []);

const overlongSkippedAdminId = "admin-" + "x".repeat(121);
const overlongAdminTarget = mapAuditLogs([{
  id: "audit-overlong-admin-target",
  targetUserId: overlongSkippedAdminId,
  action: "ADMIN_ACTION",
  createdAt: "2026-01-02T03:04:05.000Z",
}], users, new Set([overlongSkippedAdminId]));
assert.deepEqual(overlongAdminTarget.invalidRows, [
  { sourceIndex: 1, reason: "targetId_exceeds_120_characters" },
]);
assert.equal(overlongAdminTarget.rows.length, 0, "overlong historical identifiers must not be truncated or imported");
assert.deepEqual(overlongAdminTarget.historicalAdministratorTargetRows, []);

const mixedAudit = mapAuditLogs([
  null,
  "malformed string entry",
  17,
  { id: "audit-valid-after-invalid", action: "USER_UPDATED", createdAt: "2026-01-02T03:04:05.000Z" },
], users);
assert.deepEqual(mixedAudit.invalidRows, [
  { sourceIndex: 1, reason: "record_must_be_object" },
  { sourceIndex: 2, reason: "record_must_be_object" },
  { sourceIndex: 3, reason: "record_must_be_object" },
]);
assert.deepEqual(mixedAudit.rows.map(({ id }) => id), ["audit-valid-after-invalid"]);
assert.equal(JSON.stringify(mixedAudit.invalidRows).includes("malformed string entry"), false);

const invalidAudit = mapAuditLogs([
  { id: "audit-long-type", action: "X", targetType: "t".repeat(41), createdAt: "2026-01-01" },
  { id: "audit-long-id", action: "X", targetId: "i".repeat(121), createdAt: "2026-01-01" },
  { id: "audit-long-action", action: "a".repeat(81), createdAt: "2026-01-01" },
], users);
assert.deepEqual(invalidAudit.invalidRows.map(({ sourceIndex, reason }) => [sourceIndex, reason]), [
  [1, "targetType_exceeds_40_characters"],
  [2, "targetId_exceeds_120_characters"],
  [3, "action_exceeds_80_characters"],
]);
assert.equal(JSON.stringify(invalidAudit.invalidRows).includes("tttt"), false, "invalid values must not be included in diagnostics");

const unresolvedActor = mapAuditLogs([{
  id: "audit-missing-actor", actorUserId: "excluded-or-unknown", action: "ACTION", createdAt: "2026-01-01",
}], users);
assert.equal(unresolvedActor.rows[0]?.actorUserId, null);
assert.deepEqual(unresolvedActor.missingActorReferenceRows, [1]);

const revoked = mapRevokedSessions(["hash-without-date", { tokenHash: "hash-with-date", revokedAt: "2025-02-03T00:00:00.000Z" }]);
assert.equal(revoked.invalidRows.length, 0);
assert.equal(revoked.rows[0]?.revokedAt, null, "hash-only legacy records must not invent an historical timestamp");
assert.equal(revoked.rows[1]?.revokedAt?.toISOString(), "2025-02-03T00:00:00.000Z");
const migrationTime = new Date("2026-10-23T00:00:00.000Z");
const stamped = applyRevokedSessionMigrationTimestamp(revoked.rows, migrationTime);
assert.equal(stamped.missingTimestampCount, 1);
assert.equal(stamped.rows[0]?.revokedAt.toISOString(), migrationTime.toISOString());
assert.equal(stamped.rows[1]?.revokedAt.toISOString(), "2025-02-03T00:00:00.000Z");

assert.equal(isImportableLegacyRole("USER"), true);
assert.equal(isImportableLegacyRole("ADMIN"), false);
assert.equal(isImportableLegacyRole("SUPER_ADMIN"), false);
assert.equal(isSkippedAdministratorRole("SUPER_ADMIN"), true);
assert.equal(isSkippedAdministratorRole("PRODUCT_MANAGER"), true);
assert.equal(isSkippedAdministratorRole("UNKNOWN_ROLE"), false);

process.env.NODE_ENV = "test";
process.env.STORAGE_MODE = "json";
for (const name of ["DATABASE_URL", "DIRECT_URL", "DATABASE_TARGET", "NEON_ENDPOINT_ID"]) {
  delete process.env[name];
}
const [{ validateInitialSuperAdminInput, provisionInitialSuperAdmin }, { hashPassword, verifyPassword }] = await Promise.all([
  import("../src/services/initialSuperAdmin.ts"),
  import("../src/utils/crypto.ts"),
]);
const mfaKey = Buffer.alloc(32).toString("base64");
const validated = validateInitialSuperAdminInput({
  email: "admin@example.test",
  confirmation: "ADMIN@example.test",
  name: "  Test   Admin ",
  password: "correct horse battery",
  mfaEncryptionKey: mfaKey,
});
assert.deepEqual(validated, { email: "admin@example.test", name: "Test Admin", password: "correct horse battery" });
assert.throws(() => validateInitialSuperAdminInput({ ...validated, confirmation: validated.email, mfaEncryptionKey: mfaKey, password: "short" }), /12 to 256 characters/);
assert.throws(() => validateInitialSuperAdminInput({ ...validated, confirmation: validated.email, mfaEncryptionKey: "bad" }), /32-byte MFA_ENCRYPTION_KEY/);
const passwordHash = hashPassword(validated.password);
assert.notEqual(passwordHash, validated.password);
assert.equal(verifyPassword(validated.password, passwordHash), true);
assert.equal(verifyPassword("wrong password", passwordHash), false);

// In-memory transaction doubles exercise the transaction-scoped lock contract
// and rollback boundaries without opening a database connection.
const createBootstrapHarness = (initialUsers: Array<Record<string, unknown>> = []) => {
  const users = [...initialUsers];
  const stats = { lockQueries: 0, userCreates: 0, auditCreates: 0, securityCreates: 0 };
  let lockTail = Promise.resolve();

  const acquireLock = async () => {
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
    const previous = lockTail;
    lockTail = lockTail.then(() => current);
    await previous;
    return releaseCurrent;
  };

  const provision = async (input: typeof validated) => {
    let release: (() => void) | undefined;
    const fakeTx = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("?");
        assert.match(sql, /WITH held_lock AS MATERIALIZED/);
        assert.match(sql, /SELECT COUNT\(\*\) > 0 AS acquired FROM held_lock/);
        assert.match(sql, /pg_advisory_xact_lock/);
        assert.deepEqual(values, []);
        stats.lockQueries += 1;
        release = await acquireLock();
        return [{ acquired: true }];
      },
      user: {
        findUnique: async ({ where }: { where: { email: string } }) =>
          users.find((row) => row.email === where.email) ?? null,
        count: async ({ where }: { where: { role: { not: string } } }) => {
          assert.deepEqual(where, { role: { not: "USER" } });
          return users.filter((row) => row.role !== "USER").length;
        },
        findMany: async () => users.map((row) => ({ referralCode: row.referralCode as string })),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stats.userCreates += 1;
          const row = { ...data, id: `test-${users.length + 1}` };
          users.push(row);
          return row;
        },
      },
      auditLog: { create: async () => { stats.auditCreates += 1; } },
      securityEvent: { create: async () => { stats.securityCreates += 1; } },
    };
    try {
      return await provisionInitialSuperAdmin(fakeTx as never, input);
    } finally {
      release?.();
    }
  };

  return { users, stats, provision };
};

const assertGuardDidNotCreateRecords = (
  harness: ReturnType<typeof createBootstrapHarness>,
  existingUserCount: number,
) => {
  assert.equal(harness.users.length, existingUserCount);
  assert.equal(harness.stats.userCreates, 0);
  assert.equal(harness.stats.auditCreates, 0);
  assert.equal(harness.stats.securityCreates, 0);
};

const existingSuperAdmin = createBootstrapHarness([{
  id: "existing-super-admin",
  email: "existing-super-admin@example.test",
  role: "SUPER_ADMIN",
  referralCode: "existing-super-admin",
}]);
await assert.rejects(existingSuperAdmin.provision(validated), /An administrator already exists/);
assertGuardDidNotCreateRecords(existingSuperAdmin, 1);

const existingFinanceAdmin = createBootstrapHarness([{
  id: "existing-finance-admin",
  email: "existing-finance-admin@example.test",
  role: "FINANCE_ADMIN",
  referralCode: "existing-finance-admin",
}]);
await assert.rejects(existingFinanceAdmin.provision(validated), /An administrator already exists/);
assertGuardDidNotCreateRecords(existingFinanceAdmin, 1);

const emptyBootstrap = createBootstrapHarness();
const createdAdmin = await emptyBootstrap.provision(validated);
assert.equal(createdAdmin.role, "SUPER_ADMIN");
assert.equal(emptyBootstrap.users.length, 1);
assert.equal(emptyBootstrap.stats.userCreates, 1);
assert.deepEqual(emptyBootstrap.users[0]?.profile, { create: {} });
assert.deepEqual(emptyBootstrap.users[0]?.preferences, { create: {} });
assert.equal(emptyBootstrap.stats.auditCreates, 1);
assert.equal(emptyBootstrap.stats.securityCreates, 1);

const concurrentBootstrap = createBootstrapHarness();
const concurrent = await Promise.allSettled([
  concurrentBootstrap.provision(validated),
  concurrentBootstrap.provision({ ...validated, email: "second-admin@example.test" }),
]);
assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
assert.equal(concurrentBootstrap.users.length, 1);
assert.equal(concurrentBootstrap.stats.userCreates, 1);
assert.equal(concurrentBootstrap.stats.auditCreates, 1);
assert.equal(concurrentBootstrap.stats.securityCreates, 1);
assert.equal(concurrentBootstrap.stats.lockQueries, 2, "each attempt must acquire the transaction-scoped lock first");

console.log("Importer audit, revoked-session, administrator exclusion, password/MFA validation, and concurrent bootstrap safety passed.");
