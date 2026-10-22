import { defineConfig } from "prisma/config";

const configuredUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const isDatabaseCommand = process.argv.some((argument) =>
  ["dev", "deploy", "status", "reset", "resolve", "push", "execute", "seed", "--from-config-datasource", "--to-config-datasource"].includes(argument),
);
const isSchemaWriteCommand = process.argv.some((argument) =>
  ["dev", "deploy", "reset", "resolve", "push", "execute", "seed"].includes(argument),
);
const target = process.env.DATABASE_TARGET;

if (process.env.NEON_BRANCH === "production") {
  throw new Error("Prisma commands are blocked when NEON_BRANCH=production.");
}

if (configuredUrl) {
  const host = new URL(configuredUrl).hostname;
  if (target === "local" && host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("DATABASE_TARGET=local requires a localhost PostgreSQL URL.");
  }
  if (target === "angelfoods-dev") {
    const expectedEndpoint = process.env.NEON_ENDPOINT_ID;
    if (!expectedEndpoint || !host.startsWith(`${expectedEndpoint}.`)) {
      throw new Error("Neon URL does not match the approved angelfoods-dev endpoint.");
    }
  }
  if (isDatabaseCommand && target !== "local" && target !== "angelfoods-dev") {
    throw new Error("Database-changing Prisma commands require DATABASE_TARGET=local or angelfoods-dev.");
  }
  if (isSchemaWriteCommand && process.env.CONFIRM_DB_MIGRATION !== target) {
    throw new Error("Set CONFIRM_DB_MIGRATION to the exact non-production target after reviewing migration SQL.");
  }
} else if (isDatabaseCommand) {
  throw new Error("Set a non-production PostgreSQL URL and DATABASE_TARGET before database-changing Prisma commands.");
}

// The schema-only diff path has a harmless local fallback and never connects.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      configuredUrl ??
      "postgresql://postgres:postgres@127.0.0.1:5432/angelfoods_dev?schema=public",
  },
});
