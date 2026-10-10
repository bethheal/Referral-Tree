import crypto from "node:crypto";
import { env } from "../config/env.ts";

const base64Url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

export const createId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(12).toString("hex")}`;

export const nowIso = () => new Date().toISOString();

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 210000, 32, "sha256")
    .toString("hex");

  return `pbkdf2$${salt}$${hash}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [, salt, hash] = stored.split("$");

  if (!salt || !hash) return false;

  const candidate = crypto
    .pbkdf2Sync(password, salt, 210000, 32, "sha256")
    .toString("hex");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
};

export const createOtp = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");

export const hashOtp = (otp: string) =>
  crypto.createHmac("sha256", env.otpPepper).update(otp).digest("hex");

export const signToken = (payload: Record<string, unknown>) => {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    })
  );
  const signature = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
};

export const verifyToken = (token: string) => {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) return null;

  const expected = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${header}.${body}`)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));

  if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
    return null;
  }

  return payload as { sub: string; role: string; exp: number };
};
