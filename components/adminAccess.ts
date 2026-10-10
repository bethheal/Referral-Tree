import AsyncStorage from "@react-native-async-storage/async-storage";

export type AdminRole = "user" | "admin" | "super_admin";

export type AdminAccount = {
  email: string;
  name: string;
  password: string;
  role: AdminRole;
};

export type AdminSession = {
  email: string;
  name: string;
  role: AdminRole;
  authenticatedAt: string;
};

export const ADMIN_SESSION_KEY = "angelFoodsAdminSession";

const demoAdminAccounts: AdminAccount[] = [
  {
    email: "admin@angelfoods.com",
    name: "Angel Foods Admin",
    password: "admin123",
    role: "admin",
  },
  {
    email: "super@angelfoods.com",
    name: "Super Admin",
    password: "super123",
    role: "super_admin",
  },
  {
    email: "customer@angelfoods.com",
    name: "Customer Account",
    password: "customer123",
    role: "user",
  },
];

export const adminRoles: AdminRole[] = ["admin", "super_admin"];

export const isAdminRole = (role: AdminRole) => adminRoles.includes(role);

export const loginAdminAccount = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const account = demoAdminAccounts.find(
    (item) => item.email.toLowerCase() === normalizedEmail
  );

  if (!account || account.password !== password) {
    return {
      ok: false,
      message: "Admin account not found or password is incorrect.",
    };
  }

  if (!isAdminRole(account.role)) {
    return {
      ok: false,
      message: "This account is authenticated but has no admin privileges.",
    };
  }

  const session: AdminSession = {
    email: account.email,
    name: account.name,
    role: account.role,
    authenticatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));

  return {
    ok: true,
    message: "Admin login successful.",
    session,
  };
};

export const getAdminSession = async () => {
  const rawSession = await AsyncStorage.getItem(ADMIN_SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AdminSession;
  } catch {
    await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
};

export const logoutAdminAccount = async () => {
  await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
};

export const backendAuthorizationRequirements = [
  "Authenticate the request with a server-issued token or session.",
  "Load the user's role from the backend database, not from mobile input.",
  "Reject every admin endpoint unless the role is admin or super_admin.",
  "Record sensitive admin updates in an audit log.",
];
