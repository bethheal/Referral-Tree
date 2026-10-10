import path from "node:path";

const root = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.join(process.cwd(), "backend");

export const env = {
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3001",
  databaseFile:
    process.env.DATABASE_FILE ?? path.join(root, "data", "dev-db.json"),
  jwtSecret:
    process.env.JWT_SECRET ??
    "dev-only-change-me-before-using-this-backend-outside-local",
  minCashOut: Number(process.env.MIN_CASH_OUT ?? 10),
  otpDevMode: process.env.OTP_DEV_MODE !== "false",
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  otpPepper:
    process.env.OTP_PEPPER ??
    "dev-only-change-me-before-using-otp-outside-local",
  otpResendCooldownSeconds: Number(
    process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60
  ),
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 600),
  port: Number(process.env.PORT ?? 3001),
};
