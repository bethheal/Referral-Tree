import path from "node:path";
import {
  hasDatabaseConfiguration,
  validateDatabaseEnvironment,
  validateProductionDatabaseEnvironment,
} from "../utils/databaseSafety.ts";

const root = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.join(process.cwd(), "backend");

const environment = process.env.NODE_ENV ?? "development";
if (!["development", "test", "production"].includes(environment)) {
  throw new Error("NODE_ENV must be development, test, or production.");
}

const readFeatureFlag = (name: string) => {
  const value = process.env[name];
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
};

const hasStrongSecret = (value: string) => {
  const normalized = value.trim();
  if (normalized.length < 32 || new Set(normalized).size < 12) return false;
  if (/(.)\1{7,}/.test(normalized)) return false;
  return !/(change[-_]?me|replace|example|default|dev[-_]?only|test[-_]?secret)/i.test(normalized);
};

const paymentsEnabled = readFeatureFlag("FEATURE_PAYMENTS_ENABLED");
const commissionsEnabled = readFeatureFlag("FEATURE_COMMISSIONS_ENABLED");
const withdrawalsEnabled = readFeatureFlag("FEATURE_WITHDRAWALS_ENABLED");

const configuredStorageMode = process.env.STORAGE_MODE;
if (configuredStorageMode && !["json", "postgres"].includes(configuredStorageMode)) {
  throw new Error("STORAGE_MODE must be json or postgres.");
}
const storageMode = configuredStorageMode ?? (hasDatabaseConfiguration() ? "postgres" : undefined);
if (!storageMode) {
  throw new Error("STORAGE_MODE must be explicitly set to json for development/test, or postgres with database configuration.");
}
if (storageMode === "json" && environment === "production") {
  throw new Error("JSON storage is disabled in production.");
}
if (storageMode === "json" && hasDatabaseConfiguration()) {
  throw new Error("STORAGE_MODE=json cannot be combined with database configuration.");
}
if (storageMode === "postgres" && !hasDatabaseConfiguration()) {
  throw new Error("STORAGE_MODE=postgres requires database configuration.");
}

const smsProvider = process.env.SMS_PROVIDER ?? (environment === "production" ? "hubtel" : "mock");
if (smsProvider !== "mock" && smsProvider !== "hubtel") {
  throw new Error("SMS_PROVIDER must be mock or hubtel.");
}
const smsLiveValue = process.env.SMS_LIVE_DELIVERY_ENABLED ?? "false";
if (smsLiveValue !== "true" && smsLiveValue !== "false") {
  throw new Error("SMS_LIVE_DELIVERY_ENABLED must be true or false.");
}
const smsLiveDeliveryEnabled = smsLiveValue === "true";
const hubtelClientId = process.env.HUBTEL_CLIENT_ID?.trim() ?? "";
const hubtelClientSecret = process.env.HUBTEL_CLIENT_SECRET?.trim() ?? "";
const hubtelSenderId = process.env.HUBTEL_SENDER_ID?.trim() ?? "";
const hubtelApiBaseUrl = process.env.HUBTEL_API_BASE_URL?.trim() || "https://smsc.hubtel.com";

const isSafeHubtelBaseUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "hubtel.com" || parsed.hostname.endsWith(".hubtel.com")) &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
      (parsed.pathname === "/" || parsed.pathname === "");
  } catch {
    return false;
  }
};

if ((process.env.HUBTEL_API_BASE_URL?.trim() || smsProvider === "hubtel") && !isSafeHubtelBaseUrl(hubtelApiBaseUrl)) {
  throw new Error("HUBTEL_API_BASE_URL must be an HTTPS Hubtel host without a path or credentials.");
}
if (hubtelSenderId && !/^[A-Za-z0-9]{1,11}$/.test(hubtelSenderId)) {
  throw new Error("HUBTEL_SENDER_ID must be 1 to 11 letters or digits.");
}
const hubtelConfigPartCount = [hubtelClientId, hubtelClientSecret, hubtelSenderId].filter(Boolean).length;
if (hubtelConfigPartCount > 0 && hubtelConfigPartCount < 3) {
  throw new Error("HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET, and HUBTEL_SENDER_ID must be configured together.");
}
if (smsLiveDeliveryEnabled && smsProvider !== "hubtel") {
  throw new Error("Live SMS delivery requires SMS_PROVIDER=hubtel.");
}
if (smsLiveDeliveryEnabled && environment !== "development") {
  throw new Error("Live SMS delivery is available only in development in this release.");
}
if (smsLiveDeliveryEnabled && storageMode !== "postgres") {
  throw new Error("Live SMS delivery requires PostgreSQL storage in development.");
}
if (smsLiveDeliveryEnabled && (!hubtelClientId || !hubtelClientSecret || !hubtelSenderId)) {
  throw new Error("Live Hubtel delivery requires the Hubtel client ID, client secret, and sender ID.");
}
if (environment === "production" && smsProvider === "mock") {
  throw new Error("The mock SMS provider is disabled in production.");
}

