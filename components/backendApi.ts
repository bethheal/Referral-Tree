import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const expoHostUri = Constants.expoConfig?.hostUri;
const expoHost = expoHostUri
  ? new URL(`http://${expoHostUri}`).hostname
  : null;
const developmentApiBaseUrl =
  Platform.OS === "web"
    ? "http://localhost:3001"
    : expoHost
      ? `http://${expoHost}:3001`
      : Platform.OS === "android"
        ? "http://10.0.2.2:3001"
        : "http://localhost:3001";

if (
  !__DEV__ &&
  (!configuredApiBaseUrl || !configuredApiBaseUrl.startsWith("https://"))
) {
  throw new Error("A valid HTTPS EXPO_PUBLIC_API_BASE_URL is required for release builds.");
}

const API_BASE_URL = (configuredApiBaseUrl ?? developmentApiBaseUrl).replace(/\/$/, "");

const AUTH_TOKEN_KEY = "authToken";
let webSessionToken: string | null = null;

const getAuthToken = () =>
  Platform.OS === "web"
    ? Promise.resolve(webSessionToken)
    : SecureStore.getItemAsync(AUTH_TOKEN_KEY);

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

const apiRequest = async <T>(path: string, options: ApiOptions = {}) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.auth) {
    const token = await getAuthToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(body.error ?? "Request failed.", response.status);
  }

  return body as T;
};

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber: string | null;
    referralCode: string;
  };
};

export type AdminLoginResponse = AuthResponse & {
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
};

export type AdminSummaryResponse = {
  accounts: { total: number; active: number; pendingVerification: number; suspended: number; admins: number; superAdmins: number };
  memberships: {
    totalActive: number;
    byPlan: { silver: number; gold: number; premium: number };
    pendingPayments: number;
    successfulPayments: number;
    failedPayments: number;
  };
  cashOuts: { pendingReview: number };
  security: { failedLoginsLast24Hours: number; deniedAdminLoginsLast24Hours: number };
};

export type AdminManagedUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN" | "FINANCE_ADMIN" | "PRODUCT_MANAGER" | "ORDER_MANAGER" | "SUPPORT_ADMIN" | "AUDITOR";
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
  membershipTier: "free" | "silver" | "gold" | "premium";
  membershipExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  referrerId: string | null;
};

export type AdminUsersResponse = { count: number; limit: number; offset: number; rows: AdminManagedUser[] };
export type AdminAuditRow = {
  id: string;
  actorUserId: string | null;
  targetUserId: string | null;
  targetType?: string | null;
  targetId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string | null;
  createdAt: string;
};

export type AdminPage<T = Record<string, unknown>> = PaginatedResponse<T>;
export type AdminModule = "memberships" | "payments" | "payment-events" | "referrals" | "ledger" | "withdrawals" | "products" | "orders" | "invoices" | "notifications" | "security" | "approvals";
export type AdminApproval = { id: string; action: string; targetType: string; targetId: string; payload: unknown; reason: string; status: string; requestedAt: string; requester: { id: string; fullName: string; email: string; role: string } };
export type AdminProduct = { id: string; sku: string; name: string; description: string; imageKey: string | null; priceMinor: string; currency: string; inventoryCount: number; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; createdAt: string; updatedAt: string; archivedAt: string | null };

export type ProfileResponse = {
  dateOfBirth: string | null;
  email: string;
  fullName: string;
  membershipTier: "free" | "silver" | "gold" | "premium";
  phoneNumber: string | null;
  profileImageUrl: string | null;
  preferences: { language: "en" | "fr"; theme: "light" | "dark" | "system" };
};

export type DashboardApiSummary = {
  account: AuthResponse["user"];
  financial: {
    availableBalance: number;
    cashOutRequested: number;
    paidOut: number;
    pendingEarnings: number;
    potentialEarnings: number;
    totalEarnings: number;
    totalPoints: number;
  };
  referralLink: string;
  referralPreview: {
    directReferrals: number;
    fullName: string;
    id: string;
    joinedAt: string;
    status: string;
  }[];
  stats: {
    totalLeads: number;
    totalReferrals: number;
  };
};

export type AccountHistoryItem = {
  amount?: number;
  category: string;
  date: string;
  detail: string;
  id: string;
  status: string;
  title: string;
};

export type PaymentHistoryItem = {
  amount: number;
  currency: "GHS";
  date: string;
  id: string;
  reference: string;
  status: string;
  type: "CASH_OUT";
};

