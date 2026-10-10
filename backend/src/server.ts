import http from "node:http";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.ts";
import { route } from "./routes/router.ts";

export const createServer = () => http.createServer(route);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(env.port, () => {
    console.log(`Angel Foods backend listening on ${env.apiBaseUrl}`);
  });
}
