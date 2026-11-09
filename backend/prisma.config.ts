import { defineConfig } from "prisma/config";
import { validateDatabaseEnvironmentIfConfigured } from "./src/utils/databaseSafety.ts";

const databaseSettings = validateDatabaseEnvironmentIfConfigured();
const isDatabaseCommand = process.argv.some((argument) =>
  ["migrate", "db", "studio", "dev", "deploy", "status", "reset", "resolve", "push", "execute", "seed", "--from-config-datasource", "--to-config-datasource"].includes(argument),
);
const isSchemaWriteCommand = process.argv.some((argument) =>
  ["dev", "deploy", "reset", "resolve", "push", "execute", "seed"].includes(argument),
);
const target = databaseSettings?.target ?? process.env.DATABASE_TARGET;
if (isDatabaseCommand && !databaseSettings) {
  throw new Error("Both database URLs and an approved target are required before Prisma database access.");
}
if (isSchemaWriteCommand && process.env.CONFIRM_DB_MIGRATION !== target) {
  throw new Error("Set CONFIRM_DB_MIGRATION to the exact non-production target after reviewing migration SQL.");
}

// The schema-only diff path has a harmless local fallback and never connects.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      databaseSettings?.directUrl ??
      "postgresql://postgres:postgres@127.0.0.1:5432/angelfoods_dev?schema=public",
  },
});
