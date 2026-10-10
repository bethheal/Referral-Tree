import PageHeader from "@/components/pageHeader";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getOrders, Order, OrderStatus } from "./orderStore";

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

const C = {
  bg: "#FFF8F2",
  card: "#FFFFFF",
  red: "#C23122",
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
function useOrders(): { loading: boolean; orders: Order[] } {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getOrders().then((data) => {
        setOrders(data);
        setLoading(false);
      });
    }, [])
  );

  return { loading, orders };
}

const TABS: { key: OrderStatus; label: string }[] = [
  { key: "requested", label: "Requested" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const EMPTY_COPY: Record<OrderStatus, { title: string; text: string }> = {
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

const formatGhs = (value: number) => `GH₵${value.toLocaleString("en-GH")}`;
const formatDate = (time: number) => new Date(time).toLocaleDateString();

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
  selected,
}: {
  onPress: () => void;
  order: Order;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.orderCard, selected && styles.orderCardSelected, pressed && styles.pressed]}
    >
      <View style={styles.orderTop}>
        <Text numberOfLines={1} style={styles.orderTitle}>
          {order.title}
        </Text>
        <Text style={styles.orderId}>Id {order.id}</Text>
      </View>

      <View style={styles.orderMetaRow}>
        <View style={styles.orderMetaCol}>
          <Text style={styles.metaLabel}>Items</Text>
          <Text numberOfLines={1} style={styles.metaValue}>
            {order.items}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.orderMetaCol}>
          <Text style={styles.metaLabel}>{order.scheduledFor ? "Schedule" : "Placed"}</Text>
          <Text numberOfLines={1} style={styles.metaValue}>
            {order.scheduledFor ?? formatDate(order.placedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Order summary (timeline)                                                   */
/* -------------------------------------------------------------------------- */

function OrderSummary({ onBack, order }: { onBack: () => void; order: Order }) {
  const placed = formatDate(order.placedAt);

  const steps = useMemo(() => {
    if (order.status === "cancelled") {
      return [
        { label: `Order placed on ${placed}`, state: "done" as const },
        { label: "Order cancelled", state: "current" as const },
      ];
    }

    const labels = [
      `Order placed on ${placed}`,
      "Order accepted",
      "Processing order and assigning rider",
      "Completed",
    ];

    return labels.map((label, index) => ({
      label,
      state: index < order.stage ? ("done" as const) : index === order.stage ? ("current" as const) : ("todo" as const),
    }));
  }, [order, placed]);

  return (
    <View style={styles.summary}>
      <Pressable accessibilityLabel="Back to orders" hitSlop={10} onPress={onBack} style={styles.backButton}>
        <FontAwesome6 name="chevron-left" size={16} color={C.ink} />
      </Pressable>

      <Text style={styles.summaryTitle}>Order Summary</Text>

      <View style={styles.timeline}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <View key={step.label} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View
                  style={[
                    styles.dot,
                    step.state !== "todo" && styles.dotOn,
                    step.state === "current" && styles.dotCurrent,
                    order.status === "cancelled" && step.state === "current" && styles.dotCancelled,
                  ]}
                />
                {!isLast ? (
                  <View style={[styles.railLine, step.state === "done" && styles.railLineOn]} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, step.state === "todo" && styles.stepLabelOff]}>{step.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.requirementCard}>
        <Text style={styles.metaLabel}>Order</Text>
        <Text style={styles.requirementValue}>{order.title}</Text>
        <View style={styles.requirementDivider} />

        <View style={styles.requirementRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Items</Text>
            <Text style={styles.requirementSub}>{order.items}</Text>
          </View>
          <View style={styles.requirementRight}>
            <Text style={styles.metaLabel}>Total</Text>
            <Text style={styles.requirementSub}>{formatGhs(order.total)}</Text>
          </View>
        </View>

        <View style={[styles.requirementRow, { marginTop: 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Assigned rider</Text>
            <Text style={styles.requirementSub}>{order.assignedTo ?? "Not assigned yet"}</Text>
          </View>
          <View style={styles.requirementRight}>
            <Text style={styles.metaLabel}>Order Id</Text>
            <Text style={styles.requirementSub}>{order.id}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function Orders() {
  const { loading, orders } = useOrders();
  const [tab, setTab] = useState<OrderStatus>("requested");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shown = orders
    .filter((order) => order.status === tab)
    .sort((a, b) => b.placedAt - a.placedAt);
  const selected = orders.find((order) => order.id === selectedId) ?? null;

  if (selected) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.summaryScroll} showsVerticalScrollIndicator={false}>
          <OrderSummary onBack={() => setSelectedId(null)} order={selected} />
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

        {loading ? (
          <Text style={styles.loading}>Loading your orders…</Text>
        ) : shown.length === 0 ? (
          <EmptyOrders text={EMPTY_COPY[tab].text} title={EMPTY_COPY[tab].title} />
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {shown.map((order) => (
              <OrderCard
                key={order.id}
                onPress={() => setSelectedId(order.id)}
                order={order}
                selected={order.id === selectedId}
              />
            ))}
          </ScrollView>
        )}
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