import { env } from "../config/env.ts";
import type {
  Database,
  Membership,
  MembershipPayment,
  MembershipPlan,
  User,
} from "../models/types.ts";
import { createId, nowIso } from "../utils/crypto.ts";
import { HttpError } from "../utils/http.ts";

const plans: MembershipPlan[] = ["silver", "gold", "premium"];
const flutterwaveApi = "https://api.flutterwave.com/v3";

type FlutterwaveTransaction = {
  amount?: number | string;
  currency?: string;
  id?: number | string;
  status?: string;
  tx_ref?: string;
};

const requirePaymentConfig = (plan: MembershipPlan) => {
  const amount = env.membershipPricesGhs[plan];
  if (
    !env.flutterwaveSecretKey ||
    !env.flutterwaveSecretHash ||
    !env.paymentRedirectUrl.startsWith("https://") ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new HttpError(
      "Flutterwave payments are not configured with approved plan prices yet.",
      503,
      "PAYMENTS_NOT_CONFIGURED",
    );
  }
  return amount;
};

const addOneMonth = (from: Date) => {
  const day = from.getUTCDate();
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next.toISOString();
};

const findPayment = (data: Database, reference: string) =>
  data.membershipPayments.find((payment) => payment.reference === reference);

export const getMembershipState = (data: Database, userId: string) => {
  const membership = data.memberships.find((item) => item.userId === userId);
  const latestPayment = data.membershipPayments
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const isExpired = !!membership && Date.parse(membership.expiresAt) <= Date.now();

  return {
    membership: membership
      ? {
          ...membership,
          status: isExpired ? "EXPIRED" : membership.status,
        }
      : null,
    latestPayment: latestPayment
      ? {
          amount: latestPayment.amount,
          createdAt: latestPayment.createdAt,
          plan: latestPayment.plan,
          reference: latestPayment.reference,
          status: latestPayment.status,
        }
      : null,
  };
};

export const startMembershipCheckout = async (
  data: Database,
  user: User,
  requestedPlan: unknown,
  expectedAmount: unknown,
) => {
  if (typeof requestedPlan !== "string" || !plans.includes(requestedPlan as MembershipPlan)) {
    throw new HttpError("Choose a valid paid membership plan.", 400, "INVALID_MEMBERSHIP_PLAN");
  }
  const plan = requestedPlan as MembershipPlan;
  const amount = requirePaymentConfig(plan);
  if (typeof expectedAmount !== "number" || !Number.isFinite(expectedAmount) || expectedAmount !== amount) {
    throw new HttpError(
      "The displayed plan price does not match the configured price. Refresh the app or contact support.",
      409,
      "PLAN_PRICE_MISMATCH",
    );
  }
  if (!user.email) {
    throw new HttpError("An email address is required to start checkout.", 400, "EMAIL_REQUIRED");
  }
  const activeMembership = data.memberships.find(
    (item) => item.userId === user.id && item.status === "ACTIVE" && Date.parse(item.expiresAt) > Date.now(),
  );
  if (activeMembership) {
    throw new HttpError(
      `Your ${activeMembership.plan} membership is active until ${activeMembership.expiresAt}. A different plan can be purchased after it expires.`,
      409,
      "MEMBERSHIP_ALREADY_ACTIVE",
    );
  }
  const pending = data.membershipPayments.find(
    (item) => item.userId === user.id && item.status === "PENDING",
  );
  if (pending) {
    throw new HttpError(
      "A membership payment is already awaiting confirmation. Check its status before starting another checkout.",
      409,
      "MEMBERSHIP_PAYMENT_PENDING",
    );
  }

  const createdAt = nowIso();
  const payment: MembershipPayment = {
    id: createId("membership_payment"),
    userId: user.id,
    plan,
    amount,
    currency: "GHS",
    status: "PENDING",
    reference: createId("AFM"),
    flutterwaveTransactionId: null,
    createdAt,
    updatedAt: createdAt,
    paidAt: null,
  };
  data.membershipPayments.push(payment);

  try {
    const response = await fetch(`${flutterwaveApi}/payments`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${env.flutterwaveSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "GHS",
        customer: {
          email: user.email,
          name: user.fullName,
          ...(user.phoneNumber ? { phonenumber: user.phoneNumber } : {}),
        },
        customizations: {
          title: "Angel Foods membership",
          description: `${plan[0].toUpperCase()}${plan.slice(1)} monthly membership`,
        },
        payment_options: "card, ghanamobilemoney",
        redirect_url: env.paymentRedirectUrl,
        tx_ref: payment.reference,
      }),
    });
    const body = await response.json() as {
      data?: { link?: unknown };
      status?: unknown;
    };
    const link = body.data?.link;
    if (!response.ok || body.status !== "success" || typeof link !== "string") {
      throw new Error("Flutterwave checkout could not be started.");
    }
    const parsedLink = new URL(link);
    if (parsedLink.protocol !== "https:" || parsedLink.hostname !== "checkout.flutterwave.com") {
      throw new Error("Flutterwave returned an invalid checkout URL.");
    }

    return {
      amount: payment.amount,
      checkoutUrl: link,
      currency: payment.currency,
      plan: payment.plan,
      reference: payment.reference,
      status: payment.status,
    };
  } catch {
    payment.status = "FAILED";
    payment.updatedAt = nowIso();
    throw new HttpError(
      "Flutterwave checkout could not be started. No membership access was granted.",
      502,
      "CHECKOUT_START_FAILED",
    );
  }
};

