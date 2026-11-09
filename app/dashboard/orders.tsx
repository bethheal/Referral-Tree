import PageHeader from "@/components/pageHeader";
import { ApiError, getAllCustomerOrders, getCustomerOrder, type CustomerOrderDetail } from "@/components/backendApi";
import { orderHistoryTab, orderStatusLabel, toCustomerOrderHistoryRow, type CustomerOrderHistoryRow, type OrderHistoryTab } from "@/components/customerOrderHistory";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getOrders, type Order as LegacyOrder } from "./orderStore";

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

const C = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  red: "#192536",
  redSoft: "#FFF1EF",
  tint: "#FDE9E5",
  ink: "#1E3631",
  body: "#6C625F",
  muted: "#A39894",
  line: "#F0D6D0",
  dotOff: "#DDD2CE",
  green: "#2F7C50",
};

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

/** Loads saved orders every time the screen gains focus. */
function useOrders(): { loading: boolean; error: string; orders: CustomerOrderHistoryRow[]; legacyOrders: LegacyOrder[]; retry: () => void } {
  const [orders, setOrders] = useState<CustomerOrderHistoryRow[]>([]);
  const [legacyOrders, setLegacyOrders] = useState<LegacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      void (async () => {
        const savedLocally = await getOrders();
        if (active) setLegacyOrders(savedLocally);
        try {
          const serverOrders = await getAllCustomerOrders();
          if (active) setOrders(serverOrders.map(toCustomerOrderHistoryRow));
        } catch (loadError) {
          if (active) setError(loadError instanceof ApiError && loadError.status === 401
            ? "Your session has expired. Sign in again to load your AngelFoods orders."
            : "We couldn't connect to your account to load orders. Check your connection and retry.");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [refreshKey])
  );

  return { loading, error, orders, legacyOrders, retry: () => setRefreshKey((value) => value + 1) };
}

const TABS: { key: OrderHistoryTab; label: string }[] = [
  { key: "requested", label: "Requested" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const EMPTY_COPY: Record<OrderHistoryTab, { title: string; text: string }> = {
  requested: {
    title: "No orders yet",
    text: "When you place an Angel Foods order, you can track it here.",
  },
  completed: {
    title: "No completed orders",
    text: "Orders that have been delivered will show up here.",
  },
  cancelled: {
    title: "No cancelled orders",
    text: "Nothing cancelled. Orders you cancel will be listed here.",
  },
};

const formatMoney = (value: number, currency: string) => {
  try { return new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(value); }
  catch { return `${currency} ${Number.isFinite(value) ? value.toFixed(2) : "—"}`; }
};
const formatDate = (time: string | number) => new Date(time).toLocaleDateString();

/* -------------------------------------------------------------------------- */
/* "No orders" animation                                                      */
/* -------------------------------------------------------------------------- */

function EmptyOrders({ text, title }: { text: string; title: string }) {
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        duration: 2000,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      })
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [float, pulse]);

  const bagY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const shadowScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
  const shadowOpacity = float.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.12] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const sparkleY = float.interpolate({ inputRange: [0, 1], outputRange: [4, -8] });
  const sparkleOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] });

  return (
    <View style={styles.empty}>
      <View style={styles.emptyStage}>
        <Animated.View
          style={[styles.emptyRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
        />
        <View style={styles.emptyCircle}>
          <Animated.View style={{ transform: [{ translateY: bagY }] }}>
            <FontAwesome6 name="bag-shopping" size={48} color={C.red} />
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.sparkle, { left: 14, top: 26, opacity: sparkleOpacity, transform: [{ translateY: sparkleY }] }]}
        >
          <FontAwesome6 name="star" size={11} color="#F5A524" solid />
        </Animated.View>
        <Animated.View
          style={[styles.sparkle, { right: 10, top: 46, opacity: sparkleOpacity, transform: [{ translateY: sparkleY }] }]}
        >
          <FontAwesome6 name="star" size={8} color={C.red} solid />
        </Animated.View>

        <Animated.View
          style={[styles.emptyShadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]}
        />
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* List card                                                                  */
/* -------------------------------------------------------------------------- */

function OrderCard({
  onPress,
  order,
}: {
  onPress: () => void;
  order: CustomerOrderHistoryRow;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}
    >
      <View style={styles.orderTop}>
        <Text numberOfLines={1} style={styles.orderTitle}>
          {order.orderNumber}
        </Text>
        <Text style={styles.orderStatus}>{order.statusLabel}</Text>
      </View>

      <View style={styles.orderMetaRow}>
        <View style={styles.orderMetaCol}>
          <Text style={styles.metaLabel}>Items</Text>
          <Text numberOfLines={1} style={styles.metaValue}>
            {order.itemsSummary}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.orderMetaCol}>
          <Text style={styles.metaLabel}>Placed</Text>
          <Text numberOfLines={1} style={styles.metaValue}>
            {formatDate(order.createdAt)}
          </Text>
        </View>
      </View>
      <Text style={styles.orderTotal}>{formatMoney(order.total, order.currency)}</Text>
    </Pressable>
  );
}

