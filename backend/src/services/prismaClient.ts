import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

// Harmless local fallback keeps JSON-backed tests from opening a connection.
// PostgreSQL routes are only selected when DATABASE_URL and DATABASE_TARGET are set.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/angelfoods_dev";

const globalPrisma = globalThis as typeof globalThis & { angelFoodsPrisma?: PrismaClient };
export const prisma = globalPrisma.angelFoodsPrisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
  log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
});
if (process.env.NODE_ENV !== "production") globalPrisma.angelFoodsPrisma = prisma;

export const postgresRuntimeEnabled = () =>
  ["local", "angelfoods-dev", "production"].includes(process.env.DATABASE_TARGET ?? "") &&
  Boolean(process.env.DATABASE_URL);