export const env = {
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3001",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081,http://localhost:19006,http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  environment,
  storageMode,
  databaseFile:
    process.env.DATABASE_FILE ?? path.join(root, "data", "dev-db.json"),
  jwtSecret:
    process.env.JWT_SECRET ??
    "dev-only-change-me-before-using-this-backend-outside-local",
  minCashOut: Number(process.env.MIN_CASH_OUT ?? 10),
  freeTrialDays: Number(process.env.FREE_TRIAL_DAYS ?? 7),
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
  paymentsEnabled,
  commissionsEnabled,
  withdrawalsEnabled,
  paymentRedirectUrl: process.env.PAYMENT_REDIRECT_URL ?? "",
  membershipPricesGhs: {
    silver: Number(process.env.MEMBERSHIP_SILVER_PRICE_GHS ?? 0),
    gold: Number(process.env.MEMBERSHIP_GOLD_PRICE_GHS ?? 0),
    premium: Number(process.env.MEMBERSHIP_PREMIUM_PRICE_GHS ?? 0),
  },
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
  smsProvider,
  smsLiveDeliveryEnabled,
  hubtelClientId,
  hubtelClientSecret,
  hubtelSenderId,
  hubtelApiBaseUrl,
  port: Number(process.env.PORT ?? 3001),
};

if (env.environment === "production") {
  if (!hasStrongSecret(env.jwtSecret)) {
    throw new Error("JWT_SECRET must be a unique, non-default secret of at least 32 characters in production.");
  }
  if (!hasStrongSecret(env.otpPepper)) {
    throw new Error("OTP_PEPPER must be a unique, non-default secret of at least 32 characters in production.");
  }
  if (env.otpDevMode) {
    throw new Error("OTP_DEV_MODE must be false in production.");
  }
  const mfaKey = process.env.MFA_ENCRYPTION_KEY;
  const decodedMfaKey = mfaKey ? Buffer.from(mfaKey, "base64") : Buffer.alloc(0);
  if (
    !mfaKey || decodedMfaKey.length !== 32 ||
    decodedMfaKey.toString("base64").replace(/=+$/, "") !== mfaKey.replace(/=+$/, "")
  ) {
    throw new Error("MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key in production.");
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
    const parsed = new URL(env.apiBaseUrl);
    if (!process.env.API_BASE_URL?.trim() || parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error();
    }
  } catch {
    throw new Error("API_BASE_URL must be explicitly set to the public HTTPS API URL in production.");
  }
  let validPaymentRedirect = false;
  try {
    const parsed = new URL(env.paymentRedirectUrl);
    validPaymentRedirect = parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch { /* validated below */ }
  if (env.paymentsEnabled && (!env.flutterwaveSecretKey.trim() || !env.flutterwaveSecretHash.trim() || !validPaymentRedirect)) {
    throw new Error("Flutterwave server keys, webhook hash, and HTTPS payment redirect URL are required in production.");
  }
  if (env.storageMode !== "postgres") {
    throw new Error("Production requires PostgreSQL storage.");
  }
  const requiredPositiveSettings = [
    env.minCashOut,
    env.freeTrialDays,
    env.otpMaxAttempts,
    env.otpTtlSeconds,
    env.maxRequestBytes,
    env.rateLimitWindowMs,
    env.rateLimitMaxRequests,
  ];
  if (requiredPositiveSettings.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Production numeric security and request settings must be positive finite numbers.");
  }
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65_535) {
    throw new Error("PORT must be a valid TCP port in production.");
  }
  validateProductionDatabaseEnvironment();
} else if (env.storageMode === "postgres") {
  validateDatabaseEnvironment();
}
