import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const childScript = "const { env } = await import('./src/config/env.ts'); process.stdout.write(JSON.stringify({ smsProvider: env.smsProvider, smsLiveDeliveryEnabled: env.smsLiveDeliveryEnabled }))";
const baseEnv = {
  ...process.env,
  NODE_ENV: "production",
  STORAGE_MODE: "postgres",
  DATABASE_TARGET: "production",
  PRODUCTION_NEON_ENDPOINT_ID: "ep-prod-config-test",
  NEON_ENDPOINT_ID: "ep-dev-config-test",
  DATABASE_URL: "postgresql://test-user:test-password@ep-prod-config-test.neon.tech/app",
  DIRECT_URL: "postgresql://test-user:test-password@ep-prod-config-test.neon.tech/app",
  JWT_SECRET: "9d6bE2@Aq7Lk3!mR8#sT4%vX1^zC5&hJ",
  OTP_PEPPER: "4nQ7!wE2@rT9#yU5%pA8^sD3&fG6*hjK",
  OTP_DEV_MODE: "false",
  SMS_PROVIDER: "hubtel",
  SMS_LIVE_DELIVERY_ENABLED: "false",
  HUBTEL_CLIENT_ID: "",
  HUBTEL_CLIENT_SECRET: "",
  HUBTEL_SENDER_ID: "",
  HUBTEL_API_BASE_URL: "https://smsc.hubtel.com",
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  FLW_SECRET_KEY: "test-secret",
  FLW_SECRET_HASH: "test-hash",
  PAYMENT_REDIRECT_URL: "https://api.example.test/payments/return",
  FEATURE_PAYMENTS_ENABLED: "false",
  FEATURE_COMMISSIONS_ENABLED: "false",
  FEATURE_WITHDRAWALS_ENABLED: "false",
  API_BASE_URL: "https://api.example.test",
  ALLOWED_ORIGINS: "https://app.example.test",
};

const runConfig = (overrides: NodeJS.ProcessEnv = {}) =>
  spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", childScript],
    { cwd: new URL("../", import.meta.url), env: { ...baseEnv, ...overrides }, encoding: "utf8" },
  );

const validProduction = runConfig();
assert.equal(validProduction.status, 0, validProduction.stderr);

const weakJwtSecret = runConfig({ JWT_SECRET: "a".repeat(48) });
assert.notEqual(weakJwtSecret.status, 0);
assert.match(weakJwtSecret.stderr, /JWT_SECRET must be a unique, non-default secret/);

const malformedMoneyFlag = runConfig({ FEATURE_PAYMENTS_ENABLED: "enabled" });
assert.notEqual(malformedMoneyFlag.status, 0);
assert.match(malformedMoneyFlag.stderr, /FEATURE_PAYMENTS_ENABLED must be true or false/);

const paymentsNeedProviderSettings = runConfig({
  FEATURE_PAYMENTS_ENABLED: "true",
  FLW_SECRET_KEY: "",
  FLW_SECRET_HASH: "",
  PAYMENT_REDIRECT_URL: "",
});
assert.notEqual(paymentsNeedProviderSettings.status, 0);
assert.match(paymentsNeedProviderSettings.stderr, /Flutterwave server keys/);

const productionMockProvider = runConfig({ SMS_PROVIDER: "mock" });
assert.notEqual(productionMockProvider.status, 0);
assert.match(productionMockProvider.stderr, /mock SMS provider is disabled in production/);

const productionLiveSms = runConfig({ SMS_LIVE_DELIVERY_ENABLED: "true" });
assert.notEqual(productionLiveSms.status, 0);
assert.match(productionLiveSms.stderr, /available only in development/);

const unsafeHubtelEndpoint = runConfig({ HUBTEL_API_BASE_URL: "http://example.test" });
assert.notEqual(unsafeHubtelEndpoint.status, 0);
assert.match(unsafeHubtelEndpoint.stderr, /must be an HTTPS Hubtel host/);

