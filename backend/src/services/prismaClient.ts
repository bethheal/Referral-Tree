import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { env } from "../config/env.ts";
import {
  validateDatabaseEnvironment,
  validateProductionDatabaseEnvironment,
} from "../utils/databaseSafety.ts";

const databaseSettings = env.storageMode === "postgres"
  ? env.environment === "production"
    ? validateProductionDatabaseEnvironment()
    : validateDatabaseEnvironment()
  : null;
// JSON mode still imports the PostgreSQL router module. This unreachable adapter
// URL fails immediately if routing ever reaches Prisma accidentally.
const databaseUrl = databaseSettings?.databaseUrl ?? "postgresql://disabled:disabled@127.0.0.1:1/disabled";

const globalPrisma = globalThis as typeof globalThis & { angelFoodsPrisma?: PrismaClient };
export const prisma = globalPrisma.angelFoodsPrisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
  // Route startup failures through the sanitized server entrypoint instead of
  // allowing adapter/driver diagnostics to print connection details.
  log: [],
});
if (process.env.NODE_ENV !== "production") globalPrisma.angelFoodsPrisma = prisma;

export const postgresRuntimeEnabled = () => databaseSettings !== null;
export const connectPostgres = () => prisma.$connect();
export const disconnectPostgresClient = () => prisma.$disconnect();
