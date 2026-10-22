import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { URL } from "node:url";
import { getBearerToken, requireAdmin, requireSuperAdmin, requireUser } from "../middleware/auth.ts";
import { enforceRateLimit } from "../middleware/rateLimit.ts";
import { env } from "../config/env.ts";
import {
  completeRegistration,
  login,
  loginAdmin,
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
import {
  getMembershipPayment,
  getMembershipState,
  handleFlutterwaveWebhook,
  startMembershipCheckout,
  verifyMembershipPayment,
} from "../services/membershipService.ts";
import { nowIso } from "../utils/crypto.ts";
import { getRequestContext, HttpError, parsePagination, readJson, sendJson } from "../utils/http.ts";
import { createId, hashSessionToken } from "../utils/crypto.ts";
import { profileFor, updateProfile } from "../services/profileService.ts";
import {
  getAdminAuditLog,
  getAdminSummary,
  listAdminUsers,
  updateManagedUserRole,
  updateManagedUserStatus,
} from "../services/adminService.ts";
import { postgresRoute } from "./postgresRouter.ts";
import { postgresRuntimeEnabled } from "../services/prismaClient.ts";

const ok = (response: ServerResponse, payload: unknown) =>
  sendJson(response, 200, payload);

const created = (response: ServerResponse, payload: unknown) =>
  sendJson(response, 201, payload);

export const route = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const requestId = createId("req");
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");

  try {
    const origin = request.headers.origin;
    if (origin) {
      if (!env.allowedOrigins.includes(origin)) {
        throw new HttpError("Origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED");
      }
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }

    const clientAddress = request.socket.remoteAddress ?? "unknown";
    enforceRateLimit(`global:${clientAddress}`);

    // Apply authentication-specific limits before choosing JSON or PostgreSQL
    // storage so the Postgres runtime cannot bypass login throttling.
    if (url.pathname.startsWith("/api/auth/")) {
      enforceRateLimit(`auth:${clientAddress}`, 10, 60_000);
    }
    if (url.pathname === "/api/admin/auth/login") {
      enforceRateLimit(`admin-auth:${clientAddress}`, 5, 60_000);
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (postgresRuntimeEnabled()) {
      await postgresRoute(request, response, url, requestId);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/webhooks/flutterwave") {
      const signature = request.headers["verif-hash"];
      const secret = env.flutterwaveSecretHash;
      const signatureBuffer = Buffer.from(typeof signature === "string" ? signature : "");
      const secretBuffer = Buffer.from(secret);
      if (!secret || signatureBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(signatureBuffer, secretBuffer)) {
        throw new HttpError("Invalid webhook signature.", 401, "INVALID_WEBHOOK_SIGNATURE");
      }
      const body = await readJson<{
        data?: { id?: string | number; tx_ref?: string; status?: string; amount?: string | number; currency?: string };
        event?: string;
      }>(request);
      await handleFlutterwaveWebhook(db.data, body.event, body.data);
      db.save();
      ok(response, { received: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/payments/flutterwave/return") {
      const reference = url.searchParams.get("tx_ref") ?? "";
      const transactionId = url.searchParams.get("transaction_id") ?? "";
      let paymentStatus = "PENDING";
      if (reference && /^\d+$/.test(transactionId)) {
        try {
          const payment = await verifyMembershipPayment(db.data, reference, transactionId);
          paymentStatus = payment?.status ?? "PENDING";
          db.save();
        } catch {
          paymentStatus = "PENDING";
        }
      }
      const message = paymentStatus === "PAID"
        ? "Payment confirmed. Your membership access is active. Return to the Angel Foods app."
        : paymentStatus === "FAILED"
          ? "Payment was not completed. Membership access was not changed. Return to the Angel Foods app."
          : "Payment is being verified. Membership access will update after confirmation. Return to the Angel Foods app shortly.";
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Angel Foods payment</title></head><body style="font-family:Arial,sans-serif;padding:2rem;max-width:36rem;margin:auto"><h1>Payment status: ${paymentStatus}</h1><p>${message}</p><p><a href="angelfoods://dashboard/payments">Return to Angel Foods</a></p></body></html>`);
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      ok(response, { status: "ok", timestamp: nowIso() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      ok(response, { status: "ready", storage: "development-json", productionReady: false });
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

    if (request.method === "POST" && url.pathname === "/api/admin/auth/login") {
      const result = loginAdmin(
        db.data,
        await readJson<{ email: string; password: string }>(request),
        getRequestContext(request),
      );
      db.save();
      ok(response, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      requireUser(db.data, request);
      const token = getBearerToken(request);
      if (token) {
        db.data.revokedSessions ??= [];
        const tokenHash = hashSessionToken(token);
        if (!db.data.revokedSessions.includes(tokenHash)) db.data.revokedSessions.push(tokenHash);
        db.save();
      }
      ok(response, { loggedOut: true });
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

    if (request.method === "GET" && url.pathname === "/api/admin/access") {
      const user = requireUser(db.data, request);
      requireAdmin(user);
      ok(response, { authorized: true, role: user.role, fullName: user.fullName });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/dashboard/summary") {
      requireAdmin(requireUser(db.data, request));
      ok(response, getAdminSummary(db.data));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      requireAdmin(requireUser(db.data, request));
      const { limit, offset } = parsePagination(url.searchParams);
      const search = url.searchParams.get("search") ?? undefined;
      if (search && search.length > 100) throw new HttpError("Search query is too long.", 400, "INVALID_SEARCH");
      ok(response, listAdminUsers(db.data, { limit, offset, search }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/audit-log") {
      requireAdmin(requireUser(db.data, request));
      const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
        throw new HttpError("Limit must be an integer from 1 to 100.", 400, "INVALID_PAGINATION");
      }
      ok(response, getAdminAuditLog(db.data, requestedLimit));
      return;
    }

    const adminUserAction = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/(role|status)$/);
    if (request.method === "PATCH" && adminUserAction) {
      const actor = requireUser(db.data, request);
      requireAdmin(actor);
      enforceRateLimit(`admin-mutation:${actor.id}`, 20, 60_000);
      const targetId = decodeURIComponent(adminUserAction[1]);
      const body = await readJson<Record<string, unknown>>(request);
      const action = adminUserAction[2];
      const allowedKeys = action === "role" ? ["role", "reason"] : ["status", "reason"];
      if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
        throw new HttpError("Request contains unsupported fields.", 400, "INVALID_FIELDS");
      }
      if (action === "role") {
        requireSuperAdmin(actor);
        const user = updateManagedUserRole(db.data, actor, targetId, body.role, body.reason);
        db.save();
        ok(response, { user });
      } else {
        const user = updateManagedUserStatus(db.data, actor, targetId, body.status, body.reason);
        db.save();
        ok(response, { user });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/referrals") {
      const user = requireUser(db.data, request);
      const { limit, offset } = parsePagination(url.searchParams);
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
        throw new HttpError("Referral access denied.", 403, "FORBIDDEN");
      }

      const referral = db.data.users.find((item) => item.id === referralId);

      if (!referral) throw new HttpError("Referral not found.", 404, "NOT_FOUND");

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

    if (request.method === "GET" && url.pathname === "/api/me/profile") {
      const user = requireUser(db.data, request);
      ok(response, profileFor(db.data, user));
      return;
    }

    if (request.method === "PATCH" && url.pathname === "/api/me/profile") {
      const user = requireUser(db.data, request);
      const updated = updateProfile(
        db.data,
        user,
        await readJson<Record<string, unknown>>(request),
      );
      db.save();
      ok(response, updated);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/membership") {
      const user = requireUser(db.data, request);
      ok(response, getMembershipState(db.data, user.id));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/membership/checkout") {
      const user = requireUser(db.data, request);
      const body = await readJson<{ plan?: unknown; expectedAmount?: unknown }>(request);
      try {
        const result = await startMembershipCheckout(db.data, user, body.plan, body.expectedAmount);
        db.save();
        created(response, result);
      } catch (error) {
        db.save();
        throw error;
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/me/membership-payments/")) {
      const user = requireUser(db.data, request);
      const reference = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      ok(response, getMembershipPayment(db.data, user.id, reference));
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
      const { limit, offset } = parsePagination(url.searchParams);
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
      const { limit, offset } = parsePagination(url.searchParams);
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

    if (request.method === "PATCH" && url.pathname.startsWith("/api/me/notification/") && url.pathname.endsWith("/read")) {
      const user = requireUser(db.data, request);
      const notificationId = url.pathname.split("/").at(-2);
      const message = db.data.notification.find(
        (item) => item.id === notificationId && item.userId === user.id,
      );
      if (!message) throw new HttpError("Notification not found.", 404, "NOT_FOUND");
      message.readAt ??= nowIso();
      db.save();
      ok(response, { id: message.id, readAt: message.readAt });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/notification/read-all") {
      const user = requireUser(db.data, request);
      const readAt = nowIso();
      for (const message of db.data.notification) {
        if (message.userId === user.id) message.readAt ??= readAt;
      }
      db.save();
      ok(response, { readAt });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/cash-outs") {
      const user = requireUser(db.data, request);
      const body = await readJson<{ amount: number }>(request);
      if (typeof body.amount !== "number" || !Number.isFinite(body.amount)) {
        throw new HttpError("Amount must be a valid number.");
      }
      requestCashOut(db.data, user.id, body.amount);
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/admin/cash-outs/")
    ) {
      requireAdmin(requireUser(db.data, request));
      throw new HttpError(
        "Cash-out review is unavailable until approval rules and transactional PostgreSQL storage are configured.",
        503,
        "FINANCIAL_RULES_UNCONFIGURED"
      );
    }

    throw new HttpError("Not found.", 404, "NOT_FOUND");
  } catch (error) {
    const knownError = error instanceof HttpError;
    const statusCode = knownError ? error.statusCode : 500;
    const code = knownError ? error.code : "INTERNAL_ERROR";
    const message = knownError ? error.message : "Request failed.";
    if (!knownError) {
      console.error(JSON.stringify({ requestId, code, path: url.pathname }));
    }
    if (
      !postgresRuntimeEnabled() &&
      knownError &&
      ((url.pathname === "/api/auth/register/verify" && error.code === "OTP_INVALID") ||
        (url.pathname === "/api/auth/login" && error.code === "LOGIN_FAILED") ||
        url.pathname === "/api/admin/auth/login")
    ) {
      db.save();
    }
    sendJson(response, statusCode, { error: message, code, requestId });
  }
};
