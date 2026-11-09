import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const LOCK_NAMESPACE = 1095122756;
const LOCK_KEY = 1398095954;
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
let failureStage = "validating development database target";

class ProbeRollback extends Error {}

const safeErrorTag = (error: unknown) => {
  if (!error || typeof error !== "object") return "unknown-error";
  const candidate = error as { name?: unknown; code?: unknown; meta?: { code?: unknown } };
  if (typeof candidate.meta?.code === "string" && /^[A-Z0-9]{5}$/.test(candidate.meta.code)) {
    return `${typeof candidate.code === "string" ? candidate.code : "database-error"}_${candidate.meta.code}`;
  }
  const tag = typeof candidate.code === "string" ? candidate.code : candidate.name;
  return typeof tag === "string" && /^[A-Za-z0-9_]{1,48}$/.test(tag) ? tag : "database-error";
};

const main = async () => {
  // This checks both URLs independently. The stricter target condition below
  // prevents this integration probe from running against a local database.
  const database = validateDatabaseEnvironment();
  if (database.target !== "angelfoods-dev" || !database.endpointId) {
    throw new Error("The advisory-lock probe is restricted to the approved development endpoint.");
  }

  failureStage = "opening two independent database clients";
  const clientA = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.directUrl }) });
  const clientB = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.directUrl }) });
  const rollbackA = new ProbeRollback("rollback probe transaction A");
  const rollbackB = new ProbeRollback("rollback probe transaction B");

  let markAReady!: () => void;
  const aReady = new Promise<void>((resolve) => { markAReady = resolve; });
  let releaseA!: () => void;
  const releaseAAfterProbe = new Promise<void>((resolve) => { releaseA = resolve; });
  let connectionAPid: number | undefined;
  let connectionBPid: number | undefined;

  failureStage = "connection A acquiring the advisory lock";
  const transactionA = clientA.$transaction(async (tx) => {
    failureStage = "connection A setting its transaction read-only";
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    failureStage = "connection A acquiring the transaction-scoped lock";
    const lockResult = await tx.$queryRaw<Array<{ acquired: boolean; pid: number }>>`
      WITH held_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE}, ${LOCK_KEY})
      ), connection_info AS MATERIALIZED (
        SELECT pg_backend_pid() AS pid
      )
      SELECT COUNT(*) > 0 AS acquired, MAX(connection_info.pid) AS pid
      FROM held_lock CROSS JOIN connection_info
    `;
    if (lockResult[0]?.acquired !== true) throw new Error("Connection A did not acquire the advisory lock.");
    connectionAPid = lockResult[0]?.pid;
    failureStage = "connection A holding the lock while connection B probes";
    markAReady();
    await releaseAAfterProbe;
    throw rollbackA;
  }, TRANSACTION_OPTIONS).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  try {
    failureStage = "waiting for connection A to acquire the lock";
    const startState = await Promise.race([
      aReady.then(() => ({ locked: true as const })),
      transactionA.then((result) => ({ locked: false as const, result })),
    ]);
    if (!startState.locked) {
      failureStage = `${failureStage} (${startState.result.ok ? "unexpected-commit" : safeErrorTag(startState.result.error)})`;
      throw new Error("Connection A failed before acquiring the lock.");
    }

    let connectionBAcquired: boolean | undefined;
    let connectionBError: unknown;
    try {
      failureStage = "connection B attempting the non-blocking advisory lock";
      await clientB.$transaction(async (tx) => {
        failureStage = "connection B setting its transaction read-only";
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        failureStage = "connection B attempting the non-blocking transaction lock";
        const rows = await tx.$queryRaw<Array<{ acquired: boolean; pid: number }>>`
          WITH lock_attempt AS MATERIALIZED (
            SELECT pg_try_advisory_xact_lock(${LOCK_NAMESPACE}, ${LOCK_KEY}) AS acquired
          )
          SELECT COALESCE(bool_or(acquired), false) AS acquired, pg_backend_pid() AS pid
          FROM lock_attempt
        `;
        connectionBAcquired = rows[0]?.acquired;
        connectionBPid = rows[0]?.pid;
        throw rollbackB;
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      if (!(error instanceof ProbeRollback) || error !== rollbackB) connectionBError = error;
    } finally {
      releaseA();
    }

    const aResult = await transactionA;
    failureStage = "verifying both probe transactions rolled back";
    if (!aResult.ok && aResult.error !== rollbackA) throw new Error("Connection A transaction failed before its planned rollback.");
    if (aResult.ok) throw new Error("Connection A unexpectedly committed the probe transaction.");
    if (connectionBError) throw new Error("Connection B failed during the non-blocking lock probe.");
    if (connectionBAcquired !== false) throw new Error("Connection B acquired the lock while connection A held it.");
    if (connectionAPid === undefined || connectionBPid === undefined || connectionAPid === connectionBPid) {
      throw new Error("The probe did not use two distinct PostgreSQL connections.");
    }

    console.log("Advisory-lock integration check passed: connection B could not acquire connection A's transaction lock; both transactions rolled back.");
  } finally {
    // Always let A reach its intentional rollback, then close both independent pools.
    releaseA();
    await transactionA;
    await Promise.allSettled([clientA.$disconnect(), clientB.$disconnect()]);
  }
};

main().catch(() => {
  // Avoid emitting adapter errors that could contain connection configuration.
  console.error(`Advisory-lock integration check failed safely during ${failureStage}; inspect configuration and retry.`);
  process.exitCode = 1;
});
