import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getAccountHistory,
  getDashboardSummary,
  getMembershipState,
  startMembershipCheckout,
  type AccountHistoryItem,
  type DashboardApiSummary,
  type MembershipApiState,
  type MembershipPlanKey,
} from "@/components/backendApi";
import MembershipPlans from "./MembershipPlans";
import { getPlan, type PlanKey } from "./accountServices";

const C = { bg: "#F5F6F8", card: "#FFFFFF", ink: "#192536", body: "#314640", muted: "#7D8794", line: "#E5E9EF", amber: "#FFB900", mint: "#E4F7EE", green: "#1E9E6A", red: "#D92D20", blue: "#4F7CFF" };
const money = (amount: number) => `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Wallet() {
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const isWelcome = welcome === "1";
  const [summary, setSummary] = useState<DashboardApiSummary | null>(null);
  const [membershipState, setMembershipState] = useState<MembershipApiState>({ membership: null, latestPayment: null });
  const [activity, setActivity] = useState<AccountHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [dashboard, membership, history] = await Promise.all([
        getDashboardSummary(), getMembershipState(), getAccountHistory(),
      ]);
      setSummary(dashboard);
      setMembershipState(membership);
      setActivity(history.slice(0, 12));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet data could not be loaded.");
    } finally { if (showLoader) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (membershipState.latestPayment?.status !== "PENDING") return;
    const timer = setInterval(() => { void load(false); }, 5000);
    return () => clearInterval(timer);
  }, [membershipState.latestPayment?.reference, membershipState.latestPayment?.status, load]);

  useEffect(() => {
    if (!isWelcome || membershipState.membership?.status !== "ACTIVE") return;
    router.replace("/dashboard" as never);
  }, [isWelcome, membershipState.membership?.status]);

  const beginCheckout = async (plan: PlanKey, expectedAmount: number) => {
    if (plan === "free") return;
    setCheckoutError("");
    setCheckoutBusy(true);
    try {
      const checkout = await startMembershipCheckout(plan as MembershipPlanKey, expectedAmount);
      setMembershipState((current) => ({ ...current, latestPayment: {
        amount: checkout.amount, createdAt: new Date().toISOString(), plan: checkout.plan,
        reference: checkout.reference, status: "PENDING",
      } }));
      await Linking.openURL(checkout.checkoutUrl);
    } catch (cause) {
      setCheckoutError(cause instanceof Error ? cause.message : "Flutterwave checkout could not be opened. No payment was taken.");
      await load(false);
      throw cause;
    } finally { setCheckoutBusy(false); }
  };

  const currentPlan: PlanKey = membershipState.membership?.status === "ACTIVE"
    ? membershipState.membership.plan
    : "free";
  const canContinueFree = isWelcome && currentPlan === "free" && membershipState.latestPayment?.status !== "PENDING";

  if (loading && !summary) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.amber} /><Text style={styles.muted}>Loading your wallet…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.kicker}>{isWelcome ? "ACCOUNT SETUP" : "ANGEL FOODS"}</Text><Text style={styles.title}>{isWelcome ? "Choose your plan" : "Wallet"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh wallet" disabled={loading} onPress={() => void load()} style={styles.refresh}><FontAwesome6 name="rotate" size={15} color={C.ink} /></Pressable></View>

      {isWelcome ? <View style={styles.welcomeCard}><View style={styles.welcomeIcon}><FontAwesome6 name="circle-check" size={17} color={C.green} /></View><View style={styles.welcomeCopy}><Text style={styles.welcomeTitle}>Your account is ready</Text><Text style={styles.welcomeText}>Choose Free to continue at no cost, or select a paid membership. Paid access begins only after Flutterwave confirms the payment.</Text></View></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}

      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}><View><Text style={styles.balanceLabel}>Available earnings</Text><Text style={styles.balanceAmount}>{summary ? money(summary.financial.availableBalance) : "—"}</Text></View><View style={styles.walletIcon}><FontAwesome6 name="wallet" size={18} color={C.ink} /></View></View>
        <Text style={styles.balanceHint}>Only cleared earnings are available. Pending earnings are not spendable yet.</Text>
        <View style={styles.balanceStats}><WalletStat label="Pending" amount={summary?.financial.pendingEarnings} /><WalletStat label="Total earnings" amount={summary?.financial.totalEarnings} /><WalletStat label="Paid out" amount={summary?.financial.paidOut} /></View>
      </View>

      <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Membership</Text><Text style={styles.sectionSub}>Your current plan and secure payment choices</Text></View><View style={styles.tierPill}><Text style={styles.tierText}>{getPlan(currentPlan).label}</Text></View></View>
      {checkoutError ? <View style={styles.errorCard}><Text style={styles.errorText}>{checkoutError}</Text></View> : null}
      {checkoutBusy ? <View style={styles.checkoutStatus}><ActivityIndicator color={C.blue} /><Text style={styles.checkoutStatusText}>Preparing secure Flutterwave checkout…</Text></View> : null}
      <View style={styles.planCard}>
        <MembershipPlans
          currentPlan={currentPlan}
          membership={membershipState.membership}
          latestPayment={membershipState.latestPayment}
          loading={loading && !membershipState.latestPayment}
          onChange={beginCheckout}
        />
      </View>
      <View style={styles.providerCard}>
        <View style={styles.providerMark}><FontAwesome6 name="lock" size={14} color={C.green} /></View>
        <View style={styles.providerCopy}><Text style={styles.providerTitle}>Pay securely with Flutterwave</Text><Text style={styles.providerText}>On the hosted checkout, choose card or Ghana Mobile Money. Card details and mobile money PINs are entered on Flutterwave, never saved by this app.</Text></View>
      </View>

      {canContinueFree ? <Pressable accessibilityRole="button" onPress={() => router.replace("/dashboard" as never)} style={styles.freeButton}><Text style={styles.freeButtonText}>Continue with Free</Text><FontAwesome6 name="arrow-right" size={13} color={C.ink} /></Pressable> : null}
      {isWelcome && membershipState.latestPayment?.status === "PENDING" ? <View style={styles.pendingCard}><ActivityIndicator color={C.blue} /><View style={styles.providerCopy}><Text style={styles.providerTitle}>Payment awaiting confirmation</Text><Text style={styles.providerText}>We’ll activate your plan only after Flutterwave verifies the payment. You can leave this screen open while we check.</Text></View></View> : null}

      <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Wallet activity</Text><Text style={styles.sectionSub}>Recent account and earnings activity</Text></View></View>
      {activity.length ? <View style={styles.activityCard}>{activity.map((item, index) => <View key={item.id} style={[styles.activityRow, index < activity.length - 1 && styles.activityBorder]}><View style={styles.activityIcon}><FontAwesome6 name={item.category === "CASH_OUT" ? "arrow-up-right-from-square" : "arrow-down-left"} size={12} color={item.category === "CASH_OUT" ? C.blue : C.green} /></View><View style={styles.activityCopy}><Text numberOfLines={1} style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityMeta}>{new Date(item.date).toLocaleDateString()} · {item.status.replaceAll("_", " ")}</Text></View><Text style={[styles.activityAmount, item.category === "CASH_OUT" && styles.debit]}>{typeof item.amount === "number" ? `${item.category === "CASH_OUT" ? "−" : "+"}${money(item.amount)}` : "—"}</Text></View>)}</View> : <View style={styles.emptyCard}><FontAwesome6 name="receipt" size={18} color={C.muted} /><Text style={styles.emptyTitle}>No wallet activity yet</Text><Text style={styles.muted}>Verified payments and cleared account activity will appear here.</Text></View>}

      <View style={styles.withdrawNote}><FontAwesome6 name="circle-info" size={14} color={C.blue} /><Text style={styles.withdrawText}>Withdrawals are temporarily unavailable while payout rules and provider setup are completed. Your earnings stay in your account.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function WalletStat({ label, amount }: { label: string; amount?: number }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{amount === undefined ? "—" : money(amount)}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: C.bg, flex: 1 }, content: { alignSelf: "center", maxWidth: 680, paddingBottom: 130, paddingHorizontal: 20, paddingTop: 25, width: "100%" }, center: { alignItems: "center", backgroundColor: C.bg, flex: 1, justifyContent: "center", rowGap: 12 }, muted: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 16 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 }, kicker: { color: C.muted, fontFamily: "PoppinsBold", fontSize: 9, letterSpacing: 1 }, title: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 22, marginTop: 3 }, refresh: { alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderRadius: 22, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  welcomeCard: { alignItems: "flex-start", backgroundColor: "#EFF8F3", borderRadius: 15, flexDirection: "row", gap: 12, marginBottom: 16, padding: 15 }, welcomeIcon: { alignItems: "center", backgroundColor: C.card, borderRadius: 17, height: 34, justifyContent: "center", width: 34 }, welcomeCopy: { flex: 1 }, welcomeTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 12 }, welcomeText: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 10, lineHeight: 16, marginTop: 4 }, errorCard: { backgroundColor: "#FFF1F0", borderRadius: 13, marginBottom: 14, padding: 12, rowGap: 5 }, errorText: { color: C.red, fontFamily: "PoppinsRegular", fontSize: 11 }, retry: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 },
  balanceCard: { backgroundColor: C.ink, borderRadius: 20, marginBottom: 26, overflow: "hidden", padding: 19 }, balanceHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, balanceLabel: { color: "#C7D0DB", fontFamily: "PoppinsRegular", fontSize: 10 }, balanceAmount: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 27, marginTop: 4 }, walletIcon: { alignItems: "center", backgroundColor: C.amber, borderRadius: 22, height: 44, justifyContent: "center", width: 44 }, balanceHint: { color: "#D7DEE6", fontFamily: "PoppinsRegular", fontSize: 9, lineHeight: 14, marginTop: 8 }, balanceStats: { borderTopColor: "rgba(255,255,255,.18)", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 14 }, stat: { flex: 1 }, statLabel: { color: "#C7D0DB", fontFamily: "PoppinsRegular", fontSize: 9 }, statValue: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 11, marginTop: 5 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 12 }, sectionTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 15 }, sectionSub: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 9, marginTop: 3 }, tierPill: { backgroundColor: "#FFF1C2", borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5 }, tierText: { color: "#6A5000", fontFamily: "PoppinsBold", fontSize: 10 }, planCard: { backgroundColor: C.card, borderColor: C.line, borderRadius: 18, borderWidth: 1, padding: 13 }, providerCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: C.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 12, padding: 13 }, providerMark: { alignItems: "center", backgroundColor: C.mint, borderRadius: 17, height: 34, justifyContent: "center", width: 34 }, providerCopy: { flex: 1 }, providerTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 }, providerText: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 9, lineHeight: 14, marginTop: 4 }, checkoutStatus: { alignItems: "center", backgroundColor: "#EEF4FF", borderRadius: 12, flexDirection: "row", gap: 9, marginBottom: 10, padding: 11 }, checkoutStatusText: { color: C.blue, fontFamily: "PoppinsRegular", fontSize: 10 }, freeButton: { alignItems: "center", backgroundColor: C.amber, borderRadius: 14, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 12, minHeight: 49 }, freeButtonText: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 12 }, pendingCard: { alignItems: "center", backgroundColor: "#EEF4FF", borderRadius: 14, flexDirection: "row", gap: 11, marginTop: 12, padding: 13 },
  activityCard: { backgroundColor: C.card, borderColor: C.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13 }, activityRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 61 }, activityBorder: { borderBottomColor: C.line, borderBottomWidth: 1 }, activityIcon: { alignItems: "center", backgroundColor: "#EFF8F3", borderRadius: 17, height: 34, justifyContent: "center", width: 34 }, activityCopy: { flex: 1 }, activityTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 10 }, activityMeta: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 9, marginTop: 3 }, activityAmount: { color: C.green, fontFamily: "PoppinsBold", fontSize: 10 }, debit: { color: C.blue }, emptyCard: { alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderRadius: 16, borderWidth: 1, gap: 6, padding: 24 }, emptyTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 12, marginTop: 5 }, withdrawNote: { alignItems: "flex-start", backgroundColor: "#EEF4FF", borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 16, padding: 12 }, withdrawText: { color: C.body, flex: 1, fontFamily: "PoppinsRegular", fontSize: 9, lineHeight: 14 },
});
