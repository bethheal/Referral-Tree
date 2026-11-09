import assert from "node:assert/strict";
import { migrateCartItems, normalizeCartItems } from "../../components/cartModel.ts";
import { formatMinorCurrency, sumMinorCurrency } from "../../components/productMoney.ts";

const catalog = [
  { id: "prod-rice-01", name: "Organic Rice" },
  { id: "prod-oil-02", name: "Fresh Oil" },
];
const migration = migrateCartItems([
  { name: "organic rice", quantity: 2 },
  { name: "Fresh Oil", quantity: 1 },
  { productId: "prod-rice-01", quantity: 3 },
  { name: "Old product", quantity: 4 },
], catalog);
assert.deepEqual(migration.items, [
  { productId: "prod-rice-01", quantity: 5 },
  { productId: "prod-oil-02", quantity: 1 },
]);
assert.deepEqual(migration.unmatchedLegacy, [{ name: "Old product", quantity: 4 }]);
assert.deepEqual(normalizeCartItems([
  { productId: "prod-rice-01", quantity: 2 },
  { productId: "prod-rice-01", quantity: 1 },
  { productId: "", quantity: 5 },
  { productId: "prod-oil-02", quantity: 0 },
]), [{ productId: "prod-rice-01", quantity: 3 }]);

assert.equal(formatMinorCurrency("1250", "GHS"), "GH₵12.50");
assert.equal(formatMinorCurrency("900719925474099300", "GHS"), "GH₵9,007,199,254,740,993.00");
assert.equal(sumMinorCurrency(["1250", "250"]), 1500n);
assert.throws(() => formatMinorCurrency("12.50", "GHS"), /Invalid minor-unit price/);
console.log("Storefront cart identity migration and exact minor-unit money tests passed.");
