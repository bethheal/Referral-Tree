import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

/* ----------------------------- Types & data ----------------------------- */

type CardBrand = "Visa" | "Mastercard";
type MethodKind = "paypal" | "momo" | "card";
type PaymentStep = "select" | "add-card" | "processing" | "success";
type PaymentMethod = {
  brandColor: string;
  icon: string;
  id: string;
  kind: MethodKind;
  label: string;
  removable?: boolean;
};

const defaultMethods: PaymentMethod[] = [
  { brandColor: "#1B75BB", icon: "paypal", id: "paypal", kind: "paypal", label: "PayPal" },
  {
    brandColor: "#F6A800",
    icon: "mobile-screen-button",
    id: "momo",
    kind: "momo",
    label: "MTN Mobile Money",
  },
];

const C = {
  accent: "#FF5A00",
  accentSoft: "#FFF1EA",
  bg: "#F4F2F0",
  danger: "#C23122",
  disabled: "#D8CDC7",
  ink: "#1E3631",
  inkSoft: "#314640",
  line: "#E8E2DE",
  muted: "#8B7F7A",
  placeholder: "#B9AAA4",
  surface: "#FFFFFF",
};

const cardTheme: Record<CardBrand | "Unknown", { bg: string; stripe: string }> = {
  Visa: { bg: "#1A1F71", stripe: "#10144D" },
  Mastercard: { bg: "#2B2B2B", stripe: "#151515" },
  Unknown: { bg: "#F25408", stripe: "#A92D08" },
};

/* ------------------------------- Helpers -------------------------------- */

const digitsOnly = (value: string, max = 99) => value.replace(/\D/g, "").slice(0, max);

const formatCardNumber = (value: string) =>
  digitsOnly(value, 16).replace(/(.{4})/g, "$1 ").trim();

