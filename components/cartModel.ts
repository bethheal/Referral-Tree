export type CartItem = { productId: string; quantity: number };
export type LegacyCartItem = { name: string; quantity: number };
export type CartProductIdentity = { id: string; name: string };

const isValidQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export const normalizeCartItems = (value: unknown): CartItem[] => {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { productId?: unknown; quantity?: unknown };
    if (typeof candidate.productId !== "string" || !candidate.productId.trim() || !isValidQuantity(candidate.quantity)) continue;
    const total = (quantities.get(candidate.productId) ?? 0) + candidate.quantity;
    if (Number.isSafeInteger(total)) quantities.set(candidate.productId, total);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
};

export const migrateCartItems = (value: unknown, products: readonly CartProductIdentity[]) => {
  const items = normalizeCartItems(value);
  const quantities = new Map(items.map(({ productId, quantity }) => [productId, quantity]));
  const unmatchedLegacy: LegacyCartItem[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as { name?: unknown; quantity?: unknown };
      if (typeof candidate.name !== "string" || !isValidQuantity(candidate.quantity)) continue;
      const normalizedName = candidate.name.trim().toLocaleLowerCase();
      const matches = products.filter((product) => product.name.trim().toLocaleLowerCase() === normalizedName);
      if (matches.length !== 1) {
        unmatchedLegacy.push({ name: candidate.name, quantity: candidate.quantity });
        continue;
      }
      const productId = matches[0]!.id;
      const total = (quantities.get(productId) ?? 0) + candidate.quantity;
      if (Number.isSafeInteger(total)) quantities.set(productId, total);
      else unmatchedLegacy.push({ name: candidate.name, quantity: candidate.quantity });
    }
  }
  return {
    items: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
    unmatchedLegacy,
  };
};
