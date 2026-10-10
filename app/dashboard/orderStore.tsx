import AsyncStorage from "@react-native-async-storage/async-storage";

export type OrderStatus = "requested" | "completed" | "cancelled";

export type Order = {
  assignedTo?: string;
  id: string;
  items: string;
  placedAt: number;
  scheduledFor?: string;
  /** 0 placed, 1 accepted, 2 processing, 3 completed */
  stage: 0 | 1 | 2 | 3;
  status: OrderStatus;
  title: string;
  total: number;
};

const KEY = "angelfoods.orders";

export async function getOrders(): Promise<Order[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

type PlaceOrderLine = { name: string; quantity: number };

export async function placeOrder(
  lines: PlaceOrderLine[],
  total: number
): Promise<Order> {
  const orders = await getOrders();

  const first = lines[0];
  const extra = lines.length - 1;

  const order: Order = {
    id: String(Date.now()).slice(-6),
    items: lines.map((l) => `${l.name} x${l.quantity}`).join(", "),
    placedAt: Date.now(),
    stage: 0,
    status: "requested",
    title: extra > 0 ? `${first.name} + ${extra} more` : first.name,
    total,
  };

  await AsyncStorage.setItem(KEY, JSON.stringify([order, ...orders]));
  return order;
}