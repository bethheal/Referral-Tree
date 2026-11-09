import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

// The package command loads .env.development.local first. Validate both URLs and
// endpoint identity before importing a module that constructs Prisma or connects.
const database = validateDatabaseEnvironment();
if (database.target !== "angelfoods-dev" || !database.endpointId) {
  throw new Error("Order integration tests require the approved angelfoods-dev Neon endpoint.");
}
await import("../../tests/orders.postgres.integration.test.ts");
