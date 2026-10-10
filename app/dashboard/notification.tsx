import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getMemberDirectReferrals,
  referralSystem,
} from "@/components/referralData";

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

const C = {
  bg: "#FFE9E4",
  card: "#FFFFFF",
  unread: "#F3F1FD",
  ink: "#2B2A55",
  body: "#5A5878",
  muted: "#9A98B5",
  line: "#EEEBF7",
  link: "#2F6FD6",
  dot: "#F0645A",
  coral: "#FFC9BF",
  mint: "#E4F7EE",
  mintInk: "#1E9E6A",
  amberSoft: "#FFF3D9",
  amber: "#F5A524",
  blueSoft: "#E6EDFF",
  blue: "#4F7CFF",
  pinkSoft: "#FDE7F0",
  pink: "#F0508F",
};

const CURRENT_USER_ID = "user-1";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const formatGhs = (value: number) => `GH₵${value.toLocaleString("en-GH")}`;

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

function timeAgo(time: number | null): string {
  if (time === null) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  if (days < 365) return `${Math.floor(days / 7)} wk`;
  return `${Math.floor(days / 365)} yr`;
}

type NotificationKind = "commission" | "referral" | "bonus";

type NotificationItem = {
  body: string;
  date: number | null;
  icon: string;
  key: string;
  kind: NotificationKind;
  title: string;
};

