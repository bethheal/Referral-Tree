import http from "node:http";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.ts";
import { route } from "./routes/router.ts";
import type { PostgresRouteDependencies } from "./routes/postgresRouter.ts";
import { connectPostgres, disconnectPostgresClient, postgresRuntimeEnabled } from "./services/prismaClient.ts";
import { startStockReservationExpiryWorker } from "./services/stockReservationExpiry.ts";

export const createServer = (postgresDependencies?: PostgresRouteDependencies) => http.createServer((request, response) => {
  void route(request, response, postgresDependencies);
});

export const initializePostgresBeforeListen = async (
  storageMode: string,
  connect: () => Promise<unknown>,
  listen: () => Promise<void>,
) => {
  if (storageMode === "postgres") {
    try {
      await connect();
    } catch {
      throw new Error("PostgreSQL connection failed; the server was not started.");
    }
  }
  await listen();
};

export const startServer = async () => {
  let startedServer: http.Server | undefined;
  await initializePostgresBeforeListen(env.storageMode, connectPostgres, async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(env.port, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    startedServer = server;
  });
  // initializePostgresBeforeListen always invokes the listen callback on success.
  // Keep the server reference outside the callback for shutdown registration.
  // (Assigned inside the callback so a failed DB connection never constructs it.)
  if (!startedServer) throw new Error("Server listener was not initialized.");
  const server = startedServer;
  const stopReservationExpiryWorker = postgresRuntimeEnabled() ? startStockReservationExpiryWorker() : undefined;
  console.log(JSON.stringify({
    event: "server_started",
    port: env.port,
    environment: env.environment,
    storage: postgresRuntimeEnabled() ? "postgresql-prisma" : "development-json",
  }));

  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ event: "server_shutdown", signal }));
    stopReservationExpiryWorker?.();
    server.close((error) => {
      if (error) {
        console.error(JSON.stringify({ event: "server_shutdown_error" }));
        process.exitCode = 1;
      }
      if (postgresRuntimeEnabled()) void disconnectPostgresClient();
    });
    setTimeout(() => server.closeAllConnections(), 10_000).unref();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  return server;
};

export const startServerEntrypoint = async (
  start: () => Promise<unknown> = startServer,
  logError: (message: string) => void = (message) => console.error(message),
) => {
  try {
    await start();
    return true;
  } catch {
    logError(JSON.stringify({ event: "server_startup_failed", reason: "configuration_or_database_unavailable" }));
    process.exitCode = 1;
    return false;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServerEntrypoint();
}
