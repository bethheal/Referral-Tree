import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ACCOUNT_KINDS,
  detectBrand,
  formatCardNumber,
  formatExpiry,
  getKindInfo,
  maskAccountNumber,
  maskGhanaNumber,
  normalizeGhanaNumber,
  validateAccountInput,
} from "./accountServices";
import type {
  AccountKind,
  CardSecrets,
  NewAccountInput,
  PaymentAccount,
} from "./accountServices";

/** Short primary line shown on a card, e.g. "024 *** 4567". */
export function describeAccount(account: PaymentAccount): string {
  if (account.kind === "card") return `•••• •••• •••• ${account.last4 ?? "••••"}`;
  if (account.kind === "bank") {
    return `${account.bankName ?? "Bank"} ${maskAccountNumber(account.number ?? "")}`;
  }
  const normalized = normalizeGhanaNumber(account.number ?? "");
  return normalized ? maskGhanaNumber(normalized) : "—";
}

type Props = {
  accounts: PaymentAccount[];
  defaultHolder: string;
  error: string | null;
  loading: boolean;
  onAdd: (input: NewAccountInput, secrets?: CardSecrets) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onRetry: () => void;
  onSetDefault: (id: string) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<NewAccountInput>) => Promise<unknown>;
};

export default function PaymentAccounts({
  accounts,
  defaultHolder,
  error,
  loading,
  onAdd,
  onRemove,
  onRetry,
  onSetDefault,
  onUpdate,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<AccountKind>("mtn");
  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const kindInfo = getKindInfo(kind);
  const selected = accounts.find((account) => account.id === selectedId) ?? null;

  // Keep the highlighted account valid as the list changes.
  useEffect(() => {
    if (selectedId && !accounts.some((account) => account.id === selectedId)) {
      setSelectedId(null);
    }
  }, [accounts, selectedId]);

  const normalizedNumber = normalizeGhanaNumber(number);
  const isMomo = kind === "mtn" || kind === "telecel" || kind === "airteltigo";
  const prefixMismatch =
    isMomo &&
    normalizedNumber !== null &&
    !kindInfo.prefixes.includes(normalizedNumber.slice(0, 3));

  const resetForm = () => {
    setHolder("");
    setNumber("");
    setBankName("");
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setFormError(null);
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setHolder(defaultHolder);
    setKind("mtn");
    setFormOpen(true);
  };

  const openEdit = (account: PaymentAccount) => {
    resetForm();
    setEditingId(account.id);
    setKind(account.kind);
    setHolder(account.holder);
    setNumber(account.number ?? "");
    setBankName(account.bankName ?? "");
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
  };

  const submit = async () => {
    const problem = validateAccountInput(kind, {
      bankName,
      cardNumber,
      cvv,
      expiry,
      holder,
      number,
    });

    if (problem) {
      setFormError(problem);
      return;
    }

    setBusy(true);
    setFormError(null);

    try {
      if (editingId) {
        await onUpdate(editingId, {
          bankName: kind === "bank" ? bankName.trim() : undefined,
          holder: holder.trim(),
          number: isMomo ? (normalizedNumber ?? number) : number.replace(/\D/g, ""),
        });
        flash("Account updated");
      } else {
        const input: NewAccountInput = {
          bankName: kind === "bank" ? bankName.trim() : undefined,
          brand: kind === "card" ? detectBrand(cardNumber) : undefined,
          expiry: kind === "card" ? expiry : undefined,
          holder: holder.trim(),
          kind,
          last4: kind === "card" ? cardNumber.replace(/\D/g, "").slice(-4) : undefined,
          number:
            kind === "card"
              ? undefined
              : isMomo
              ? (normalizedNumber ?? undefined)
              : number.replace(/\D/g, ""),
        };

        await onAdd(input, kind === "card" ? { cvv, number: cardNumber } : undefined);
        flash("Account added");
      }

      closeForm();
    } catch {
      setFormError("Something went wrong while saving. Please try again.");
    } finally {
      // Sensitive values never outlive the submit.
      setCardNumber("");
      setCvv("");
      setBusy(false);
    }
  };

  const makeDefault = async (account: PaymentAccount) => {
    setBusy(true);
    try {
      await onSetDefault(account.id);
      flash("Default account changed");
    } catch {
      Alert.alert("Couldn't change account", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (account: PaymentAccount) => {
    Alert.alert(
      "Remove this account?",
      `${getKindInfo(account.kind).label} ${describeAccount(account)} will be removed.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: async () => {
            setBusy(true);
            try {
              await onRemove(account.id);
              flash("Account removed");
            } catch {
              Alert.alert("Couldn't remove account", "Please try again.");
            } finally {
              setBusy(false);
            }
          },
          style: "destructive",
          text: "Remove",
        },
      ]
    );
  };

  /* ------------------------------ Preview card ---------------------------- */

  const previewLine = useMemo(() => {
    if (kind === "card") return cardNumber ? formatCardNumber(cardNumber) : "•••• •••• •••• ••••";
    if (kind === "bank") return number ? maskAccountNumber(number.replace(/\D/g, "")) : "•••• ••••";
    return normalizedNumber ? maskGhanaNumber(normalizedNumber) : "0•• ••• ••••";
  }, [cardNumber, kind, normalizedNumber, number]);

  return (
    <View>
      {notice ? (
        <View style={styles.notice}>
          <FontAwesome6 name="circle-check" size={12} color="#2F7C50" />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#192536" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable onPress={onRetry}>
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          <Pressable
            accessibilityLabel="Add a new account"
            accessibilityRole="button"
            onPress={openAdd}
            style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
          >
            <FontAwesome6 name="plus" size={18} color="#192536" />
            <Text style={styles.addTileText}>Add</Text>
          </Pressable>

          {accounts.map((account) => {
            const info = getKindInfo(account.kind);
            const isSelected = account.id === selectedId;

            return (
              <Pressable
                key={account.id}
                accessibilityHint="Select to manage this account"
                accessibilityLabel={`${info.label} ${describeAccount(account)}${
                  account.isDefault ? ", default" : ""
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedId(isSelected ? null : account.id)}
                style={[
                  styles.card,
                  { backgroundColor: info.key === "mtn" ? "#2B2410" : info.bg },
                  isSelected && styles.cardSelected,
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: info.bg }]}>
                    {info.badge ? (
                      <Text style={[styles.badgeText, { color: info.fg }]}>{info.badge}</Text>
                    ) : (
                      <FontAwesome6
                        name={info.key === "card" ? "credit-card" : "building-columns"}
                        size={11}
                        color={info.fg}
                      />
                    )}
                  </View>
                  {account.isDefault ? (
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultPillText}>DEFAULT</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.cardNumber}>{describeAccount(account)}</Text>

                <View style={styles.cardBottom}>
                  <Text numberOfLines={1} style={styles.cardHolder}>
                    {account.holder.toUpperCase()}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {account.kind === "card"
                      ? account.expiry
                      : info.label.split(" ")[0]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!loading && !error && accounts.length === 0 && !formOpen ? (
        <Text style={styles.emptyText}>
          No accounts yet. Add a mobile money, bank or card account to get started.
        </Text>
      ) : null}

      {/* Manage selected account ("change account") */}
      {selected && !formOpen ? (
        <View style={styles.manage}>
          <Text style={styles.manageTitle}>
            {getKindInfo(selected.kind).label} • {describeAccount(selected)}
          </Text>

          <View style={styles.manageRow}>
            {!selected.isDefault ? (
              <Pressable
                disabled={busy}
                onPress={() => makeDefault(selected)}
                style={[styles.manageButton, styles.manageButtonPrimary]}
              >
                <FontAwesome6 name="star" size={11} color="#FFFFFF" />
                <Text style={styles.manageButtonPrimaryText}>Use as default</Text>
              </Pressable>
            ) : (
              <View style={styles.manageButton}>
                <FontAwesome6 name="circle-check" size={11} color="#2F7C50" />
                <Text style={styles.manageButtonText}>Current default</Text>
              </View>
            )}

            {selected.kind !== "card" ? (
              <Pressable disabled={busy} onPress={() => openEdit(selected)} style={styles.manageButton}>
                <FontAwesome6 name="pen" size={11} color="#192536" />
                <Text style={styles.manageButtonText}>Edit</Text>
              </Pressable>
            ) : null}

            <Pressable disabled={busy} onPress={() => confirmRemove(selected)} style={styles.manageButton}>
              <FontAwesome6 name="trash" size={11} color="#192536" />
              <Text style={styles.manageButtonText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Add / edit form */}
      {formOpen ? (
        <View style={styles.form}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editingId ? "Edit account" : "Add new account"}</Text>
            <Pressable accessibilityLabel="Close form" hitSlop={8} onPress={closeForm}>
              <FontAwesome6 name="xmark" size={15} color="#8B7F7A" />
            </Pressable>
          </View>

          {/* Live preview */}
          <View style={[styles.card, styles.previewCard, { backgroundColor: kind === "mtn" ? "#2B2410" : kindInfo.bg }]}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, { backgroundColor: kindInfo.bg }]}>
                {kindInfo.badge ? (
                  <Text style={[styles.badgeText, { color: kindInfo.fg }]}>{kindInfo.badge}</Text>
                ) : (
                  <FontAwesome6 name={kind === "card" ? "credit-card" : "building-columns"} size={11} color={kindInfo.fg} />
                )}
              </View>
              <Text style={styles.cardMeta}>{kind === "card" ? expiry || "MM/YY" : kindInfo.label}</Text>
            </View>
            <Text style={styles.cardNumber}>{previewLine}</Text>
            <Text numberOfLines={1} style={styles.cardHolder}>
              {(holder || "ACCOUNT HOLDER").toUpperCase()}
            </Text>
          </View>

          {!editingId ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kindRow}
            >
              {ACCOUNT_KINDS.map((item) => {
                const isActive = item.key === kind;

                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => {
                      setKind(item.key);
                      setFormError(null);
                    }}
                    style={[styles.kindChip, isActive && styles.kindChipActive]}
                  >
                    <View style={[styles.kindBadge, { backgroundColor: item.bg }]}>
                      {item.badge ? (
                        <Text style={[styles.badgeText, { color: item.fg }]}>{item.badge}</Text>
                      ) : (
                        <FontAwesome6
                          name={item.key === "card" ? "credit-card" : "building-columns"}
                          size={10}
                          color={item.fg}
                        />
                      )}
                    </View>
                    <Text style={[styles.kindText, isActive && styles.kindTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {kind === "bank" ? (
            <>
              <Text style={styles.label}>Bank name</Text>
              <TextInput
                onChangeText={setBankName}
                placeholder="e.g. GCB Bank"
                placeholderTextColor="#B5AAA5"
                style={styles.input}
                value={bankName}
              />
            </>
          ) : null}

          {kind === "card" ? (
            <>
              <Text style={styles.label}>Card number</Text>
              <TextInput
                autoComplete="off"
                importantForAutofill="no"
                keyboardType="number-pad"
                maxLength={23}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                placeholder="0000 0000 0000 0000"
                placeholderTextColor="#B5AAA5"
                style={styles.input}
                value={cardNumber}
              />

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.label}>Expiry date</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={5}
                    onChangeText={(text) => setExpiry(formatExpiry(text))}
                    placeholder="MM/YY"
                    placeholderTextColor="#B5AAA5"
                    style={styles.input}
                    value={expiry}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>CVV</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(text) => setCvv(text.replace(/\D/g, ""))}
                    placeholder="123"
                    placeholderTextColor="#B5AAA5"
                    secureTextEntry
                    style={styles.input}
                    value={cvv}
                  />
                </View>
              </View>
            </>
          ) : null}

          {isMomo ? (
            <>
              <Text style={styles.label}>Mobile money number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>🇬🇭 +233</Text>
                </View>
                <TextInput
                  keyboardType="phone-pad"
                  maxLength={16}
                  onChangeText={setNumber}
                  placeholder="24 123 4567"
                  placeholderTextColor="#B5AAA5"
                  style={styles.phoneInput}
                  value={number}
                />
              </View>
              {prefixMismatch ? (
                <Text style={styles.hint}>
                  This number doesn&apos;t start with a usual {kindInfo.label} prefix (
                  {kindInfo.prefixes.join(", ")}). Check the network, unless the number was ported.
                </Text>
              ) : null}
            </>
          ) : null}

          {kind === "bank" ? (
            <>
              <Text style={styles.label}>Account number</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={16}
                onChangeText={setNumber}
                placeholder="Account number"
                placeholderTextColor="#B5AAA5"
                style={styles.input}
                value={number}
              />
            </>
          ) : null}

          <Text style={styles.label}>{kind === "card" ? "Name on card" : "Account holder name"}</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setHolder}
            placeholder="Full name"
            placeholderTextColor="#B5AAA5"
            style={styles.input}
            value={holder}
          />

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          {kind === "card" ? (
            <Text style={styles.secureNote}>
              <FontAwesome6 name="lock" size={9} color="#8B7F7A" /> Only the card type, last 4
              digits and expiry are kept. The full number and CVV are never stored.
            </Text>
          ) : null}

          <Pressable
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={submit}
            style={({ pressed }) => [
              styles.submit,
              busy && styles.submitBusy,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>{editingId ? "Save changes" : "Add account"}</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },

  notice: {
    alignItems: "center",
    backgroundColor: "#E9FBF5",
    borderRadius: 10,
    columnGap: 8,
    flexDirection: "row",
    marginBottom: 10,
    padding: 10,
  },
  noticeText: { color: "#2F7C50", fontFamily: "PoppinsBold", fontSize: 11 },

  centered: { alignItems: "center", paddingVertical: 24, rowGap: 8 },
  emptyText: { color: "#8B7F7A", fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: "center" },
  link: { color: "#192536", fontFamily: "PoppinsBold", fontSize: 11 },

  carousel: { columnGap: 12, paddingRight: 4, paddingVertical: 4 },
  addTile: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderColor: "#F0D6D0",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 132,
    justifyContent: "center",
    rowGap: 6,
    width: 64,
  },
  addTileText: { color: "#192536", fontFamily: "PoppinsBold", fontSize: 10 },

  card: {
    borderColor: "transparent",
    borderRadius: 16,
    borderWidth: 2,
    height: 132,
    justifyContent: "space-between",
    padding: 14,
    width: 230,
  },
  cardSelected: { borderColor: "#192536" },
  previewCard: { marginTop: 12, width: "100%" },
  cardTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  badge: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    minWidth: 28,
    paddingHorizontal: 6,
  },
  badgeText: { fontFamily: "PoppinsBold", fontSize: 9 },
  defaultPill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  defaultPillText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 8 },
  cardNumber: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 15, letterSpacing: 1 },
  cardBottom: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardHolder: { color: "#FFFFFF", flex: 1, fontFamily: "PoppinsRegular", fontSize: 10 },
  cardMeta: { color: "rgba(255,255,255,0.8)", fontFamily: "PoppinsRegular", fontSize: 10 },

  manage: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  manageTitle: { color: "#1E3631", fontFamily: "PoppinsBold", fontSize: 12 },
  manageRow: { columnGap: 8, flexDirection: "row", flexWrap: "wrap", marginTop: 10, rowGap: 8 },
  manageButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 10,
    borderWidth: 1,
    columnGap: 6,
    flexDirection: "row",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  manageButtonPrimary: { backgroundColor: "#192536", borderColor: "#192536" },
  manageButtonText: { color: "#314640", fontFamily: "PoppinsBold", fontSize: 10 },
  manageButtonPrimaryText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 10 },

  form: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  formHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  formTitle: { color: "#1E3631", fontFamily: "PoppinsBold", fontSize: 14 },

  kindRow: { columnGap: 8, paddingVertical: 12 },
  kindChip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    columnGap: 8,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kindChipActive: { backgroundColor: "#FFF1EF", borderColor: "#192536" },
  kindBadge: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    minWidth: 24,
    paddingHorizontal: 5,
  },
  kindText: { color: "#6C625F", fontFamily: "PoppinsBold", fontSize: 10 },
  kindTextActive: { color: "#192536" },

  label: { color: "#8B7F7A", fontFamily: "PoppinsRegular", fontSize: 11, marginBottom: 5, marginTop: 10 },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 10,
    borderWidth: 1,
    color: "#1E3631",
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  twoCol: { columnGap: 10, flexDirection: "row" },
  col: { flex: 1 },

  phoneRow: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    overflow: "hidden",
  },
  phonePrefix: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRightColor: "#F0D6D0",
    borderRightWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  phonePrefixText: { color: "#1E3631", fontFamily: "PoppinsBold", fontSize: 12 },
  phoneInput: { color: "#1E3631", flex: 1, fontFamily: "PoppinsRegular", fontSize: 13, paddingHorizontal: 12 },

  hint: { color: "#8A5C13", fontFamily: "PoppinsRegular", fontSize: 10, lineHeight: 15, marginTop: 6 },
  error: { color: "#192536", fontFamily: "PoppinsRegular", fontSize: 11, marginTop: 10 },
  secureNote: { color: "#8B7F7A", fontFamily: "PoppinsRegular", fontSize: 9, lineHeight: 14, marginTop: 10 },

  submit: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
  },
  submitBusy: { opacity: 0.7 },
  submitText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 14 },
});
