import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const childScript = "await import('./src/config/env.ts')";
const baseEnv = {
  ...process.env,
  NODE_ENV: "production",
  JWT_SECRET: "a".repeat(48),
  OTP_PEPPER: "b".repeat(48),
  OTP_DEV_MODE: "false",
  FLW_SECRET_KEY: "test-secret",
  FLW_SECRET_HASH: "test-hash",
  PAYMENT_REDIRECT_URL: "https://api.example.test/payments/return",
  DATABASE_URL: "postgres://unused:unused@localhost:5432/unused",
  API_BASE_URL: "https://api.example.test",
};

const runConfig = (overrides: NodeJS.ProcessEnv = {}) =>
  spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", childScript],
    { cwd: new URL("../", import.meta.url), env: { ...baseEnv, ...overrides }, encoding: "utf8" },
  );

const missingOrigins = runConfig({ ALLOWED_ORIGINS: "" });
assert.notEqual(missingOrigins.status, 0);
assert.match(missingOrigins.stderr, /ALLOWED_ORIGINS must be explicitly set/);

const insecureOrigin = runConfig({ ALLOWED_ORIGINS: "http://app.example.test" });
assert.notEqual(insecureOrigin.status, 0);
assert.match(insecureOrigin.stderr, /ALLOWED_ORIGINS must be explicitly set/);

const missingApiUrl = runConfig({ ALLOWED_ORIGINS: "https://app.example.test", API_BASE_URL: "" });
assert.notEqual(missingApiUrl.status, 0);
assert.match(missingApiUrl.stderr, /API_BASE_URL must be explicitly set/);

const validPublicUrls = runConfig({ ALLOWED_ORIGINS: "https://app.example.test" });
assert.notEqual(validPublicUrls.status, 0);
assert.match(validPublicUrls.stderr, /PostgreSQL adapter and reviewed migrations/);

console.log("Production environment URL validation passed.");
