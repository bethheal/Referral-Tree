import { useCallback, useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Payment account types                                                      */
/* -------------------------------------------------------------------------- */

export type AccountKind = "mtn" | "telecel" | "airteltigo" | "bank" | "card";
export type CardBrand = "visa" | "mastercard" | "unknown";

export type PaymentAccount = {
  bankName?: string;
  brand?: CardBrand;
  createdAt: number;
  expiry?: string; // MM/YY (cards)
  holder: string;
  id: string;
  isDefault: boolean;
  kind: AccountKind;
  last4?: string; // cards
  number?: string; // mobile money number (0XXXXXXXXX) or bank account number
};

export type NewAccountInput = Omit<PaymentAccount, "createdAt" | "id" | "isDefault">;

/** Sensitive card data. Only ever passed to the service, never kept in state. */
export type CardSecrets = { cvv: string; number: string };

export const ACCOUNT_KINDS: {
  bg: string;
  badge: string;
  fg: string;
  key: AccountKind;
  label: string;
  prefixes: readonly string[];
}[] = [
  { badge: "MTN", bg: "#FFCC00", fg: "#1A1A1A", key: "mtn", label: "MTN MoMo", prefixes: ["024", "025", "053", "054", "055", "059"] },
  { badge: "T", bg: "#E60000", fg: "#FFFFFF", key: "telecel", label: "Telecel Cash", prefixes: ["020", "050"] },
  { badge: "AT", bg: "#0A4DA2", fg: "#FFFFFF", key: "airteltigo", label: "AirtelTigo Money", prefixes: ["026", "027", "056", "057"] },
  { badge: "", bg: "#1E3631", fg: "#FFFFFF", key: "bank", label: "Bank account", prefixes: [] },
  { badge: "", bg: "#4A2A6B", fg: "#FFFFFF", key: "card", label: "Debit / credit card", prefixes: [] },
];

export const getKindInfo = (kind: AccountKind) =>
  ACCOUNT_KINDS.find((item) => item.key === kind) ?? ACCOUNT_KINDS[0];

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

/** Accepts 0241234567, 024 123 4567 or +233241234567 and returns 0241234567. */
export function normalizeGhanaNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("233")) return `0${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  return null;
}

export const maskGhanaNumber = (n: string) => `${n.slice(0, 3)} *** ${n.slice(6)}`;
export const maskAccountNumber = (n: string) => `•••• ${n.slice(-4)}`;

export function luhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }

  return sum % 10 === 0;
}

export function detectBrand(cardNumber: string): CardBrand {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  return "unknown";
}

export function expiryValid(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return false;

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;

  // A card is valid through the last day of its expiry month.
  return new Date(year, month, 1).getTime() > Date.now();
}

export const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();

export function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Returns an error message, or null when the input is valid. */
export function validateAccountInput(
  kind: AccountKind,
  fields: {
    bankName: string;
    cardNumber: string;
    cvv: string;
    expiry: string;
    holder: string;
    number: string;
  }
): string | null {
  if (fields.holder.trim().length < 2) return "Enter the account holder's name.";

  if (kind === "card") {
    if (!luhnValid(fields.cardNumber)) return "That card number doesn't look valid.";
    if (!expiryValid(fields.expiry)) return "Enter a valid expiry date (MM/YY) that hasn't passed.";
    if (!/^\d{3,4}$/.test(fields.cvv)) return "Enter the 3 or 4 digit security code.";
    return null;
  }

  if (kind === "bank") {
    if (fields.bankName.trim().length < 2) return "Enter the bank name.";
    const digits = fields.number.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 16 ? null : "Enter a valid account number (10–16 digits).";
  }

  return normalizeGhanaNumber(fields.number) ? null : "Enter a valid Ghana number, e.g. 024 123 4567.";
}

/* -------------------------------------------------------------------------- */
/* Membership plans                                                           */
/* -------------------------------------------------------------------------- */

export type PlanKey = "free" | "silver" | "gold" | "premium";

export type Plan = {
  accent: string;
  /** Percentage of the member's earnings for the month paid to the platform. */
  commissionRate: number;
  /** Flat monthly fee in GH₵ paid to the platform. */
  monthlyFee: number;
  key: PlanKey;
  label: string;
};

/**
 * ⚠️ PLACEHOLDER RATES: replace with your real pricing (or load them from your
 * backend). Everything in the UI derives from this list, so no other code
 * needs to change.
 */
export const PLANS: Plan[] = [
  { accent: "#8B7F7A", commissionRate: 10, key: "free", label: "Free", monthlyFee: 0 },
  { accent: "#8E9AA6", commissionRate: 7, key: "silver", label: "Silver", monthlyFee: 20 },
  { accent: "#D7B126", commissionRate: 5, key: "gold", label: "Gold", monthlyFee: 50 },
  { accent: "#192536", commissionRate: 3, key: "premium", label: "Premium", monthlyFee: 100 },
];

export const getPlan = (key: PlanKey) => PLANS.find((plan) => plan.key === key) ?? PLANS[0];

/** Commission due to the platform for a month with the given earnings. */
export function commissionDue(plan: Plan, monthEarnings: number) {
  const percentage = Math.round(((plan.commissionRate / 100) * monthEarnings) * 100) / 100;
  return { fee: plan.monthlyFee, percentage, total: plan.monthlyFee + percentage };
}

/* -------------------------------------------------------------------------- */
/* Service adapters                                                           */
/* -------------------------------------------------------------------------- */

/**
 * REPLACE WITH API CALLS.
 *
 * These adapters keep data in memory, so everything works end to end during
 * the app session but resets on reload. Swap each method body for your real
 * backend or payment processor (e.g. tokenize cards with Paystack/Flutterwave
 * and store only the token). Keep the signatures and the UI needs no changes.
 * Full card numbers and CVVs are discarded immediately in this adapter.
 */
const delay = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let accountStore: PaymentAccount[] = [];
let planStore: { billingAccountId: string | null; plan: PlanKey } = {
  billingAccountId: null,
  plan: "free",
};

const newId = () => `acct_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const accountService = {
  async add(input: NewAccountInput, secrets?: CardSecrets): Promise<PaymentAccount> {
    await delay();

    const account: PaymentAccount = {
      ...input,
      brand: secrets ? detectBrand(secrets.number) : input.brand,
      createdAt: Date.now(),
      id: newId(),
      isDefault: accountStore.length === 0,
      last4: secrets ? secrets.number.replace(/\D/g, "").slice(-4) : input.last4,
    };

    accountStore = [...accountStore, account];
    return account;
  },

  async list(): Promise<PaymentAccount[]> {
    await delay(200);
    return [...accountStore];
  },

  async remove(id: string): Promise<void> {
    await delay();
    const wasDefault = accountStore.find((item) => item.id === id)?.isDefault;
    accountStore = accountStore.filter((item) => item.id !== id);

    if (wasDefault && accountStore.length) {
      accountStore = accountStore.map((item, index) => ({ ...item, isDefault: index === 0 }));
    }
    if (planStore.billingAccountId === id) {
      planStore = { ...planStore, billingAccountId: null };
    }
  },

  async setDefault(id: string): Promise<void> {
    await delay(200);
    accountStore = accountStore.map((item) => ({ ...item, isDefault: item.id === id }));
  },

  async update(id: string, patch: Partial<NewAccountInput>): Promise<void> {
    await delay();
    accountStore = accountStore.map((item) => (item.id === id ? { ...item, ...patch } : item));
  },
};

