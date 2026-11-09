import { AdminPermission } from "../generated/prisma/enums.ts";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const EXPECTED_TARGET = "angelfoods-dev";
const EXPECTED_ENDPOINT_ID = "ep-raspy-grass-b5ii56xs";
const EXPECTED_DATABASE = "neondb";
const ACCOUNT_EMAIL = "angelfood@admin.com";
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 };

type PermissionReport = {
  permissions: Record<string, boolean>;
  accountHasSuperAdminRole: boolean;
};

class DiagnosticError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

class ReadOnlyVerificationComplete extends Error {
  readonly report: PermissionReport;

  constructor(report: PermissionReport) {
    super("Read-only verification complete; roll back the transaction.");
    this.report = report;
  }
}

const safeErrorCode = (error: unknown) => {
  if (error instanceof DiagnosticError) return error.code;
  if (!error || typeof error !== "object") return "DATABASE_DIAGNOSTIC_FAILED";
  const candidate = error as { code?: unknown; name?: unknown };
  if (typeof candidate.code === "string" && /^[A-Z0-9_]{1,48}$/.test(candidate.code)) return candidate.code;
  if (typeof candidate.name === "string" && /^[A-Za-z0-9_]{1,48}$/.test(candidate.name)) return candidate.name;
  return "DATABASE_DIAGNOSTIC_FAILED";
};

const main = async () => {
  let failureStage = "validating the development database target";
  let disconnect: (() => Promise<void>) | undefined;
  try {
    // The guard validates both DATABASE_URL and DIRECT_URL before Prisma is loaded.
    const database = validateDatabaseEnvironment();
    if (database.target !== EXPECTED_TARGET) throw new DiagnosticError("DEVELOPMENT_TARGET_REQUIRED");
    if (database.endpointId !== EXPECTED_ENDPOINT_ID) throw new DiagnosticError("UNEXPECTED_DEVELOPMENT_ENDPOINT");

    // Importing the shared client only after all target checks prevents an accidental connection.
    const { prisma, disconnectPostgresClient } = await import("../services/prismaClient.ts");
    disconnect = disconnectPostgresClient;

    failureStage = "opening a read-only database transaction";
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const identity = await tx.$queryRaw<Array<{ database: string; readOnly: boolean }>>`
        SELECT current_database() AS database,
               current_setting('transaction_read_only') = 'on' AS "readOnly"
      `;
      if (identity[0]?.database !== EXPECTED_DATABASE) throw new DiagnosticError("UNEXPECTED_DATABASE");
      if (identity[0]?.readOnly !== true) throw new DiagnosticError("READ_ONLY_TRANSACTION_NOT_CONFIRMED");

      failureStage = "reading Super Admin permissions";
      const [grants, matchingAccount] = await Promise.all([
        tx.rolePermission.findMany({ where: { role: "SUPER_ADMIN" }, select: { permission: true } }),
        tx.user.findFirst({ where: { email: ACCOUNT_EMAIL, role: "SUPER_ADMIN" }, select: { id: true } }),
      ]);
      const granted = new Set(grants.map(({ permission }) => permission));
      const permissions = Object.fromEntries(
        Object.values(AdminPermission).map((permission) => [permission, granted.has(permission)]),
      );
      throw new ReadOnlyVerificationComplete({
        permissions,
        accountHasSuperAdminRole: matchingAccount !== null,
      });
    }, TRANSACTION_OPTIONS);

    throw new DiagnosticError("READ_ONLY_TRANSACTION_UNEXPECTEDLY_COMMITTED");
  } catch (error) {
    if (error instanceof ReadOnlyVerificationComplete) {
      console.log(JSON.stringify(error.report, null, 2));
      return;
    }
    console.error(`Super Admin permission diagnostic failed safely during ${failureStage} (${safeErrorCode(error)}).`);
    process.exitCode = 1;
  } finally {
    if (disconnect) await disconnect().catch(() => undefined);
  }
};

await main();
