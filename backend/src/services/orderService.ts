import crypto from "node:crypto";

export type OrderLineInput = { productId: string; quantity: number };
export type OrderProduct = { id: string; sku: string; name: string; priceMinor: bigint; currency: string; inventoryCount: number; status: string };
export type OrderItemSnapshot = { productId: string | null; quantity: number; unitPriceMinor: bigint; currency: string };
export type ExistingOrder = { id: string; orderNumber: string; status: string; currency: string; totalMinor: bigint; items: OrderItemSnapshot[] };
export type NewOrder = { id: string; userId: string; orderNumber: string; status: "PENDING_PAYMENT"; currency: string; subtotalMinor: bigint; taxMinor: bigint; discountMinor: bigint; shippingMinor: bigint; totalMinor: bigint; idempotencyKey: string };
export type NewOrderItem = { orderId: string; productId: string; skuSnapshot: string; nameSnapshot: string; quantity: number; unitPriceMinor: bigint; taxMinor: bigint; discountMinor: bigint; lineTotalMinor: bigint; currency: string };
export type OrderTransaction = {
  findOrder(key: string): Promise<ExistingOrder | null>;
  lockProducts(ids: string[]): Promise<void>;
  expireHeldReservations(now: Date): Promise<void>;
  getProducts(ids: string[]): Promise<OrderProduct[]>;
  getHeldQuantities(ids: string[], now: Date): Promise<Map<string, number>>;
  createOrder(order: NewOrder): Promise<void>;
  createItems(items: NewOrderItem[]): Promise<void>;
  createReservations(rows: Array<{ orderId: string; productId: string; quantity: number; expiresAt: Date }>): Promise<void>;
  recordCreationAudit(data: { userId: string; orderId: string; requestId: string; ipAddress: string | null }): Promise<void>;
};
export type OrderDatabase = { findOrder(key: string): Promise<ExistingOrder | null>; transaction<T>(work: (tx: OrderTransaction) => Promise<T>): Promise<T> };

export class OrderServiceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) { super(message); this.status = status; this.code = code; }
}

const fail = (message: string, status: number, code: string): never => { throw new OrderServiceError(message, status, code); };
const keyFor = (userId: string, key: string) => crypto.createHash("sha256").update(`${userId}\0${key}`).digest("hex");
const MAX_PG_BIGINT = 9_223_372_036_854_775_807n;
const RESERVATION_TTL_MS = 15 * 60 * 1000;

const normalizeLines = (items: unknown): OrderLineInput[] => {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return fail("Order items are invalid.", 400, "INVALID_ORDER_ITEMS");
  const seen = new Set<string>();
  return items.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return fail("Order item is invalid.", 400, "INVALID_ORDER_ITEM");
    const item = row as Record<string, unknown>;
    if (Object.keys(item).some((key) => key !== "productId" && key !== "quantity")) return fail("Only product IDs and quantities are accepted.", 400, "UNTRUSTED_ORDER_FIELDS");
    if (typeof item.productId !== "string" || item.productId.length < 1 || item.productId.length > 128) return fail("Product ID is invalid.", 400, "INVALID_PRODUCT_ID");
    if (!Number.isSafeInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 1000) return fail("Quantity must be an integer from 1 to 1000.", 400, "INVALID_QUANTITY");
    if (seen.has(item.productId)) return fail("Each product may appear only once.", 400, "DUPLICATE_PRODUCT");
    seen.add(item.productId);
    return { productId: item.productId, quantity: item.quantity as number };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
};

const replayMatches = (order: ExistingOrder, lines: OrderLineInput[]) => {
  const old = order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })).sort((a, b) => String(a.productId).localeCompare(String(b.productId)));
  return old.length === lines.length && old.every((item, i) => item.productId === lines[i]?.productId && item.quantity === lines[i]?.quantity);
};

