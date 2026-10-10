import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { requireAdmin, requireUser } from "../middleware/auth.ts";
import {
  completeRegistration,
  login,
  publicUser,
  requestRegistrationOtp,
} from "../services/authService.ts";
import { db } from "../services/database.ts";
import {
  getFinancialSummary,
  getPaymentHistory,
  requestCashOut,
} from "../services/financialService.ts";
import { getNetworkUserIds } from "../services/referralService.ts";
import { nowIso } from "../utils/crypto.ts";
import { getRequestContext, readJson, sendJson } from "../utils/http.ts";

const ok = (response: ServerResponse, payload: unknown) =>
  sendJson(response, 200, payload);

const created = (response: ServerResponse, payload: unknown) =>
  sendJson(response, 201, payload);

export const route = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      ok(response, { status: "ok", timestamp: nowIso() });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/auth/register/request-otp"
    ) {
      const result = requestRegistrationOtp(
        db.data,
        await readJson<{
          email: string;
          fullName: string;
          password: string;
          phoneNumber: string;
          referralCode?: string;
        }>(request),
      );
      db.save();
      created(response, result);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/auth/register/verify"
    ) {
      const result = completeRegistration(
        db.data,
        await readJson<{ otp: string; registrationId: string }>(request),
        getRequestContext(request),
      );
      db.save();
      created(response, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const result = login(
        db.data,
        await readJson<{ email: string; password: string }>(request),
        getRequestContext(request),
      );
      db.save();
      ok(response, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/dashboard") {
      const user = requireUser(db.data, request);
      const financial = getFinancialSummary(db.data, user.id);
      const networkIds = getNetworkUserIds(db.data, user.id);
      const referrals = db.data.users
        .filter((item) => item.referrerId === user.id)
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          fullName: item.fullName,
          status: item.status,
          joinedAt: item.createdAt,
          directReferrals: db.data.users.filter(
            (candidate) => candidate.referrerId === item.id,
          ).length,
        }));

      ok(response, {
        account: publicUser(user),
        financial,
        referralLink: `${process.env.API_BASE_URL ?? "http://localhost:3001"}/register?ref=${user.referralCode}`,
        stats: {
          totalLeads: db.data.leads.filter(
            (lead) => lead.ownerUserId === user.id,
          ).length,
          totalReferrals: Math.max(networkIds.size - 1, 0),
        },
        referralPreview: referrals,
        recentActivity: db.data.securityEvents
          .filter((event) => event.userId === user.id)
          .slice(-5)
          .reverse(),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/referrals") {
      const user = requireUser(db.data, request);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      const networkIds = getNetworkUserIds(db.data, user.id);
      networkIds.delete(user.id);
      const rows = db.data.users
        .filter((item) => networkIds.has(item.id))
        .slice(offset, offset + limit)
        .map((item) => ({
          id: item.id,
          fullName: item.fullName,
          status: item.status,
          joinedAt: item.createdAt,
          directReferrals: db.data.users.filter(
            (candidate) => candidate.referrerId === item.id,
          ).length,
        }));

      ok(response, {
        count: networkIds.size,
        limit,
        offset,
        rows,
      });
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname.startsWith("/api/me/referrals/")
    ) {
      const user = requireUser(db.data, request);
      const referralId = url.pathname.split("/").at(-1);
      const networkIds = getNetworkUserIds(db.data, user.id);

      if (
        !referralId ||
        referralId === user.id ||
        !networkIds.has(referralId)
      ) {
        throw new Error("Referral access denied.");
      }

      const referral = db.data.users.find((item) => item.id === referralId);

      if (!referral) throw new Error("Referral not found.");

      ok(response, {
        id: referral.id,
        directReferrals: db.data.users
          .filter((item) => item.referrerId === referral.id)
          .map((item) => ({
            id: item.id,
            fullName: item.fullName,
            joinedAt: item.createdAt,
            status: item.status,
          })),
        fullName: referral.fullName,
        joinedAt: referral.createdAt,
        referrerId: referral.referrerId,
        status: referral.status,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/account") {
      const user = requireUser(db.data, request);
      const referrer = user.referrerId
        ? db.data.users.find((item) => item.id === user.referrerId)
        : null;

      ok(response, {
        ...publicUser(user),
        referrer: referrer
          ? {
              fullName: referrer.fullName,
              id: referrer.id,
              referralCode: referrer.referralCode,
            }
          : null,
      });
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/me/account-history"
    ) {
      const user = requireUser(db.data, request);
      const ledgerEvents = db.data.ledger
        .filter((entry) => entry.userId === user.id)
        .map((entry) => ({
          id: entry.id,
          amount: entry.amount,
          category: entry.type,
          date: entry.createdAt,
          detail: entry.description,
          status: entry.state,
          title: entry.type.replaceAll("_", " "),
        }));
      const securityEvents = db.data.securityEvents
        .filter((event) => event.userId === user.id)
        .map((event) => ({
          id: event.id,
          category: "SECURITY",
          date: event.createdAt,
          detail: event.type.replaceAll("_", " "),
          status: "RECORDED",
          title: event.type.replaceAll("_", " "),
        }));

      ok(
        response,
        [...ledgerEvents, ...securityEvents].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/me/payment-history"
    ) {
      const user = requireUser(db.data, request);

      ok(response, getPaymentHistory(db.data, user.id));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/leads") {
      const user = requireUser(db.data, request);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      const leads = db.data.leads.filter(
        (lead) => lead.ownerUserId === user.id,
      );

      ok(response, {
        count: leads.length,
        limit,
        offset,
        rows: leads.slice(offset, offset + limit),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/notification") {
      const user = requireUser(db.data, request);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      const notification = db.data.notification.filter(
        (message) => message.userId === user.id,
      );

      ok(response, {
        count: notification.length,
        limit,
        offset,
        rows: notification.slice(offset, offset + limit),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/cash-outs") {
      const user = requireUser(db.data, request);
      const body = await readJson<{ amount: number }>(request);
      const cashOut = requestCashOut(db.data, user.id, Number(body.amount));
      db.securityEvent({
        userId: user.id,
        type: "CASH_OUT_REQUESTED",
        ...getRequestContext(request),
        metadata: { amount: cashOut.amount },
      });
      db.save();
      created(response, cashOut);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/admin/cash-outs/")
    ) {
      const admin = requireUser(db.data, request);
      requireAdmin(admin);
      const id = url.pathname.split("/").at(-2);
      const cashOut = db.data.cashOuts.find((item) => item.id === id);
      const body = await readJson<{ status: string; reason?: string }>(request);

      if (!cashOut) throw new Error("Cash-out request not found.");
      if (
        ![
          "UNDER_REVIEW",
          "APPROVED",
          "PROCESSING",
          "PAID",
          "REJECTED",
        ].includes(body.status)
      ) {
        throw new Error("Unsupported cash-out status.");
      }

      const oldValue = { status: cashOut.status };
      cashOut.status = body.status as typeof cashOut.status;
      cashOut.updatedAt = nowIso();
      db.audit({
        action: "CASH_OUT_STATUS_CHANGED",
        actorUserId: admin.id,
        targetUserId: cashOut.userId,
        oldValue,
        newValue: { status: cashOut.status },
        reason: body.reason,
      });
      db.save();
      ok(response, cashOut);
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Request failed.",
    });
  }
};
