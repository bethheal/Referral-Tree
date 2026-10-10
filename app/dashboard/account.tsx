import {
  getMemberDashboardSummary,
  getMemberDirectReferrals,
  mockReferralLink,
  mockReferralTree,
  referralSystem,
} from "@/components/referralData";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as Clipboard from "expo-clipboard";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import MembershipPlans from "./MembershipPlans";

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

// App-wide palette.
const C = {
  bg: "#F7F5FB",
  card: "#FFFFFF",
  ink: "#1C1B2E",
  muted: "#8A8AA3",
  line: "#EFEDF5",
  pink: "#F0508F",
  pinkSoft: "#FDE7F0",
  lilac: "#EBD7F7",
  lilacSoft: "#F4EAFB",
  green: "#1F9A87",
  greenSoft: "#E3F4F1",
  mint: "#E4F7EE",
  mintInk: "#1E9E6A",
  amberSoft: "#FFF3D9",
  amber: "#F5A524",
  blueSoft: "#E6EDFF",
  blue: "#4F7CFF",
  danger: "#E5484D",
  purple: "#8A5BC2",
};

// Payment flow palette, taken from the supplied reference screens.
const P = {
  orange: "#FF4D00",
  orangeDark: "#D93F00",
  orangePeach: "#FFF1EA",
  teal: "#14403F",
  gray: "#6E7B79",
  grayLight: "#A7B2B0",
  grayLine: "#D5DCDA",
  track: "#E4E9E8",
  white: "#FFFFFF",
  red: "#D92D20",
  momo: "#FFC60A",
  focus: "#14403F",
};

/* -------------------------------------------------------------------------- */
/* Payment provider                                                           */
/* -------------------------------------------------------------------------- */

/**
 * INTEGRATION POINT: connect your payment gateway here.
 *
 * Card data must go straight from the form to the provider's tokenizer (its
 * SDK or hosted fields). The app receives only a token, the brand, the last
 * four digits and the expiry, and never stores the card number or CVV.
 *
 * While this is null, every payment attempt fails with a clear message, so the
 * UI never reports a charge or a saved method that did not happen.
 */
type CardBrand = "visa" | "mastercard";

type CardInput = { number: string; name: string; expiry: string; cvv: string };

type TokenizedCard = {
  token: string;
  brand: CardBrand;
  last4: string;
  expiry: string;
};

type ChargeRequest = {
  method: "paypal" | "mtn_momo" | "card";
  intent: "charge" | "save";
  amount?: number;
  currency: "GHS";
  cardToken?: string;
  phone?: string;
  saveForFuture: boolean;
};

type ChargeResult =
  | { ok: true; reference: string }
  | { ok: false; message: string };

