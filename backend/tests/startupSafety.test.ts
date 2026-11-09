import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "angelfoods-json-launcher-"));
const envFile = path.join(temporaryDirectory, ".env");
const envFileContent = "DO_NOT_CHANGE=this-test-marker\n";
fs.writeFileSync(envFile, envFileContent, "utf8");
const launcherPath = fileURLToPath(new URL("../src/scripts/enableJsonDev.ts", import.meta.url));
const launcherUrl = pathToFileURL(launcherPath).href;
const launcherProgram = "process.stdout.write(`ENTRY_RAN:${process.env.NODE_ENV}:${process.env.STORAGE_MODE}`)";

const runLauncher = (nodeEnv?: string) => {
  const childEnv = { ...process.env };
  for (const name of ["NODE_ENV", "STORAGE_MODE", "DATABASE_URL", "DIRECT_URL", "DATABASE_TARGET", "NEON_ENDPOINT_ID"]) {
    delete childEnv[name];
  }
  if (nodeEnv !== undefined) childEnv.NODE_ENV = nodeEnv;
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--import", launcherUrl, "--input-type=module", "-e", launcherProgram],
    { cwd: temporaryDirectory, env: childEnv, encoding: "utf8" },
  );
};

try {
  for (const rejectedEnvironment of [undefined, "", "production", "staging"]) {
    const result = runLauncher(rejectedEnvironment);
    assert.notEqual(result.status, 0, `expected NODE_ENV=${String(rejectedEnvironment)} to be rejected`);
    assert.doesNotMatch(result.stdout, /ENTRY_RAN:/, "the entry program must not execute after launcher rejection");
    assert.match(result.stderr, /NODE_ENV to be explicitly set to development or test/);
    assert.equal(fs.readFileSync(envFile, "utf8"), envFileContent, "launcher rejection must not change environment files");
  }

  for (const acceptedEnvironment of ["development", "test"]) {
    const result = runLauncher(acceptedEnvironment);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `ENTRY_RAN:${acceptedEnvironment}:json`, "launcher preserves NODE_ENV and explicitly enables JSON mode");
    assert.equal(fs.readFileSync(envFile, "utf8"), envFileContent, "launcher must not change environment files");
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

process.env.NODE_ENV = "test";
process.env.STORAGE_MODE = "json";
for (const name of ["DATABASE_URL", "DIRECT_URL", "DATABASE_TARGET", "NEON_ENDPOINT_ID"]) {
  delete process.env[name];
}
for (const name of ["SMS_PROVIDER", "SMS_LIVE_DELIVERY_ENABLED", "HUBTEL_CLIENT_ID", "HUBTEL_CLIENT_SECRET", "HUBTEL_SENDER_ID", "HUBTEL_API_BASE_URL"]) {
  delete process.env[name];
}

const { initializePostgresBeforeListen, startServerEntrypoint } = await import("../src/server.ts");

const ordering: string[] = [];
await initializePostgresBeforeListen(
  "postgres",
  async () => { ordering.push("connected"); },
  async () => { ordering.push("listening"); },
);
assert.deepEqual(ordering, ["connected", "listening"]);

let listenCalledAfterFailure = false;
await assert.rejects(
  initializePostgresBeforeListen(
    "postgres",
    async () => { throw new Error("postgresql://private-user:private-password@private-host/private-db"); },
    async () => { listenCalledAfterFailure = true; },
  ),
  /PostgreSQL connection failed; the server was not started/,
);
assert.equal(listenCalledAfterFailure, false, "connection failure must prevent listening");

const oldExitCode = process.exitCode;
const applicationLogs: string[] = [];
const startupSucceeded = await startServerEntrypoint(
  async () => { throw new Error("postgresql://private-user:private-password@private-host/private-db"); },
  (message) => applicationLogs.push(message),
);
assert.equal(startupSucceeded, false);
assert.equal(applicationLogs.length, 1);
assert.doesNotMatch(applicationLogs[0]!, /postgresql:|private-user|private-password|private-host|private-db/);
process.exitCode = oldExitCode;

console.log("JSON launcher and PostgreSQL startup safety passed.");
