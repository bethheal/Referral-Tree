export type OrderHistoryTab = "requested" | "completed" | "cancelled";
export type CustomerOrderStatus = "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELLED" | "REFUND_PENDING" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type CustomerOrderItem = { id: string; sku: string; name: string; quantity: number; unitPrice: number; lineTotal: number; currency: string };
export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  shipping: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: CustomerOrderItem[];
};
export type CustomerOrderDetail = CustomerOrder & {
  statusHistory: Array<{ status: CustomerOrderStatus; reason: string | null; createdAt: string }>;
};

export type CustomerOrderHistoryRow = {
  id: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  statusLabel: string;
  tab: OrderHistoryTab;
  createdAt: number;
  itemsSummary: string;
  total: number;
  currency: string;
};

const statusLabels: Record<CustomerOrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "On the way",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund pending",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
};

export const orderStatusLabel = (status: CustomerOrderStatus) => statusLabels[status];

export const orderHistoryTab = (status: CustomerOrderStatus): OrderHistoryTab => {
  if (status === "DELIVERED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "requested";
};

export const toCustomerOrderHistoryRow = (order: CustomerOrder): CustomerOrderHistoryRow => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  statusLabel: orderStatusLabel(order.status),
  tab: orderHistoryTab(order.status),
  createdAt: Date.parse(order.createdAt),
  itemsSummary: order.items.map((item) => `${item.name} ×${item.quantity}`).join(", "),
  total: order.total,
  currency: order.currency,
});

export const loadAllPages = async <T>(loadPage: (input: { limit: number; offset: number }) => Promise<{ count: number; rows: T[] }>) => {
  const pageSize = 50;
  const first = await loadPage({ limit: pageSize, offset: 0 });
  const rows = [...first.rows];
  while (rows.length < first.count) {
    const next = await loadPage({ limit: pageSize, offset: rows.length });
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  return rows;
};
