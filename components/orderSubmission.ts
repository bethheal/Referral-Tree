import type { CartItem } from "./cartModel";

export type CustomerOrderPayload = { items: Array<{ productId: string; quantity: number }> };

export const buildCustomerOrderPayload = (items: readonly CartItem[]): CustomerOrderPayload => ({
  items: items.map(({ productId, quantity }) => ({ productId, quantity })),
});

export const reconcileCartItems = (current: readonly CartItem[], submitted: readonly CartItem[]) => {
  const submittedByProduct = new Map(submitted.map(({ productId, quantity }) => [productId, quantity]));
  return current.map(({ productId, quantity }) => ({ productId, quantity: Math.max(0, quantity - (submittedByProduct.get(productId) ?? 0)) })).filter(({ quantity }) => quantity > 0);
};

export const isDefinitiveOrderRejection = (status: number) => status >= 400 && status < 500;
