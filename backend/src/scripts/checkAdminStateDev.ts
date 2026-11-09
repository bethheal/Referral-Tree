import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
const EXPECTED_DATABASE = "neondb";

type AdminStateReport = {
  superAdminCount: number;
  otherAdministratorCount: number;
  administratorCount: number;
  adminAccountExistsForConfiguredEmail: boolean;
};

class ReadOnlyVerificationComplete extends Error {
  report: AdminStateReport;

  constructor(report: AdminStateReport) {
    super("Read-only verification complete; roll back the transaction.");
    this.report = report;
  }
}

class DiagnosticError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const safeErrorCode = (error: unknown) => {
  if (error instanceof DiagnosticError) return error.code;
  if (!error || typeof error !== "object") return "DATABASE_DIAGNOSTIC_FAILED";

  const candidate = error as { code?: unknown; name?: unknown };
  if (typeof candidate.code === "string" && /^[A-Z0-9_]{1,48}$/.test(candidate.code)) {
    return candidate.code;
  }
  if (typeof candidate.name === "string" && /^[A-Za-z0-9_]{1,48}$/.test(candidate.name)) {
    return candidate.name;
  }
  return "DATABASE_DIAGNOSTIC_FAILED";
};

const main = async () => {
  let failureStage = "validating the development database target";
  let disconnect: (() => Promise<void>) | undefined;
  try {
    // This shared guard validates DATABASE_URL and DIRECT_URL and ensures both
    // resolve to the configured, non-production Neon development endpoint.
    const database = validateDatabaseEnvironment();
    if (database.target !== "angelfoods-dev" || !database.endpointId) {
      throw new DiagnosticError("DEVELOPMENT_TARGET_REQUIRED");
    }

    failureStage = "validating the configured admin email";
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!adminEmail) throw new DiagnosticError("ADMIN_EMAIL_NOT_CONFIGURED");

    // Load the shared Prisma client only after the development-only guard passes.
    const { prisma, disconnectPostgresClient } = await import("../services/prismaClient.ts");
    disconnect = disconnectPostgresClient;

    failureStage = "opening a read-only database transaction";
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;

      const identity = await tx.$queryRaw<Array<{ database: string; readOnly: boolean }>>`
        SELECT current_database() AS database,
               current_setting('transaction_read_only') = 'on' AS "readOnly"
      `;
      if (identity[0]?.database !== EXPECTED_DATABASE) {
        throw new DiagnosticError("UNEXPECTED_DATABASE");
      }
      if (identity[0]?.readOnly !== true) {
        throw new DiagnosticError("READ_ONLY_TRANSACTION_NOT_CONFIRMED");
      }

      failureStage = "counting administrator records";
      const [superAdminCount, otherAdministratorCount, administratorCount, matchingAdminCount] =
        await Promise.all([
          tx.user.count({ where: { role: "SUPER_ADMIN" } }),
          tx.user.count({ where: { role: { notIn: ["USER", "SUPER_ADMIN"] } } }),
          tx.user.count({ where: { role: { not: "USER" } } }),
          tx.user.count({ where: { email: adminEmail, role: { not: "USER" } } }),
        ]);

      const report: AdminStateReport = {
        superAdminCount,
        otherAdministratorCount,
        administratorCount,
        adminAccountExistsForConfiguredEmail: matchingAdminCount > 0,
      };
      throw new ReadOnlyVerificationComplete(report);
    }, TRANSACTION_OPTIONS);

    throw new DiagnosticError("READ_ONLY_TRANSACTION_UNEXPECTEDLY_COMMITTED");
  } catch (error) {
    if (error instanceof ReadOnlyVerificationComplete) {
      // The intentional exception above makes Prisma roll back this read-only
      // transaction. Only counts and the email-match Boolean are emitted.
      console.log(JSON.stringify(error.report));
      return;
    }
    console.error(`Admin-state diagnostic failed safely during ${failureStage} (${safeErrorCode(error)}).`);
    process.exitCode = 1;
  } finally {
    if (disconnect) await disconnect().catch(() => undefined);
  }
};

await main();