export const createCustomerOrder = async (args: {
  db: OrderDatabase; userId: string; idempotencyKey: string; items: unknown; requestId: string; ipAddress: string | null;
  now?: Date; createId: (prefix: string) => string;
}) => {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(args.idempotencyKey)) fail("A valid Idempotency-Key header is required.", 400, "INVALID_IDEMPOTENCY_KEY");
  const lines = normalizeLines(args.items);
  const now = args.now ?? new Date();
  const idempotencyKey = keyFor(args.userId, args.idempotencyKey);
  try { return await args.db.transaction(async (tx) => {
    const prior = await tx.findOrder(idempotencyKey);
    if (prior) {
      if (!replayMatches(prior, lines)) fail("This idempotency key was already used for a different order.", 409, "IDEMPOTENCY_KEY_REUSED");
      return { order: prior, replayed: true };
    }
    const productIds = lines.map((item) => item.productId);
    await tx.lockProducts(productIds);
    await tx.expireHeldReservations(now);
    // Recheck under locks. A simultaneous submission may have completed while this one waited.
    const raced = await tx.findOrder(idempotencyKey);
    if (raced) {
      if (!replayMatches(raced, lines)) fail("This idempotency key was already used for a different order.", 409, "IDEMPOTENCY_KEY_REUSED");
      return { order: raced, replayed: true };
    }
    const products = await tx.getProducts(productIds);
    const byId = new Map(products.map((product) => [product.id, product]));
    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product) return fail("One or more products are unavailable.", 404, "PRODUCT_NOT_FOUND");
      if (product.status !== "ACTIVE") fail("One or more products are unavailable.", 409, "PRODUCT_INACTIVE");
      if (product.priceMinor < 0n || product.priceMinor > MAX_PG_BIGINT) fail("Product price is unsupported.", 409, "INVALID_PRODUCT_PRICE");
      if (product.currency !== "GHS") fail("This order contains an unsupported currency.", 409, "UNSUPPORTED_CURRENCY");
    }
    const held = await tx.getHeldQuantities(productIds, now);
    for (const line of lines) {
      const product = byId.get(line.productId)!;
      if (line.quantity + (held.get(line.productId) ?? 0) > product.inventoryCount) fail("Insufficient stock for one or more products.", 409, "INSUFFICIENT_STOCK");
    }
    const itemRows: NewOrderItem[] = [];
    let subtotalMinor = 0n;
    for (const line of lines) {
      const product = byId.get(line.productId)!;
      const lineTotalMinor = product.priceMinor * BigInt(line.quantity);
      if (lineTotalMinor > MAX_PG_BIGINT || subtotalMinor + lineTotalMinor > MAX_PG_BIGINT) fail("Order total is outside the supported range.", 400, "ORDER_TOTAL_OUT_OF_RANGE");
      subtotalMinor += lineTotalMinor;
      itemRows.push({ orderId: "", productId: product.id, skuSnapshot: product.sku, nameSnapshot: product.name, quantity: line.quantity, unitPriceMinor: product.priceMinor, taxMinor: 0n, discountMinor: 0n, lineTotalMinor, currency: product.currency });
    }
    const orderId = args.createId("order");
    const orderNumber = args.createId("AF").toUpperCase();
    const order: NewOrder = { id: orderId, userId: args.userId, orderNumber, status: "PENDING_PAYMENT", currency: "GHS", subtotalMinor, taxMinor: 0n, discountMinor: 0n, shippingMinor: 0n, totalMinor: subtotalMinor, idempotencyKey };
    await tx.createOrder(order);
    await tx.createItems(itemRows.map((item) => ({ ...item, orderId })));
    await tx.createReservations(lines.map((line) => ({ orderId, productId: line.productId, quantity: line.quantity, expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS) })));
    await tx.recordCreationAudit({ userId: args.userId, orderId, requestId: args.requestId, ipAddress: args.ipAddress });
    return { order: { ...order, items: itemRows.map((item) => ({ ...item, orderId })) }, replayed: false };
  }); } catch (error) {
    // A reused key with a different cart can race on disjoint product locks. Resolve the
    // unique-key winner after rollback, returning it only for the identical cart.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const prior = await args.db.findOrder(idempotencyKey);
      if (prior) {
        if (!replayMatches(prior, lines)) fail("This idempotency key was already used for a different order.", 409, "IDEMPOTENCY_KEY_REUSED");
        return { order: prior, replayed: true };
      }
    }
    throw error;
  }
};
