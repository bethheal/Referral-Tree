import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "../config/env.ts";

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const readJson = async <T>(request: IncomingMessage) => {
  const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError("Content-Type must be application/json.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > env.maxRequestBytes) {
      throw new HttpError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) return {} as T;

  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError("Request body must be a JSON object.");
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Request body must contain valid JSON.");
  }
};

export const sendJson = (
  response: ServerResponse,
  status: number,
  payload: unknown
) => {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  response.end(status === 204 ? undefined : JSON.stringify(payload));
};

export const parsePagination = (searchParams: URLSearchParams) => {
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1_000_000
  ) {
    throw new HttpError("Pagination parameters are invalid.", 400, "INVALID_PAGINATION");
  }

  return { limit, offset };
};

export const getRequestContext = (request: IncomingMessage) => ({
  ipAddress: request.socket.remoteAddress,
  userAgent: request.headers["user-agent"],
});
