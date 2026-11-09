import type { Prisma } from "../generated/prisma/client.ts";

export const customerProductWhere = (search?: string): Prisma.ProductWhereInput => ({
  status: "ACTIVE",
  ...(search
    ? {
        OR: [
          { sku: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }
    : {}),
});

export type CustomerProductRecord = {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageKey: string | null;
  priceMinor: bigint;
  currency: string;
  inventoryCount: number;
};

export const toCustomerProduct = (product: CustomerProductRecord) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  description: product.description,
  imageKey: product.imageKey,
  priceMinor: product.priceMinor.toString(),
  currency: product.currency,
  inStock: product.inventoryCount > 0,
});
