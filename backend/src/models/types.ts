export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";
export type AccountStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
export type LedgerState =
  | "POTENTIAL"
  | "PENDING"
  | "AVAILABLE"
  | "PAID"
  | "VOID";
export type LedgerType =
  | "COMMISSION"
  | "POINTS"
  | "CASH_OUT"
  | "ADJUSTMENT"
  | "REVERSAL";
export type CashOutStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED";
export type MembershipPlan = "silver" | "gold" | "premium";
export type MembershipPaymentStatus = "PENDING" | "PAID" | "FAILED";
export type MembershipStatus = "ACTIVE" | "EXPIRED";

export type MembershipPayment = {
  id: string;
  userId: string;
  plan: MembershipPlan;
  amount: number;
  currency: "GHS";
  status: MembershipPaymentStatus;
  reference: string;
  flutterwaveTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

export type Membership = {
  id: string;
  userId: string;
  plan: MembershipPlan;
  status: MembershipStatus;
  paymentReference: string;
  startsAt: string;
  expiresAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  passwordHash: string;
  referralCode: string;
  referrerId: string | null;
  role: Role;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  dateOfBirth?: string | null;
  languagePreference?: "en" | "fr";
  themePreference?: "light" | "dark" | "system";
  profileImageKey?: string | null;
};

export type RegistrationAttempt = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  passwordHash: string;
  referralCode?: string;
  otpHash: string;
  otpExpiresAt: string;
  otpAttempts: number;
  resendAvailableAt: string;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  type: LedgerType;
  state: LedgerState;
  amount: number;
  currency: "GHS" | "POINTS";
  description: string;
  referenceId: string;
  createdAt: string;
};

export type CashOutRequest = {
  id: string;
  userId: string;
  amount: number;
  currency: "GHS";
  status: CashOutStatus;
  ledgerEntryId: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorUserId: string | null;
  targetUserId: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  createdAt: string;
};

export type SecurityEvent = {
  id: string;
  userId: string | null;
  type: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type Message = {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type Lead = {
  id: string;
  ownerUserId: string;
  displayName: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "CLOSED";
  potentialValue: number;
  createdAt: string;
};

export type Database = {
  users: User[];
  registrations: RegistrationAttempt[];
  ledger: LedgerEntry[];
  cashOuts: CashOutRequest[];
  auditLogs: AuditLog[];
  securityEvents: SecurityEvent[];
  notification: Message[];
  leads: Lead[];
  membershipPayments: MembershipPayment[];
  memberships: Membership[];
  revokedSessions?: string[];
};
