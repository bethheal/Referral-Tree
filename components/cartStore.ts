import AsyncStorage from "@react-native-async-storage/async-storage";

import { products } from "@/components/dashboardData";

const CART_STORAGE_KEY = "angelFoodsCart";

export type CartItem = {
  name: string;
  quantity: number;
};

const normalizeItems = (items: CartItem[]) =>
  items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      name: item.name,
      quantity: item.quantity,
    }));

export const getCartItems = async () => {
  const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);

  if (!savedCart) {
    return [];
  }

  try {
    return normalizeItems(JSON.parse(savedCart));
  } catch {
    return [];
  }
};

export const saveCartItems = async (items: CartItem[]) => {
  await AsyncStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify(normalizeItems(items))
  );
};

export const addCartItem = async (name: string) => {
  const items = await getCartItems();
  const existingItem = items.find((item) => item.name === name);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    items.push({ name, quantity: 1 });
  }

  await saveCartItems(items);
  return items;
};

export const removeCartItem = async (name: string) => {
  const items = (await getCartItems()).filter((item) => item.name !== name);
  await saveCartItems(items);
  return items;
};

export const updateCartItemQuantity = async (name: string, quantity: number) => {
  const items = (await getCartItems()).map((item) =>
    item.name === name ? { ...item, quantity } : item
  );

  await saveCartItems(items);
  return normalizeItems(items);
};

export const getCartProduct = (name: string) =>
  products.find((product) => product.name === name);
