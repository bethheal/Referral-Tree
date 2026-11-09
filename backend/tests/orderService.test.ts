import assert from "node:assert/strict";
import { createCustomerOrder, OrderServiceError, type ExistingOrder, type NewOrder, type NewOrderItem, type OrderDatabase, type OrderProduct, type OrderTransaction } from "../src/services/orderService.ts";

const products: OrderProduct[] = [
  { id: "rice", sku: "RICE", name: "Rice", priceMinor: 1250n, currency: "GHS", inventoryCount: 3, status: "ACTIVE" },
  { id: "oil", sku: "OIL", name: "Oil", priceMinor: 700n, currency: "GHS", inventoryCount: 1, status: "ACTIVE" },
];

class MemoryDb implements OrderDatabase {
  orders = new Map<string, ExistingOrder>();
  orderKeys = new Map<string, string>();
  reservations: Array<{ productId: string; quantity: number; expiresAt: Date }> = [];
  orderRows: NewOrder[] = [];
  items: NewOrderItem[] = [];
  failItems = false;
  async findOrder(key: string) { const id = this.orderKeys.get(key); return id ? this.orders.get(id) ?? null : null; }
  async transaction<T>(work: (tx: OrderTransaction) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({ orders: [...this.orders], orderKeys: [...this.orderKeys], reservations: this.reservations, orderRows: this.orderRows, items: this.items });
    const tx: OrderTransaction = {
      findOrder: async (key) => { const id = this.orderKeys.get(key); return id ? this.orders.get(id) ?? null : null; },
      lockProducts: async () => {},
      expireHeldReservations: async () => {},
      getProducts: async (ids) => products.filter((product) => ids.includes(product.id)),
      getHeldQuantities: async (ids, now) => {
        const totals = new Map<string, number>();
        for (const row of this.reservations) if (ids.includes(row.productId) && row.expiresAt > now) totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantity);
        return totals;
      },
      createOrder: async (order) => { this.orderRows.push(order); this.orders.set(order.id, { ...order, items: [] }); this.orderKeys.set(order.idempotencyKey, order.id); },
      createItems: async (rows) => { if (this.failItems) throw new Error("simulated insert failure"); this.items.push(...rows); const order = this.orders.get(rows[0]?.orderId ?? ""); if (order) order.items = rows.map((row) => ({ productId: row.productId, quantity: row.quantity, unitPriceMinor: row.unitPriceMinor, currency: row.currency })); },
      createReservations: async (rows) => { this.reservations.push(...rows); },
      recordCreationAudit: async () => {},
    };
    try { return await work(tx); }
    catch (error) {
      this.orders = new Map(snapshot.orders);
      this.orderKeys = new Map(snapshot.orderKeys);
      this.reservations = snapshot.reservations;
      this.orderRows = snapshot.orderRows;
      this.items = snapshot.items;
      throw error;
    }
  }
}

let sequence = 0;
const place = (db: MemoryDb, overrides: Partial<Parameters<typeof createCustomerOrder>[0]> = {}) => createCustomerOrder({
  db, userId: "customer-1", idempotencyKey: overrides.idempotencyKey ?? `request-${++sequence}`, items: [{ productId: "rice", quantity: 2 }], requestId: "request-id", ipAddress: null, now: new Date("2026-10-23T12:00:00Z"), createId: (prefix) => `${prefix}_${++sequence}`, ...overrides,
});
const rejectsCode = async (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof OrderServiceError && error.code === code);

const db = new MemoryDb();
const created = await place(db, { idempotencyKey: "request-12345" });
assert.equal(created.replayed, false);
assert.equal(db.orderRows[0]?.totalMinor, 2500n, "price comes from the product record, never the request");
assert.equal(db.orderRows[0]?.status, "PENDING_PAYMENT");
assert.equal(db.reservations[0]?.quantity, 2);
assert.equal(db.reservations[0]?.expiresAt.toISOString(), "2026-10-23T12:15:00.000Z");
assert.equal((await place(db, { idempotencyKey: "request-12345" })).replayed, true, "same user/key/cart returns the original order");
await rejectsCode(place(db, { idempotencyKey: "request-12345", items: [{ productId: "oil", quantity: 1 }] }), "IDEMPOTENCY_KEY_REUSED");
await rejectsCode(place(db, { idempotencyKey: "bad", items: [{ productId: "rice", quantity: 1 }] }), "INVALID_IDEMPOTENCY_KEY");
await rejectsCode(place(db, { items: [{ productId: "missing", quantity: 1 }] }), "PRODUCT_NOT_FOUND");
await rejectsCode(place(db, { items: [{ productId: "rice", quantity: 0 }] }), "INVALID_QUANTITY");
await rejectsCode(place(db, { items: [{ productId: "rice", quantity: 1.5 }] }), "INVALID_QUANTITY");
await rejectsCode(place(db, { items: [{ productId: "rice", quantity: 1, totalMinor: 1 } as never] }), "UNTRUSTED_ORDER_FIELDS");
await rejectsCode(place(db, { idempotencyKey: "tamper-12345", items: [{ productId: "rice", quantity: 1, priceMinor: 1 } as never] }), "UNTRUSTED_ORDER_FIELDS");
await rejectsCode(place(db, { items: [{ productId: "oil", quantity: 2 }] }), "INSUFFICIENT_STOCK");
await rejectsCode(place(db, { items: [{ productId: "rice", quantity: 1 }, { productId: "rice", quantity: 1 }] }), "DUPLICATE_PRODUCT");
products[1]!.status = "ARCHIVED";
await rejectsCode(place(db, { items: [{ productId: "oil", quantity: 1 }] }), "PRODUCT_INACTIVE");
products[1]!.status = "ACTIVE";
products[1]!.currency = "USD";
await rejectsCode(place(db, { items: [{ productId: "oil", quantity: 1 }] }), "UNSUPPORTED_CURRENCY");
products[1]!.currency = "GHS";

const failedDb = new MemoryDb();
failedDb.failItems = true;
await assert.rejects(place(failedDb));
assert.equal(failedDb.orderRows.length, 0, "failed item persistence rolls the transaction back");
assert.equal(failedDb.reservations.length, 0);

console.log("PostgreSQL order service validation, pricing, reservations, idempotency, and rollback tests passed (mocked transaction; no PostgreSQL connection).");