export type MembershipPaymentStatus = "PENDING" | "PAID" | "FAILED";
export type MembershipPlanKey = "silver" | "gold" | "premium";
export type MembershipApiState = {
  membership: {
    expiresAt: string;
    id: string;
    paymentReference: string;
    plan: MembershipPlanKey;
    startsAt: string;
    status: "ACTIVE" | "EXPIRED";
    updatedAt: string;
    userId: string;
  } | null;
  latestPayment: {
    amount: number;
    createdAt: string;
    plan: MembershipPlanKey;
    reference: string;
    status: MembershipPaymentStatus;
  } | null;
};

export type MembershipCheckout = {
  amount: number;
  checkoutUrl: string;
  currency: "GHS";
  plan: MembershipPlanKey;
  reference: string;
  status: MembershipPaymentStatus;
};

export type ReferralDetail = {
  directReferrals: {
    fullName: string;
    id: string;
    joinedAt: string;
    status: string;
  }[];
  fullName: string;
  id: string;
  joinedAt: string;
  referrerId: string | null;
  status: string;
};

export type PaginatedResponse<T> = {
  count: number;
  limit: number;
  offset: number;
  rows: T[];
};

export const saveAuthSession = async (auth: AuthResponse) => {
  if (Platform.OS === "web") {
    webSessionToken = auth.token;
  } else {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, auth.token);
  }
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.setItem("loggedIn", "true");
};

export const clearAuthSession = async () => {
  webSessionToken = null;
  if (Platform.OS !== "web") {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  }
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, "loggedIn"]);
};

