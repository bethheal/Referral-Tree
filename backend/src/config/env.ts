import path from "node:path";

const root = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.join(process.cwd(), "backend");

export const env = {
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3001",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081,http://localhost:19006,http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  environment: process.env.NODE_ENV ?? "development",
  databaseFile:
    process.env.DATABASE_FILE ?? path.join(root, "data", "dev-db.json"),
  jwtSecret:
    process.env.JWT_SECRET ??
    "dev-only-change-me-before-using-this-backend-outside-local",
  minCashOut: Number(process.env.MIN_CASH_OUT ?? 10),
  otpDevMode: process.env.OTP_DEV_MODE === "true",
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  otpPepper:
    process.env.OTP_PEPPER ??
    "dev-only-change-me-before-using-otp-outside-local",
  otpResendCooldownSeconds: Number(
    process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60
  ),
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 600),
  maxRequestBytes: Number(process.env.MAX_REQUEST_BYTES ?? 32 * 1024),
  flutterwaveSecretKey: process.env.FLW_SECRET_KEY ?? "",
  flutterwaveSecretHash: process.env.FLW_SECRET_HASH ?? "",
  paymentRedirectUrl: process.env.PAYMENT_REDIRECT_URL ?? "",
  membershipPricesGhs: {
    silver: Number(process.env.MEMBERSHIP_SILVER_PRICE_GHS ?? 0),
    gold: Number(process.env.MEMBERSHIP_GOLD_PRICE_GHS ?? 0),
    premium: Number(process.env.MEMBERSHIP_PREMIUM_PRICE_GHS ?? 0),
  },
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
  port: Number(process.env.PORT ?? 3001),
};

if (env.environment === "production") {
  if (env.jwtSecret.length < 32 || env.jwtSecret.startsWith("dev-only")) {
    throw new Error("JWT_SECRET must be a unique secret of at least 32 characters in production.");
  }
  if (env.otpPepper.length < 32 || env.otpPepper.startsWith("dev-only")) {
    throw new Error("OTP_PEPPER must be a unique secret of at least 32 characters in production.");
  }
  if (env.otpDevMode) {
    throw new Error("OTP_DEV_MODE must be false in production.");
  }
  const isHttpsOrigin = (origin: string) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === "https:" && parsed.origin === origin;
    } catch {
      return false;
    }
  };
  if (
    !process.env.ALLOWED_ORIGINS?.trim() ||
    env.allowedOrigins.length === 0 ||
    env.allowedOrigins.some((origin) => !isHttpsOrigin(origin))
  ) {
    throw new Error("ALLOWED_ORIGINS must be explicitly set to comma-separated HTTPS origins in production.");
  }
  try {
    if (!process.env.API_BASE_URL?.trim() || new URL(env.apiBaseUrl).protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error("API_BASE_URL must be explicitly set to the public HTTPS API URL in production.");
  }
  if (!env.flutterwaveSecretKey || !env.flutterwaveSecretHash || !env.paymentRedirectUrl.startsWith("https://")) {
    throw new Error("Flutterwave server keys, webhook hash, and HTTPS payment redirect URL are required in production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production; JSON storage is development-only.");
  }
  throw new Error("Production startup is blocked until the PostgreSQL adapter and reviewed migrations are installed.");
}
