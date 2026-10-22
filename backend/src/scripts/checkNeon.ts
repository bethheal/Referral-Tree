import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Run `neon env pull` or configure it in the backend environment.");
}

const target = process.env.DATABASE_TARGET;
const branch = process.env.NEON_BRANCH;
const endpointId = process.env.NEON_ENDPOINT_ID;
const host = new URL(connectionString).hostname;
if (branch === "production" || target === "production") {
  throw new Error("Database connectivity checks are blocked for production.");
}
if (target === "local" && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("DATABASE_TARGET=local requires a localhost PostgreSQL URL.");
}
if (
  target === "angelfoods-dev" &&
  (branch !== "angelfoods-dev" ||
    !endpointId ||
    !(host.startsWith(`${endpointId}.`) || host.startsWith(`${endpointId}-pooler.`)))
) {
  throw new Error("Neon URL does not match the approved angelfoods-dev endpoint.");
}
if (target !== "local" && target !== "angelfoods-dev") {
  throw new Error("Set DATABASE_TARGET=local or angelfoods-dev before checking connectivity.");
}

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
    branch: process.env.NEON_BRANCH ?? null,
    serverTime: row.serverTime.toISOString(),
  }));
} finally {
  await pool.end();
}
