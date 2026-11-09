import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const EXPECTED_ENDPOINT_ID = "ep-raspy-grass-b5ii56xs";
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 };
let failureStage = "validating the development database target";

class IntentionalRollback extends Error {}

const main = async () => {
  // Validates DATABASE_URL and DIRECT_URL independently before any connection.
  const database = validateDatabaseEnvironment();
  if (database.target !== "angelfoods-dev" || database.endpointId !== EXPECTED_ENDPOINT_ID) {
    throw new Error("This smoke test is restricted to the approved angelfoods-dev endpoint.");
  }

  failureStage = "loading the shared PostgreSQL client";
  const { prisma, postgresRuntimeEnabled } = await import("../services/prismaClient.ts");
  if (!postgresRuntimeEnabled()) {
    throw new Error("The shared Prisma client is not configured for PostgreSQL.");
  }

  try {
    failureStage = "starting the read-only development transaction";
    let lockConfirmed = false;
    let rollbackConfirmed = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;

        failureStage = "verifying the development database name";
        const databaseRows = await tx.$queryRaw<Array<{ databaseName: string }>>`
          SELECT current_database() AS "databaseName"
        `;
        if (databaseRows[0]?.databaseName !== "neondb") {
          throw new Error("Connected database name did not match the approved development database.");
        }

        failureStage = "acquiring and validating the initial-admin advisory lock";
        const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>`
          WITH held_lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(1095122756, 1398095954)
          )
          SELECT COUNT(*) > 0 AS acquired FROM held_lock
        `;
        if (lock[0]?.acquired !== true) {
          throw new Error("The advisory lock query did not return Boolean true.");
        }

        lockConfirmed = true;
        // Throwing aborts the interactive transaction and releases the xact lock.
        throw new IntentionalRollback("rollback after successful lock check");
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      if (error instanceof IntentionalRollback) rollbackConfirmed = true;
      else throw error;
    }

    if (!lockConfirmed || !rollbackConfirmed) {
      throw new Error("The lock check did not complete with the expected rollback.");
    }
    console.log("Development advisory-lock smoke test passed; Boolean true was returned and the transaction rolled back.");
  } finally {
    failureStage = "closing the development database client";
    await prisma.$disconnect();
  }
};

main().catch(() => {
  // Avoid printing adapter errors, which may include connection configuration.
  console.error(`Development advisory-lock smoke test failed safely during ${failureStage}.`);
  process.exitCode = 1;
});
