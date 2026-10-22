import { createServer } from "../src/server.ts";
import { disconnectPostgres } from "../src/routes/postgresRouter.ts";

const server = createServer();
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not bind restart probe.");
  // Emit only the ephemeral port; never include connection data or credentials.
  process.stdout.write(`${address.port}\n`);
});

process.once("SIGTERM", () => {
  server.close(() => {
    void disconnectPostgres().finally(() => process.exit(0));
  });
  server.closeAllConnections();
});
