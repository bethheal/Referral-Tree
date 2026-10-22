import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { MembershipApiState } from "@/components/backendApi";
import { PLANS } from "./accountServices";

type PlanKey = (typeof PLANS)[number]["key"];

const formatGhs = (value: number) =>
  `GHS ${value.toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;

const getPlan = (key: PlanKey) =>
  PLANS.find((plan) => plan.key === key) ?? PLANS[0];
type Props = {
  currentPlan: PlanKey;
  membership: MembershipApiState["membership"];
  latestPayment: MembershipApiState["latestPayment"];
  loading: boolean;
  onChange: (plan: PlanKey, expectedAmount: number) => Promise<void>;
};

export default function MembershipPlans({
  currentPlan,
  membership,
  latestPayment,
  loading,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<PlanKey>(currentPlan);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Follow the stored plan once it has loaded.
  useEffect(() => setSelected(currentPlan), [currentPlan]);

  const plan = getPlan(selected);
  const current = getPlan(currentPlan);
  const isCurrent = selected === currentPlan;
  const needsAccount = plan.monthlyFee > 0;
  const paidPlanActive = membership?.status === "ACTIVE" && membership.expiresAt && Date.parse(membership.expiresAt) > Date.now();
  const freePlanUnavailable = selected === "free" && !!paidPlanActive;

  const accessStatus = membership?.status === "ACTIVE"
    ? "Active"
    : membership?.status === "EXPIRED"
      ? "Expired"
      : "Free plan";
  const paymentStatus = membership?.plan === selected
    ? membership.status === "ACTIVE" ? "PAID" : "EXPIRED"
    : latestPayment?.plan === selected
      ? latestPayment.status
      : "NOT_PAID";
  const expiryLabel = membership?.expiresAt
    ? new Date(membership.expiresAt).toLocaleDateString()
    : null;

  const confirm = () => {
    if (isCurrent || busy || !needsAccount) return;

    setError(null);

    setConfirming(true);
  };

  const payForPlan = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onChange(selected, plan.monthlyFee);
      setConfirming(false);
      setNotice("Flutterwave checkout opened. Plan access starts after payment verification.");
      setTimeout(() => setNotice(null), 5000);
    } catch (cause) {
      setConfirming(false);
      setError(cause instanceof Error ? cause.message : "Checkout could not be started. No payment was taken.");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#192536" />
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
            Monthly membership price
            </Text>
            <Text style={styles.currentAmount}>
              {formatGhs(current.monthlyFee)}
            </Text>
          </View>
        </View>
        <Text style={styles.currentMeta}>
          Membership access: {accessStatus}{expiryLabel ? ` - until ${expiryLabel}` : ""}
        </Text>
        {membership?.status === "ACTIVE" ? (
          <Text style={styles.currentMeta}>
            Payment status: Paid - Reference {membership.paymentReference}
          </Text>
        ) : null}
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
              accessibilityLabel={`${item.label} plan, ${formatGhs(item.monthlyFee)} per month`}
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
                {item.monthlyFee === 0 ? "GHS 0" : formatGhs(item.monthlyFee)}
                <Text style={styles.planPer}> /month</Text>
              </Text>
              <Text style={styles.planRate}>
                {item.monthlyFee === 0 ? "No membership fee" : "One-time monthly payment"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{plan.label} monthly membership</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Monthly fee</Text>
          <Text style={styles.summaryValue}>{formatGhs(plan.monthlyFee)}</Text>
        </View>
        <Text style={styles.note}>
          Pay securely with Mastercard or Ghana Mobile Money through Flutterwave.
          This one-time payment covers one month and does not renew automatically.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isCurrent && needsAccount ? (
        <View style={styles.paymentStatus} accessibilityLiveRegion="polite">
          <Text style={styles.paymentStatusTitle}>
            Payment status: {paymentStatus === "PAID" ? "Paid" : paymentStatus === "PENDING" ? "Pending verification" : paymentStatus === "FAILED" ? "Failed" : "Not paid"}
          </Text>
          <Text style={styles.paymentStatusCopy}>
            {paymentStatus === "PAID"
              ? `${plan.label} access is active until ${expiryLabel ?? "the end of the paid month"}.`
              : paymentStatus === "EXPIRED"
                ? `${plan.label} access expired. Renew with a verified payment to restore access.`
              : paymentStatus === "PENDING"
                ? "Flutterwave is confirming your payment. Access will activate when verification succeeds."
                : paymentStatus === "FAILED"
                  ? "Payment was not completed. Your current membership access has not changed."
                  : `${plan.label} benefits and access start only after Flutterwave verifies payment.`}
          </Text>
          {latestPayment?.plan === selected ? (
            <Text style={styles.paymentStatusCopy}>Reference: {latestPayment.reference}</Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityState={{ busy, disabled: isCurrent || busy || freePlanUnavailable }}
        disabled={isCurrent || busy || freePlanUnavailable}
        onPress={confirm}
        style={({ pressed }) => [
          styles.button,
          (isCurrent || busy || freePlanUnavailable) && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            {isCurrent ? `You're on ${plan.label}` : freePlanUnavailable ? `Available after ${current.label} ends` : plan.monthlyFee > 0 ? `Pay for ${plan.label}` : `Continue with ${plan.label}`}
          </Text>
        )}
      </Pressable>

      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Continue to secure checkout?</Text>
            <Text style={styles.confirmBody}>{plan.label} membership · {formatGhs(plan.monthlyFee)} for one month. This is a one-time payment and will not renew automatically.</Text>
            <View style={styles.confirmMethods}>
              <FontAwesome6 name="credit-card" size={15} color="#192536" />
              <Text style={styles.confirmBody}>Choose card or Ghana Mobile Money on Flutterwave.</Text>
            </View>
            <Text style={styles.confirmFoot}>Your membership changes only after the payment provider confirms the transaction.</Text>
            <View style={styles.confirmActions}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirming(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void payForPlan()} style={styles.confirmButton}>{busy ? <ActivityIndicator color="#192536" /> : <Text style={styles.confirmButtonText}>Continue</Text>}</Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  centered: { alignItems: "center", paddingVertical: 24 },

  currentCard: {
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    color: "#192536",
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
  confirmOverlay: { alignItems: "center", backgroundColor: "rgba(12,24,38,0.48)", flex: 1, justifyContent: "center", padding: 20 },
  confirmCard: { backgroundColor: "#FFFFFF", borderRadius: 18, gap: 12, maxWidth: 420, padding: 20, width: "100%" },
  confirmTitle: { color: "#192536", fontFamily: "PoppinsBold", fontSize: 16 },
  confirmBody: { color: "#314640", flex: 1, fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17 },
  confirmMethods: { alignItems: "center", backgroundColor: "#FFF8E4", borderRadius: 11, flexDirection: "row", gap: 9, padding: 11 },
  confirmFoot: { color: "#8B7F7A", fontFamily: "PoppinsRegular", fontSize: 10, lineHeight: 15 },
  confirmActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 4 },
  cancelButton: { alignItems: "center", borderColor: "#E7DDD9", borderRadius: 11, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 18 },
  cancelText: { color: "#192536", fontFamily: "PoppinsBold", fontSize: 11 },
  confirmButton: { alignItems: "center", backgroundColor: "#FFB900", borderRadius: 11, justifyContent: "center", minHeight: 44, minWidth: 110, paddingHorizontal: 18 },
  confirmButtonText: { color: "#192536", fontFamily: "PoppinsBold", fontSize: 11 },

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
  billingRowActive: { backgroundColor: "#FFF1EF", borderColor: "#192536" },
  billingCopy: { flex: 1 },
  billingName: { color: "#1E3631", fontFamily: "PoppinsBold", fontSize: 11 },
  billingMeta: { color: "#8B7F7A", fontFamily: "PoppinsRegular", fontSize: 10 },
  defaultText: { color: "#2F7C50", fontFamily: "PoppinsBold", fontSize: 9 },
  addAccount: {
    alignItems: "center",
    borderColor: "#192536",
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1,
    columnGap: 8,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 44,
  },
  addAccountText: { color: "#192536", fontFamily: "PoppinsBold", fontSize: 11 },

  error: {
    color: "#192536",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 10,
  },
  paymentStatus: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D9C9C4",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  paymentStatusTitle: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },
  paymentStatusCopy: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
  },
  buttonDisabled: { backgroundColor: "#D9C9C4" },
  buttonText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 14 },
});
