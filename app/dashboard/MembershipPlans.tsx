import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { describeAccount } from "./PaymentAccounts";
import {PLANS } from "./accountServices"

type PlanKey = (typeof PLANS)[number]["key"];

type PaymentAccount = Parameters<typeof describeAccount>[0];

const formatGhs = (value: number) =>
  `GH₵${value.toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;

const commissionDue = (plan: (typeof PLANS)[number], earnings: number) => {
  const fee = plan.monthlyFee;
  const percentage = (earnings * plan.commissionRate) / 100;
  return { fee, percentage, total: fee + percentage };
};

const getPlan = (key: PlanKey) =>
  PLANS.find((plan) => plan.key === key) ?? PLANS[0];
const accountKindLabel = (kind: PaymentAccount["kind"]) =>
  String(kind)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

type Props = {
  accounts: PaymentAccount[];
  billingAccountId: string | null;
  currentPlan: PlanKey;
  loading: boolean;
  /** Earnings for the current calendar month, or null if the data has no dates. */
  monthEarnings: number | null;
  onChange: (plan: PlanKey, billingAccountId: string | null) => Promise<void>;
  onAddAccount: () => void;
};

export default function MembershipPlans({
  accounts,
  billingAccountId,
  currentPlan,
  loading,
  monthEarnings,
  onAddAccount,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<PlanKey>(currentPlan);
  const [billingId, setBillingId] = useState<string | null>(billingAccountId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Follow the stored plan once it has loaded.
  useEffect(() => setSelected(currentPlan), [currentPlan]);

  // Default the billing account to the stored one, else the default account.
  useEffect(() => {
    const stillExists = accounts.some((account) => account.id === billingId);
    if (stillExists) return;

    const fallback =
      accounts.find((account) => account.id === billingAccountId) ??
      accounts.find((account) => account.isDefault) ??
      accounts[0];

    setBillingId(fallback?.id ?? null);
  }, [accounts, billingAccountId, billingId]);

  const plan = getPlan(selected);
  const current = getPlan(currentPlan);
  const isCurrent = selected === currentPlan;
  const needsAccount = plan.monthlyFee > 0;
  const missingAccount = needsAccount && !billingId;

  const due = commissionDue(plan, monthEarnings ?? 0);
  const currentDue = commissionDue(current, monthEarnings ?? 0);

  const nextBilling = (() => {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
    ).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  })();

  const confirm = () => {
    if (isCurrent || busy) return;

    if (missingAccount) {
      setError("Add a payment account to choose a paid plan.");
      return;
    }

    setError(null);

    const billing = accounts.find((account) => account.id === billingId);

    Alert.alert(
      `Switch to ${plan.label}?`,
      `${plan.label}: ${formatGhs(plan.monthlyFee)}/month + ${plan.commissionRate}% commission on monthly earnings.` +
        (billing
          ? `\nBilled to ${accountKindLabel(billing.kind)} ${describeAccount(billing)}.`
          : "") +
        `\nNext billing date: ${nextBilling}.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: async () => {
            setBusy(true);
            try {
              await onChange(
                selected,
                needsAccount ? billingId : null,
              );
              setNotice(`You're now on the ${plan.label} plan`);
              setTimeout(() => setNotice(null), 3000);
            } catch {
              setError("We couldn't change your plan. Please try again.");
            } finally {
              setBusy(false);
            }
          },
          text: "Confirm",
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C23122" />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.currentCard}>
        <View style={styles.currentTop}>
          <View>
            <Text style={styles.currentLabel}>Current plan</Text>
            <Text style={[styles.currentValue, { color: current.accent }]}>
              {current.label}
            </Text>
          </View>
          <View style={styles.currentRight}>
            <Text style={styles.currentLabel}>
              Estimated commission this month
            </Text>
            <Text style={styles.currentAmount}>
              {formatGhs(currentDue.total)}
            </Text>
          </View>
        </View>
        <Text style={styles.currentMeta}>Next billing date: {nextBilling}</Text>
      </View>

      {notice ? (
        <View style={styles.notice}>
          <FontAwesome6 name="circle-check" size={12} color="#2F7C50" />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.planGrid}>
        {PLANS.map((item) => {
          const isSelected = item.key === selected;
          const isCurrentPlan = item.key === currentPlan;

          return (
            <Pressable
              key={item.key}
              accessibilityLabel={`${item.label} plan, ${formatGhs(item.monthlyFee)} per month, ${item.commissionRate} percent commission`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                setSelected(item.key);
                setError(null);
              }}
              style={[
                styles.planCard,
                isSelected && { borderColor: item.accent, borderWidth: 2 },
              ]}
            >
              <View style={styles.planTop}>
                <View
                  style={[styles.planDot, { backgroundColor: item.accent }]}
                >
                  <FontAwesome6
                    name={
                      item.key === "free"
                        ? "seedling"
                        : item.key === "premium"
                          ? "crown"
                          : "medal"
                    }
                    size={11}
                    color="#FFFFFF"
                  />
                </View>
                {isCurrentPlan ? (
                  <View style={styles.currentTag}>
                    <Text style={styles.currentTagText}>CURRENT</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.planName}>{item.label}</Text>
              <Text style={styles.planPrice}>
                {item.monthlyFee === 0 ? "GH₵0" : formatGhs(item.monthlyFee)}
                <Text style={styles.planPer}> /month</Text>
              </Text>
              <Text style={styles.planRate}>
                + {item.commissionRate}% of monthly earnings
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>
          {plan.label} monthly commission to us
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Monthly fee</Text>
          <Text style={styles.summaryValue}>{formatGhs(due.fee)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {plan.commissionRate}% of this month's earnings
          </Text>
          <Text style={styles.summaryValue}>
            {monthEarnings === null ? "—" : formatGhs(due.percentage)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <Text style={styles.summaryTotalLabel}>Estimated total</Text>
          <Text style={styles.summaryTotalValue}>{formatGhs(due.total)}</Text>
        </View>
        {monthEarnings === null ? (
          <Text style={styles.note}>
            Commission on earnings can't be estimated because your earnings
            records have no dates.
          </Text>
        ) : (
          <Text style={styles.note}>
            Based on {formatGhs(monthEarnings)} earned this month. The final
            amount is calculated at billing.
          </Text>
        )}
      </View>

      {needsAccount ? (
        <View style={styles.billing}>
          <Text style={styles.billingTitle}>Pay commission from</Text>
          {accounts.length === 0 ? (
            <Pressable onPress={onAddAccount} style={styles.addAccount}>
              <FontAwesome6 name="plus" size={11} color="#C23122" />
              <Text style={styles.addAccountText}>Add a payment account</Text>
            </Pressable>
          ) : (
            accounts.map((account) => {
              const active = account.id === billingId;

              return (
                <Pressable
                  key={account.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setBillingId(account.id)}
                  style={[styles.billingRow, active && styles.billingRowActive]}
                >
                  <FontAwesome6
                    name={active ? "circle-dot" : "circle"}
                    size={14}
                    color={active ? "#C23122" : "#C9BDB8"}
                  />
                  <View style={styles.billingCopy}>
                    <Text style={styles.billingName}>
                      {accountKindLabel(account.kind)}
                    </Text>
                    <Text style={styles.billingMeta}>
                      {describeAccount(account)}
                    </Text>
                  </View>
                  {account.isDefault ? (
                    <Text style={styles.defaultText}>Default</Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityState={{ busy, disabled: isCurrent || busy }}
        disabled={isCurrent || busy}
        onPress={confirm}
        style={({ pressed }) => [
          styles.button,
          (isCurrent || busy) && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            {isCurrent ? `You're on ${plan.label}` : `Switch to ${plan.label}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  centered: { alignItems: "center", paddingVertical: 24 },

  currentCard: {
    backgroundColor: "#FFF8F2",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  currentTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  currentRight: { alignItems: "flex-end", flexShrink: 1 },
  currentLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },
  currentValue: { fontFamily: "PoppinsBold", fontSize: 22, marginTop: 2 },
  currentAmount: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 20,
    marginTop: 2,
  },
  currentMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 10,
  },

  notice: {
    alignItems: "center",
    backgroundColor: "#E9FBF5",
    borderRadius: 10,
    columnGap: 8,
    flexDirection: "row",
    marginTop: 10,
    padding: 10,
  },
  noticeText: { color: "#2F7C50", fontFamily: "PoppinsBold", fontSize: 11 },

  planGrid: {
    columnGap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    rowGap: 10,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    padding: 12,
  },
  planTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  planDot: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  currentTag: {
    backgroundColor: "#E9FBF5",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  currentTagText: { color: "#2F7C50", fontFamily: "PoppinsBold", fontSize: 8 },
  planName: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 15,
    marginTop: 10,
  },
  planPrice: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 17,
    marginTop: 2,
  },
  planPer: { color: "#8B7F7A", fontFamily: "PoppinsRegular", fontSize: 10 },
  planRate: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 4,
  },

  summary: {
    backgroundColor: "#FFF8F2",
    borderRadius: 12,
    marginTop: 14,
    padding: 14,
  },
  summaryTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    marginBottom: 6,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryLabel: {
    color: "#8B7F7A",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
  },
  summaryValue: { color: "#1E3631", fontFamily: "PoppinsBold", fontSize: 12 },
  summaryTotal: {
    borderTopColor: "#F0D6D0",
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 8,
  },
  summaryTotalLabel: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },
  summaryTotalValue: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },
  note: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 8,
  },

  billing: { marginTop: 14 },
  billingTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    marginBottom: 8,
  },
  billingRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 10,
    borderWidth: 1,
    columnGap: 10,
    flexDirection: "row",
    marginBottom: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  billingRowActive: { backgroundColor: "#FFF1EF", borderColor: "#C23122" },
  billingCopy: { flex: 1 },
  billingName: { color: "#1E3631", fontFamily: "PoppinsBold", fontSize: 11 },
  billingMeta: { color: "#8B7F7A", fontFamily: "PoppinsRegular", fontSize: 10 },
  defaultText: { color: "#2F7C50", fontFamily: "PoppinsBold", fontSize: 9 },
  addAccount: {
    alignItems: "center",
    borderColor: "#C23122",
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1,
    columnGap: 8,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 44,
  },
  addAccountText: { color: "#C23122", fontFamily: "PoppinsBold", fontSize: 11 },

  error: {
    color: "#C23122",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 10,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
  },
  buttonDisabled: { backgroundColor: "#D9C9C4" },
  buttonText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 14 },
});
