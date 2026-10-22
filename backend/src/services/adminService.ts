import type { AccountStatus, Database, Role, User } from "../models/types.ts";
import { createId, nowIso } from "../utils/crypto.ts";
import { HttpError } from "../utils/http.ts";

const publicAdminUser = (data: Database, user: User) => {
  const membership = data.memberships.find((item) =>
    item.userId === user.id && item.status === "ACTIVE" && Date.parse(item.expiresAt) > Date.now(),
  );
  return {
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  status: user.status,
  membershipTier: membership?.plan ?? "free",
  membershipExpiresAt: membership?.expiresAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  referrerId: user.referrerId,
  };
};

const audit = (
  data: Database,
  actor: User,
  target: User,
  action: string,
  oldValue: unknown,
  newValue: unknown,
  reason: string,
) => {
  data.auditLogs.push({
    id: createId("audit"),
    actorUserId: actor.id,
    targetUserId: target.id,
    action,
    oldValue,
    newValue,
    reason,
    createdAt: nowIso(),
  });
};

export const getAdminSummary = (data: Database) => {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const activeMembers = data.users.filter((user) => user.status === "ACTIVE");
  const memberships = data.memberships.filter(
    (membership) => membership.status === "ACTIVE" && Date.parse(membership.expiresAt) > Date.now(),
  );
  return {
    accounts: {
      total: data.users.length,
      active: activeMembers.length,
      pendingVerification: data.users.filter((user) => user.status === "PENDING_VERIFICATION").length,
      suspended: data.users.filter((user) => user.status === "SUSPENDED").length,
      admins: data.users.filter((user) => user.role === "ADMIN").length,
      superAdmins: data.users.filter((user) => user.role === "SUPER_ADMIN").length,
    },
    memberships: {
      totalActive: memberships.length,
      byPlan: {
        silver: memberships.filter((membership) => membership.plan === "silver").length,
        gold: memberships.filter((membership) => membership.plan === "gold").length,
        premium: memberships.filter((membership) => membership.plan === "premium").length,
      },
      pendingPayments: data.membershipPayments.filter((payment) => payment.status === "PENDING").length,
      successfulPayments: data.membershipPayments.filter((payment) => payment.status === "PAID").length,
      failedPayments: data.membershipPayments.filter((payment) => payment.status === "FAILED").length,
    },
    cashOuts: {
      pendingReview: data.cashOuts.filter((item) => ["REQUESTED", "UNDER_REVIEW"].includes(item.status)).length,
    },
    security: {
      failedLoginsLast24Hours: data.securityEvents.filter((event) =>
        event.type === "LOGIN_FAILED" && Date.parse(event.createdAt) >= since,
      ).length,
      deniedAdminLoginsLast24Hours: data.securityEvents.filter((event) =>
        event.type === "ADMIN_LOGIN_DENIED" && Date.parse(event.createdAt) >= since,
      ).length,
    },
  };
};

export const listAdminUsers = (
  data: Database,
  { limit, offset, search }: { limit: number; offset: number; search?: string },
) => {
  const term = search?.trim().toLocaleLowerCase();
  const matches = data.users.filter((user) =>
    !term || [user.fullName, user.email, user.phoneNumber ?? ""].some((value) => value.toLocaleLowerCase().includes(term)),
  );
  matches.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    count: matches.length,
    limit,
    offset,
    rows: matches.slice(offset, offset + limit).map((user) => publicAdminUser(data, user)),
  };
};

export const getAdminAuditLog = (data: Database, limit: number) => ({
  rows: [...data.auditLogs]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit),
});

export const updateManagedUserRole = (
  data: Database,
  actor: User,
  targetId: string,
  roleInput: unknown,
  reasonInput: unknown,
) => {
  if (actor.role !== "SUPER_ADMIN") throw new HttpError("Super-admin permission required.", 403, "FORBIDDEN");
  if (typeof roleInput !== "string" || !["USER", "ADMIN"].includes(roleInput)) {
    throw new HttpError("Role must be USER or ADMIN.", 400, "INVALID_ROLE");
  }
  const reason = validateReason(reasonInput);
  const target = findTarget(data, targetId);
  if (target.id === actor.id) throw new HttpError("You cannot change your own role.", 400, "SELF_ROLE_CHANGE_DENIED");
  if (target.role === "SUPER_ADMIN") throw new HttpError("Super-admin roles cannot be changed here.", 403, "PROTECTED_ADMIN_ACCOUNT");
  const nextRole = roleInput as Role;
  if (target.role !== nextRole) {
    const oldRole = target.role;
    target.role = nextRole;
    target.updatedAt = nowIso();
    audit(data, actor, target, "ADMIN_USER_ROLE_CHANGED", { role: oldRole }, { role: nextRole }, reason);
  }
  return publicAdminUser(data, target);
};

export const updateManagedUserStatus = (
  data: Database,
  actor: User,
  targetId: string,
  statusInput: unknown,
  reasonInput: unknown,
) => {
  if (typeof statusInput !== "string" || !["ACTIVE", "SUSPENDED"].includes(statusInput)) {
    throw new HttpError("Status must be ACTIVE or SUSPENDED.", 400, "INVALID_ACCOUNT_STATUS");
  }
  const reason = validateReason(reasonInput);
  const target = findTarget(data, targetId);
  if (target.id === actor.id) throw new HttpError("You cannot change your own account status.", 400, "SELF_STATUS_CHANGE_DENIED");
  if (target.role === "SUPER_ADMIN") throw new HttpError("Super-admin accounts cannot be changed here.", 403, "PROTECTED_ADMIN_ACCOUNT");
  if (target.status === "PENDING_VERIFICATION") {
    throw new HttpError("An unverified account cannot be activated or suspended through admin management.", 409, "ACCOUNT_NOT_VERIFIED");
  }
  if (actor.role === "ADMIN" && target.role !== "USER") {
    throw new HttpError("Only a super-admin can manage administrator accounts.", 403, "FORBIDDEN");
  }
  const nextStatus = statusInput as AccountStatus;
  if (target.status !== nextStatus) {
    const oldStatus = target.status;
    target.status = nextStatus;
    target.updatedAt = nowIso();
    audit(data, actor, target, "ADMIN_USER_STATUS_CHANGED", { status: oldStatus }, { status: nextStatus }, reason);
  }
  return publicAdminUser(data, target);
};

const findTarget = (data: Database, targetId: string) => {
  if (!targetId || targetId.length > 120) throw new HttpError("User id is invalid.", 400, "INVALID_USER_ID");
  const target = data.users.find((user) => user.id === targetId);
  if (!target) throw new HttpError("User not found.", 404, "NOT_FOUND");
  return target;
};

const validateReason = (input: unknown) => {
  if (typeof input !== "string") throw new HttpError("A reason is required.", 400, "REASON_REQUIRED");
  const reason = input.trim();
  if (reason.length < 8 || reason.length > 500) {
    throw new HttpError("Reason must be between 8 and 500 characters.", 400, "INVALID_REASON");
  }
  return reason;
};