interface PaymentProvider {
  tokenizeCard(card: CardInput, saveForFuture: boolean): Promise<TokenizedCard>;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

const paymentProvider: PaymentProvider | null = null;

const NOT_CONFIGURED = "PAYMENTS_NOT_CONFIGURED";

/* -------------------------------------------------------------------------- */
/* Payment validation helpers (pure)                                          */
/* -------------------------------------------------------------------------- */

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

/**
 * Formats digit input while keeping backspace usable. If the user deleted a
 * separator (so the digits did not change), one digit is removed instead, so
 * the value never gets stuck.
 */
function formatDigitsInput(
  next: string,
  prev: string,
  maxDigits: number,
  group: (digits: string) => string,
) {
  let digits = onlyDigits(next);
  if (next.length < prev.length && digits === onlyDigits(prev)) {
    digits = digits.slice(0, -1);
  }
  return group(digits.slice(0, maxDigits));
}

const groupCardNumber = (digits: string) =>
  digits.replace(/(\d{4})(?=\d)/g, "$1 ");

const groupExpiry = (digits: string) =>
  digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;

/** Returns the network for the digits entered so far, or flags it as unsupported. */
function detectBrand(digits: string): {
  brand: CardBrand | null;
  unsupported: boolean;
} {
  if (!digits) return { brand: null, unsupported: false };

  const first = digits[0];

  if (first === "4") return { brand: "visa", unsupported: false };

  if (first === "5") {
    if (digits.length < 2) return { brand: null, unsupported: false };
    const second = Number(digits[1]);
    return second >= 1 && second <= 5
      ? { brand: "mastercard", unsupported: false }
      : { brand: null, unsupported: true };
  }

  if (first === "2") {
    // Mastercard 2-series runs from 2221 to 2720.
    if (digits.length >= 2 && (digits[1] < "2" || digits[1] > "7")) {
      return { brand: null, unsupported: true };
    }
    if (digits.length < 4) return { brand: null, unsupported: false };
    const prefix = Number(digits.slice(0, 4));
    return prefix >= 2221 && prefix <= 2720
      ? { brand: "mastercard", unsupported: false }
      : { brand: null, unsupported: true };
  }

  return { brand: null, unsupported: true };
}

function luhnValid(digits: string) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

function validateCardNumber(digits: string): string | null {
  if (!digits) return "Enter your card number";
  if (detectBrand(digits).unsupported) return "We accept Visa and Mastercard";
  if (digits.length < 16) return "Card number must be 16 digits";
  if (!luhnValid(digits)) return "This card number isn't valid";
  return null;
}

function validateName(raw: string): string | null {
  const name = normalizeName(raw);
  if (!name) return "Enter the name as printed on the card";
  if (name.length < 2) return "Name looks too short";
  if (!/^\p{L}[\p{L} '.-]*$/u.test(name)) {
    return "Use letters, spaces, apostrophes, periods or hyphens";
  }
  return null;
}

function validateExpiry(value: string, now: Date = new Date()): string | null {
  if (!value) return "Enter the expiry date";

  const digits = onlyDigits(value);
  if (digits.length >= 2) {
    const month = Number(digits.slice(0, 2));
    if (month < 1 || month > 12) return "Month must be 01-12";
  }

  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return "Enter the date as MM/YY";

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return "This card has expired";
  }
  return null;
}

function validateCvv(digits: string): string | null {
  if (!digits) return "Enter the CVV on the back of your card";
  if (digits.length !== 3) return "CVV must be 3 digits";
  return null;
}

function validateMomoPhone(digits: string): string | null {
  if (!digits) return "Enter your mobile money number";
  if (!/^0\d{9}$/.test(digits))
    return "Enter a 10-digit number starting with 0";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Saved payment methods                                                      */
/* -------------------------------------------------------------------------- */

type SavedMethod = {
  id: string;
  isDefault: boolean;
  kind: "card" | "paypal" | "mobile_money";
  brand?: string;
  last4?: string;
  expiry?: string;
  holder?: string;
  phone?: string;
  cardToken?: string;
};

type NewMethod = Omit<SavedMethod, "id" | "isDefault">;

function usePaymentMethods() {
  const [methods, setMethods] = useState<SavedMethod[]>([]);

  const addMethod = (input: NewMethod) =>
    setMethods((current) => [
      ...current,
      {
        ...input,
        id: `${input.kind}-${Date.now()}`,
        isDefault: current.length === 0,
      },
    ]);

  const removeMethod = (id: string) =>
    setMethods((current) => {
      const next = current.filter((item) => item.id !== id);
      // Keep a default when the default is removed.
      if (next.length && !next.some((item) => item.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });

  const setDefault = (id: string) =>
    setMethods((current) =>
      current.map((item) => ({ ...item, isDefault: item.id === id })),
    );

  return { methods, addMethod, removeMethod, setDefault };
}

const methodTitle = (method: SavedMethod) => {
  if (method.kind === "card") return `${method.brand ?? "Card"} card`;
  if (method.kind === "paypal") return "PayPal";
  return "MTN Mobile Money";
};

const methodDetail = (method: SavedMethod) => {
  if (method.kind === "card")
    return `•••• ${method.last4} · Expires ${method.expiry}`;
  if (method.kind === "paypal") return "Linked account";
  return `•••• ${(method.phone ?? "").slice(-4)}`;
};

/* -------------------------------------------------------------------------- */
/* Shared page helpers                                                        */
/* -------------------------------------------------------------------------- */

const formatGhs = (value: number) => `GH₵${value.toLocaleString("en-GH")}`;

const formatDate = (time: number | null) =>
  time === null ? "—" : new Date(time).toLocaleDateString();

const CURRENT_USER_ID = "user-1";
const PAYMENTS_PREVIEW = 6;
const HISTORY_PREVIEW = 8;

const SECTIONS = [
  { key: "referral", label: "Referral" },
  { key: "finance", label: "Finance" },
  { key: "methods", label: "Payments" },
  { key: "plans", label: "Plan" },
  { key: "withdraw", label: "Withdraw" },
  { key: "history", label: "History" },
  { key: "transactions", label: "Transactions" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

/**
 * Some records don't have a fixed shape in the shared types, so optional fields
 * are read defensively. Missing data shows "—" or is hidden. Nothing is invented.
 */
function readField(
  record: unknown,
  keys: string[],
): string | number | undefined {
  if (!record || typeof record !== "object") return undefined;
  const source = record as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return undefined;
}

function toTime(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

type HistoryCategory =
  | "commission"
  | "bonus"
  | "referral"
  | "withdrawal"
  | "other";

type HistoryItem = {
  amount?: number;
  category: HistoryCategory;
  date: number | null;
  icon: string;
  key: string;
  subtitle: string;
  title: string;
};

const HISTORY_FILTERS: { key: "all" | HistoryCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "commission", label: "Commissions" },
  { key: "bonus", label: "Bonuses" },
  { key: "referral", label: "Referrals" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "other", label: "Other" },
];

const CATEGORY_TINT: Record<HistoryCategory, { bg: string; fg: string }> = {
  commission: { bg: C.mint, fg: C.mintInk },
  bonus: { bg: C.amberSoft, fg: C.amber },
  referral: { bg: C.blueSoft, fg: C.blue },
  withdrawal: { bg: C.pinkSoft, fg: C.pink },
  other: { bg: C.lilacSoft, fg: C.purple },
};

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function Section({
  children,
  icon,
  onLayout,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: string;
  onLayout: (event: LayoutChangeEvent) => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <View onLayout={onLayout} style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <FontAwesome6 name={icon} size={13} color={C.pink} />
        </View>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function StatTile({
  bg,
  fg,
  icon,
  label,
  value,
}: {
  bg: string;
  fg: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: bg }]}>
      <View style={styles.statIcon}>
        <FontAwesome6 name={icon} size={11} color={fg} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

function Chip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  filled,
  icon,
  label,
  onPress,
}: {
  filled?: boolean;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        filled && styles.actionButtonFilled,
        pressed && styles.pressed,
      ]}
    >
      <FontAwesome6 name={icon} size={13} color={filled ? "#FFFFFF" : C.pink} />
      <Text
        style={[
          styles.actionButtonText,
          filled && styles.actionButtonTextFilled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <FontAwesome6 name="inbox" size={18} color="#B3B3C6" />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment flow: building blocks                                              */
/* -------------------------------------------------------------------------- */

type Step = "method" | "details" | "pay";
type CardField = "number" | "name" | "expiry" | "cvv";
type CardForm = Record<CardField, string>;
type PayState = {
  status: "idle" | "processing" | "success" | "error";
  message?: string;
  reference?: string;
};

const EMPTY_CARD: CardForm = { number: "", name: "", expiry: "", cvv: "" };
const PAYPAL = "paypal";
const MOMO = "mobile_money";
const NEW_CARD = "new_card";

function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  const labels = ["Method", "Details", "Pay"];
  return (
    <View
      style={styles.stepRow}
      accessibilityLabel={`Step ${current + 1} of 3: ${labels[current]}`}
    >
      {labels.map((label, index) => {
        const reached = index <= current;
        const isCurrent = index === current;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepBar,
                { backgroundColor: reached ? P.orange : P.track },
              ]}
            />
            <Text
              style={[
                styles.stepLabel,
                { color: isCurrent ? P.teal : P.grayLight },
                isCurrent && styles.stepLabelActive,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CardPreview({
  number,
  name,
  expiry,
}: {
  number: string;
  name: string;
  expiry: string;
}) {
  const digits = onlyDigits(number);
  // Show typed digits, then bullets for the rest, so the card keeps its shape.
  const groups = [0, 4, 8, 12].map((start) =>
    (digits.slice(start, start + 4) + "••••").slice(0, 4),
  );
  const displayName = name ? normalizeName(name).toUpperCase() : "Name on card";
  const displayExpiry = expiry || "MM/YY";

  return (
    <View style={styles.card} accessibilityLabel="Card preview">
      <View style={styles.cardStrip} />
      <View style={styles.cardBandLarge} />
      <View style={styles.cardBandSmall} />

      <View style={styles.cardTop}>
        <FontAwesome6 name="credit-card" size={22} color={P.white} />
      </View>

      <Text style={styles.cardNumber} numberOfLines={1} adjustsFontSizeToFit>
        {groups.join(" ")}
      </Text>

      <View style={styles.cardBottom}>
        <View style={styles.cardBottomLeft}>
          <Text style={styles.cardSmallLabel}>Card holder</Text>
          <Text numberOfLines={1} style={styles.cardName}>
            {displayName}
          </Text>
        </View>
        <View style={styles.cardBottomRight}>
          <Text style={styles.cardSmallLabel}>Expires</Text>
          <Text style={styles.cardName}>{displayExpiry}</Text>
        </View>
      </View>
    </View>
  );
}

function Field({
  error,
  label,
  onBlur,
  onFocus,
  ...props
}: TextInputProps & { error?: string | null; label: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled: false }}
        placeholderTextColor={P.grayLight}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}
        {...props}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function PaymentOption({
  icon,
  onPress,
  selected,
  subtitle,
  title,
  visual,
}: {
  icon: ReactNode;
  onPress: () => void;
  selected: boolean;
  subtitle?: string;
  title: string;
  visual?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.optionLeading}>{visual ?? icon}</View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.optionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

function Checkbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={styles.checkboxRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? (
          <FontAwesome6 name="check" size={11} color={P.white} />
        ) : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.payButton,
        disabled && styles.payButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.payButtonText}>{label}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment flow: the three screens                                            */
/* -------------------------------------------------------------------------- */

type PaymentFlowProps = {
  amount?: number;
  intent: "charge" | "save";
  onClose: () => void;
  onSaved: (method: NewMethod) => void;
  savedMethods: SavedMethod[];
  visible: boolean;
};

function PaymentFlow({
  amount,
  intent,
  onClose,
  onSaved,
  savedMethods,
  visible,
}: PaymentFlowProps) {
  const [step, setStep] = useState<Step>("method");
  const [selected, setSelected] = useState<string>(PAYPAL);
  const [card, setCard] = useState<CardForm>(EMPTY_CARD);
  const [saveCard, setSaveCard] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<CardField, boolean>>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [pay, setPay] = useState<PayState>({ status: "idle" });

  // Reset everything, including the CVV, whenever the flow closes.
  useEffect(() => {
    if (!visible) {
      setStep("method");
      setSelected(PAYPAL);
      setCard(EMPTY_CARD);
      setSaveCard(true);
      setTouched({});
      setSubmitted(false);
      setPhone("");
      setPhoneTouched(false);
      setPay({ status: "idle" });
    }
  }, [visible]);

  const cardNumber = onlyDigits(card.number);
  const cvvDigits = onlyDigits(card.cvv);

  const cardErrors: Record<CardField, string | null> = {
    number: validateCardNumber(cardNumber),
    name: validateName(card.name),
    expiry: validateExpiry(card.expiry),
    cvv: validateCvv(cvvDigits),
  };
  const cardValid = Object.values(cardErrors).every((error) => error === null);

  // Errors appear once a field has been touched or the form was submitted.
  const errorFor = (field: CardField) =>
    touched[field] || submitted ? cardErrors[field] : null;

  const savedCards = savedMethods.filter((method) => method.kind === "card");
  const savedCard =
    savedCards.find((method) => `saved:${method.id}` === selected) ?? null;
  const momoError = phoneTouched ? validateMomoPhone(onlyDigits(phone)) : null;

  const stepIndex: 0 | 1 | 2 =
    step === "method" ? 0 : step === "details" ? 1 : 2;
  const isProcessing = pay.status === "processing";

  const chargeMethod: ChargeRequest["method"] =
    selected === PAYPAL ? "paypal" : selected === MOMO ? "mtn_momo" : "card";

  const goToDetails = () => {
    setSelected(NEW_CARD);
    setSubmitted(false);
    setStep("details");
  };

  const backFromDetails = () => {
    // Keep non-sensitive values, but never keep the CVV after leaving the screen.
    setCard((current) => ({ ...current, cvv: "" }));
    setSelected((current) => (current === NEW_CARD ? PAYPAL : current));
    setStep("method");
  };

  const continueFromMethod = () => {
    setPay({ status: "idle" });
    setStep("pay");
  };

  const continueFromDetails = () => {
    setSubmitted(true);
    if (!cardValid) return;
    setPay({ status: "idle" });
    setStep("pay");
  };

  const goBack = () => {
    if (isProcessing) return;
    if (step === "method") onClose();
    else if (step === "details") backFromDetails();
    else {
      setPay({ status: "idle" });
      setStep(selected === NEW_CARD ? "details" : "method");
    }
  };

  const submitPayment = async () => {
    if (isProcessing || pay.status === "success") return;

    if (selected === MOMO) {
      setPhoneTouched(true);
      if (validateMomoPhone(onlyDigits(phone))) return;
    }

    setPay({ status: "processing" });

    try {
      if (!paymentProvider) throw new Error(NOT_CONFIGURED);

      const saveForFuture =
        intent === "save" || (selected === NEW_CARD && saveCard);
      let cardToken: string | undefined;
      let tokenized: TokenizedCard | undefined;

      if (selected === NEW_CARD) {
        tokenized = await paymentProvider.tokenizeCard(
          {
            number: cardNumber,
            name: normalizeName(card.name),
            expiry: card.expiry,
            cvv: cvvDigits,
          },
          saveCard,
        );
        cardToken = tokenized.token;
      } else if (savedCard) {
        cardToken = savedCard.cardToken;
      }

      const result = await paymentProvider.charge({
        method: chargeMethod,
        intent,
        amount: intent === "charge" ? amount : undefined,
        currency: "GHS",
        cardToken,
        phone: selected === MOMO ? onlyDigits(phone) : undefined,
        saveForFuture,
      });

      if (!result.ok) {
        setPay({ status: "error", message: result.message });
        return;
      }

      // Only save after the provider has confirmed.
      if (tokenized && saveCard) {
        onSaved({
          kind: "card",
          brand: tokenized.brand === "visa" ? "Visa" : "Mastercard",
          last4: tokenized.last4,
          expiry: tokenized.expiry,
          holder: normalizeName(card.name),
          cardToken: tokenized.token,
        });
      } else if (intent === "save" && selected === MOMO) {
        onSaved({ kind: "mobile_money", phone: onlyDigits(phone) });
      } else if (intent === "save" && selected === PAYPAL) {
        onSaved({ kind: "paypal" });
      }

      setCard((current) => ({ ...current, cvv: "" }));
      setPay({ status: "success", reference: result.reference });
    } catch (error) {
      const notConfigured =
        error instanceof Error && error.message === NOT_CONFIGURED;
      setPay({
        status: "error",
        message: notConfigured
          ? "Payments aren't connected yet, so nothing was charged or saved."
          : "The payment couldn't be completed. You haven't been charged. Please try again.",
      });
    }
  };

  const headerTitle =
    step === "method"
      ? "Payment"
      : step === "details"
        ? "Add new card"
        : intent === "save"
          ? "Save method"
          : "Confirm payment";

  const payLabel =
    intent === "save"
      ? "Save payment method"
      : amount !== undefined
        ? `Pay ${formatGhs(amount)}`
        : "Pay";

  const selectedTitle =
    selected === PAYPAL
      ? "PayPal"
      : selected === MOMO
        ? "MTN Mobile Money"
        : selected === NEW_CARD
          ? "New card"
          : savedCard
            ? methodTitle(savedCard)
            : "";

  return (
    <Modal
      animationType="slide"
      onRequestClose={goBack}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView style={styles.flowContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flowFlex}
        >
          <View style={styles.flowHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              disabled={isProcessing}
              hitSlop={10}
              onPress={goBack}
              style={styles.backButton}
            >
              <FontAwesome6 name="arrow-left" size={16} color={P.teal} />
            </Pressable>
            <Text style={styles.flowTitle}>{headerTitle}</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.flowContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <StepIndicator current={stepIndex} />

            {step === "method" ? (
              <View>
                <Text style={styles.flowHeading}>Choose how to pay</Text>

                <PaymentOption
                  onPress={() => setSelected(PAYPAL)}
                  selected={selected === PAYPAL}
                  title="PayPal"
                  visual={
                    <Image
                      accessibilityLabel="PayPal logo"
                      resizeMode="contain"
                      source={require("../../assets/images/paypal.png")}
                      style={styles.paypalLogo}
                    />
                  }
                  icon={null}
                />

                <PaymentOption
                  onPress={() => setSelected(MOMO)}
                  selected={selected === MOMO}
                  title="MTN Mobile Money"
                  visual={
                    <View style={styles.momoIcon}>
                      <FontAwesome6
                        name="mobile-screen-button"
                        size={16}
                        color={P.teal}
                      />
                    </View>
                  }
                  icon={null}
                />

                {savedCards.map((method) => (
                  <PaymentOption
                    key={method.id}
                    onPress={() => setSelected(`saved:${method.id}`)}
                    selected={selected === `saved:${method.id}`}
                    subtitle={methodDetail(method)}
                    title={methodTitle(method)}
                    visual={
                      <View style={styles.cardIcon}>
                        <FontAwesome6
                          name="credit-card"
                          size={14}
                          color={P.white}
                        />
                      </View>
                    }
                    icon={null}
                  />
                ))}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add new card"
                  onPress={goToDetails}
                  style={({ pressed }) => [
                    styles.addCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <FontAwesome6 name="plus" size={12} color={P.teal} />
                  <Text style={styles.addCardText}>Add new card</Text>
                </Pressable>

                <View style={styles.spacer} />
                <PrimaryButton label="Continue" onPress={continueFromMethod} />
              </View>
            ) : null}

            {step === "details" ? (
              <View>
                <CardPreview
                  expiry={card.expiry}
                  name={card.name}
                  number={card.number}
                />

                <View style={styles.formGap}>
                  <Field
                    autoComplete="cc-number"
                    error={errorFor("number")}
                    keyboardType="number-pad"
                    label="Card number"
                    maxLength={19}
                    onBlur={() => setTouched((t) => ({ ...t, number: true }))}
                    onChangeText={(text) =>
                      setCard((c) => ({
                        ...c,
                        number: formatDigitsInput(
                          text,
                          c.number,
                          16,
                          groupCardNumber,
                        ),
                      }))
                    }
                    placeholder="0000 0000 0000 0000"
                    value={card.number}
                  />

                  <Field
                    autoCapitalize="words"
                    autoComplete="name"
                    error={errorFor("name")}
                    label="Name on card"
                    maxLength={40}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    onChangeText={(text) =>
                      setCard((c) => ({ ...c, name: text }))
                    }
                    placeholder="As printed on the card"
                    value={card.name}
                  />

                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Field
                        error={errorFor("expiry")}
                        keyboardType="number-pad"
                        label="Expiry date"
                        maxLength={5}
                        onBlur={() =>
                          setTouched((t) => ({ ...t, expiry: true }))
                        }
                        onChangeText={(text) =>
                          setCard((c) => ({
                            ...c,
                            expiry: formatDigitsInput(
                              text,
                              c.expiry,
                              4,
                              groupExpiry,
                            ),
                          }))
                        }
                        placeholder="MM/YY"
                        value={card.expiry}
                      />
                    </View>
                    <View style={styles.half}>
                      <Field
                        error={errorFor("cvv")}
                        keyboardType="number-pad"
                        label="CVV"
                        maxLength={3}
                        onBlur={() => setTouched((t) => ({ ...t, cvv: true }))}
                        onChangeText={(text) =>
                          setCard((c) => ({
                            ...c,
                            cvv: onlyDigits(text).slice(0, 3),
                          }))
                        }
                        placeholder="123"
                        secureTextEntry
                        value={card.cvv}
                      />
                    </View>
                  </View>

                  <Checkbox
                    checked={saveCard}
                    label="Save this card for next time"
                    onToggle={() => setSaveCard((value) => !value)}
                  />
                </View>

                <View style={styles.spacer} />
                <PrimaryButton label="Continue" onPress={continueFromDetails} />
              </View>
            ) : null}

            {step === "pay" ? (
              <View>
                <View style={styles.summary}>
                  <Text style={styles.summaryLabel}>Paying with</Text>
                  <Text style={styles.summaryValue}>{selectedTitle}</Text>

                  {intent === "charge" && amount !== undefined ? (
                    <>
                      <Text style={styles.summaryLabel}>Amount</Text>
                      <Text style={styles.summaryAmount}>
                        {formatGhs(amount)}
                      </Text>
                    </>
                  ) : null}

                  {selected === NEW_CARD ? (
                    <>
                      <Text style={styles.summaryLabel}>Card</Text>
                      <Text style={styles.summaryValue}>
                        •••• {cardNumber.slice(-4)} · Expires {card.expiry}
                      </Text>
                    </>
                  ) : null}

                  {savedCard ? (
                    <>
                      <Text style={styles.summaryLabel}>Card</Text>
                      <Text style={styles.summaryValue}>
                        {methodDetail(savedCard)}
                      </Text>
                    </>
                  ) : null}

                  {selected === PAYPAL ? (
                    <Text style={styles.summaryHint}>
                      You'll confirm this payment with PayPal.
                    </Text>
                  ) : null}
                </View>

                {selected === MOMO ? (
                  <View style={styles.formGap}>
                    <Field
                      error={momoError}
                      keyboardType="phone-pad"
                      label="MTN mobile money number"
                      maxLength={10}
                      onBlur={() => setPhoneTouched(true)}
                      onChangeText={(text) =>
                        setPhone(onlyDigits(text).slice(0, 10))
                      }
                      placeholder="024 000 0000"
                      value={phone}
                    />
                  </View>
                ) : null}

                {pay.status === "processing" ? (
                  <View
                    style={styles.statusRow}
                    accessibilityLiveRegion="polite"
                  >
                    <ActivityIndicator color={P.orange} />
                    <Text style={styles.statusText}>Processing…</Text>
                  </View>
                ) : null}

                {pay.status === "error" ? (
                  <View
                    style={styles.errorBox}
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={styles.errorBoxText}>{pay.message}</Text>
                  </View>
                ) : null}

                {pay.status === "success" ? (
                  <View
                    style={styles.successBox}
                    accessibilityLiveRegion="polite"
                  >
                    <FontAwesome6
                      name="circle-check"
                      size={22}
                      color={C.mintInk}
                    />
                    <Text style={styles.successTitle}>
                      {intent === "save"
                        ? "Payment method saved"
                        : "Payment confirmed"}
                    </Text>
                    <Text style={styles.successRef}>
                      Reference: {pay.reference}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.spacer} />

                {pay.status === "success" ? (
                  <PrimaryButton label="Done" onPress={onClose} />
                ) : (
                  <>
                    <PrimaryButton
                      disabled={isProcessing}
                      label={
                        isProcessing
                          ? "Processing…"
                          : pay.status === "error"
                            ? "Try again"
                            : payLabel
                      }
                      onPress={submitPayment}
                    />
                    <Text style={styles.secureNote}>
                      Card details go directly to the payment provider and are
                      never stored in the app.
                    </Text>
                  </>
                )}
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment methods section (replaces Payment Accounts)                        */
/* -------------------------------------------------------------------------- */

function PaymentMethodsList({
  methods,
  onOpenFlow,
  onRemove,
  onSetDefault,
}: {
  methods: SavedMethod[];
  onOpenFlow: () => void;
  onRemove: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  return (
    <View>
      {methods.length === 0 ? (
        <EmptyState message="No saved payment methods yet." />
      ) : (
        methods.map((method) => (
          <View key={method.id} style={styles.methodRow}>
            <View
              style={[
                styles.methodBadge,
                {
                  backgroundColor:
                    method.kind === "mobile_money"
                      ? C.amberSoft
                      : method.kind === "paypal"
                        ? C.blueSoft
                        : C.lilacSoft,
                },
              ]}
            >
              <FontAwesome6
                name={
                  method.kind === "card"
                    ? "credit-card"
                    : method.kind === "paypal"
                      ? "paypal"
                      : "mobile-screen-button"
                }
                size={13}
                color={
                  method.kind === "mobile_money"
                    ? C.amber
                    : method.kind === "paypal"
                      ? C.blue
                      : C.purple
                }
              />
            </View>
            <View style={styles.methodCopy}>
              <Text numberOfLines={1} style={styles.listTitle}>
                {methodTitle(method)}
              </Text>
              <Text numberOfLines={1} style={styles.listMeta}>
                {methodDetail(method)}
                {method.isDefault ? " · Default" : ""}
              </Text>
            </View>
            {!method.isDefault ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => onSetDefault(method.id)}
              >
                <Text style={styles.linkAction}>Set default</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${methodTitle(method)}`}
              hitSlop={8}
              onPress={() => onRemove(method.id)}
              style={styles.removeButton}
            >
              <FontAwesome6 name="trash-can" size={13} color={C.danger} />
            </Pressable>
          </View>
        ))
      )}

      <ActionButton
        filled
        icon="plus"
        label="Add payment method"
        onPress={onOpenFlow}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function Account() {
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("referral");

  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  // Withdrawal form
  const [amountInput, setAmountInput] = useState("");
  const [payoutId, setPayoutId] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  // History / transactions
  const [historyFilter, setHistoryFilter] = useState<"all" | HistoryCategory>(
    "all",
  );
  const [historySearch, setHistorySearch] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  // Payment flow
  const [flowOpen, setFlowOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  /* ------------------------------- Data ---------------------------------- */

  const { methods, addMethod, removeMethod, setDefault } = usePaymentMethods();
  const [membershipPlan, setMembershipPlan] = useState("Free");
  const [billingAccountId, setBillingAccountId] = useState<string | null>(null);

  const user = useMemo(
    () => referralSystem.users.find((item) => item.id === CURRENT_USER_ID),
    [],
  );
  const summary = useMemo(
    () => getMemberDashboardSummary(referralSystem, CURRENT_USER_ID),
    [],
  );
  const directReferrals = useMemo(
    () => getMemberDirectReferrals(referralSystem, CURRENT_USER_ID),
    [],
  );

  const fullName = user?.name ?? mockReferralTree.name;
  const firstName = fullName.split(" ")[0];
  const phone = readField(user, ["phone", "phoneNumber", "mobile"]);
  const email = readField(user, ["email"]);
  const memberId = String(
    readField(user, ["memberId", "accountId"]) ?? CURRENT_USER_ID,
  );
  const status = String(mockReferralTree.status);
  const isActive = status.trim().toLowerCase() === "active";
  const joined = formatDate(toTime(mockReferralTree.createdAt));
  const referralCode = mockReferralTree.referralCode;

  const earnings = summary.earnings as unknown;
  const available = summary.earnings.available;
  const total = summary.earnings.total;
  const pending = readField(earnings, ["pending", "pendingEarnings"]);
  const withdrawn = readField(earnings, ["withdrawn", "totalWithdrawn"]);
  const expected = readField(earnings, [
    "expected",
    "potential",
    "expectedEarnings",
  ]);

  const commissions = useMemo(
    () =>
      referralSystem.commissions.filter(
        (c) => c.recipientId === CURRENT_USER_ID,
      ),
    [],
  );

  const history = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [];

    commissions.forEach((commission, index) => {
      const sourceId = readField(commission, [
        "sourceUserId",
        "sourceId",
        "fromUserId",
        "referredUserId",
      ]);
      const source = referralSystem.users.find((u) => u.id === sourceId);
      items.push({
        amount: commission.amount,
        category: "commission",
        date: toTime(readField(commission, ["createdAt", "date", "earnedAt"])),
        icon: "coins",
        key: `commission-${readField(commission, ["id"]) ?? index}`,
        subtitle: source ? `From ${source.name}` : "Referral commission",
        title: "Referral commission",
      });
    });

    referralSystem.points
      .filter((point) => point.userId === CURRENT_USER_ID)
      .forEach((point, index) => {
        items.push({
          category: "bonus",
          date: toTime(readField(point, ["createdAt", "date"])),
          icon: "gift",
          key: `bonus-${readField(point, ["id"]) ?? index}`,
          subtitle: `+${point.points.toLocaleString()} points`,
          title: String(
            readField(point, ["reason", "type", "description"]) ??
              "Bonus points",
          ),
        });
      });

    directReferrals.forEach((member) => {
      items.push({
        category: "referral",
        date: toTime(readField(member, ["createdAt", "joinedAt"])),
        icon: "user-plus",
        key: `referral-${member.id}`,
        subtitle: "Joined your network",
        title: `New referral: ${member.name}`,
      });
    });

    return items.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
  }, [commissions, directReferrals]);

  const filteredHistory = history.filter((item) => {
    const matchesFilter =
      historyFilter === "all" || item.category === historyFilter;
    const query = historySearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.subtitle.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
  const shownHistory = showAllHistory
    ? filteredHistory
    : filteredHistory.slice(0, HISTORY_PREVIEW);

  const transactions = useMemo(
    () =>
      [...commissions]
        .map((commission, index) => ({
          amount: commission.amount,
          date: toTime(
            readField(commission, ["createdAt", "date", "earnedAt"]),
          ),
          id: String(
            readField(commission, ["id", "transactionId", "reference"]) ?? "—",
          ),
          key: `transaction-${readField(commission, ["id"]) ?? index}`,
          method: String(
            readField(commission, ["method", "paymentMethod"]) ?? "—",
          ),
          status: String(
            readField(commission, ["status", "paymentStatus"]) ?? "—",
          ),
          type: String(
            readField(commission, ["type", "kind", "commissionType"]) ??
              "Referral commission",
          ),
        }))
        .sort((a, b) => (b.date ?? 0) - (a.date ?? 0)),
    [commissions],
  );
  const shownTransactions = showAllPayments
    ? transactions
    : transactions.slice(0, PAYMENTS_PREVIEW);

  // Only mobile money (and bank, if added later) can receive withdrawals. Cards cannot.
  const payoutAccounts = methods.filter(
    (method) => method.kind === "mobile_money",
  );
  const activePayout =
    payoutAccounts.find((account) => account.id === payoutId) ??
    payoutAccounts.find((account) => account.isDefault) ??
    payoutAccounts[0] ??
    null;

  // Earnings this calendar month (null when records carry no dates).
  const monthEarnings = useMemo(() => {
    const now = new Date();
    let dated = false;
    let sum = 0;
    commissions.forEach((commission) => {
      const time = toTime(
        readField(commission, ["createdAt", "date", "earnedAt"]),
      );
      if (time === null) return;
      dated = true;
      const date = new Date(time);
      if (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      ) {
        sum += commission.amount;
      }
    });
    return dated ? sum : null;
  }, [commissions]);

  const latestWithdrawal = history.find(
    (item) => item.category === "withdrawal",
  );

  // Shape the saved methods for MembershipPlans, which expects account-like records.
  const billingAccounts = useMemo(
    () =>
      methods.map((method) => ({
        accountNumber: method.last4 ?? method.phone ?? "",
        holder: method.holder ?? fullName,
        id: method.id,
        isDefault: method.isDefault,
        kind: method.kind,
      })),
    [methods, fullName],
  );

  /* ----------------------------- Handlers -------------------------------- */

  const scrollToSection = (key: SectionKey) => {
    setActiveSection(key);
    const y = sectionY.current[key];
    if (y !== undefined)
      scrollRef.current?.scrollTo({ animated: true, y: Math.max(y - 8, 0) });
  };

  const trackSection = (key: SectionKey) => (event: LayoutChangeEvent) => {
    sectionY.current[key] = event.nativeEvent.layout.y;
  };

  const copyValue = async (kind: "code" | "link") => {
    await Clipboard.setStringAsync(
      kind === "code" ? referralCode : mockReferralLink,
    );
    setCopied(kind);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1800);
  };

  const shareReferral = () =>
    Share.share({
      message: `Join Angel Foods with my referral link: ${mockReferralLink}`,
      title: "Join Angel Foods",
      url: mockReferralLink,
    });

  const handleAmountChange = (text: string) => {
    // Digits and at most one decimal point, with two decimal places.
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const next =
      parts.length > 1
        ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`
        : cleaned;
    setAmountInput(next);
    setAmountError(null);
  };

  /**
   * INTEGRATION POINT: moving money. Connect your payout service here. Until then
   * the UI never says money was sent.
   */
  const submitWithdrawal = () => {
    const amount = Number(amountInput);

    if (!amountInput.trim() || Number.isNaN(amount) || amount <= 0) {
      setAmountError("Enter an amount greater than 0.");
      return;
    }
    if (amount > available) {
      setAmountError(`You can withdraw up to ${formatGhs(available)}.`);
      return;
    }
    setAmountError(null);

    if (!activePayout) {
      setPayoutError("Add a mobile money account to withdraw to.");
      return;
    }
    setPayoutError(null);

    Alert.alert(
      "Withdrawals aren't connected yet",
      `A request for ${formatGhs(amount)} to ${methodTitle(activePayout)} ${methodDetail(activePayout)} is ready, but the payout service isn't connected, so nothing was submitted.`,
    );
  };

  /* ------------------------------- Render -------------------------------- */

  const withdrawDisabled = available <= 0 || !activePayout;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBlobLarge} />
          <View style={styles.heroBlobSmall} />

          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text numberOfLines={1} style={styles.heroGreeting}>
                Hi {firstName} 👋
              </Text>
              <Text numberOfLines={1} style={styles.heroSub}>
                {email
                  ? String(email)
                  : phone
                    ? String(phone)
                    : "Welcome back to your account"}
              </Text>
            </View>
            <View
              style={[styles.heroStatus, isActive && styles.heroStatusActive]}
            >
              <View
                style={[styles.statusDot, isActive && styles.statusDotActive]}
              />
              <Text style={styles.heroStatusText}>{status}</Text>
            </View>
          </View>

          <Text style={styles.heroBalanceLabel}>Available balance</Text>
          <Text style={styles.heroBalance}>{formatGhs(available)}</Text>

          <View style={styles.heroFooter}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Member ID</Text>
              <Text style={styles.heroPillValue}>{memberId}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Joined</Text>
              <Text style={styles.heroPillValue}>{joined}</Text>
            </View>
          </View>
        </View>

        {/* Section navigation (sticky) */}
        <View style={styles.navWrap}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.navRow}
            showsHorizontalScrollIndicator={false}
          >
            {SECTIONS.map((section) => (
              <Chip
                key={section.key}
                label={section.label}
                onPress={() => scrollToSection(section.key)}
                selected={activeSection === section.key}
              />
            ))}
          </ScrollView>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {[
            {
              icon: "arrow-up-from-bracket",
              label: "Withdraw",
              target: "withdraw",
              bg: C.pinkSoft,
              fg: C.pink,
            },
            {
              icon: "share-nodes",
              label: "Refer",
              target: "referral",
              bg: C.mint,
              fg: C.mintInk,
            },
            {
              icon: "credit-card",
              label: "Payments",
              target: "methods",
              bg: C.blueSoft,
              fg: C.blue,
            },
            {
              icon: "clock-rotate-left",
              label: "History",
              target: "history",
              bg: C.amberSoft,
              fg: C.amber,
            },
          ].map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => scrollToSection(action.target as SectionKey)}
              style={({ pressed }) => [
                styles.quickTile,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.quickIcon, { backgroundColor: action.bg }]}>
                <FontAwesome6 name={action.icon} size={16} color={action.fg} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Referral information */}
        <Section
          icon="people-group"
          onLayout={trackSection("referral")}
          title="Referral Information"
        >
          <View style={styles.copyBox}>
            <View style={styles.copyBoxCopy}>
              <Text style={styles.fieldText}>Referral code</Text>
              <Text selectable style={styles.codeText}>
                {referralCode}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy referral code"
              onPress={() => copyValue("code")}
              style={styles.copyIcon}
            >
              <FontAwesome6
                name={copied === "code" ? "check" : "copy"}
                size={14}
                color={C.pink}
              />
            </Pressable>
          </View>

          <View style={styles.copyBox}>
            <View style={styles.copyBoxCopy}>
              <Text style={styles.fieldText}>Referral link</Text>
              <Text numberOfLines={1} selectable style={styles.linkText}>
                {mockReferralLink}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy referral link"
              onPress={() => copyValue("link")}
              style={styles.copyIcon}
            >
              <FontAwesome6
                name={copied === "link" ? "check" : "copy"}
                size={14}
                color={C.pink}
              />
            </Pressable>
          </View>

          {copied ? (
            <Text accessibilityLiveRegion="polite" style={styles.copyFeedback}>
              {copied === "code"
                ? "Referral code copied"
                : "Referral link copied"}
            </Text>
          ) : null}

          <ActionButton
            filled
            icon="share-nodes"
            label="Share referral"
            onPress={shareReferral}
          />

          <View style={styles.statGrid}>
            <StatTile
              bg={C.blueSoft}
              fg={C.blue}
              icon="user-group"
              label="Direct referrals"
              value={String(summary.directReferrals)}
            />
            <StatTile
              bg={C.lilacSoft}
              fg={C.purple}
              icon="sitemap"
              label="Network members"
              value={String(summary.treeSize)}
            />
            <StatTile
              bg={C.mint}
              fg={C.mintInk}
              icon="coins"
              label="Referral earnings"
              value={formatGhs(total)}
            />
          </View>
        </Section>

        {/* Financial summary */}
        <Section
          icon="chart-line"
          onLayout={trackSection("finance")}
          title="Financial Summary"
        >
          <View style={styles.statGrid}>
            <StatTile
              bg={C.mint}
              fg={C.mintInk}
              icon="wallet"
              label="Available balance"
              value={formatGhs(available)}
            />
            <StatTile
              bg={C.pinkSoft}
              fg={C.pink}
              icon="hourglass-half"
              label="Pending earnings"
              value={typeof pending === "number" ? formatGhs(pending) : "—"}
            />
            <StatTile
              bg={C.lilacSoft}
              fg={C.purple}
              icon="arrow-trend-up"
              label="Total earnings"
              value={formatGhs(total)}
            />
            <StatTile
              bg={C.blueSoft}
              fg={C.blue}
              icon="arrow-up-from-bracket"
              label="Total withdrawn"
              value={typeof withdrawn === "number" ? formatGhs(withdrawn) : "—"}
            />
            {typeof expected === "number" ? (
              <StatTile
                bg={C.amberSoft}
                fg={C.amber}
                icon="bullseye"
                label="Expected earnings"
                value={formatGhs(expected)}
              />
            ) : null}
          </View>
          {monthEarnings !== null ? (
            <Text style={styles.note}>
              This month: {formatGhs(monthEarnings)}
            </Text>
          ) : null}
          {typeof pending !== "number" || typeof withdrawn !== "number" ? (
            <Text style={styles.note}>
              "—" means that figure isn't provided by the current data source.
            </Text>
          ) : null}
        </Section>

        {/* Payment methods (replaces Payment Accounts) */}
        <Section
          icon="credit-card"
          onLayout={trackSection("methods")}
          subtitle="PayPal, MTN Mobile Money and saved cards"
          title="Payment Methods"
        >
          <PaymentMethodsList
            methods={methods}
            onOpenFlow={() => setFlowOpen(true)}
            onRemove={removeMethod}
            onSetDefault={setDefault}
          />
        </Section>

        {/* Membership plan */}
        <Section
          icon="crown"
          onLayout={trackSection("plans")}
          subtitle="Free, Silver, Gold or Premium"
          title="Membership Plan"
        >
          <MembershipPlans
            accounts={billingAccounts}
            billingAccountId={billingAccountId}
            currentPlan={membershipPlan}
            loading={false}
            monthEarnings={monthEarnings}
            onAddAccount={() => setFlowOpen(true)}
            onChange={(nextPlan: string, accountId?: string | null) => {
              setMembershipPlan(nextPlan);
              if (accountId !== undefined) setBillingAccountId(accountId);
            }}
          />
        </Section>

        {/* Withdraw */}
        <View
          onLayout={trackSection("withdraw")}
          style={styles.withdrawSection}
        >
          <Text style={styles.withdrawTitle}>Withdraw</Text>

          <View style={styles.withdrawBanner}>
            <Text style={styles.withdrawBannerLabel}>Balance</Text>
            <Text style={styles.withdrawBannerValue}>
              {formatGhs(available)}
            </Text>
          </View>

          <Text style={styles.withdrawHeading}>Amount</Text>
          <View style={styles.amountRow}>
            <TextInput
              accessibilityLabel="Withdrawal amount"
              keyboardType="decimal-pad"
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor="#A7B4B1"
              style={[
                styles.amountInput,
                amountError ? styles.inputError : null,
              ]}
              value={amountInput}
            />
            <View style={styles.amountCurrency}>
              <Text style={styles.amountCurrencyText}>GH₵</Text>
            </View>
          </View>
          {amountError ? (
            <Text style={styles.fieldError}>{amountError}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAmountInput(String(available));
              setAmountError(null);
            }}
          >
            <Text style={styles.greenLink}>Withdraw maximum</Text>
          </Pressable>

          <View style={styles.withdrawToHeader}>
            <Text style={styles.withdrawHeading}>Withdraw to</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFlowOpen(true)}
            >
              <Text style={styles.greenLink}>
                {payoutAccounts.length ? "Add account" : "Add mobile money"}
              </Text>
            </Pressable>
          </View>

          {payoutAccounts.length === 0 ? (
            <Text style={styles.payoutEmpty}>
              No mobile money account yet. Add MTN Mobile Money in Payment
              Methods.
            </Text>
          ) : (
            <ScrollView
              horizontal
              contentContainerStyle={styles.tileRow}
              showsHorizontalScrollIndicator={false}
            >
              {payoutAccounts.map((account) => {
                const selected = activePayout?.id === account.id;
                return (
                  <Pressable
                    key={account.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setPayoutId(account.id);
                      setPayoutError(null);
                    }}
                    style={[styles.payTile, selected && styles.payTileActive]}
                  >
                    {selected ? (
                      <View style={styles.payTick}>
                        <FontAwesome6 name="check" size={8} color="#FFFFFF" />
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.methodBadge,
                        { backgroundColor: C.amberSoft },
                      ]}
                    >
                      <FontAwesome6
                        name="mobile-screen-button"
                        size={12}
                        color={C.amber}
                      />
                    </View>
                    <Text numberOfLines={1} style={styles.payTileLabel}>
                      MTN
                    </Text>
                    {account.isDefault ? (
                      <Text style={styles.payTileDefault}>Default</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {activePayout ? (
            <View>
              <Text style={styles.withdrawFieldLabel}>Account holder name</Text>
              <View style={styles.readField}>
                <Text numberOfLines={1} style={styles.readFieldText}>
                  {activePayout.holder || fullName}
                </Text>
              </View>
              <Text style={styles.withdrawFieldLabel}>Mobile number</Text>
              <View style={styles.readField}>
                <Text numberOfLines={1} style={styles.readFieldText}>
                  {methodDetail(activePayout)}
                </Text>
              </View>
            </View>
          ) : null}

          {payoutError ? (
            <Text style={styles.fieldError}>{payoutError}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: withdrawDisabled }}
            disabled={withdrawDisabled}
            onPress={submitWithdrawal}
            style={({ pressed }) => [
              styles.withdrawButton,
              withdrawDisabled && styles.withdrawButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </Pressable>

          <View style={styles.statusRow}>
            <Text style={styles.fieldText}>Withdrawal status</Text>
            <Text style={styles.statusValue}>
              {latestWithdrawal
                ? latestWithdrawal.subtitle
                : "No withdrawal requests yet"}
            </Text>
          </View>
        </View>

        {/* Account history */}
        <Section
          icon="clock-rotate-left"
          onLayout={trackSection("history")}
          subtitle="Commissions, bonuses, referrals and withdrawals"
          title="Account History"
        >
          <View style={styles.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={12} color="#B3B3C6" />
            <TextInput
              accessibilityLabel="Search activity"
              onChangeText={(text) => {
                setHistorySearch(text);
                setShowAllHistory(false);
              }}
              placeholder="Search activity"
              placeholderTextColor="#B3B3C6"
              style={styles.searchInput}
              value={historySearch}
            />
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.chipRow}
            showsHorizontalScrollIndicator={false}
          >
            {HISTORY_FILTERS.map((filter) => (
              <Chip
                key={filter.key}
                label={filter.label}
                onPress={() => {
                  setHistoryFilter(filter.key);
                  setShowAllHistory(false);
                }}
                selected={historyFilter === filter.key}
              />
            ))}
          </ScrollView>

          {filteredHistory.length === 0 ? (
            <EmptyState message="No activity to show yet." />
          ) : (
            <View style={styles.listWrap}>
              {shownHistory.map((item) => {
                const tint = CATEGORY_TINT[item.category];
                return (
                  <View key={item.key} style={styles.listRow}>
                    <View
                      style={[styles.listIcon, { backgroundColor: tint.bg }]}
                    >
                      <FontAwesome6
                        name={item.icon}
                        size={13}
                        color={tint.fg}
                      />
                    </View>
                    <View style={styles.listCopy}>
                      <Text numberOfLines={1} style={styles.listTitle}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.listMeta}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <View style={styles.listRight}>
                      {item.amount !== undefined ? (
                        <Text style={styles.listAmount}>
                          +{formatGhs(item.amount)}
                        </Text>
                      ) : null}
                      <Text style={styles.listDate}>
                        {formatDate(item.date)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {filteredHistory.length > HISTORY_PREVIEW ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllHistory((current) => !current)}
                  style={styles.showMore}
                >
                  <Text style={styles.linkAction}>
                    {showAllHistory
                      ? "Show fewer"
                      : `See all ${filteredHistory.length}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Section>

        {/* Transactions */}
        <Section
          icon="receipt"
          onLayout={trackSection("transactions")}
          title="Transactions"
        >
          {transactions.length === 0 ? (
            <EmptyState message="No transactions yet." />
          ) : (
            <View style={styles.listWrap}>
              {shownTransactions.map((transaction) => (
                <View key={transaction.key} style={styles.transactionCard}>
                  <View style={styles.transactionTop}>
                    <Text
                      numberOfLines={1}
                      style={[styles.listTitle, styles.flexShrink]}
                    >
                      {transaction.type}
                    </Text>
                    <Text style={styles.listAmount}>
                      {formatGhs(transaction.amount)}
                    </Text>
                  </View>
                  <View style={styles.transactionGrid}>
                    <Text style={styles.transactionMeta}>
                      ID: {transaction.id}
                    </Text>
                    <Text style={styles.transactionMeta}>
                      {formatDate(transaction.date)}
                    </Text>
                    <Text style={styles.transactionMeta}>
                      Method: {transaction.method}
                    </Text>
                    <Text style={styles.transactionStatus}>
                      {transaction.status}
                    </Text>
                  </View>
                </View>
              ))}

              {transactions.length > PAYMENTS_PREVIEW ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllPayments((current) => !current)}
                  style={styles.showMore}
                >
                  <Text style={styles.linkAction}>
                    {showAllPayments
                      ? "Show fewer"
                      : `See all ${transactions.length}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Section>
      </ScrollView>

      <PaymentFlow
        amount={undefined}
        intent="save"
        onClose={() => setFlowOpen(false)}
        onSaved={addMethod}
        savedMethods={methods}
        visible={flowOpen}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const softShadow = {
  elevation: 2,
  shadowColor: "#6B5B95",
  shadowOffset: { height: 6, width: 0 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
};

const styles = StyleSheet.create({
  container: { backgroundColor: C.bg, flex: 1 },
  pressed: { opacity: 0.72 },
  flexShrink: { flexShrink: 1 },
  spacer: { height: 20 },

  header: { alignItems: "center", paddingBottom: 12, paddingTop: 26 },
  headerTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 18 },
  content: { paddingBottom: 40, paddingHorizontal: 20 },

  /* Hero */
  heroCard: {
    backgroundColor: C.lilac,
    borderRadius: 24,
    marginBottom: 6,
    overflow: "hidden",
    padding: 18,
  },
  heroBlobLarge: {
    backgroundColor: "rgba(240,80,143,0.18)",
    borderRadius: 90,
    height: 180,
    position: "absolute",
    right: -50,
    top: -50,
    width: 180,
  },
  heroBlobSmall: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 50,
    bottom: -30,
    height: 100,
    position: "absolute",
    right: 60,
    width: 100,
  },
  heroTop: { alignItems: "center", flexDirection: "row" },
  heroCopy: { flex: 1, minWidth: 0 },
  heroGreeting: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 17 },
  heroSub: {
    color: "#6F6A86",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 1,
  },
  heroStatus: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 12,
    columnGap: 6,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroStatusActive: { backgroundColor: "#FFFFFF" },
  statusDot: { backgroundColor: C.muted, borderRadius: 4, height: 8, width: 8 },
  statusDotActive: { backgroundColor: C.mintInk },
  heroStatusText: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 10,
    textTransform: "capitalize",
  },
  heroBalanceLabel: {
    color: "#6F6A86",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 20,
  },
  heroBalance: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 34,
    marginTop: 2,
  },
  heroFooter: { columnGap: 10, flexDirection: "row", marginTop: 16 },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPillLabel: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 9 },
  heroPillValue: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 12,
    marginTop: 1,
  },

  /* Nav */
  navWrap: { backgroundColor: C.bg, paddingVertical: 10 },
  navRow: { columnGap: 8 },

  /* Quick actions */
  quickRow: {
    columnGap: 10,
    flexDirection: "row",
    marginBottom: 4,
    marginTop: 4,
  },
  quickTile: {
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 20,
    flex: 1,
    paddingVertical: 14,
    ...softShadow,
  },
  quickIcon: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  quickLabel: {
    color: C.ink,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 8,
  },

  /* Sections */
  section: {
    backgroundColor: C.card,
    borderRadius: 24,
    marginTop: 16,
    padding: 16,
    ...softShadow,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  sectionIcon: {
    alignItems: "center",
    backgroundColor: C.pinkSoft,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    marginRight: 10,
    width: 32,
  },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 15 },
  sectionSubtitle: {
    color: C.muted,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 1,
  },
  fieldText: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 11 },

  /* Buttons */
  actionButton: {
    alignItems: "center",
    borderColor: C.pink,
    borderRadius: 16,
    borderWidth: 1,
    columnGap: 8,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  actionButtonFilled: { backgroundColor: C.pink, borderWidth: 0 },
  actionButtonText: { color: C.pink, fontFamily: "PoppinsBold", fontSize: 12 },
  actionButtonTextFilled: { color: "#FFFFFF" },
  linkAction: { color: C.pink, fontFamily: "PoppinsBold", fontSize: 11 },

  /* Chips */
  chipRow: { columnGap: 8, flexDirection: "row", marginTop: 12 },
  chip: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: C.pink, borderColor: C.pink },
  chipText: { color: "#6C6B85", fontFamily: "PoppinsBold", fontSize: 10 },
  chipTextSelected: { color: "#FFFFFF" },

  /* Referral */
  copyBox: {
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 10,
    paddingLeft: 14,
  },
  copyBoxCopy: { flex: 1, minWidth: 0, paddingVertical: 10 },
  codeText: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 15,
    letterSpacing: 1,
  },
  linkText: { color: "#4D4B66", fontFamily: "PoppinsRegular", fontSize: 11 },
  copyIcon: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  copyFeedback: {
    color: C.mintInk,
    fontFamily: "PoppinsBold",
    fontSize: 10,
    marginBottom: 8,
  },

  /* Stats */
  statGrid: {
    columnGap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    rowGap: 10,
  },
  statTile: {
    borderRadius: 18,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 84,
    padding: 12,
  },
  statIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  statLabel: {
    color: "#6C6B85",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 8,
  },
  statValue: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 17,
    marginTop: 2,
  },
  note: {
    color: C.muted,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 10,
  },

  /* Saved methods list */
  methodRow: {
    alignItems: "center",
    borderBottomColor: C.line,
    borderBottomWidth: 1,
    columnGap: 10,
    flexDirection: "row",
    paddingVertical: 10,
  },
  methodBadge: {
    alignItems: "center",
    borderRadius: 14,
    height: 32,
    justifyContent: "center",
    minWidth: 32,
    paddingHorizontal: 6,
  },
  methodCopy: { flex: 1, minWidth: 0 },
  removeButton: { paddingLeft: 4 },
  listTitle: {
    color: C.ink,
    flexShrink: 1,
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },
  listMeta: {
    color: C.muted,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 2,
  },

  /* Withdraw */
  withdrawSection: {
    backgroundColor: C.card,
    borderRadius: 28,
    marginTop: 16,
    padding: 18,
    ...softShadow,
  },
  withdrawTitle: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 15,
    marginBottom: 14,
    textAlign: "center",
  },
  withdrawBanner: {
    alignItems: "center",
    backgroundColor: C.green,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  withdrawBannerLabel: {
    color: "#D5F2EC",
    fontFamily: "PoppinsRegular",
    fontSize: 13,
  },
  withdrawBannerValue: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 22,
  },
  withdrawHeading: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginBottom: 10,
    marginTop: 20,
  },
  amountRow: { columnGap: 8, flexDirection: "row" },
  amountInput: {
    backgroundColor: "#F3F5F5",
    borderRadius: 12,
    color: C.ink,
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  amountCurrency: {
    alignItems: "center",
    backgroundColor: "#E1E6E6",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    width: 56,
  },
  amountCurrencyText: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 12 },
  greenLink: {
    color: C.green,
    fontFamily: "PoppinsBold",
    fontSize: 11,
    marginTop: 8,
  },
  withdrawToHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tileRow: { columnGap: 10, paddingTop: 10 },
  payTile: {
    alignItems: "center",
    backgroundColor: C.card,
    borderColor: "#E4E8E8",
    borderRadius: 14,
    borderWidth: 1,
    height: 84,
    justifyContent: "center",
    paddingHorizontal: 10,
    rowGap: 6,
    width: 104,
  },
  payTileActive: { borderColor: C.green, borderWidth: 1.5 },
  payTick: {
    alignItems: "center",
    backgroundColor: C.green,
    borderRadius: 8,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 16,
  },
  payTileLabel: { color: C.ink, fontFamily: "PoppinsRegular", fontSize: 11 },
  payTileDefault: { color: C.green, fontFamily: "PoppinsBold", fontSize: 8 },
  payoutEmpty: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 11 },
  withdrawFieldLabel: {
    color: "#4D5B58",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginBottom: 6,
    marginTop: 16,
  },
  readField: {
    backgroundColor: "#F3F5F5",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  readFieldText: { color: C.ink, fontFamily: "PoppinsRegular", fontSize: 13 },
  withdrawButton: {
    alignItems: "center",
    backgroundColor: C.green,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 24,
    minHeight: 52,
  },
  withdrawButtonDisabled: { backgroundColor: "#B9D8D2" },
  withdrawButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  statusValue: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 },

  /* History */
  searchBox: {
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: 16,
    columnGap: 10,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: C.ink,
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 12,
  },
  listWrap: { marginTop: 10 },
  listRow: {
    alignItems: "center",
    borderBottomColor: C.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingVertical: 8,
  },
  listIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  listCopy: { flex: 1, minWidth: 0 },
  listRight: { alignItems: "flex-end", marginLeft: 8 },
  listAmount: { color: C.mintInk, fontFamily: "PoppinsBold", fontSize: 12 },
  listDate: {
    color: C.muted,
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },
  showMore: { alignItems: "center", paddingVertical: 10 },

  transactionCard: {
    backgroundColor: C.bg,
    borderRadius: 16,
    marginBottom: 8,
    padding: 12,
  },
  transactionTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  transactionGrid: {
    columnGap: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    rowGap: 3,
  },
  transactionMeta: {
    color: C.muted,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },
  transactionStatus: {
    color: C.mintInk,
    fontFamily: "PoppinsBold",
    fontSize: 10,
    textTransform: "capitalize",
  },

  emptyState: { alignItems: "center", paddingVertical: 24, rowGap: 8 },
  emptyText: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 11 },
  errorText: {
    color: C.danger,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 6,
  },
  fieldError: {
    color: C.danger,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 6,
  },
  inputError: { borderColor: C.danger, borderWidth: 1 },

  /* -------------------- Payment flow (orange reference) -------------------- */
  flowContainer: { backgroundColor: "#F6F5F3", flex: 1 },
  flowFlex: { flex: 1 },
  flowHeader: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  backButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    marginRight: 10,
    width: 36,
  },
  flowTitle: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 17 },
  flowContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  flowHeading: {
    color: P.teal,
    fontFamily: "PoppinsBold",
    fontSize: 15,
    marginBottom: 12,
    marginTop: 20,
  },

  stepRow: { columnGap: 8, flexDirection: "row", marginTop: 4 },
  stepItem: { flex: 1 },
  stepBar: { borderRadius: 3, height: 5, marginBottom: 8 },
  stepLabel: {
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    textAlign: "center",
  },
  stepLabelActive: { fontFamily: "PoppinsBold" },

  option: {
    alignItems: "center",
    backgroundColor: P.white,
    borderColor: P.grayLine,
    borderRadius: 16,
    borderWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    marginBottom: 10,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionSelected: {
    backgroundColor: P.orangePeach,
    borderColor: P.orange,
    borderWidth: 1.5,
  },
  optionLeading: { alignItems: "center", justifyContent: "center", width: 40 },
  optionCopy: { flex: 1 },
  optionTitle: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 14 },
  optionSubtitle: {
    color: P.gray,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 2,
  },
  radioOuter: {
    alignItems: "center",
    borderColor: P.grayLight,
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioOuterSelected: { borderColor: P.orange },
  radioInner: {
    backgroundColor: P.orange,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  paypalLogo: { height: 26, width: 36 },
  momoIcon: {
    alignItems: "center",
    backgroundColor: P.momo,
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  cardIcon: {
    alignItems: "center",
    backgroundColor: P.teal,
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 36,
  },

  addCard: {
    alignItems: "center",
    borderColor: P.grayLine,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    columnGap: 8,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 6,
    paddingVertical: 18,
  },
  addCardText: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 14 },

  payButton: {
    alignItems: "center",
    backgroundColor: P.orange,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 52,
  },
  payButtonDisabled: { backgroundColor: "#F5B8A0" },
  payButtonText: { color: P.white, fontFamily: "PoppinsBold", fontSize: 15 },

  /* Card preview */
  card: {
    alignSelf: "center",
    aspectRatio: 1.7,
    backgroundColor: P.orange,
    borderRadius: 18,
    marginTop: 18,
    overflow: "hidden",
    padding: 18,
    width: "100%",
    maxWidth: 380,
    justifyContent: "space-between",
  },
  cardStrip: {
    backgroundColor: P.orangeDark,
    height: 8,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  cardBandLarge: {
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 200,
    borderWidth: 26,
    height: 260,
    position: "absolute",
    right: -150,
    top: -110,
    width: 260,
  },
  cardBandSmall: {
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 160,
    borderWidth: 20,
    height: 180,
    position: "absolute",
    right: -70,
    top: 30,
    width: 180,
  },
  cardTop: { alignItems: "flex-end" },
  cardNumber: {
    color: P.white,
    fontFamily: "PoppinsBold",
    fontSize: 20,
    letterSpacing: 2,
    textAlign: "left",
  },
  cardBottom: { flexDirection: "row", justifyContent: "space-between" },
  cardBottomLeft: { flex: 1, minWidth: 0, paddingRight: 12 },
  cardBottomRight: { alignItems: "flex-end" },
  cardSmallLabel: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },
  cardName: {
    color: P.white,
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginTop: 2,
  },

  /* Form fields */
  formGap: { marginTop: 18, rowGap: 14 },
  field: { rowGap: 6 },
  fieldLabel: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 12 },
  input: {
    backgroundColor: P.white,
    borderColor: P.grayLine,
    borderRadius: 12,
    borderWidth: 1,
    color: P.teal,
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  inputFocused: { borderColor: P.focus, borderWidth: 1.5 },
  fieldError: { color: P.red, fontFamily: "PoppinsRegular", fontSize: 11 },
  row: { columnGap: 12, flexDirection: "row" },
  half: { flex: 1 },

  checkboxRow: { alignItems: "center", columnGap: 10, flexDirection: "row" },
  checkbox: {
    alignItems: "center",
    borderColor: P.orange,
    borderRadius: 5,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  checkboxChecked: { backgroundColor: P.orange },
  checkboxLabel: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 13 },

  /* Pay step */
  summary: {
    backgroundColor: P.white,
    borderColor: P.grayLine,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    rowGap: 4,
  },
  summaryLabel: {
    color: P.gray,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 6,
  },
  summaryValue: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 14 },
  summaryAmount: { color: P.orange, fontFamily: "PoppinsBold", fontSize: 22 },
  summaryHint: {
    color: P.gray,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 8,
  },
  statusRow2: {},
  statusText: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 12 },
  errorBox: {
    backgroundColor: "#FDECEA",
    borderRadius: 12,
    marginTop: 16,
    padding: 12,
  },
  errorBoxText: { color: P.red, fontFamily: "PoppinsRegular", fontSize: 12 },
  successBox: {
    alignItems: "center",
    backgroundColor: C.mint,
    borderRadius: 16,
    marginTop: 16,
    padding: 18,
    rowGap: 6,
  },
  successTitle: { color: P.teal, fontFamily: "PoppinsBold", fontSize: 15 },
  successRef: { color: P.gray, fontFamily: "PoppinsRegular", fontSize: 11 },
  secureNote: {
    color: P.gray,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 12,
    textAlign: "center",
  },
});
