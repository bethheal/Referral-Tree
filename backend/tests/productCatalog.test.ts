import assert from "node:assert/strict";
import { customerProductWhere, toCustomerProduct, type CustomerProductRecord } from "../src/services/productCatalogService.ts";

const activeOnly = customerProductWhere();
assert.deepEqual(activeOnly, { status: "ACTIVE" }, "customer catalog filters out draft and archived products");

const searched = customerProductWhere("rice");
assert.equal(searched.status, "ACTIVE");
assert.deepEqual(searched.OR, [
  { sku: { contains: "rice", mode: "insensitive" } },
  { name: { contains: "rice", mode: "insensitive" } },
  { description: { contains: "rice", mode: "insensitive" } },
]);

const product: CustomerProductRecord = {
  id: "product-1",
  sku: "RICE-5KG",
  name: "Organic Rice",
  description: "Five kilogram bag",
  imageKey: "catalog/rice.webp",
  priceMinor: 18000n,
  currency: "GHS",
  inventoryCount: 3,
};
assert.deepEqual(toCustomerProduct(product), {
  id: "product-1",
  sku: "RICE-5KG",
  name: "Organic Rice",
  description: "Five kilogram bag",
  imageKey: "catalog/rice.webp",
  priceMinor: "18000",
  currency: "GHS",
  inStock: true,
});
assert.equal(toCustomerProduct({ ...product, inventoryCount: 0 }).inStock, false);
console.log("Customer product catalog query and serialization tests passed.");
