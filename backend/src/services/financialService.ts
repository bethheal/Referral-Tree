import type { CashOutRequest, Database, LedgerEntry } from "../models/types.ts";
import { HttpError } from "../utils/http.ts";

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

export const requestCashOut = (
  _data: Database,
  _userId: string,
  _amount: number
) => {
  throw new HttpError(
    "Cash-outs are unavailable until withdrawal and eligibility rules are approved and backed by PostgreSQL transactions.",
    503,
    "FINANCIAL_RULES_UNCONFIGURED"
  );
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
