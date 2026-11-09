import { prisma } from "./prismaClient.ts";

/** Atomically expire only holds that are still HELD and already due. Safe to retry. */
export const expireStaleStockReservations = async (now = new Date(), productIds?: string[]) => {
  const result = await prisma.stockReservation.updateMany({
    where: { status: "HELD", expiresAt: { lte: now }, ...(productIds ? { productId: { in: productIds } } : {}) },
    data: { status: "EXPIRED" },
  });
  return result.count;
};

/**
 * Periodic, process-local sweeper. Multiple instances are safe: PostgreSQL's
 * conditional UPDATE and status predicate make each due row transition once.
 */
export const startStockReservationExpiryWorker = () => {
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const expiredCount = await expireStaleStockReservations();
      if (expiredCount > 0) console.info(JSON.stringify({ event: "stock_reservations_expired", count: expiredCount }));
    } catch {
      console.error(JSON.stringify({ event: "stock_reservation_expiry_failed" }));
    } finally {
      running = false;
    }
  };
  void sweep();
  const timer = setInterval(() => { void sweep(); }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
};
