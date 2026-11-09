import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "../src/server.ts";
import { prisma } from "../src/services/prismaClient.ts";
import { createCustomerOrder, type OrderDatabase } from "../src/services/orderService.ts";
import { prismaOrderDatabase } from "../src/services/prismaOrderDatabase.ts";
import { expireStaleStockReservations } from "../src/services/stockReservationExpiry.ts";
import { createId, hashPassword, hashSessionToken, signToken } from "../src/utils/crypto.ts";
import { validateDatabaseEnvironment } from "../src/utils/databaseSafety.ts";

const database = validateDatabaseEnvironment();
assert.equal(database.target, "angelfoods-dev", "order integration tests are development-only");

const runId = randomUUID();
const fixtureUserIds = Array.from({ length: 7 }, () => createId("order-integration-user"));
const fixtureProductIds = Array.from({ length: 5 }, () => createId("order-integration-product"));
const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const tokens = fixtureUserIds.map((id) => signToken({ sub: id, role: "USER" }));
const fixtureRequestIds: string[] = [];
const observedAuditCalls: Array<{ userId: string; orderId: string }> = [];
const testOrderDatabase: OrderDatabase = {
  findOrder: prismaOrderDatabase.findOrder,
  transaction: (work) => prismaOrderDatabase.transaction((tx) => work({
    ...tx,
    // AuditLog is append-only for the application role. Keep disposable fixture audit intent in memory.
    recordCreationAudit: async ({ userId, orderId }) => { observedAuditCalls.push({ userId, orderId }); },
  })),
};
const server = createServer({ orderDatabase: testOrderDatabase });
let serverStarted = false;