const formatExpiry = (value: string) => {
  const d = digitsOnly(value, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const detectBrand = (digits: string): CardBrand | null => {
  if (/^4/.test(digits)) return "Visa";
  const two = Number(digits.slice(0, 2));
  const four = Number(digits.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return "Mastercard";
  return null;
};

// Luhn checksum – catches most mistyped card numbers.
const passesLuhn = (digits: string) => {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
};

const getCardError = (digits: string) => {
  if (digits.length < 16) return "Enter all 16 digits";
  if (!detectBrand(digits)) return "We accept Visa and Mastercard";
  if (!passesLuhn(digits)) return "Check the card number";
  return null;
};

const getExpiryError = (expiry: string) => {
  const d = digitsOnly(expiry);
  if (d.length < 4) return "Use MM/YY";
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return "Month must be 01–12";
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  if (year * 12 + (month - 1) < currentMonth) return "This card has expired";
  return null;
};

/* ------------------------------ Components ------------------------------ */

function Field({
  error,
  label,
  ...props
}: TextInputProps & { error?: string | null; label: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={C.placeholder}
        {...props}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/* -------------------------------- Screen -------------------------------- */

export default function Payments() {
  const params = useLocalSearchParams<{ currency?: string; total?: string }>();
  const total = parseFloat(params.total ?? "");
  const hasTotal = Number.isFinite(total) && total > 0;
  const amountLabel = hasTotal ? `${params.currency ?? "$"}${total.toFixed(2)}` : "";
  const payLabel = hasTotal ? `Pay ${amountLabel}` : "Pay now";

  const successScale = useRef(new Animated.Value(0.6)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [accountHolder, setAccountHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const [expiry, setExpiry] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [methods, setMethods] = useState(defaultMethods);
  const [paidWith, setPaidWith] = useState("");
  const [reference, setReference] = useState("");
  const [saveCard, setSaveCard] = useState(true);
  const [selectedMethodId, setSelectedMethodId] = useState("paypal");
  const [step, setStep] = useState<PaymentStep>("select");
  const [touched, setTouched] = useState({ cvv: false, expiry: false, holder: false, number: false });

  const cardDigits = digitsOnly(cardNumber);
  const brand = detectBrand(cardDigits);
  const theme = cardTheme[brand ?? "Unknown"];
  const last4 = cardDigits.slice(-4);

  const errors = {
    cvv: cvv.length === 3 ? null : "3 digits",
    expiry: getExpiryError(expiry),
    holder: accountHolder.trim().length > 1 ? null : "Enter the name on the card",
    number: getCardError(cardDigits),
  };
  const cardIsValid = !errors.cvv && !errors.expiry && !errors.holder && !errors.number;

  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const momoIsValid = digitsOnly(momoNumber).length >= 9;
  const canPaySelected =
    !!selectedMethod && (selectedMethod.kind !== "momo" || momoIsValid);

  useEffect(
    () => () => {
      if (processingTimer.current) clearTimeout(processingTimer.current);
    },
    []
  );

  const startProcessing = (label: string) => {
    if (step === "processing") return; // guard against double taps
    setPaidWith(label);
    setStep("processing");
    successScale.setValue(0.6);
    successFade.setValue(0);

    // Simulated request – replace with your real payment call.
    processingTimer.current = setTimeout(() => {
      setReference(`#${Date.now().toString().slice(-8)}`);
      setStep("success");
      Animated.parallel([
        Animated.spring(successScale, {
          friction: 5,
          tension: 130,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(successFade, {
          duration: 350,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1600);
  };

  const paySelected = () => {
    if (!selectedMethod || !canPaySelected) return;
    startProcessing(selectedMethod.label);
  };

  const payWithNewCard = () => {
    if (!cardIsValid) {
      setTouched({ cvv: true, expiry: true, holder: true, number: true });
      return;
    }

    const label = `${brand} •••• ${last4}`;

    if (saveCard && brand) {
      const method: PaymentMethod = {
        brandColor: brand === "Visa" ? "#1A1F71" : "#EB001B",
        icon: brand === "Visa" ? "cc-visa" : "cc-mastercard",
        id: `${brand.toLowerCase()}-${last4}-${Date.now()}`,
        kind: "card",
        label,
        removable: true,
      };
      setMethods((current) => [method, ...current]);
      setSelectedMethodId(method.id);
    }

    // Never keep raw card data around after it has been used.
    setCardNumber("");
    setCvv("");
    setExpiry("");
    setAccountHolder("");
    setTouched({ cvv: false, expiry: false, holder: false, number: false });
    startProcessing(label);
  };

  const removeMethod = (methodId: string) => {
    const next = methods.filter((m) => m.id !== methodId);
    setMethods(next);
    if (selectedMethodId === methodId) setSelectedMethodId(next[0]?.id ?? "");
  };

  const goBack = () => {
    if (step === "processing") return;
    if (step === "add-card") {
      setStep("select");
      return;
    }
    router.back();
  };

  /* ------------------------------- Success ------------------------------- */

  if (step === "success") {
    return (
      <SafeAreaView style={styles.successContainer}>
        <View style={styles.successScreen}>
          <View style={styles.successTop}>
            <Animated.View
              style={[styles.successMark, { transform: [{ scale: successScale }] }]}
            >
              <FontAwesome6 name="check" size={38} color="#FFFFFF" />
            </Animated.View>

            <Animated.View style={[styles.successTextBlock, { opacity: successFade }]}>
              <Text style={styles.successHeadline}>Payment successful</Text>
              <Text style={styles.successMessage}>
                {hasTotal ? `${amountLabel} was paid with ${paidWith}.` : `Paid with ${paidWith}.`}
                {"\n"}Your payment is on its way to the receiver.
              </Text>
              <Text style={styles.successReference}>Reference {reference}</Text>
            </Animated.View>
          </View>

          <View style={styles.successActions}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.88}
              onPress={() => router.replace("/dashboard/products" as any)}
              style={styles.primarySuccessButton}
            >
              <Text style={styles.primarySuccessText}>Continue shopping</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.88}
              onPress={() => router.push("/dashboard/orders" as any)}
              style={styles.secondarySuccessButton}
            >
              <Text style={styles.secondarySuccessText}>View my orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* -------------------------------- Main --------------------------------- */

  const activeSegments = step === "select" ? 1 : step === "add-card" ? 2 : 3;
  const progressLabels = ["Method", "Details", "Pay"];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityLabel="Go back"
              accessibilityRole="button"
              activeOpacity={0.75}
              disabled={step === "processing"}
              hitSlop={10}
              onPress={goBack}
              style={styles.backButton}
            >
              <FontAwesome6 name="arrow-left" size={15} color={C.ink} />
            </TouchableOpacity>

            <Text style={styles.title}>{step === "add-card" ? "Add new card" : "Payment"}</Text>
          </View>

          {/* Progress */}
          <View style={styles.progressWrap}>
            <View style={styles.progressRow}>
              {progressLabels.map((label, i) => (
                <View
                  key={label}
                  style={[styles.progressSegment, i < activeSegments && styles.activeSegment]}
                />
              ))}
            </View>
            <View style={styles.progressRow}>
              {progressLabels.map((label, i) => (
                <Text
                  key={label}
                  style={[styles.progressLabel, i < activeSegments && styles.activeProgressLabel]}
                >
                  {label}
                </Text>
              ))}
            </View>
          </View>

          {/* Processing */}
          {step === "processing" ? (
            <View style={styles.processingState}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={styles.processingTitle}>Processing payment</Text>
              <Text style={styles.processingText}>
                Please keep this screen open. This only takes a moment.
              </Text>
            </View>
          ) : null}

          {/* Select method */}
          {step === "select" ? (
            <>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {hasTotal ? (
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total to pay</Text>
                    <Text style={styles.summaryAmount}>{amountLabel}</Text>
                  </View>
                ) : null}

                <Text style={styles.sectionLabel}>Choose how to pay</Text>

                <View style={styles.methodList}>
                  {methods.map((method) => {
                    const isSelected = selectedMethodId === method.id;
                    const showMomo = isSelected && method.kind === "momo";

                    return (
                      <View key={method.id}>
                        <View style={[styles.methodRow, isSelected && styles.selectedMethodRow]}>
                          <Pressable
                            accessibilityLabel={method.label}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => setSelectedMethodId(method.id)}
                            style={styles.methodPressable}
                          >
                            <View style={styles.methodBrand}>
                              <FontAwesome6
                                name={method.icon as any}
                                size={22}
                                color={method.brandColor}
                              />
                            </View>

                            <Text style={styles.methodName}>{method.label}</Text>

                            <View style={[styles.radio, isSelected && styles.selectedRadio]}>
                              {isSelected ? <View style={styles.radioDot} /> : null}
                            </View>
                          </Pressable>

                          {method.removable ? (
                            <Pressable
                              accessibilityLabel={`Remove ${method.label}`}
                              accessibilityRole="button"
                              hitSlop={8}
                              onPress={() => removeMethod(method.id)}
                              style={styles.removeButton}
                            >
                              <FontAwesome6 name="trash" size={12} color={C.danger} />
                            </Pressable>
                          ) : null}
                        </View>

                        {showMomo ? (
                          <View style={styles.momoField}>
                            <Field
                              error={momoNumber.length > 0 && !momoIsValid ? "Enter a valid phone number" : null}
                              keyboardType="phone-pad"
                              label="Mobile money number"
                              onChangeText={(v) => setMomoNumber(digitsOnly(v, 12))}
                              placeholder="024 000 0000"
                              value={momoNumber}
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.86}
                  onPress={() => setStep("add-card")}
                  style={styles.addNewCardButton}
                >
                  <FontAwesome6 name="plus" size={12} color={C.ink} />
                  <Text style={styles.addNewCardText}>Add new card</Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canPaySelected }}
                  activeOpacity={0.9}
                  disabled={!canPaySelected}
                  onPress={paySelected}
                  style={[styles.bottomButton, !canPaySelected && styles.disabledButton]}
                >
                  <Text style={styles.bottomButtonText}>{payLabel}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* Add card */}
          {step === "add-card" ? (
            <>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Live card preview */}
                <View style={[styles.cardPreview, { backgroundColor: theme.bg }]}>
                  <View style={[styles.cardStripe, { backgroundColor: theme.stripe }]} />
                  <View style={styles.cardCurveOne} />
                  <View style={styles.cardCurveTwo} />

                  <View style={styles.cardTopRow}>
                    {brand ? (
                      <FontAwesome6
                        name={brand === "Visa" ? "cc-visa" : "cc-mastercard"}
                        size={30}
                        color="#FFFFFF"
                      />
                    ) : (
                      <FontAwesome6 name="credit-card" size={24} color="rgba(255,255,255,0.8)" />
                    )}
                  </View>

                  <Text style={styles.cardNumberPreview}>
                    {(cardDigits + "••••••••••••••••").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()}
                  </Text>

                  <View style={styles.cardPreviewBottom}>
                    <View style={styles.flex}>
                      <Text style={styles.cardTinyLabel}>Card holder</Text>
                      <Text numberOfLines={1} style={styles.cardMaskedText}>
                        {accountHolder.trim() || "Name on card"}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.cardTinyLabel}>Expires</Text>
                      <Text style={styles.cardMaskedText}>{expiry || "MM/YY"}</Text>
                    </View>
                  </View>
                </View>

                <Field
                  autoComplete="cc-number"
                  error={touched.number ? errors.number : null}
                  keyboardType="number-pad"
                  label="Card number"
                  maxLength={19}
                  onBlur={() => setTouched((t) => ({ ...t, number: true }))}
                  onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                />

                <Field
                  autoCapitalize="words"
                  autoComplete="cc-name"
                  error={touched.holder ? errors.holder : null}
                  label="Name on card"
                  onBlur={() => setTouched((t) => ({ ...t, holder: true }))}
                  onChangeText={setAccountHolder}
                  placeholder="As printed on the card"
                  value={accountHolder}
                />

                <View style={styles.splitInputRow}>
                  <View style={styles.splitInput}>
                    <Field
                      autoComplete="cc-exp"
                      error={touched.expiry ? errors.expiry : null}
                      keyboardType="number-pad"
                      label="Expiry date"
                      maxLength={5}
                      onBlur={() => setTouched((t) => ({ ...t, expiry: true }))}
                      onChangeText={(v) => setExpiry(formatExpiry(v))}
                      placeholder="MM/YY"
                      value={expiry}
                    />
                  </View>

                  <View style={styles.splitInput}>
                    <Field
                      autoComplete="cc-csc"
                      error={touched.cvv ? errors.cvv : null}
                      keyboardType="number-pad"
                      label="CVV"
                      maxLength={3}
                      onBlur={() => setTouched((t) => ({ ...t, cvv: true }))}
                      onChangeText={(v) => setCvv(digitsOnly(v, 3))}
                      placeholder="123"
                      secureTextEntry
                      value={cvv}
                    />
                  </View>
                </View>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: saveCard }}
                  onPress={() => setSaveCard((v) => !v)}
                  style={styles.saveRow}
                >
                  <View style={[styles.checkbox, saveCard && styles.checkedBox]}>
                    {saveCard ? <FontAwesome6 name="check" size={10} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={styles.saveText}>Save this card for next time</Text>
                </Pressable>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.9}
                  onPress={payWithNewCard}
                  style={styles.bottomButton}
                >
                  <Text style={styles.bottomButtonText}>{payLabel}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* -------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    backgroundColor: C.bg,
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },

  page: {
    alignSelf: "center",
    flex: 1,
    maxWidth: 440,
    paddingHorizontal: 20,
    width: "100%",
  },

  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
  },

  backButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  title: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  progressWrap: { gap: 6, marginTop: 16 },

  progressRow: { flexDirection: "row", gap: 6 },

  progressSegment: {
    backgroundColor: "#D3D0CD",
    borderRadius: 2,
    flex: 1,
    height: 3,
  },

  activeSegment: { backgroundColor: C.accent },

  progressLabel: {
    color: C.placeholder,
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },

  activeProgressLabel: { color: C.inkSoft },

  scrollContent: {
    paddingBottom: 16,
    paddingTop: 22,
  },

  /* Summary */
  summaryCard: {
    alignItems: "center",
    backgroundColor: C.surface,
    borderColor: C.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    padding: 16,
  },

  summaryLabel: {
    color: C.muted,
    fontFamily: "PoppinsRegular",
    fontSize: 12,
  },

  summaryAmount: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 20,
  },

  /* Methods */
  sectionLabel: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginBottom: 12,
  },

  methodList: { gap: 10 },

  methodRow: {
    alignItems: "center",
    backgroundColor: C.surface,
    borderColor: C.line,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: "row",
    minHeight: 54,
  },

  selectedMethodRow: {
    backgroundColor: C.accentSoft,
    borderColor: C.accent,
  },

  methodPressable: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    minHeight: 54,
    paddingHorizontal: 12,
  },

  methodBrand: { alignItems: "center", width: 34 },

  methodName: {
    color: C.ink,
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginLeft: 10,
  },

  radio: {
    alignItems: "center",
    borderColor: "#D5CFCA",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },

  selectedRadio: { borderColor: C.accent },

  radioDot: {
    backgroundColor: C.accent,
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  removeButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },

  momoField: { paddingHorizontal: 2, paddingTop: 2 },

  addNewCardButton: {
    alignItems: "center",
    borderColor: "#CFC8C3",
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
  },

  addNewCardText: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  /* Footer / CTA */
  footer: {
    paddingBottom: 18,
    paddingTop: 10,
  },

  bottomButton: {
    alignItems: "center",
    backgroundColor: C.accent,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 50,
  },

  disabledButton: { backgroundColor: C.disabled },

  bottomButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  /* Card preview */
  cardPreview: {
    borderRadius: 14,
    height: 168,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 18,
  },

  cardStripe: {
    height: 3,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },

  cardCurveOne: {
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 120,
    borderWidth: 12,
    height: 200,
    position: "absolute",
    right: -60,
    top: -40,
    width: 150,
  },

  cardCurveTwo: {
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 120,
    borderWidth: 9,
    height: 190,
    position: "absolute",
    right: -20,
    top: -40,
    width: 120,
  },

  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 30,
    justifyContent: "flex-end",
  },

  cardNumberPreview: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 16,
    letterSpacing: 1.5,
  },

  cardPreviewBottom: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 16,
  },

  cardTinyLabel: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
  },

  cardMaskedText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  /* Form */
  field: { marginTop: 14 },

  inputLabel: {
    color: C.inkSoft,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginBottom: 6,
  },

  input: {
    backgroundColor: C.surface,
    borderColor: "#CFC8C3",
    borderRadius: 8,
    borderWidth: 1.5,
    color: C.ink,
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    height: 46,
    paddingHorizontal: 12,
  },

  inputFocused: { borderColor: C.accent },

  inputError: { borderColor: C.danger },

  errorText: {
    color: C.danger,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 4,
  },

  splitInputRow: { flexDirection: "row", gap: 12 },

  splitInput: { flex: 1 },

  saveRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    minHeight: 32,
  },

  checkbox: {
    alignItems: "center",
    borderColor: "#6D7670",
    borderRadius: 4,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },

  checkedBox: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },

  saveText: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  /* Processing */
  processingState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 60,
  },

  processingTitle: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 17,
    marginTop: 20,
  },

  processingText: {
    color: C.muted,
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    marginTop: 6,
    maxWidth: 240,
    textAlign: "center",
  },

  /* Success */
  successContainer: {
    backgroundColor: C.accent,
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },

  successScreen: {
    alignSelf: "center",
    flex: 1,
    justifyContent: "space-between",
    maxWidth: 440,
    paddingBottom: 24,
    paddingHorizontal: 24,
    width: "100%",
  },

  successTop: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },

  successMark: {
    alignItems: "center",
    borderColor: "#FFFFFF",
    borderRadius: 48,
    borderWidth: 3,
    height: 92,
    justifyContent: "center",
    width: 92,
  },

  successTextBlock: { alignItems: "center", marginTop: 32 },

  successHeadline: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 22,
  },

  successMessage: {
    color: "#FFFFFF",
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 260,
    textAlign: "center",
  },

  successReference: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 16,
  },

  successActions: { gap: 12, width: "100%" },

  primarySuccessButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 50,
  },

  primarySuccessText: {
    color: C.accent,
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  secondarySuccessButton: {
    alignItems: "center",
    borderColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 50,
  },

  secondarySuccessText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },
});