export const logoutSession = async () => {
  try {
    await apiRequest<{ loggedOut: boolean }>("/api/auth/logout", {
      auth: true,
      method: "POST",
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  await clearAuthSession();
};

export const checkAdminAccess = () =>
  apiRequest<{ authorized: true; fullName: string; role: "ADMIN" | "SUPER_ADMIN" | "FINANCE_ADMIN" | "PRODUCT_MANAGER" | "ORDER_MANAGER" | "SUPPORT_ADMIN" | "AUDITOR" }>(
    "/api/admin/access",
    { auth: true },
  );

export const getAdminSummary = () =>
  apiRequest<AdminSummaryResponse>("/api/admin/dashboard/summary", { auth: true });

export const getAdminUsers = (input: { limit: number; offset: number; search?: string }) => {
  const query = new URLSearchParams({ limit: String(input.limit), offset: String(input.offset) });
  if (input.search?.trim()) query.set("search", input.search.trim());
  return apiRequest<AdminUsersResponse>(`/api/admin/users?${query.toString()}`, { auth: true });
};

export const setAdminUserStatus = (id: string, status: "ACTIVE" | "SUSPENDED", reason: string) =>
  apiRequest<{ user: AdminManagedUser }>(`/api/admin/users/${encodeURIComponent(id)}/status`, {
    auth: true,
    body: JSON.stringify({ status, reason }),
    method: "PATCH",
  });

export const setAdminUserRole = (id: string, role: "USER" | "ADMIN", reason: string) =>
  apiRequest<{ user?: AdminManagedUser; approvalRequired?: true; approval?: { id: string; status: string; action: string; requestedAt: string } }>(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    auth: true,
    body: JSON.stringify({ role, reason }),
    method: "PATCH",
  });

export const getAdminAuditLog = (input: number | { limit?: number; offset?: number; action?: string; actorUserId?: string; targetId?: string; since?: string; until?: string } = 50) => {
  const params = typeof input === "number" ? { limit: input, offset: 0 } : { limit: input.limit ?? 50, offset: input.offset ?? 0, ...input };
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
  return apiRequest<AdminPage<AdminAuditRow>>(`/api/admin/audit-log?${query.toString()}`, { auth: true });
};

export const getAdminResource = <T = Record<string, unknown>>(module: AdminModule, input: { limit?: number; offset?: number; search?: string; status?: string; action?: string; actorUserId?: string; targetUserId?: string; userId?: string } = {}) => {
  const params = new URLSearchParams({ limit: String(input.limit ?? 20), offset: String(input.offset ?? 0) });
  for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== "") params.set(key, String(value));
  return apiRequest<AdminPage<T>>(`/api/admin/${module}?${params.toString()}`, { auth: true });
};

export const getAdminUserDetail = (id: string) => apiRequest<{ user: Record<string, unknown> }>(`/api/admin/users/${encodeURIComponent(id)}`, { auth: true });
export const revokeAdminUserSessions = (id: string, reason: string) => apiRequest<{ user: { id: string; fullName: string; email: string }; revokedSessions: number }>(`/api/admin/users/${encodeURIComponent(id)}/sessions/revoke`, { auth: true, body: JSON.stringify({ reason }), method: "POST" });
export const decideAdminApproval = (id: string, decision: "APPROVED" | "REJECTED", reason: string) => apiRequest<{ id: string; status: string; targetUserId?: string; role?: string }>(`/api/admin/approvals/${encodeURIComponent(id)}`, { auth: true, body: JSON.stringify({ decision, reason }), method: "PATCH" });
export const createAdminProduct = (input: Omit<AdminProduct, "id" | "createdAt" | "updatedAt" | "archivedAt"> & { reason: string }) => apiRequest<{ product: AdminProduct }>("/api/admin/products", { auth: true, body: JSON.stringify(input), method: "POST" });
export const updateAdminProduct = (id: string, input: Partial<Omit<AdminProduct, "id" | "createdAt" | "updatedAt" | "archivedAt">> & { reason: string }) => apiRequest<{ product: AdminProduct }>(`/api/admin/products/${encodeURIComponent(id)}`, { auth: true, body: JSON.stringify(input), method: "PATCH" });

export const hasAuthSession = async () => {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  return Boolean(await getAuthToken());
};

export const requestRegistrationOtp = (input: {
  email: string;
  fullName: string;
  password: string;
  phoneNumber: string;
  referralCode?: string;
}) =>
  apiRequest<{ otp?: string; registrationId: string }>(
    "/api/auth/register/request-otp",
    {
      body: JSON.stringify(input),
      method: "POST",
    },
  );

export const verifyRegistrationOtp = (input: {
  otp: string;
  registrationId: string;
}) =>
  apiRequest<AuthResponse>("/api/auth/register/verify", {
    body: JSON.stringify(input),
    method: "POST",
  });

export const loginWithPassword = (input: { email: string; password: string }) =>
  apiRequest<AuthResponse>("/api/auth/login", {
    body: JSON.stringify(input),
    method: "POST",
  });

export const loginAdminWithPassword = (input: { email: string; password: string }) =>
  apiRequest<AdminLoginResponse>("/api/admin/auth/login", {
    body: JSON.stringify(input),
    method: "POST",
  });

export const beginAdminMfaSetup = () =>
  apiRequest<{ secret: string; otpauthUrl: string; instructions: string }>("/api/admin/auth/mfa/setup", { auth: true, method: "POST" });

export const verifyAdminMfa = (code: string) =>
  apiRequest<{ verified: true; recoveryCodes?: string[] }>("/api/admin/auth/mfa/verify", {
    auth: true,
    body: JSON.stringify({ code }),
    method: "POST",
  });

export const getDashboardSummary = () =>
  apiRequest<DashboardApiSummary>("/api/me/dashboard", { auth: true });

export const getAccountDetails = () =>
  apiRequest<DashboardApiSummary["account"] & { referrer: unknown }>(
    "/api/me/account",
    { auth: true },
  );

export const getProfile = () =>
  apiRequest<ProfileResponse>("/api/me/profile", { auth: true });

export const updateProfile = (input: Partial<{
  fullName: string;
  dateOfBirth: string;
  language: "en" | "fr";
  theme: "light" | "dark" | "system";
}>) =>
  apiRequest<ProfileResponse>("/api/me/profile", {
    auth: true,
    body: JSON.stringify(input),
    method: "PATCH",
  });

export const getAccountHistory = () =>
  apiRequest<AccountHistoryItem[]>("/api/me/account-history", { auth: true });

export const getPaymentHistory = () =>
  apiRequest<PaymentHistoryItem[]>("/api/me/payment-history", { auth: true });

export const getMembershipState = () =>
  apiRequest<MembershipApiState>("/api/me/membership", { auth: true });

export const startMembershipCheckout = (plan: MembershipPlanKey, expectedAmount: number) =>
  apiRequest<MembershipCheckout>("/api/me/membership/checkout", {
    auth: true,
    body: JSON.stringify({ expectedAmount, plan }),
    method: "POST",
  });

export const getReferralDetail = (id: string) =>
  apiRequest<ReferralDetail>(`/api/me/referrals/${id}`, { auth: true });

export const getPotentialLeads = (offset = 0, limit = 20) =>
  apiRequest<
    PaginatedResponse<{
      createdAt: string;
      displayName: string;
      id: string;
      potentialValue: number;
      status: string;
    }>
  >(`/api/me/leads?offset=${offset}&limit=${limit}`, { auth: true });

export const getnotification = (offset = 0, limit = 20) =>
  apiRequest<
    PaginatedResponse<{
      body: string;
      createdAt: string;
      id: string;
      readAt: string | null;
      title: string;
    }>
  >(`/api/me/notification?offset=${offset}&limit=${limit}`, { auth: true });

export const markNotificationRead = (id: string) =>
  apiRequest<{ id: string; readAt: string }>(`/api/me/notification/${encodeURIComponent(id)}/read`, {
    auth: true,
    method: "PATCH",
  });

export const markAllNotificationsRead = () =>
  apiRequest<{ readAt: string }>("/api/me/notification/read-all", { auth: true, method: "POST" });
