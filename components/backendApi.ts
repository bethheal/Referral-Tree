import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const AUTH_TOKEN_KEY = "authToken";

type ApiOptions = RequestInit & {
  auth?: boolean;
};

const apiRequest = async <T>(path: string, options: ApiOptions = {}) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.auth) {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body as T;
};

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber: string;
    referralCode: string;
    role: "USER" | "ADMIN" | "SUPER_ADMIN";
    status: string;
  };
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
  await AsyncStorage.multiSet([
    [AUTH_TOKEN_KEY, auth.token],
    ["loggedIn", "true"],
  ]);
};

export const clearAuthSession = async () => {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, "loggedIn"]);
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

export const getDashboardSummary = () =>
  apiRequest<DashboardApiSummary>("/api/me/dashboard", { auth: true });

export const getAccountDetails = () =>
  apiRequest<DashboardApiSummary["account"] & { referrer: unknown }>(
    "/api/me/account",
    { auth: true },
  );

export const getAccountHistory = () =>
  apiRequest<AccountHistoryItem[]>("/api/me/account-history", { auth: true });

export const getPaymentHistory = () =>
  apiRequest<PaymentHistoryItem[]>("/api/me/payment-history", { auth: true });

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