const liveSmsWithJsonStorage = runConfig({
  NODE_ENV: "development",
  STORAGE_MODE: "json",
  DATABASE_URL: "",
  DIRECT_URL: "",
  DATABASE_TARGET: "",
  NEON_ENDPOINT_ID: "",
  PRODUCTION_NEON_ENDPOINT_ID: "",
  SMS_PROVIDER: "hubtel",
  SMS_LIVE_DELIVERY_ENABLED: "true",
  HUBTEL_CLIENT_ID: "test-client",
  HUBTEL_CLIENT_SECRET: "test-secret",
  HUBTEL_SENDER_ID: "AngelFoods",
});
assert.notEqual(liveSmsWithJsonStorage.status, 0);
assert.match(liveSmsWithJsonStorage.stderr, /requires PostgreSQL storage/);

const partialHubtelCredentials = runConfig({ HUBTEL_CLIENT_ID: "partial-test-client" });
assert.notEqual(partialHubtelCredentials.status, 0);
assert.match(partialHubtelCredentials.stderr, /must be configured together/);

const developmentMockDefault = runConfig({
  NODE_ENV: "development",
  STORAGE_MODE: "json",
  DATABASE_URL: "",
  DIRECT_URL: "",
  DATABASE_TARGET: "",
  NEON_ENDPOINT_ID: "",
  PRODUCTION_NEON_ENDPOINT_ID: "",
  SMS_PROVIDER: undefined,
  SMS_LIVE_DELIVERY_ENABLED: "false",
});
assert.equal(developmentMockDefault.status, 0, developmentMockDefault.stderr);
assert.match(developmentMockDefault.stdout, /"smsProvider":"mock"/);

const missingDatabase = runConfig({ DATABASE_URL: "", DIRECT_URL: "" });
assert.notEqual(missingDatabase.status, 0);
assert.match(missingDatabase.stderr, /DATABASE_URL is required/);

const invalidDatabase = runConfig({ DATABASE_URL: "not-a-database-url" });
assert.notEqual(invalidDatabase.status, 0);
assert.match(invalidDatabase.stderr, /DATABASE_URL must be a valid PostgreSQL connection URL/);

const invalidDirectDatabase = runConfig({ DIRECT_URL: "not-a-database-url" });
assert.notEqual(invalidDirectDatabase.status, 0);
assert.match(invalidDirectDatabase.stderr, /DIRECT_URL must be a valid PostgreSQL connection URL/);

const missingDirectDatabase = runConfig({ DIRECT_URL: "" });
assert.notEqual(missingDirectDatabase.status, 0);
assert.match(missingDirectDatabase.stderr, /DIRECT_URL is required/);

const developmentEndpointInProduction = runConfig({
  DATABASE_URL: "postgresql://test-user:test-password@ep-dev-config-test.neon.tech/app",
});
assert.notEqual(developmentEndpointInProduction.status, 0);
assert.match(developmentEndpointInProduction.stderr, /must match PRODUCTION_NEON_ENDPOINT_ID/);

const attemptedJsonFallback = runConfig({ STORAGE_MODE: "json" });
assert.notEqual(attemptedJsonFallback.status, 0);
assert.match(attemptedJsonFallback.stderr, /JSON storage is disabled in production/);

const implicitJsonFallback = runConfig({
  NODE_ENV: "development",
  STORAGE_MODE: "",
  DATABASE_TARGET: "",
  PRODUCTION_NEON_ENDPOINT_ID: "",
  NEON_ENDPOINT_ID: "",
  DATABASE_URL: "",
  DIRECT_URL: "",
});
assert.notEqual(implicitJsonFallback.status, 0);
assert.match(implicitJsonFallback.stderr, /STORAGE_MODE must be explicitly set/);

const missingOrigins = runConfig({ ALLOWED_ORIGINS: "" });
assert.notEqual(missingOrigins.status, 0);
assert.match(missingOrigins.stderr, /ALLOWED_ORIGINS must be explicitly set/);

const insecureOrigin = runConfig({ ALLOWED_ORIGINS: "http://app.example.test" });
assert.notEqual(insecureOrigin.status, 0);
assert.match(insecureOrigin.stderr, /ALLOWED_ORIGINS must be explicitly set/);

const missingApiUrl = runConfig({ ALLOWED_ORIGINS: "https://app.example.test", API_BASE_URL: "" });
assert.notEqual(missingApiUrl.status, 0);
assert.match(missingApiUrl.stderr, /API_BASE_URL must be explicitly set/);

console.log("Production configuration validation passed without database access.");