const run = async () => {
  const privileges = await prisma.$queryRaw<Array<Record<string, boolean>>>`
    SELECT
      has_table_privilege(current_user, 'public."User"', 'SELECT') AS user_select,
      has_table_privilege(current_user, 'public."User"', 'INSERT') AS user_insert,
      has_table_privilege(current_user, 'public."User"', 'DELETE') AS user_delete,
      has_table_privilege(current_user, 'public."Session"', 'SELECT') AS session_select,
      has_table_privilege(current_user, 'public."Session"', 'INSERT') AS session_insert,
      has_table_privilege(current_user, 'public."Product"', 'SELECT') AS product_select,
      has_table_privilege(current_user, 'public."Product"', 'INSERT') AS product_insert,
      has_table_privilege(current_user, 'public."Product"', 'DELETE') AS product_delete,
      has_table_privilege(current_user, 'public."ProductOrder"', 'SELECT') AS order_select,
      has_table_privilege(current_user, 'public."ProductOrder"', 'INSERT') AS order_insert,
      has_table_privilege(current_user, 'public."ProductOrder"', 'DELETE') AS order_delete,
      has_table_privilege(current_user, 'public."ProductOrderItem"', 'SELECT') AS item_select,
      has_table_privilege(current_user, 'public."ProductOrderItem"', 'INSERT') AS item_insert,
      has_table_privilege(current_user, 'public."StockReservation"', 'SELECT') AS reservation_select,
      has_table_privilege(current_user, 'public."StockReservation"', 'INSERT') AS reservation_insert,
      has_table_privilege(current_user, 'public."StockReservation"', 'UPDATE') AS reservation_update,
      has_table_privilege(current_user, 'public."AuditLog"', 'SELECT') AS audit_select,
      has_table_privilege(current_user, 'public."AuditLog"', 'INSERT') AS audit_insert
  `;
  const missingPrivileges = Object.entries(privileges[0] ?? {}).filter(([, allowed]) => !allowed).map(([name]) => name);
  if (missingPrivileges.length) throw new Error(`Development integration role lacks required test/cleanup privileges: ${missingPrivileges.join(", ")}. No fixtures were created.`);

  for (let index = 0; index < fixtureUserIds.length; index += 1) {
    const id = fixtureUserIds[index]!;
    await prisma.user.create({ data: {
      id,
      fullName: "Order Integration Customer",
      email: `order-integration-${runId}-${index}@example.invalid`,
      passwordHash: hashPassword(`Integration-${randomUUID()}-Password!`),
      referralCode: `OI${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      role: "USER",
      status: "ACTIVE",
      profile: { create: {} },
      preferences: { create: {} },
      sessions: { create: { tokenHash: hashSessionToken(tokens[index]!), expiresAt: new Date(Date.now() + 60 * 60_000) } },
    } });
    createdUserIds.push(id);
  }

  const productSeeds = [
    { name: "Order integration rice", priceMinor: 1234n, inventoryCount: 3, status: "ACTIVE" as const },
    { name: "Order integration archived", priceMinor: 500n, inventoryCount: 8, status: "DRAFT" as const },
    { name: "Order integration concurrency", priceMinor: 200n, inventoryCount: 1, status: "ACTIVE" as const },
    { name: "Order integration idempotency", priceMinor: 725n, inventoryCount: 10, status: "ACTIVE" as const },
    { name: "Order integration rollback", priceMinor: 999n, inventoryCount: 4, status: "ACTIVE" as const },
  ];
  for (let index = 0; index < productSeeds.length; index += 1) {
    const seed = productSeeds[index]!;
    await prisma.product.create({ data: {
      id: fixtureProductIds[index]!, sku: `OI-${runId}-${index}`, name: seed.name,
      priceMinor: seed.priceMinor, currency: "GHS", inventoryCount: seed.inventoryCount, status: seed.status,
    } });
    createdProductIds.push(fixtureProductIds[index]!);
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { serverStarted = true; resolve(); });
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (userIndex: number | null, items: unknown, key: string, extra: Record<string, unknown> = {}) => {
    const requestId = `order-it-${runId}-${fixtureRequestIds.length}`;
    fixtureRequestIds.push(requestId);
    return fetch(`${base}/api/me/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-Request-Id": requestId,
        ...(userIndex === null ? {} : { Authorization: `Bearer ${tokens[userIndex]!}` }),
      },
      body: JSON.stringify({ items, ...extra }),
    });
  };
  const orderIdFrom = async (response: Response) => (await response.json() as { id: string }).id;

  // Persisted order and item prices are snapshots from PostgreSQL, with no client total accepted.
  const success = await post(0, [{ productId: fixtureProductIds[0], quantity: 2 }], "success-key-0001");
  assert.equal(success.status, 201);
  const successPayload = await success.json() as { id: string; status: string; currency: string; totalMinor: string; replayed: boolean; items: Array<{ sku: string; name: string; quantity: number; unitPriceMinor: string; lineTotalMinor: string }> };
  assert.equal(successPayload.status, "PENDING_PAYMENT");
  assert.equal(successPayload.currency, "GHS");
  assert.equal(successPayload.totalMinor, "2468");
  assert.equal(successPayload.replayed, false);
  assert.equal(successPayload.items[0]?.unitPriceMinor, "1234");
  assert.equal(successPayload.items[0]?.lineTotalMinor, "2468");
  const savedOrder = await prisma.productOrder.findUniqueOrThrow({ where: { id: successPayload.id }, include: { items: true, reservations: true } });
  assert.equal(savedOrder.userId, fixtureUserIds[0]);
  assert.equal(savedOrder.items[0]?.skuSnapshot, `OI-${runId}-0`);
  assert.equal(savedOrder.items[0]?.nameSnapshot, "Order integration rice");
  assert.equal(savedOrder.items[0]?.unitPriceMinor, 1234n);
  assert.equal(savedOrder.reservations[0]?.quantity, 2);
  assert.equal(savedOrder.reservations[0]?.status, "HELD");
  assert.ok(savedOrder.reservations[0]!.expiresAt.getTime() > Date.now());
  assert.ok(savedOrder.reservations[0]!.expiresAt.getTime() <= Date.now() + 15 * 60_000 + 5_000);
  assert.ok(observedAuditCalls.some((entry) => entry.userId === fixtureUserIds[0] && entry.orderId === savedOrder.id));

  for (const body of [
    { items: [{ productId: fixtureProductIds[0], quantity: 1, unitPriceMinor: "1" }] },
    { items: [{ productId: fixtureProductIds[0], quantity: 1 }], totalMinor: "1" },
    { items: [{ productId: fixtureProductIds[0], quantity: 1 }], userId: fixtureUserIds[1] },
  ]) {
    const response = await post(1, body.items, `tamper-${randomUUID()}`, Object.fromEntries(Object.entries(body).filter(([key]) => key !== "items")));
    assert.equal(response.status, 400);
  }
  const inactive = await post(1, [{ productId: fixtureProductIds[1], quantity: 1 }], "inactive-key-001");
  assert.equal(inactive.status, 409);
  const missing = await post(1, [{ productId: "missing-order-integration-product", quantity: 1 }], "missing-key-001");
  assert.equal(missing.status, 404);
  const insufficient = await post(1, [{ productId: fixtureProductIds[0], quantity: 2 }], "insufficient-key-01");
  assert.equal(insufficient.status, 409, "existing two-unit hold leaves only one unit available");

  // Two independent HTTP requests and PostgreSQL connections compete for one unit.
  const concurrentStock = await Promise.all([
    post(2, [{ productId: fixtureProductIds[2], quantity: 1 }], "stock-race-key-001"),
    post(3, [{ productId: fixtureProductIds[2], quantity: 1 }], "stock-race-key-002"),
  ]);
  assert.deepEqual(concurrentStock.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await prisma.stockReservation.count({ where: { productId: fixtureProductIds[2], status: "HELD", expiresAt: { gt: new Date() } } }), 1);

  const repeatKey = "repeat-order-key-001";
  const firstRepeat = await post(4, [{ productId: fixtureProductIds[3], quantity: 2 }], repeatKey);
  const secondRepeat = await post(4, [{ productId: fixtureProductIds[3], quantity: 2 }], repeatKey);
  assert.equal(firstRepeat.status, 201);
  assert.equal(secondRepeat.status, 200);
  assert.equal(await orderIdFrom(firstRepeat), await orderIdFrom(secondRepeat));
  assert.equal(await prisma.productOrder.count({ where: { userId: fixtureUserIds[4] } }), 1);

  const duplicateKey = "simultaneous-key-001";
  const simultaneousDuplicates = await Promise.all([
    post(5, [{ productId: fixtureProductIds[3], quantity: 3 }], duplicateKey),
    post(5, [{ productId: fixtureProductIds[3], quantity: 3 }], duplicateKey),
  ]);
  assert.deepEqual(simultaneousDuplicates.map((response) => response.status).sort(), [200, 201]);
  assert.equal(await orderIdFrom(simultaneousDuplicates[0]!), await orderIdFrom(simultaneousDuplicates[1]!));
  assert.equal(await prisma.productOrder.count({ where: { userId: fixtureUserIds[5] } }), 1);
  assert.equal(await prisma.stockReservation.count({ where: { productId: fixtureProductIds[3], status: "HELD", expiresAt: { gt: new Date() } } }), 2, "one reservation row is created per idempotent order");
  const heldUnits = await prisma.stockReservation.aggregate({ where: { productId: fixtureProductIds[3], status: "HELD", expiresAt: { gt: new Date() } }, _sum: { quantity: true } });
  assert.equal(heldUnits._sum.quantity, 5, "the sequential and simultaneous requests reserve only their intended quantities");

  // Stale holds transition once to EXPIRED and stop reserving capacity. Cleanup is retryable.
  const expiryOrder = await post(6, [{ productId: fixtureProductIds[0], quantity: 1 }], "expiry-order-key-001");
  assert.equal(expiryOrder.status, 201);
  const expiryOrderId = await orderIdFrom(expiryOrder);
  await prisma.stockReservation.updateMany({ where: { productId: fixtureProductIds[0], status: "HELD" }, data: { expiresAt: new Date(Date.now() - 1_000) } });
  const firstSweepCount = await expireStaleStockReservations(new Date(), [fixtureProductIds[0]!]);
  assert.equal(firstSweepCount, 2, "both due holds for the product should expire exactly once");
  assert.equal(await expireStaleStockReservations(new Date(), [fixtureProductIds[0]!]), 0, "repeated cleanup is a no-op");
  assert.equal(await prisma.stockReservation.count({ where: { orderId: { in: [savedOrder.id, expiryOrderId] }, status: "EXPIRED" } }), 2);
  const afterExpiry = await post(6, [{ productId: fixtureProductIds[0], quantity: 3 }], "after-expiry-key-001");
  assert.equal(afterExpiry.status, 201);
  const afterExpiryId = await orderIdFrom(afterExpiry);
  await prisma.stockReservation.updateMany({ where: { orderId: afterExpiryId, status: "HELD" }, data: { expiresAt: new Date(Date.now() - 1_000) } });
  const lazyExpiry = await post(6, [{ productId: fixtureProductIds[0], quantity: 3 }], "lazy-expiry-key-001");
  assert.equal(lazyExpiry.status, 201, "order transaction expires due holds before calculating availability");
  assert.equal((await prisma.stockReservation.findFirstOrThrow({ where: { orderId: afterExpiryId } })).status, "EXPIRED");
  const lazyExpiryId = await orderIdFrom(lazyExpiry);
  await prisma.stockReservation.updateMany({ where: { orderId: lazyExpiryId, status: "HELD" }, data: { expiresAt: new Date(Date.now() - 1_000) } });
  assert.equal(await expireStaleStockReservations(new Date(), [fixtureProductIds[0]!]), 1);

  // Race cleanup against a valid terminal transition; either winner is safe and the loser cannot overwrite it.
  const raceOrderResponse = await post(6, [{ productId: fixtureProductIds[0], quantity: 1 }], "expiry-race-key-001");
  assert.equal(raceOrderResponse.status, 201);
  const raceOrderId = await orderIdFrom(raceOrderResponse);
  const raceReservation = await prisma.stockReservation.findFirstOrThrow({ where: { orderId: raceOrderId } });
  await prisma.stockReservation.update({ where: { id: raceReservation.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
  const [raceSweepCount, raceRelease] = await Promise.all([
    expireStaleStockReservations(new Date(), [fixtureProductIds[0]!]),
    prisma.stockReservation.updateMany({ where: { id: raceReservation.id, status: "HELD" }, data: { status: "RELEASED" } }),
  ]);
  const raceFinal = await prisma.stockReservation.findUniqueOrThrow({ where: { id: raceReservation.id } });
  assert.ok(["EXPIRED", "RELEASED"].includes(raceFinal.status));
  assert.equal(raceFinal.status, raceSweepCount === 1 ? "EXPIRED" : "RELEASED");
  if (raceFinal.status === "EXPIRED") assert.equal(raceRelease.count, 0);
  else assert.equal(raceRelease.count, 1);

  // Cleanup never changes holds that have already reached a terminal state.
  await prisma.stockReservation.update({ where: { id: raceReservation.id }, data: { status: "COMMITTED", expiresAt: new Date(Date.now() - 1_000) } });
  assert.equal(await expireStaleStockReservations(new Date(), [fixtureProductIds[0]!]), 0);
  assert.equal((await prisma.stockReservation.findUniqueOrThrow({ where: { id: raceReservation.id } })).status, "COMMITTED");
  await prisma.stockReservation.update({ where: { id: raceReservation.id }, data: { status: "RELEASED" } });
  assert.equal(await expireStaleStockReservations(new Date(), [fixtureProductIds[0]!]), 0);
  assert.equal((await prisma.stockReservation.findUniqueOrThrow({ where: { id: raceReservation.id } })).status, "RELEASED");

  const unauthenticated = await post(null, [{ productId: fixtureProductIds[4], quantity: 1 }], "unauthenticated-001");
  assert.equal(unauthenticated.status, 401);
  const otherOwner = await fetch(`${base}/api/me/orders/${successPayload.id}`, { headers: { Authorization: `Bearer ${tokens[1]!}` } });
  assert.equal(otherOwner.status, 404);

  // Inject a failure after real order and item inserts, within the real Prisma transaction.
  const failingDatabase: OrderDatabase = {
    findOrder: prismaOrderDatabase.findOrder,
    transaction: (work) => prismaOrderDatabase.transaction((tx) => work({
      ...tx,
      createItems: async (rows) => { await tx.createItems(rows); throw new Error("injected order integration failure"); },
    })),
  };
  const beforeRollbackCount = await prisma.productOrder.count({ where: { userId: fixtureUserIds[6] } });
  const beforeRollbackAudits = observedAuditCalls.length;
  await assert.rejects(createCustomerOrder({
    db: failingDatabase,
    userId: fixtureUserIds[6]!,
    idempotencyKey: "rollback-order-key-001",
    items: [{ productId: fixtureProductIds[4], quantity: 1 }],
    requestId: `rollback-${runId}`,
    ipAddress: null,
    createId,
  }), /injected order integration failure/);
  assert.equal(await prisma.productOrder.count({ where: { userId: fixtureUserIds[6] } }), beforeRollbackCount);
  assert.equal(await prisma.stockReservation.count({ where: { productId: fixtureProductIds[4] } }), 0);
  assert.equal(observedAuditCalls.length, beforeRollbackAudits, "failed transaction did not emit committed audit intent");

  // Verify the production transaction adapter persists the order audit row. The append-only
  // row is intentionally retained; user deletion later sets its actor reference to null.
  const auditServer = createServer();
  await new Promise<void>((resolve, reject) => {
    auditServer.once("error", reject);
    auditServer.listen(0, "127.0.0.1", () => resolve());
  });
  const auditAddress = auditServer.address();
  assert.ok(auditAddress && typeof auditAddress !== "string");
  try {
    const auditResponse = await fetch(`http://127.0.0.1:${auditAddress.port}/api/me/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "audit-order-key-001", Authorization: `Bearer ${tokens[0]!}` },
      body: JSON.stringify({ items: [{ productId: fixtureProductIds[4], quantity: 1 }] }),
    });
    assert.equal(auditResponse.status, 201);
    const auditOrder = await auditResponse.json() as { id: string };
    const requestId = auditResponse.headers.get("x-request-id");
    assert.ok(requestId, "backend returns the generated request identifier");
    const persistedAudit = await prisma.auditLog.findFirst({ where: { action: "CUSTOMER_ORDER_CREATED", targetType: "ORDER", targetId: auditOrder.id } });
    assert.ok(persistedAudit, "production order path persisted its audit record");
    assert.equal(persistedAudit.actorUserId, fixtureUserIds[0]);
    assert.equal(persistedAudit.requestId, requestId);
    assert.deepEqual(persistedAudit.newValue, { orderId: auditOrder.id });
  } finally {
    await new Promise<void>((resolve) => auditServer.close(() => resolve()));
  }

  console.log("Order PostgreSQL integration passed: order snapshots, stock/idempotency/auth checks, expiry cleanup/retry/race/terminal-state protection, transaction rollback, and persisted audit association (one append-only audit fixture retained).");
};

try {
  await run();
} finally {
  if (serverStarted) await new Promise<void>((resolve) => server.close(() => resolve()));
  // Remove only successfully created test fixtures. Continue cleanup if one grant is missing.
  let cleanupBlocked = false;
  const cleanup = async (action: () => Promise<unknown>, label: string) => {
    try { await action(); } catch { cleanupBlocked = true; console.error(`Order test cleanup could not remove its ${label} fixtures.`); }
  };
  if (createdUserIds.length) {
    await cleanup(() => prisma.productOrder.deleteMany({ where: { userId: { in: createdUserIds } } }), "order");
  }
  if (createdProductIds.length) await cleanup(() => prisma.product.deleteMany({ where: { id: { in: createdProductIds } } }), "product");
  if (createdUserIds.length) await cleanup(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), "user");
  await cleanup(() => prisma.$disconnect(), "database connection");
  if (cleanupBlocked) process.exitCode = 1;
}
