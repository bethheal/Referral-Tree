export type AdminMfaLoginStep = "setup" | "verify";

export type AdminMfaCompletion<Session> =
  | { destination: "recovery"; session: Session; recoveryCodes: string[] }
  | { destination: "dashboard"; session: Session; recoveryCodes: [] };

export const completeAdminMfaLogin = async <Session>(
  input: { email: string; code: string; step: AdminMfaLoginStep },
  dependencies: {
    verifyCode: (code: string) => Promise<{ verified: true; recoveryCodes?: string[] }>;
    establishSession: (email: string) => Promise<Session>;
  },
): Promise<AdminMfaCompletion<Session>> => {
  const verification = await dependencies.verifyCode(input.code);
  const session = await dependencies.establishSession(input.email);

  if (input.step === "setup") {
    return { destination: "recovery", session, recoveryCodes: verification.recoveryCodes ?? [] };
  }
  return { destination: "dashboard", session, recoveryCodes: [] };
};
