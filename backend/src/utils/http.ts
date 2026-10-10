import type { IncomingMessage, ServerResponse } from "node:http";

export const readJson = async <T>(request: IncomingMessage) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8");

  return (body ? JSON.parse(body) : {}) as T;
};

export const sendJson = (
  response: ServerResponse,
  status: number,
  payload: unknown
) => {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
};

export const getRequestContext = (request: IncomingMessage) => ({
  ipAddress:
    request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
    request.socket.remoteAddress,
  userAgent: request.headers["user-agent"],
});
