import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const database = validateDatabaseEnvironment();
if (database.target !== "angelfoods-dev") throw new Error("PostgreSQL integration tests are restricted to angelfoods-dev.");

// Development OTP is enabled only in this guarded test process so the registration
// request can return its test code without configuring a real delivery provider.
process.env.OTP_DEV_MODE = "true";
await import("../../tests/postgres.integration.test.ts");
