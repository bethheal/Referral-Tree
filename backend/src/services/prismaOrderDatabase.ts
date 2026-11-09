import { prisma } from "./prismaClient.ts";
import type { OrderDatabase, OrderTransaction } from "./orderService.ts";

const findOrder = async (key: string) => prisma.productOrder.findUnique({ where: { idempotencyKey: key }, include: { items: { select: { productId: true, skuSnapshot: true, nameSnapshot: true, quantity: true, unitPriceMinor: true, lineTotalMinor: true, currency: true } } } });

export const prismaOrderDatabase: OrderDatabase = {
  findOrder,
  transaction: <T>(work: (tx: OrderTransaction) => Promise<T>) => prisma.$transaction(async (tx) => work({
    findOrder: async (key) => tx.productOrder.findUnique({ where: { idempotencyKey: key }, include: { items: { select: { productId: true, skuSnapshot: true, nameSnapshot: true, quantity: true, unitPriceMinor: true, lineTotalMinor: true, currency: true } } } }),
    lockProducts: async (ids) => {
      // Lock in a stable order to serialize stock checks and avoid deadlocks for multi-item carts.
      for (const id of ids) await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE`;
    },
    expireHeldReservations: async (now) => { await tx.stockReservation.updateMany({ where: { status: "HELD", expiresAt: { lte: now } }, data: { status: "EXPIRED" } }); },
    getProducts: async (ids) => tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, sku: true, name: true, priceMinor: true, currency: true, inventoryCount: true, status: true } }),
    getHeldQuantities: async (ids, now) => {
      const rows = await tx.stockReservation.groupBy({ by: ["productId"], where: { productId: { in: ids }, status: "HELD", expiresAt: { gt: now } }, _sum: { quantity: true } });
      return new Map(rows.map((row) => [row.productId, row._sum.quantity ?? 0]));
    },
    createOrder: async (order) => { await tx.productOrder.create({ data: order }); },
    createItems: async (items) => { await tx.productOrderItem.createMany({ data: items }); },
    createReservations: async (rows) => { await tx.stockReservation.createMany({ data: rows }); },
    recordCreationAudit: async (data) => { await tx.auditLog.create({ data: { actorUserId: data.userId, targetType: "ORDER", targetId: data.orderId, action: "CUSTOMER_ORDER_CREATED", newValue: { orderId: data.orderId }, requestId: data.requestId, ipAddress: data.ipAddress } }); },
  })),
};
