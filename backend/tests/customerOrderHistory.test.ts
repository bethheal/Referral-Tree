import assert from "node:assert/strict";
import { loadAllPages, orderHistoryTab, orderStatusLabel, toCustomerOrderHistoryRow, type CustomerOrder } from "../../components/customerOrderHistory.ts";

const pageCalls: Array<{ limit: number; offset: number }> = [];
const allRows = await loadAllPages(async ({ limit, offset }) => {
  pageCalls.push({ limit, offset });
  const rows = Array.from({ length: Math.max(0, Math.min(50, 73 - offset)) }, (_, index) => offset + index);
  return { count: 73, rows };
});
assert.equal(allRows.length, 73);
assert.deepEqual(pageCalls, [{ limit: 50, offset: 0 }, { limit: 50, offset: 50 }]);

const customerOrder: CustomerOrder = {
  id: "database-order-id",
  orderNumber: "AF-2026-001",
  status: "PENDING_PAYMENT",
  currency: "GHS",
  subtotal: 12.34,
  tax: 0,
  discount: 0,
  shipping: 0,
  total: 12.34,
  createdAt: "2026-10-23T12:00:00.000Z",
  updatedAt: "2026-10-23T12:00:00.000Z",
  items: [{ id: "item-id", sku: "RICE", name: "Rice", quantity: 2, unitPrice: 6.17, lineTotal: 12.34, currency: "GHS" }],
};
const display = toCustomerOrderHistoryRow(customerOrder);
assert.equal(display.id, customerOrder.id, "server identity remains the stable row/detail key");
assert.equal(display.orderNumber, customerOrder.orderNumber);
assert.equal(display.tab, "requested");
assert.equal(display.statusLabel, "Awaiting payment");
assert.equal(display.itemsSummary, "Rice ×2");
assert.equal(display.total, 12.34);
assert.equal(orderHistoryTab("DELIVERED"), "completed");
assert.equal(orderHistoryTab("CANCELLED"), "cancelled");
assert.equal(orderStatusLabel("REFUND_PENDING"), "Refund pending");

console.log("Customer order history pagination, ownership-safe identity mapping, and server status labels passed.");
