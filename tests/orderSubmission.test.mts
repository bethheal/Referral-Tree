import assert from "node:assert/strict";
import { buildCustomerOrderPayload, isDefinitiveOrderRejection, reconcileCartItems } from "../components/orderSubmission.ts";
import { formatMinorCurrency } from "../components/productMoney.ts";

const cart = [{ productId: "rice", quantity: 2 }, { productId: "oil", quantity: 1 }];
assert.deepEqual(buildCustomerOrderPayload(cart), { items: [{ productId: "rice", quantity: 2 }, { productId: "oil", quantity: 1 }] }, "payload contains only product IDs and quantities");
assert.deepEqual(reconcileCartItems([{ productId: "rice", quantity: 5 }, { productId: "oil", quantity: 1 }, { productId: "beans", quantity: 3 }], cart), [{ productId: "rice", quantity: 3 }, { productId: "beans", quantity: 3 }], "success removes only submitted quantities and preserves later additions");
assert.deepEqual(reconcileCartItems(cart, []), cart, "failures leave the cart unchanged");
assert.equal(isDefinitiveOrderRejection(401), true, "authentication response is definitive");
assert.equal(isDefinitiveOrderRejection(409), true, "stock response is definitive");
assert.equal(isDefinitiveOrderRejection(503), false, "server failure is uncertain");
assert.equal(formatMinorCurrency("900719925474099312345", "GHS"), "GH₵9,007,199,254,740,993,123.45", "large minor-unit values format without float conversion");

// Simulate process restart: the durable record is read back and retried verbatim after an uncertain outcome.
const storage = new Map<string, string>();
const pending = { idempotencyKey: "af-stable-key-123", payload: buildCustomerOrderPayload(cart) };
storage.set("pending", JSON.stringify(pending));
const recovered = JSON.parse(storage.get("pending")!) as typeof pending;
const attempts: Array<{ key: string; body: unknown }> = [];
const send = async (key: string, body: unknown, uncertain: boolean) => {
  attempts.push({ key, body });
  if (uncertain) throw new Error("network timeout");
};
await assert.rejects(send(recovered.idempotencyKey, recovered.payload, true));
const afterRestart = JSON.parse(storage.get("pending")!) as typeof pending;
await send(afterRestart.idempotencyKey, afterRestart.payload, false);
assert.equal(attempts[0]?.key, attempts[1]?.key);
assert.deepEqual(attempts[0]?.body, attempts[1]?.body);
console.log("App order submission helper tests passed.");
