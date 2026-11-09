import AsyncStorage from "@react-native-async-storage/async-storage";
import { migrateCartItems, normalizeCartItems, type CartItem, type CartProductIdentity } from "@/components/cartModel";
import { reconcileCartItems } from "@/components/orderSubmission";

const CART_STORAGE_KEY = "angelFoodsCart";
const LEGACY_CART_STORAGE_KEY = "angelFoodsCart.legacy-unmatched";
const PENDING_ORDER_KEY = "angelFoodsCart.pending-order";
export type { CartItem } from "@/components/cartModel";

export type PendingOrderSubmission = { idempotencyKey: string; payload: { items: CartItem[] } };
export const getPendingOrderSubmission = async (): Promise<PendingOrderSubmission | null> => {
  const raw = await AsyncStorage.getItem(PENDING_ORDER_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PendingOrderSubmission;
  if (!parsed?.idempotencyKey || !Array.isArray(parsed.payload?.items)) throw new Error("Saved order submission is unreadable; it was kept for safety.");
  return parsed;
};
export const savePendingOrderSubmission = (submission: PendingOrderSubmission) => AsyncStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(submission));
export const clearPendingOrderSubmission = () => AsyncStorage.removeItem(PENDING_ORDER_KEY);

export const reconcileSubmittedCart = async (submitted: readonly CartItem[]) => {
  const current = await getCartItems();
  const reconciled = reconcileCartItems(current, submitted);
  await saveCartItems(reconciled);
  return reconciled.filter((item) => item.quantity > 0);
};

export const getCartItems = async (products: readonly CartProductIdentity[] = []): Promise<CartItem[]> => {
  const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
  if (!savedCart) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(savedCart);
    const migration = migrateCartItems(parsed, products);
    if (Array.isArray(parsed) && parsed.some((item) => item && typeof item === "object" && "name" in item)) {
      if (migration.unmatchedLegacy.length > 0) {
        const previousRaw = await AsyncStorage.getItem(LEGACY_CART_STORAGE_KEY);
        const previous: unknown = previousRaw ? JSON.parse(previousRaw) : [];
        const retained = Array.isArray(previous) ? previous : [];
        await AsyncStorage.setItem(LEGACY_CART_STORAGE_KEY, JSON.stringify([...retained, ...migration.unmatchedLegacy]));
      }
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(migration.items));
    }
    return migration.items;
  } catch {
    return [];
  }
};

export const saveCartItems = async (items: CartItem[]) => {
  await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizeCartItems(items)));
};

export const addCartItem = async (productId: string) => {
  if (!productId.trim()) throw new TypeError("A product ID is required.");
  const items = await getCartItems();
  const existingItem = items.find((item) => item.productId === productId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    items.push({ productId, quantity: 1 });
  }

  await saveCartItems(items);
  return items;
};

export const removeCartItem = async (productId: string) => {
  const items = (await getCartItems()).filter((item) => item.productId !== productId);
  await saveCartItems(items);
  return items;
};

export const updateCartItemQuantity = async (productId: string, quantity: number) => {
  if (!Number.isSafeInteger(quantity)) throw new TypeError("Cart quantity must be a whole number.");
  const items = (await getCartItems()).map((item) =>
    item.productId === productId ? { ...item, quantity } : item
  );

  await saveCartItems(items);
  return normalizeCartItems(items);
};

export const getUnmatchedLegacyCartCount = async () => {
  const raw = await AsyncStorage.getItem(LEGACY_CART_STORAGE_KEY);
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};