const verifyTransaction = async (transactionId: string | number) => {
  const id = String(transactionId);
  if (!/^\d+$/.test(id)) return null;
  const response = await fetch(`${flutterwaveApi}/transactions/${id}/verify`, {
    headers: { Authorization: `Bearer ${env.flutterwaveSecretKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new HttpError("Payment verification is temporarily unavailable.", 502, "PAYMENT_VERIFY_FAILED");
  const body = await response.json() as { data?: FlutterwaveTransaction; status?: unknown };
  return body.status === "success" ? body.data ?? null : null;
};

const applyVerifiedTransaction = (
  data: Database,
  transaction: FlutterwaveTransaction | null,
) => {
  const reference = transaction?.tx_ref;
  if (typeof reference !== "string") return null;
  const payment = findPayment(data, reference);
  if (!payment) return null;

  const updatedAt = nowIso();
  if (
    transaction?.status === "successful" &&
    transaction.currency === payment.currency &&
    Number(transaction.amount) === payment.amount
  ) {
    if (payment.status !== "PAID") {
      const paidAt = updatedAt;
      payment.status = "PAID";
      payment.paidAt = paidAt;
      payment.updatedAt = paidAt;
      payment.flutterwaveTransactionId = String(transaction.id ?? "");
      const existing = data.memberships.find((item) => item.userId === payment.userId);
      const membership: Membership = {
        id: existing?.id ?? createId("membership"),
        userId: payment.userId,
        plan: payment.plan,
        status: "ACTIVE",
        paymentReference: payment.reference,
        startsAt: paidAt,
        expiresAt: addOneMonth(new Date(paidAt)),
        updatedAt: paidAt,
      };
      if (existing) Object.assign(existing, membership);
      else data.memberships.push(membership);
    }
  } else if (transaction?.status === "failed" || transaction?.status === "cancelled") {
    if (payment.status !== "PAID") {
      payment.status = "FAILED";
      payment.updatedAt = updatedAt;
      payment.flutterwaveTransactionId = String(transaction.id ?? "");
    }
  }
  return payment;
};

export const verifyMembershipPayment = async (
  data: Database,
  reference: string,
  transactionId: string | number,
) => {
  const payment = findPayment(data, reference);
  if (!payment) throw new HttpError("Payment reference was not found.", 404, "PAYMENT_NOT_FOUND");
  const transaction = await verifyTransaction(transactionId);
  if (!transaction || transaction.tx_ref !== reference) {
    throw new HttpError("Flutterwave could not verify this payment reference.", 400, "PAYMENT_UNVERIFIED");
  }
  return applyVerifiedTransaction(data, transaction);
};

export const handleFlutterwaveWebhook = async (
  data: Database,
  event: unknown,
  transaction: FlutterwaveTransaction | undefined,
) => {
  if (event !== "charge.completed" || !transaction?.id || !transaction.tx_ref) return null;
  const payment = findPayment(data, transaction.tx_ref);
  if (!payment) return null;
  const verified = await verifyTransaction(transaction.id);
  if (!verified || verified.tx_ref !== payment.reference) return null;
  return applyVerifiedTransaction(data, verified);
};

export const getMembershipPayment = (data: Database, userId: string, reference: string) => {
  const payment = findPayment(data, reference);
  if (!payment || payment.userId !== userId) {
    throw new HttpError("Payment reference was not found.", 404, "PAYMENT_NOT_FOUND");
  }
  return {
    amount: payment.amount,
    createdAt: payment.createdAt,
    currency: payment.currency,
    plan: payment.plan,
    reference: payment.reference,
    status: payment.status,
  };
};
