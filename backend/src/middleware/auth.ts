import type { IncomingMessage } from "node:http";
import type { Database, User } from "../models/types.ts";
import { hashSessionToken, verifyToken } from "../utils/crypto.ts";
import { HttpError } from "../utils/http.ts";

export const getBearerToken = (request: IncomingMessage) => {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) return null;

  return header.slice("Bearer ".length);
};

export const requireUser = (data: Database, request: IncomingMessage) => {
  const token = getBearerToken(request);

  if (!token) throw new HttpError("Authentication required.", 401, "UNAUTHENTICATED");

  const payload = verifyToken(token);

  if (!payload) throw new HttpError("Invalid or expired session.", 401, "INVALID_SESSION");
  if (data.revokedSessions?.includes(hashSessionToken(token))) {
    throw new HttpError("Session has been signed out.", 401, "SESSION_REVOKED");
  }

  const user = data.users.find((item) => item.id === payload.sub);

  if (!user || user.status !== "ACTIVE") {
    throw new HttpError("Authentication required.", 401, "UNAUTHENTICATED");
  }

  return user;
};

export const requireAdmin = (user: User) => {
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    throw new HttpError("Admin permission required.", 403, "FORBIDDEN");
  }
};

export const requireSuperAdmin = (user: User) => {
  if (user.role !== "SUPER_ADMIN") {
    throw new HttpError("Super-admin permission required.", 403, "FORBIDDEN");
  }
};
