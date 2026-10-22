import AsyncStorage from "@react-native-async-storage/async-storage";
import { beginAdminMfaSetup, checkAdminAccess, loginAdminWithPassword, logoutSession, saveAuthSession, verifyAdminMfa } from "@/components/backendApi";

export type AdminRole = "admin" | "super_admin" | "finance_admin" | "product_manager" | "order_manager" | "support_admin" | "auditor";
export type AdminSession = { email: string; name: string; role: AdminRole; authenticatedAt: string };
export const ADMIN_SESSION_KEY = "angelFoodsAdminSession";
export const backendAuthorizationRequirements = [
  "Sign in with an account provisioned as an administrator by the backend owner.",
  "Complete authenticator-app MFA before the dashboard is unlocked.",
  "The backend loads the role from the account record for each protected request.",
  "Admin actions are denied by default unless server-side authorization succeeds.",
];
export const isAdminRole = (role: AdminRole | string) => ["admin", "super_admin", "finance_admin", "product_manager", "order_manager", "support_admin", "auditor"].includes(role);

export const verifyAndStoreAdminSession = async (email: string) => {
  const access = await checkAdminAccess();
  const session: AdminSession = {
    email,
    name: access.fullName,
    role: access.role.toLowerCase() as AdminRole,
    authenticatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
};

export const clearAdminSession = () => AsyncStorage.removeItem(ADMIN_SESSION_KEY);

export const loginAdminAccount = async (email: string, password: string) => {
  let sessionTokenSaved = false;
  let challengePending = false;
  try {
    const auth = await loginAdminWithPassword({ email, password });
    await saveAuthSession(auth);
    sessionTokenSaved = true;
    if (auth.mfaSetupRequired) {
      const setup = await beginAdminMfaSetup();
      challengePending = true;
      return { ok: false as const, step: "setup" as const, message: setup.instructions, secret: setup.secret };
    }
    if (auth.mfaRequired) {
      challengePending = true;
      return { ok: false as const, step: "verify" as const, message: "Enter the current code from your authenticator app." };
    }
    const session = await verifyAndStoreAdminSession(auth.user.email);
    return { ok: true as const, message: "Admin login successful.", session };
  } catch (error) {
    if (sessionTokenSaved && !challengePending) await logoutSession().catch(() => undefined);
    return { ok: false as const, message: error instanceof Error ? error.message : "Admin login failed." };
  }
};

export const finishAdminMfaLogin = async (email: string, code: string) => {
  const result = await verifyAdminMfa(code);
  const session = await verifyAndStoreAdminSession(email);
  return { session, recoveryCodes: result.recoveryCodes ?? [] };
};

export const getAdminSession = async (): Promise<AdminSession | null> => {
  const rawSession = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
  if (!rawSession) return null;
  try {
    const session = JSON.parse(rawSession) as AdminSession;
    if (!isAdminRole(session.role)) throw new Error("Invalid admin role");
    return session;
  } catch {
    await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
};

export const logoutAdminAccount = async () => {
  try { await logoutSession(); }
  finally { await AsyncStorage.removeItem(ADMIN_SESSION_KEY); }
};

export const verifyAdminSession = async () => {
  const access = await checkAdminAccess();
  return { ...access, role: access.role.toLowerCase() as AdminRole };
};
