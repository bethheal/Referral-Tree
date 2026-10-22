import http from "node:http";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.ts";
import { route } from "./routes/router.ts";
import { postgresRuntimeEnabled } from "./services/prismaClient.ts";
import { disconnectPostgres } from "./routes/postgresRouter.ts";

export const createServer = () => http.createServer(route);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer();
  server.listen(env.port, () => {
    console.log(JSON.stringify({
      event: "server_started",
      port: env.port,
      environment: env.environment,
      storage: postgresRuntimeEnabled() ? "postgresql-prisma" : "development-json",
    }));
  });

  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ event: "server_shutdown", signal }));
    server.close((error) => {
      if (error) {
        console.error(JSON.stringify({ event: "server_shutdown_error" }));
        process.exitCode = 1;
      }
      if (postgresRuntimeEnabled()) void disconnectPostgres();
    });
    setTimeout(() => server.closeAllConnections(), 10_000).unref();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