const KIND_TINT: Record<NotificationKind, { bg: string; fg: string }> = {
  commission: { bg: C.mint, fg: C.mintInk },
  referral: { bg: C.blueSoft, fg: C.blue },
  bonus: { bg: C.amberSoft, fg: C.amber },
};

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function Notifications() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Notifications are built from real commission, referral and points records.
  const items = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    referralSystem.commissions
      .filter((c) => c.recipientId === CURRENT_USER_ID)
      .forEach((commission, index) => {
        const sourceId = readField(commission, [
          "sourceUserId",
          "sourceId",
          "fromUserId",
          "referredUserId",
        ]);
        const source = referralSystem.users.find((u) => u.id === sourceId);

        list.push({
          body: source
            ? `You earned ${formatGhs(commission.amount)} from ${source.name}'s activity.`
            : `You earned ${formatGhs(commission.amount)} in referral commission.`,
          date: toTime(readField(commission, ["createdAt", "date", "earnedAt"])),
          icon: "coins",
          key: `commission-${readField(commission, ["id"]) ?? index}`,
          kind: "commission",
          title: "New commission earned",
        });
      });

    getMemberDirectReferrals(referralSystem, CURRENT_USER_ID).forEach((member) => {
      list.push({
        body: `${member.name} signed up with your referral link and joined your network.`,
        date: toTime(readField(member, ["createdAt", "joinedAt"])),
        icon: "user-plus",
        key: `referral-${member.id}`,
        kind: "referral",
        title: "New referral joined",
      });
    });

    referralSystem.points
      .filter((point) => point.userId === CURRENT_USER_ID)
      .forEach((point, index) => {
        list.push({
          body: `You received +${point.points.toLocaleString()} bonus points.`,
          date: toTime(readField(point, ["createdAt", "date"])),
          icon: "gift",
          key: `bonus-${readField(point, ["id"]) ?? index}`,
          kind: "bonus",
          title: String(readField(point, ["reason", "type", "description"]) ?? "Bonus points added"),
        });
      });

    return list.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
  }, []);

  const visible = items.filter((item) => !dismissed.has(item.key));
  const unreadCount = visible.filter((item) => !readKeys.has(item.key)).length;
  const shown = visible.filter((item) => filter === "all" || !readKeys.has(item.key));

  const markRead = (key: string) => setReadKeys((current) => new Set(current).add(key));
  const dismiss = (key: string) => setDismissed((current) => new Set(current).add(key));
  const markAllRead = () => setReadKeys(new Set(visible.map((item) => item.key)));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={[styles.headerSide, styles.headerRight]}>
          <Pressable
            accessibilityLabel="Mark all as read"
            disabled={unreadCount === 0}
            hitSlop={8}
            onPress={markAllRead}
            style={unreadCount === 0 && styles.dimmed}
          >
            <FontAwesome6 name="check-double" size={16} color={C.ink} />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabs}>
        {(["all", "unread"] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === tab }}
            onPress={() => setFilter(tab)}
            style={[styles.tab, filter === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
              {tab === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyCircle}>
            <Text style={styles.zzz}>z</Text>
            <Text style={[styles.zzz, styles.zzzSmall]}>z</Text>
            <FontAwesome6 name="bell" size={64} color={C.ink} solid={false} />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === "unread" && visible.length > 0 ? "No unread notifications" : "You're all caught up"}
          </Text>
          <Text style={styles.emptyText}>
            Come back later for commissions, referrals, bonuses and withdrawal updates.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.listCard}>
            {shown.map((item, index) => {
              const isUnread = !readKeys.has(item.key);
              const tint = KIND_TINT[item.kind];

              return (
                <View
                  key={item.key}
                  style={[
                    styles.row,
                    isUnread && styles.rowUnread,
                    index === shown.length - 1 && styles.rowLast,
                  ]}
                >
                  <View style={styles.dotSlot}>{isUnread ? <View style={styles.unreadDot} /> : null}</View>

                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <View style={[styles.icon, { backgroundColor: tint.bg }]}>
                        <FontAwesome6 name={item.icon} size={11} color={tint.fg} />
                      </View>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.rowTime}>{timeAgo(item.date)}</Text>
                    </View>

                    <Text style={styles.rowBody}>{item.body}</Text>

                    <View style={styles.actions}>
                      {isUnread ? (
                        <Pressable hitSlop={6} onPress={() => markRead(item.key)}>
                          <Text style={styles.actionText}>Mark as read</Text>
                        </Pressable>
                      ) : null}
                      {isUnread ? <Text style={styles.actionSep}>-</Text> : null}
                      <Pressable hitSlop={6} onPress={() => dismiss(item.key)}>
                        <Text style={styles.actionText}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { backgroundColor: C.bg, flex: 1 },
  dimmed: { opacity: 0.35 },

  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  headerSide: { width: 40 },
  headerRight: { alignItems: "flex-end" },
  headerTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 16 },

  tabs: { columnGap: 8, flexDirection: "row", paddingBottom: 12, paddingHorizontal: 20 },
  tab: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: C.ink },
  tabText: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 },
  tabTextActive: { color: "#FFFFFF" },

  content: { paddingBottom: 40, paddingHorizontal: 20 },
  listCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    elevation: 3,
    overflow: "hidden",
    shadowColor: "#D9534A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },

  row: {
    borderBottomColor: C.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingRight: 16,
    paddingVertical: 14,
  },
  rowUnread: { backgroundColor: C.unread },
  rowLast: { borderBottomWidth: 0 },
  dotSlot: { alignItems: "center", paddingTop: 7, width: 16 },
  unreadDot: { backgroundColor: C.dot, borderRadius: 3, height: 6, width: 6 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { alignItems: "center", columnGap: 8, flexDirection: "row" },
  icon: {
    alignItems: "center",
    borderRadius: 6,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  rowTitle: { color: C.ink, flex: 1, fontFamily: "PoppinsBold", fontSize: 13 },
  rowTime: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 10 },
  rowBody: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17, marginTop: 8 },
  actions: { alignItems: "center", columnGap: 6, flexDirection: "row", marginTop: 10 },
  actionText: { color: C.link, fontFamily: "PoppinsRegular", fontSize: 11 },
  actionSep: { color: C.muted, fontSize: 11 },

  /* Empty state */
  empty: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 80, paddingHorizontal: 40 },
  emptyCircle: {
    alignItems: "center",
    backgroundColor: C.coral,
    borderRadius: 80,
    height: 160,
    justifyContent: "center",
    width: 160,
  },
  zzz: {
    color: C.ink,
    fontFamily: "PoppinsBold",
    fontSize: 20,
    position: "absolute",
    right: 36,
    top: 22,
  },
  zzzSmall: { fontSize: 13, right: 22, top: 40 },
  emptyTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 14, marginTop: 22 },
  emptyText: {
    color: C.body,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
    textAlign: "center",
  },
});