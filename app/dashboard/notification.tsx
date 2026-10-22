import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { getnotification, markAllNotificationsRead, markNotificationRead } from "@/components/backendApi";

type Notification = { body: string; createdAt: string; id: string; readAt: string | null; title: string };
const C = { bg: "#FFFFFF", card: "#FFFFFF", ink: "#192536", body: "#314640", muted: "#8B7F7A", line: "#E7DDD9", amber: "#FFB900", unread: "#FFF9E6" };
const relativeTime = (date: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.floor(hours / 24)} d`;
};

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await getnotification(0, 50)).rows); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't load notifications."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => items.filter((item) => filter === "all" || !item.readAt), [items, filter]);
  const unreadCount = items.filter((item) => !item.readAt).length;

  const markRead = async (id: string) => {
    setBusyKey(id); setError("");
    try {
      const result = await markNotificationRead(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: result.readAt } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't update this notification."); }
    finally { setBusyKey(""); }
  };

  const markAll = async () => {
    setBusyKey("all"); setError("");
    try {
      const result = await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? result.readAt })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't update notifications."); }
    finally { setBusyKey(""); }
  };

  return <SafeAreaView style={styles.container}>
    <View style={styles.header}><View style={styles.headerSide} /><Text style={styles.headerTitle}>Notifications</Text><Pressable accessibilityRole="button" accessibilityLabel="Mark all as read" disabled={!unreadCount || !!busyKey} onPress={() => void markAll()} style={styles.headerSide}>{busyKey === "all" ? <ActivityIndicator size="small" /> : <FontAwesome6 name="check-double" size={16} color={unreadCount ? C.ink : C.muted} />}</Pressable></View>
    <View style={styles.tabs}>{(["all", "unread"] as const).map((tab) => <Pressable key={tab} accessibilityRole="button" accessibilityState={{ selected: filter === tab }} onPress={() => setFilter(tab)} style={[styles.tab, filter === tab && styles.tabActive]}><Text style={styles.tabText}>{tab === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}</Text></Pressable>)}</View>
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
    {loading ? <View style={styles.empty}><ActivityIndicator color={C.amber} /><Text style={styles.muted}>Loading notifications…</Text></View> : shown.length === 0 ? <View style={styles.empty}><View style={styles.emptyIcon}><FontAwesome6 name="bell" size={35} color={C.ink} /></View><Text style={styles.emptyTitle}>{filter === "unread" ? "No unread notifications" : "You're all caught up"}</Text><Text style={styles.muted}>New account updates will appear here.</Text></View> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.listCard}>{shown.map((item, index) => <View key={item.id} style={[styles.row, !item.readAt && styles.rowUnread, index === shown.length - 1 && styles.rowLast]}>
        <View style={styles.dotSlot}>{!item.readAt ? <View style={styles.unreadDot} /> : null}</View><View style={styles.rowMain}><View style={styles.rowTop}><View style={styles.icon}><FontAwesome6 name="bell" size={11} color="#8A6500" /></View><Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text></View><Text style={styles.rowBody}>{item.body}</Text>{!item.readAt ? <Pressable accessibilityRole="button" disabled={!!busyKey} onPress={() => void markRead(item.id)}><Text style={styles.actionText}>{busyKey === item.id ? "Saving…" : "Mark as read"}</Text></Pressable> : null}</View>
      </View>)}</View>
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: C.bg, flex: 1 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 12, paddingHorizontal: 20, paddingTop: 26 }, headerSide: { alignItems: "center", justifyContent: "center", width: 40 }, headerTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 16 }, tabs: { columnGap: 8, flexDirection: "row", paddingBottom: 12, paddingHorizontal: 20 }, tab: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 }, tabActive: { backgroundColor: C.amber }, tabText: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 }, content: { paddingBottom: 40, paddingHorizontal: 20 }, listCard: { backgroundColor: C.card, borderRadius: 20, elevation: 3, overflow: "hidden", shadowColor: "#D9534A", shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.12, shadowRadius: 16 }, row: { borderBottomColor: C.line, borderBottomWidth: 1, flexDirection: "row", paddingRight: 16, paddingVertical: 14 }, rowUnread: { backgroundColor: C.unread }, rowLast: { borderBottomWidth: 0 }, dotSlot: { alignItems: "center", paddingTop: 7, width: 16 }, unreadDot: { backgroundColor: C.amber, borderRadius: 3, height: 6, width: 6 }, rowMain: { flex: 1, minWidth: 0 }, rowTop: { alignItems: "center", columnGap: 8, flexDirection: "row" }, icon: { alignItems: "center", backgroundColor: C.unread, borderRadius: 6, height: 22, justifyContent: "center", width: 22 }, rowTitle: { color: C.ink, flex: 1, fontFamily: "PoppinsBold", fontSize: 13 }, rowTime: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 10 }, rowBody: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17, marginTop: 8 }, actionText: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11, marginTop: 10 }, empty: { alignItems: "center", flex: 1, justifyContent: "center", padding: 40, rowGap: 10 }, emptyIcon: { alignItems: "center", backgroundColor: C.unread, borderRadius: 45, height: 90, justifyContent: "center", width: 90 }, emptyTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 14, marginTop: 12 }, muted: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 11, textAlign: "center" }, errorBox: { backgroundColor: "#FFF0EE", marginHorizontal: 20, padding: 12, rowGap: 6 }, errorText: { color: "#D92D20", fontFamily: "PoppinsRegular", fontSize: 11 }, retry: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 },
});