function LocalOrderCard({ order }: { order: LegacyOrder }) {
  return (
    <View style={styles.localOrderCard}>
      <View style={styles.orderTop}>
        <Text numberOfLines={1} style={styles.orderTitle}>{order.title}</Text>
        <Text style={styles.localOrderStatus}>Device only · not confirmed</Text>
      </View>
      <Text style={styles.localOrderItems}>{order.items}</Text>
      <View style={styles.localOrderFooter}>
        <Text style={styles.metaValue}>{formatDate(order.placedAt)}</Text>
        <Text style={styles.metaValue}>{formatMoney(order.total, "GHS")}</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Order summary (timeline)                                                   */
/* -------------------------------------------------------------------------- */

function OrderSummary({ onBack, order }: { onBack: () => void; order: CustomerOrderDetail }) {
  return (
    <View style={styles.summary}>
      <Pressable accessibilityLabel="Back to orders" hitSlop={10} onPress={onBack} style={styles.backButton}>
        <FontAwesome6 name="chevron-left" size={16} color={C.ink} />
      </Pressable>

      <Text style={styles.summaryTitle}>Order Summary</Text>
      <Text style={styles.summaryOrderNumber}>{order.orderNumber} · {orderStatusLabel(order.status)}</Text>

      <View style={styles.timeline}>
        {[{ label: `Order placed · ${formatDate(order.createdAt)}`, key: `placed-${order.id}` }, ...order.statusHistory.map((entry) => ({ label: `${orderStatusLabel(entry.status)} · ${formatDate(entry.createdAt)}`, key: `${entry.createdAt}-${entry.status}` }))].map((step, index, events) => {
          const isLast = index === events.length - 1;
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View style={[styles.dot, styles.dotOn, isLast && styles.dotCurrent, order.status === "CANCELLED" && isLast && styles.dotCancelled]} />
                {!isLast ? (
                  <View style={[styles.railLine, styles.railLineOn]} />
                ) : null}
              </View>
              <Text style={styles.stepLabel}>{step.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.requirementCard}>
        <Text style={styles.metaLabel}>Order</Text>
        <Text style={styles.requirementValue}>{order.orderNumber}</Text>
        <View style={styles.requirementDivider} />

        <View style={styles.requirementRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Items</Text>
            <Text style={styles.requirementSub}>{order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ") || "No items"}</Text>
          </View>
          <View style={styles.requirementRight}>
            <Text style={styles.metaLabel}>Total</Text>
            <Text style={styles.requirementSub}>{formatMoney(order.total, order.currency)}</Text>
          </View>
        </View>

        <View style={[styles.requirementRow, { marginTop: 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Order status</Text>
            <Text style={styles.requirementSub}>{orderStatusLabel(order.status)}</Text>
          </View>
          <View style={styles.requirementRight}>
            <Text style={styles.metaLabel}>Order Id</Text>
            <Text style={styles.requirementSub}>{order.id}</Text>
          </View>
        </View>
        <View style={styles.serverItems}>
          {order.items.map((item) => <View key={item.id} style={styles.serverItemRow}><Text style={styles.serverItemName}>{item.name} ×{item.quantity}</Text><Text style={styles.serverItemPrice}>{formatMoney(item.lineTotal, item.currency)}</Text></View>)}
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function Orders() {
  const { loading, error, orders, legacyOrders, retry } = useOrders();
  const [tab, setTab] = useState<OrderHistoryTab>("requested");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetryKey, setDetailRetryKey] = useState(0);

  useEffect(() => {
    if (!selectedId) { setSelectedOrder(null); setDetailError(""); return; }
    let active = true;
    setDetailLoading(true);
    setDetailError("");
    setSelectedOrder(null);
    void getCustomerOrder(selectedId).then((detail) => {
      if (active) setSelectedOrder(detail);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setDetailError(loadError instanceof ApiError && loadError.status === 404
        ? "This order isn't available in your account."
        : loadError instanceof ApiError && loadError.status === 401
          ? "Your session has expired. Sign in again to view order details."
          : "We couldn't load this order's details. Check your connection and retry.");
    }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, detailRetryKey]);

  const shown = orders
    .filter((order) => orderHistoryTab(order.status) === tab)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (selectedId) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.summaryScroll} showsVerticalScrollIndicator={false}>
          {detailLoading ? <View style={styles.detailState}><ActivityIndicator color={C.red} /><Text style={styles.loading}>Loading order details…</Text></View> : detailError ? <View style={styles.detailState}><Text style={styles.errorText}>{detailError}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setDetailRetryKey((value) => value + 1)} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setSelectedId(null)} style={styles.backTextButton}><Text style={styles.retryButtonText}>Back to orders</Text></TouchableOpacity></View> : selectedOrder ? <OrderSummary onBack={() => setSelectedId(null)} order={selectedOrder} /> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <PageHeader title="My Orders" subtitle="Track your Angel Foods orders" />

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => setTab(item.key)}
              style={[styles.tab, tab === item.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.historyContent} showsVerticalScrollIndicator={false}>
          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={retry} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></View> : null}
          {loading && orders.length === 0 ? <View style={styles.detailState}><ActivityIndicator color={C.red} /><Text style={styles.loading}>Loading your orders…</Text></View> : !error && shown.length === 0 ? <EmptyOrders text={EMPTY_COPY[tab].text} title={EMPTY_COPY[tab].title} /> : shown.length > 0 ? <View style={styles.list}>{shown.map((order) => <OrderCard key={order.id} onPress={() => setSelectedId(order.id)} order={order} />)}</View> : null}
          {legacyOrders.length > 0 ? <View style={styles.localHistory}><Text style={styles.localHistoryTitle}>Saved on this device</Text><Text style={styles.localHistoryNotice}>These older records are local history only. They were not confirmed or placed with AngelFoods.</Text>{legacyOrders.map((order) => <LocalOrderCard key={`local-${order.id}`} order={order} />)}</View> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { backgroundColor: C.bg, flex: 1 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 14 },
  pressed: { opacity: 0.75 },

  /* Tabs */
  tabs: { columnGap: 8, flexDirection: "row", marginBottom: 14, marginTop: 14 },
  tab: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  tabActive: { backgroundColor: C.red },
  tabText: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 11 },
  tabTextActive: { color: "#FFFFFF", fontFamily: "PoppinsBold" },
  loading: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 12, marginTop: 24, textAlign: "center" },

  /* List */
  historyContent: { flexGrow: 1, paddingBottom: 40 },
  list: { paddingBottom: 40, rowGap: 12 },
  orderCard: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  orderCardSelected: { backgroundColor: C.tint, borderColor: C.tint },
  orderTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  orderTitle: { color: C.ink, flex: 1, fontFamily: "PoppinsBold", fontSize: 14 },
  orderId: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 9, marginLeft: 8 },
  orderStatus: { color: C.red, fontFamily: "PoppinsBold", fontSize: 9, marginLeft: 8 },
  orderTotal: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 12, marginTop: 12, textAlign: "right" },
  errorCard: { backgroundColor: "#FFF5F3", borderRadius: 14, marginBottom: 12, padding: 14 },
  errorText: { color: "#7A2B22", fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17, textAlign: "center" },
  retryButton: { alignSelf: "center", backgroundColor: C.red, borderRadius: 12, marginTop: 10, paddingHorizontal: 18, paddingVertical: 9 },
  retryButtonText: { color: "#FFFFFF", fontFamily: "PoppinsBold", fontSize: 11 },
  backTextButton: { alignSelf: "center", backgroundColor: C.body, borderRadius: 12, marginTop: 10, paddingHorizontal: 18, paddingVertical: 9 },
  detailState: { alignItems: "center", justifyContent: "center", padding: 24 },
  summaryOrderNumber: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 12, marginTop: 5 },
  serverItems: { borderTopColor: C.line, borderTopWidth: 1, marginTop: 14, paddingTop: 10 },
  serverItemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  serverItemName: { color: C.body, flex: 1, fontFamily: "PoppinsRegular", fontSize: 11, paddingRight: 10 },
  serverItemPrice: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11 },
  localHistory: { borderTopColor: C.line, borderTopWidth: 1, marginTop: 16, paddingTop: 14, rowGap: 9 },
  localHistoryTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 13 },
  localHistoryNotice: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 10, lineHeight: 15 },
  localOrderCard: { backgroundColor: "#FFF8E5", borderRadius: 12, padding: 12 },
  localOrderStatus: { color: "#705A16", fontFamily: "PoppinsBold", fontSize: 8, marginLeft: 8 },
  localOrderItems: { color: C.body, fontFamily: "PoppinsRegular", fontSize: 10, marginTop: 8 },
  localOrderFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  orderMetaRow: { flexDirection: "row", marginTop: 12 },
  orderMetaCol: { flex: 1, minWidth: 0 },
  metaDivider: { backgroundColor: C.line, marginHorizontal: 12, width: 1 },
  metaLabel: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 9 },
  metaValue: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 11, marginTop: 3 },

  /* Empty state */
  empty: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 90, paddingHorizontal: 30 },
  emptyStage: { alignItems: "center", height: 190, justifyContent: "center", width: 190 },
  emptyRing: {
    backgroundColor: C.red,
    borderRadius: 70,
    height: 140,
    position: "absolute",
    top: 10,
    width: 140,
  },
  emptyCircle: {
    alignItems: "center",
    backgroundColor: C.tint,
    borderRadius: 70,
    height: 140,
    justifyContent: "center",
    marginTop: -10,
    width: 140,
  },
  emptyShadow: {
    backgroundColor: C.red,
    borderRadius: 30,
    bottom: 6,
    height: 10,
    position: "absolute",
    width: 70,
  },
  sparkle: { position: "absolute" },
  emptyTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 15, marginTop: 14 },
  emptyText: {
    color: C.body,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    textAlign: "center",
  },

  /* Summary */
  summaryScroll: { paddingBottom: 40 },
  summary: { paddingHorizontal: 22, paddingTop: 26 },
  backButton: { alignSelf: "flex-start", padding: 4 },
  summaryTitle: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 22, marginTop: 18 },
  timeline: { marginTop: 28 },
  stepRow: { columnGap: 16, flexDirection: "row", minHeight: 60 },
  stepRail: { alignItems: "center", width: 14 },
  dot: { backgroundColor: C.dotOff, borderRadius: 6, height: 12, width: 12 },
  dotOn: { backgroundColor: C.red },
  dotCurrent: { borderColor: C.tint, borderWidth: 3, height: 16, marginTop: -2, width: 16 },
  dotCancelled: { backgroundColor: "#7A2B22" },
  railLine: { backgroundColor: C.dotOff, flex: 1, marginVertical: 4, width: 2 },
  railLineOn: { backgroundColor: C.red },
  stepLabel: { color: C.ink, flex: 1, fontFamily: "PoppinsRegular", fontSize: 12, lineHeight: 18 },
  stepLabelOff: { color: C.muted },

  requirementCard: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    padding: 16,
  },
  requirementValue: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 15, marginTop: 4 },
  requirementDivider: { backgroundColor: C.line, height: 1, marginVertical: 14 },
  requirementRow: { flexDirection: "row" },
  requirementRight: { alignItems: "flex-start", width: 110 },
  requirementSub: { color: C.ink, fontFamily: "PoppinsBold", fontSize: 12, marginTop: 3 },
});
