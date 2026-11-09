import assert from "node:assert/strict";
import { completeAdminMfaLogin } from "../components/adminMfaFlow.ts";

const session = { id: "session-fixture", role: "SUPER_ADMIN" };
const recoveryCodes = ["fixture-code-one", "fixture-code-two"];

const enrollmentCalls: string[] = [];
const enrollment = await completeAdminMfaLogin(
  { email: "admin@example.invalid", code: "123456", step: "setup" },
  {
    verifyCode: async (code) => {
      enrollmentCalls.push(`verify:${code}`);
      return { verified: true, recoveryCodes };
    },
    establishSession: async (email) => {
      enrollmentCalls.push(`session:${email}`);
      return session;
    },
  },
);
assert.deepEqual(enrollment, { destination: "recovery", session, recoveryCodes });
assert.deepEqual(enrollmentCalls, ["verify:123456", "session:admin@example.invalid"]);

const signIn = await completeAdminMfaLogin(
  { email: "admin@example.invalid", code: "654321", step: "verify" },
  {
    verifyCode: async () => ({ verified: true }),
    establishSession: async () => session,
  },
);
assert.deepEqual(signIn, { destination: "dashboard", session, recoveryCodes: [] });

let establishSessionCalled = false;
await assert.rejects(
  completeAdminMfaLogin(
    { email: "admin@example.invalid", code: "000000", step: "setup" },
    {
      verifyCode: async () => { throw new Error("MFA_INVALID"); },
      establishSession: async () => {
        establishSessionCalled = true;
        return session;
      },
    },
  ),
  /MFA_INVALID/,
);
assert.equal(establishSessionCalled, false, "a rejected MFA code must not establish a local authenticated session");

await assert.rejects(
  completeAdminMfaLogin(
    { email: "admin@example.invalid", code: "123456", step: "verify" },
    {
      verifyCode: async () => ({ verified: true }),
      establishSession: async () => { throw new Error("ADMIN_ACCESS_REQUIRED"); },
    },
  ),
  /ADMIN_ACCESS_REQUIRED/,
  "MFA verification alone must not navigate without server-confirmed admin access and stored session state",
);

console.log("Admin MFA completion and authenticated navigation flow tests passed.");