export const planService = {
  async change(plan: PlanKey, billingAccountId: string | null): Promise<void> {
    await delay(500);
    planStore = { billingAccountId, plan };
  },

  async current() {
    await delay(150);
    return { ...planStore };
  },
};

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

export function usePaymentAccounts() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setAccounts(await accountService.list());
    } catch {
      setError("We couldn't load your accounts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      const result = await action();
      setAccounts(await accountService.list());
      return result;
    },
    []
  );

  return {
    accounts,
    add: (input: NewAccountInput, secrets?: CardSecrets) =>
      run(() => accountService.add(input, secrets)),
    error,
    loading,
    reload,
    remove: (id: string) => run(() => accountService.remove(id)),
    setDefault: (id: string) => run(() => accountService.setDefault(id)),
    update: (id: string, patch: Partial<NewAccountInput>) =>
      run(() => accountService.update(id, patch)),
  };
}

export function useMembershipPlan() {
  const [plan, setPlan] = useState<PlanKey>("free");
  const [billingAccountId, setBillingAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    planService
      .current()
      .then((state) => {
        setPlan(state.plan);
        setBillingAccountId(state.billingAccountId);
      })
      .finally(() => setLoading(false));
  }, []);

  const change = async (next: PlanKey, accountId: string | null) => {
    await planService.change(next, accountId);
    setPlan(next);
    setBillingAccountId(accountId);
  };

  return { billingAccountId, change, loading, plan };
}