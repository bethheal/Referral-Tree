import type { IncomingMessage } from "node:http";
import type { Database, User } from "../models/types.ts";
import { verifyToken } from "../utils/crypto.ts";

export const getBearerToken = (request: IncomingMessage) => {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) return null;

  return header.slice("Bearer ".length);
};

export const requireUser = (data: Database, request: IncomingMessage) => {
  const token = getBearerToken(request);

  if (!token) throw new Error("Authentication required.");

  const payload = verifyToken(token);

  if (!payload) throw new Error("Invalid or expired session.");

  const user = data.users.find((item) => item.id === payload.sub);

  if (!user || user.status !== "ACTIVE") {
    throw new Error("Authentication required.");
  }

  return user;
};

export const requireAdmin = (user: User) => {
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    throw new Error("Admin permission required.");
  }
};
