import { Pool } from "pg";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

// Validate both pooled and direct URLs before opening any connection. Inspection
// uses the runtime URL only after the shared guard verifies its Neon endpoint.
const database = validateDatabaseEnvironment();
if (database.target !== "angelfoods-dev" || !database.endpointId) {
  throw new Error("Database inspection is restricted to the verified angelfoods-dev endpoint.");
}

const pool = new Pool({
  connectionString: database.databaseUrl,
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 1_000,
  ssl: { rejectUnauthorized: true },
});

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

try {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;

    const identity = await client.query<{ database: string; readOnly: boolean }>(
      "SELECT current_database() AS database, current_setting('transaction_read_only') = 'on' AS \"readOnly\"",
    );

    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         AND table_name <> '_prisma_migrations'
       ORDER BY table_name`,
    );

    const publicTables = [];
    for (const { table_name: tableName } of tables.rows) {
      const qualifiedName = `"public".${quoteIdentifier(tableName)}`;
      const presence = await client.query<{ has_rows: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM ${qualifiedName} LIMIT 1) AS has_rows`,
      );
      publicTables.push({ name: tableName, hasRows: presence.rows[0]?.has_rows ?? false });
    }

    const migrationTable = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists",
    );
    let migrationHistory: Record<string, unknown>;
    if (!migrationTable.rows[0]?.exists) {
      migrationHistory = { exists: false, entries: [] };
    } else {
      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
         ORDER BY ordinal_position`,
      );
      const availableColumns = columns.rows.map(({ column_name }) => column_name);
      const requiredColumns = ["migration_name", "started_at", "finished_at", "rolled_back_at"];
      if (!requiredColumns.every((column) => availableColumns.includes(column))) {
        migrationHistory = {
          exists: true,
          complete: false,
          availableColumns,
          entries: [],
        };
      } else {
        const history = await client.query<{
          migration_name: string;
          started_at: Date | null;
          finished_at: Date | null;
          rolled_back_at: Date | null;
        }>(
          `SELECT migration_name, started_at, finished_at, rolled_back_at
           FROM public."_prisma_migrations" ORDER BY started_at, migration_name`,
        );
        migrationHistory = {
          exists: true,
          complete: true,
          entries: history.rows.map((entry) => ({
            name: entry.migration_name,
            status: entry.rolled_back_at
              ? "rolled_back"
              : entry.finished_at
                ? "applied"
                : entry.started_at
                  ? "incomplete"
                  : "recorded_without_start",
          })),
        };
      }
    }

    if (!identity.rows[0]?.readOnly) {
      throw new Error("Read-only transaction could not be confirmed.");
    }
    console.log(JSON.stringify({
      event: "development_database_inspection",
      target: database.target,
      endpointId: database.endpointId,
      database: identity.rows[0].database,
      transactionReadOnly: true,
      publicTables,
      prismaMigrationHistory: migrationHistory,
    }));
  } finally {
    if (transactionStarted) await client.query("ROLLBACK");
    client.release();
  }
} catch {
  // Do not echo driver errors, which can contain connection details.
  console.error("Development database inspection failed; connection details were suppressed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
