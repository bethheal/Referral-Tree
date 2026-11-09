import { Pool } from "pg";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const { databaseUrl: connectionString, target, endpointId } = validateDatabaseEnvironment();

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 1_000,
  ssl: { rejectUnauthorized: true },
});

try {
  const result = await pool.query<{ database: string; serverTime: Date }>(
    "select current_database() as database, now() as \"serverTime\"",
  );
  const row = result.rows[0];
  if (!row) throw new Error("Neon returned no database status row.");

  console.log(JSON.stringify({
    event: "neon_database_connected",
    database: row.database,
    target,
    endpointId,
    serverTime: row.serverTime.toISOString(),
  }));
} finally {
  await pool.end();
}
