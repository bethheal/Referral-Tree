import type { CashOutRequest, Database, LedgerEntry, User } from "../models/types.ts";
import { env } from "../config/env.ts";
import { createId, nowIso } from "../utils/crypto.ts";

const sum = (entries: LedgerEntry[]) =>
  entries.reduce((total, entry) => total + entry.amount, 0);

export const getFinancialSummary = (data: Database, userId: string) => {
  const entries = data.ledger.filter((entry) => entry.userId === userId);
  const availableCredits = sum(
    entries.filter(
      (entry) => entry.currency === "GHS" && entry.state === "AVAILABLE"
    )
  );
  const reservedCashOuts = sum(
    data.cashOuts
      .filter(
        (cashOut) =>
          cashOut.userId === userId &&
          !["PAID", "REJECTED"].includes(cashOut.status)
      )
      .map((cashOut) => ({
        amount: cashOut.amount,
      })) as LedgerEntry[]
  );

  return {
    availableBalance: Math.max(availableCredits - reservedCashOuts, 0),
    cashOutRequested: reservedCashOuts,
    paidOut: sum(
      data.cashOuts
        .filter((cashOut) => cashOut.userId === userId && cashOut.status === "PAID")
        .map((cashOut) => ({ amount: cashOut.amount })) as LedgerEntry[]
    ),
    pendingEarnings: sum(
      entries.filter((entry) => entry.currency === "GHS" && entry.state === "PENDING")
    ),
    potentialEarnings: sum(
      entries.filter((entry) => entry.currency === "GHS" && entry.state === "POTENTIAL")
    ),
    totalEarnings: sum(
      entries.filter(
        (entry) => entry.currency === "GHS" && entry.state !== "VOID"
      )
    ),
    totalPoints: sum(
      entries.filter(
        (entry) => entry.currency === "POINTS" && entry.state !== "VOID"
      )
    ),
  };
};

export const awardReferralRewards = (
  data: Database,
  referrer: User,
  sourceUser: User
) => {
  const timestamp = nowIso();

  data.ledger.push(
    {
      id: createId("ledger"),
      userId: referrer.id,
      type: "COMMISSION",
      state: "PENDING",
      amount: 50,
      currency: "GHS",
      description: `Referral commission pending for ${sourceUser.fullName}`,
      referenceId: `registration:${sourceUser.id}:commission`,
      createdAt: timestamp,
    },
    {
      id: createId("ledger"),
      userId: referrer.id,
      type: "POINTS",
      state: "AVAILABLE",
      amount: 50,
      currency: "POINTS",
      description: `Referral points for ${sourceUser.fullName}`,
      referenceId: `registration:${sourceUser.id}:points`,
      createdAt: timestamp,
    },
    {
      id: createId("ledger"),
      userId: referrer.id,
      type: "COMMISSION",
      state: "POTENTIAL",
      amount: 25,
      currency: "GHS",
      description: `Potential network earnings for ${sourceUser.fullName}`,
      referenceId: `registration:${sourceUser.id}:potential`,
      createdAt: timestamp,
    }
  );
};

export const requestCashOut = (
  data: Database,
  userId: string,
  amount: number
) => {
  if (!Number.isFinite(amount) || amount < env.minCashOut) {
    throw new Error(`Minimum cash-out amount is GHS ${env.minCashOut}.`);
  }

  const summary = getFinancialSummary(data, userId);

  if (amount > summary.availableBalance) {
    throw new Error("Available balance is not enough for this cash-out.");
  }

  const ledgerEntry: LedgerEntry = {
    id: createId("ledger"),
    userId,
    type: "CASH_OUT",
    state: "PENDING",
    amount: -amount,
    currency: "GHS",
    description: "Cash-out requested",
    referenceId: createId("cashout_ref"),
    createdAt: nowIso(),
  };
  const cashOut: CashOutRequest = {
    id: createId("cashout"),
    userId,
    amount,
    currency: "GHS",
    status: "REQUESTED",
    ledgerEntryId: ledgerEntry.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  data.ledger.push(ledgerEntry);
  data.cashOuts.push(cashOut);

  return cashOut;
};

export const getPaymentHistory = (data: Database, userId: string) =>
  data.cashOuts
    .filter((cashOut) => cashOut.userId === userId)
    .slice()
    .reverse()
    .map((cashOut) => ({
      id: cashOut.id,
      amount: cashOut.amount,
      currency: cashOut.currency,
      date: cashOut.createdAt,
      reference: cashOut.ledgerEntryId,
      status: cashOut.status,
      type: "CASH_OUT",
    }));
