import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getMemberDashboardSummary,
  getMemberDirectReferrals,
  referralSystem,
} from "@/components/referralData";

/* -------------------------------------------------------------------------- */
/* Theme & config                                                             */
/* -------------------------------------------------------------------------- */

const C = {
  bg: "#F4F7F4",
  card: "#FFFFFF",
  green: "#4CB35F",
  greenDark: "#1F7A34",
  greenSoft: "#DDF1E0",
  greenBar: "#BFE3C6",
  teal: "#1FB5A0",
  tealDark: "#149A87",
  orange: "#F5A524",
  orangeDark: "#E8901A",
  warnBg: "#FFF1B8",
  warnBorder: "#F2D96B",
  ink: "#16221A",
  body: "#5E6B62",
  muted: "#98A39B",
  line: "#E8EEE9",
  trackBg: "#EEF2EF",
};

/** Change this to wherever your Account screen (with the Withdraw form) lives. */
const ACCOUNT_ROUTE = "/account";
const CURRENT_USER_ID = "user-1";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const formatGhs = (value: number) => `GH₵${Math.round(value * 100) / 100 === Math.round(value) ? Math.round(value).toLocaleString("en-GH") : value.toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;

/** Optional fields aren't fixed in the shared types, so they are read defensively. */
function readField(record: unknown, keys: string[]): string | number | undefined {
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

const DAY = 86_400_000;
const startOfDay = (time: number) => {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

type Period = "week" | "month" | "year";
type Bucket = { label: string; value: number };
type Entry = { amount: number; time: number };

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function buildBuckets(entries: Entry[], period: Period): Bucket[] {
  const now = Date.now();
  const today = startOfDay(now);

  if (period === "week") {
    const buckets: Bucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = today - i * DAY;
      buckets.push({ label: WEEKDAYS[new Date(dayStart).getDay()], value: 0 });
    }
    entries.forEach(({ amount, time }) => {
      const ago = Math.floor((today - startOfDay(time)) / DAY);
      if (ago >= 0 && ago <= 6) buckets[6 - ago].value += amount;
    });
    return buckets;
  }

  if (period === "month") {
    const buckets: Bucket[] = [1, 2, 3, 4].map((n) => ({ label: `Wk ${n}`, value: 0 }));
    entries.forEach(({ amount, time }) => {
      const ago = Math.floor((today - startOfDay(time)) / DAY);
      if (ago >= 0 && ago <= 27) buckets[3 - Math.floor(ago / 7)].value += amount;
    });
    return buckets;
  }

  const current = new Date(now);
  const buckets: Bucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
    buckets.push({ label: MONTHS[d.getMonth()], value: 0 });
  }
  entries.forEach(({ amount, time }) => {
    const d = new Date(time);
    const diff =
      (current.getFullYear() - d.getFullYear()) * 12 + (current.getMonth() - d.getMonth());
    if (diff >= 0 && diff <= 11) buckets[11 - diff].value += amount;
  });
  return buckets;
}

const CATEGORY_STYLES = [
  { bg: "#FDEBD0", fg: "#E8901A", icon: "coins" },
  { bg: "#F3E1FA", fg: "#A24BC9", icon: "users" },
  { bg: "#FDE3EC", fg: "#E0457B", icon: "gift" },
  { bg: "#DDEBFF", fg: "#3E78E0", icon: "star" },
];

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function Segmented({
  onChange,
  value,
}: {
  onChange: (next: Period) => void;
  value: Period;
}) {
  const options: { key: Period; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "week", label: "Week" },
  ];

  return (
    <View style={styles.segment}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.key }}
          onPress={() => onChange(option.key)}
          style={[styles.segmentItem, value === option.key && styles.segmentItemActive]}
        >
          <Text style={[styles.segmentText, value === option.key && styles.segmentTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function BarChart({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(...buckets.map((b) => b.value), 0);
  const peakIndex = max > 0 ? buckets.findIndex((b) => b.value === max) : -1;
  const CHART_HEIGHT = 130;

  if (max === 0) {
    return (
      <View style={styles.chartEmpty}>
        <FontAwesome6 name="chart-simple" size={18} color={C.muted} />
        <Text style={styles.emptyText}>No earnings in this period yet.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.chartScale}>
        <Text style={styles.chartScaleText}>{formatGhs(max)}</Text>
        <Text style={styles.chartScaleText}>0</Text>
      </View>
      <View style={[styles.chartRow, { height: CHART_HEIGHT + 28 }]}>
        {buckets.map((bucket, index) => {
          const isPeak = index === peakIndex;
          const height = Math.max((bucket.value / max) * CHART_HEIGHT, bucket.value > 0 ? 6 : 2);

          return (
            <View key={`${bucket.label}-${index}`} style={styles.barCol}>
              <View style={{ height: CHART_HEIGHT, justifyContent: "flex-end", alignItems: "center" }}>
                {isPeak ? (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipText}>{formatGhs(bucket.value)}</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    { height, backgroundColor: isPeak ? C.green : C.greenBar },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isPeak && styles.barLabelActive]}>{bucket.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Tile({
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
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <FontAwesome6 name={icon} size={13} color={fg} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.tileValue}>
        {value}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function Earnings() {
  const [period, setPeriod] = useState<Period>("week");

  const summary = useMemo(() => getMemberDashboardSummary(referralSystem, CURRENT_USER_ID), []);
  const directReferrals = useMemo(
    () => getMemberDirectReferrals(referralSystem, CURRENT_USER_ID),
    []
  );
  const commissions = useMemo(
    () => referralSystem.commissions.filter((c) => c.recipientId === CURRENT_USER_ID),
    []
  );
  const bonusPoints = useMemo(
    () =>
      referralSystem.points
        .filter((p) => p.userId === CURRENT_USER_ID)
        .reduce((sum, p) => sum + p.points, 0),
    []
  );

  const earnings = summary.earnings as unknown;
  const available = summary.earnings.available;
  const total = summary.earnings.total;
  const pending = readField(earnings, ["pending", "pendingEarnings"]);
  const withdrawn = readField(earnings, ["withdrawn", "totalWithdrawn"]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    commissions.forEach((commission) => {
      const time = toTime(readField(commission, ["createdAt", "date", "earnedAt"]));
      if (time !== null) list.push({ amount: commission.amount, time });
    });
    return list;
  }, [commissions]);

  const buckets = useMemo(() => buildBuckets(entries, period), [entries, period]);

  // Weekly summary card
  const weekBuckets = useMemo(() => buildBuckets(entries, "week"), [entries]);
  const weekTotal = weekBuckets.reduce((sum, b) => sum + b.value, 0);
  const weekCount = useMemo(() => {
    const today = startOfDay(Date.now());
    return entries.filter((e) => {
      const ago = Math.floor((today - startOfDay(e.time)) / DAY);
      return ago >= 0 && ago <= 6;
    }).length;
  }, [entries]);
  const bestDay = weekBuckets.reduce<Bucket | null>(
    (best, b) => (b.value > (best?.value ?? 0) ? b : best),
    null
  );
  const averagePerCommission = weekCount ? weekTotal / weekCount : 0;

  const monthTotal = useMemo(() => {
    const now = new Date();
    return entries
      .filter((e) => {
        const d = new Date(e.time);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  // Earnings by category (commission type)
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    commissions.forEach((commission) => {
      const type = String(
        readField(commission, ["type", "kind", "commissionType"]) ?? "Referral commission"
      );
      map.set(type, (map.get(type) ?? 0) + commission.amount);
    });
    return [...map.entries()].map(([name, amount]) => ({ name, amount }));
  }, [commissions]);

  const goToWithdraw = () => router.push(ACCOUNT_ROUTE as any);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Green header */}
        <View style={styles.header}>
          <SafeAreaView>
            <View style={styles.headerRow}>
              <Pressable
                accessibilityLabel="Go back"
                hitSlop={8}
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <FontAwesome6 name="arrow-left" size={14} color={C.greenDark} />
              </Pressable>
              <Text style={styles.headerTitle}>Earnings</Text>
            </View>
          </SafeAreaView>
        </View>

        {/* Total + pending cards overlapping the header */}
        <View style={styles.cardsRow}>
          <View style={[styles.walletCard, { backgroundColor: C.teal }]}>
            <Text style={styles.walletLabel}>Total earnings</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.walletValue}>
              {formatGhs(total)}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={goToWithdraw}
              style={({ pressed }) => [styles.walletButton, pressed && styles.pressed]}
            >
              <Text style={styles.walletButtonText}>Withdraw now</Text>
            </Pressable>
          </View>

          <View style={[styles.walletCard, { backgroundColor: C.orange }]}>
            <Text style={styles.walletLabel}>Pending earnings</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.walletValue}>
              {typeof pending === "number" ? formatGhs(pending) : "—"}
            </Text>
            <View style={styles.walletNote}>
              <Text style={styles.walletNoteText}>
                {typeof pending === "number" ? "Awaiting approval" : "Not provided yet"}
              </Text>
            </View>
          </View>
        </View>

        {/* Ready-to-withdraw banner */}
        {available > 0 ? (
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <FontAwesome6 name="wallet" size={16} color={C.orangeDark} />
            </View>
            <Text style={styles.bannerText}>
              You have {formatGhs(available)} ready to withdraw. Cash out whenever you like.
            </Text>
          </View>
        ) : null}

        {/* Statistic report */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Statistic report</Text>
            <Segmented onChange={setPeriod} value={period} />
          </View>
          <BarChart buckets={buckets} />
        </View>

        {/* Summary */}
        <View style={[styles.card, styles.summaryCard]}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Income this week</Text>
              <Text style={styles.summaryValue}>{formatGhs(weekTotal)}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Commissions</Text>
              <Text style={styles.summaryValue}>{weekCount}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Best earning day</Text>
              <Text style={styles.summaryValue}>
                {bestDay && bestDay.value > 0 ? formatGhs(bestDay.value) : "—"}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Avg. per commission</Text>
              <Text style={styles.summaryValue}>
                {weekCount ? formatGhs(averagePerCommission) : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Earnings by category */}
        <Text style={styles.sectionTitle}>Earnings category</Text>
        {categories.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <FontAwesome6 name="inbox" size={18} color={C.muted} />
            <Text style={styles.emptyText}>No commissions yet. Share your referral link to start earning.</Text>
          </View>
        ) : (
          categories.map((category, index) => {
            const tint = CATEGORY_STYLES[index % CATEGORY_STYLES.length];
            return (
              <View key={category.name} style={styles.categoryRow}>
                <View style={[styles.categoryIcon, { backgroundColor: tint.bg }]}>
                  <FontAwesome6 name={tint.icon} size={15} color={tint.fg} />
                </View>
                <Text numberOfLines={1} style={styles.categoryName}>
                  {category.name}
                </Text>
                <Text style={styles.categoryAmount}>{formatGhs(category.amount)}</Text>
              </View>
            );
          })
        )}
        {bonusPoints > 0 ? (
          <View style={styles.categoryRow}>
            <View style={[styles.categoryIcon, { backgroundColor: "#FDE3EC" }]}>
              <FontAwesome6 name="gift" size={15} color="#E0457B" />
            </View>
            <Text style={styles.categoryName}>Bonus points</Text>
            <Text style={styles.categoryAmount}>{bonusPoints.toLocaleString()} pts</Text>
          </View>
        ) : null}

        {/* Breakdown */}
        <Text style={styles.sectionTitle}>Income breakdown</Text>
        <View style={styles.tileGrid}>
          <Tile
            bg="#DDF1E0"
            fg={C.greenDark}
            icon="calendar-days"
            label="This month"
            value={formatGhs(monthTotal)}
          />
          <Tile
            bg="#DDF5F1"
            fg={C.tealDark}
            icon="user-group"
            label="Direct referrals"
            value={String(directReferrals.length)}
          />
          <Tile
            bg="#DDEBFF"
            fg="#3E78E0"
            icon="arrow-up-from-bracket"
            label="Total withdrawn"
            value={typeof withdrawn === "number" ? formatGhs(withdrawn) : "—"}
          />
          <Tile
            bg="#FDEBD0"
            fg={C.orangeDark}
            icon="wallet"
            label="Available"
            value={formatGhs(available)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const shadow = {
  elevation: 2,
  shadowColor: "#1F7A34",
  shadowOffset: { height: 4, width: 0 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
};

const styles = StyleSheet.create({
  container: { backgroundColor: C.bg, flex: 1 },
  content: { paddingBottom: 48 },
  pressed: { opacity: 0.75 },

  header: { backgroundColor: C.green, paddingBottom: 72, paddingHorizontal: 20, paddingTop: 18 },
  headerRow: { alignItems: "center", columnGap: 12, flexDirection: "row", paddingTop: 8 },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  headerTitle: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 16 },

  cardsRow: { columnGap: 12, flexDirection: "row", marginTop: -52, paddingHorizontal: 20 },
  walletCard: { borderRadius: 18, flex: 1, minHeight: 132, padding: 14, ...shadow },
  walletLabel: { color: "#FFFFFF", fontFamily: "PoppinsRegular", fontSize: 11 },
  walletValue: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 22, marginTop: 4 },
  walletButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginTop: "auto",
    paddingVertical: 8,
  },
  walletButtonText: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 },
  walletNote: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 8,
    marginTop: "auto",
    paddingVertical: 8,
  },
  walletNoteText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 11 },

  banner: {
    alignItems: "center",
    backgroundColor: C.warnBg,
    borderColor: C.warnBorder,
    borderRadius: 16,
    borderWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
  },
  bannerIcon: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  bannerText: { color: C.ink, flex: 1, fontFamily: "PoppinsBold", fontSize: 11, lineHeight: 17 },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    ...shadow,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 13 },

  segment: { backgroundColor: C.trackBg, borderRadius: 8, flexDirection: "row", padding: 3 },
  segmentItem: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  segmentItemActive: { backgroundColor: C.green },
  segmentText: { color: C.muted, fontFamily: "PoppinsBold", fontSize: 9 },
  segmentTextActive: { color: "#FFFFFF" },

  /* Chart */
  chartScale: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  chartScaleText: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 9 },
  chartRow: { alignItems: "flex-end", columnGap: 6, flexDirection: "row" },
  barCol: { alignItems: "center", flex: 1 },
  bar: { borderRadius: 4, width: "70%" },
  barLabel: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 8, marginTop: 8 },
  barLabelActive: { color: C.greenDark, fontFamily: "PoppinsBold" },
  tooltip: {
    backgroundColor: C.greenDark,
    borderRadius: 6,
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tooltipText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 8 },
  chartEmpty: { alignItems: "center", paddingVertical: 36, rowGap: 8 },

  /* Summary */
  summaryCard: { borderColor: C.green, borderWidth: 1 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  summaryCell: { width: "50%" },
  summaryLabel: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 10 },
  summaryValue: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 18, marginTop: 2 },

  /* Categories */
  sectionTitle: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginHorizontal: 20,
    marginTop: 24,
  },
  categoryRow: {
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 16,
    columnGap: 14,
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
    ...shadow,
  },
  categoryIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  categoryName: { color: C.ink, flex: 1, fontFamily: "PoppinsBold", fontSize: 12 },
  categoryAmount: { color: C.greenDark, fontFamily: "PoppinsBold", fontSize: 14 },

  emptyCard: { alignItems: "center", rowGap: 8 },
  emptyText: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 11, textAlign: "center" },

  /* Breakdown tiles */
  tileGrid: {
    columnGap: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 20,
    marginTop: 10,
    rowGap: 12,
  },
  tile: {
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 18,
    flexBasis: "47%",
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    ...shadow,
  },
  tileIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  tileLabel: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 10, marginTop: 8 },
  tileValue: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 20, marginTop: 2 },
});