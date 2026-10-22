import crypto from "node:crypto";
import { env } from "../config/env.ts";

const base64Url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

export const createId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(12).toString("hex")}`;

export const hashSessionToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

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

  if (
    !salt ||
    !/^[a-f0-9]{32}$/i.test(salt) ||
    !hash ||
    !/^[a-f0-9]{64}$/i.test(hash)
  ) return false;

  const candidate = crypto
    .pbkdf2Sync(password, salt, 210000, 32, "sha256")
    .toString("hex");

  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(candidate, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
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
      iss: "angelfoods-api",
      aud: "angelfoods-client",
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
  try {
    if (token.length > 4096) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    if (!header || !body || !signature) return null;
    const headerValue = JSON.parse(
      Buffer.from(header, "base64url").toString("utf8")
    );
    if (headerValue.alg !== "HS256" || headerValue.typ !== "JWT") return null;

    const expected = crypto
      .createHmac("sha256", env.jwtSecret)
      .update(`${header}.${body}`)
      .digest("base64url");

    const signatureBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (
      signatureBytes.length !== expectedBytes.length ||
      !crypto.timingSafeEqual(signatureBytes, expectedBytes)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));

    if (
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now() / 1000 ||
      payload.iss !== "angelfoods-api" ||
      payload.aud !== "angelfoods-client" ||
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return payload as {
      sub: string;
      role: string;
      exp: number;
      iss: string;
      aud: string;
    };
  } catch {
    return null;
  }
};
