import {
  CartItem,
  getCartItems,
  getCartProduct,
  removeCartItem,
  updateCartItemQuantity,
} from "@/components/cartStore";
import { formatGhs } from "@/components/dashboardData";
import PageHeader from "@/components/pageHeader";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { placeOrder } from "./orderStore";

export default function Cart() {
  const { width } = useWindowDimensions();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [placing, setPlacing] = useState(false);

  const horizontalPadding = width >= 620 ? 22 : 18;
  const isWide = width >= 760;

  const hydratedCartItems = useMemo(
    () =>
      cartItems
        .map((item) => ({
          ...item,
          product: getCartProduct(item.name),
        }))
        .filter((item) => item.product),
    [cartItems]
  );

  const subtotal = hydratedCartItems.reduce(
    (total, item) => total + (item.product?.price ?? 0) * item.quantity,
    0
  );
  const rewardsDiscount = subtotal >= 300 ? 20 : 0;
  const total = subtotal - rewardsDiscount;

  const loadCart = useCallback(() => {
    getCartItems().then(setCartItems);
  }, []);

  useFocusEffect(loadCart);

  const changeQuantity = async (name: string, quantity: number) => {
    const items = await updateCartItemQuantity(name, quantity);
    setCartItems(items);
  };

  const removeItem = async (name: string) => {
    const items = await removeCartItem(name);
    setCartItems(items);
  };

  const checkout = async () => {
    if (placing || hydratedCartItems.length === 0) return;
    setPlacing(true);

    try {
      await placeOrder(
        hydratedCartItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
        })),
        total
      );

      // clear the cart
      for (const item of cartItems) {
        await removeCartItem(item.name);
      }
      setCartItems([]);

      router.push("/dashboard/orders" as any);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.screen, { paddingHorizontal: horizontalPadding }]}>
        <PageHeader title="Cart" subtitle="Your Angel Foods cart" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {hydratedCartItems.length > 0 ? (
            <View style={[styles.cartLayout, isWide && styles.wideCartLayout]}>
              <View style={styles.cartItemsColumn}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      Shopping Bag ({hydratedCartItems.length})
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      Tap minus or remove to update your cart
                    </Text>
                  </View>
                </View>

                {hydratedCartItems.map((item) => {
                  const product = item.product;

                  if (!product) {
                    return null;
                  }

                  return (
                    <View key={item.name} style={styles.cartItemCard}>
                      <View
                        style={[
                          styles.itemImageWrap,
                          { backgroundColor: `${product.color}24` },
                        ]}
                      >
                        <Image source={{ uri: product.image }} style={styles.itemImage} />
                      </View>

                      <View style={styles.itemInfo}>
                        <Text numberOfLines={1} style={styles.itemName}>
                          {product.name}
                        </Text>

                        <Text numberOfLines={1} style={styles.itemUnit}>
                          {product.unit}
                        </Text>

                        <Text style={styles.itemPrice}>{formatGhs(product.price)}</Text>

                        <View style={styles.quantityRow}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() =>
                              changeQuantity(product.name, item.quantity - 1)
                            }
                            style={styles.quantityButton}
                          >
                            <FontAwesome6 name="minus" size={10} color="#C23122" />
                          </TouchableOpacity>

                          <Text style={styles.quantityText}>{item.quantity}</Text>

                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() =>
                              changeQuantity(product.name, item.quantity + 1)
                            }
                            style={styles.quantityButton}
                          >
                            <FontAwesome6 name="plus" size={10} color="#C23122" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.itemRight}>
                        <Text style={styles.lineTotal}>
                          {formatGhs(product.price * item.quantity)}
                        </Text>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => removeItem(product.name)}
                          style={styles.removeButton}
                        >
                          <FontAwesome6 name="trash" size={12} color="#C23122" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <FontAwesome6 name="receipt" size={16} color="#C23122" />
                </View>

                <Text style={styles.summaryTitle}>Order Summary</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>

                  <Text style={styles.summaryValue}>{formatGhs(subtotal)}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Rewards discount</Text>

                  <Text style={styles.discountValue}>
                    -{formatGhs(rewardsDiscount)}
                  </Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>

                  <Text style={styles.totalValue}>{formatGhs(total)}</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={placing}
                  onPress={checkout}
                  style={[styles.checkoutButton, placing && { opacity: 0.6 }]}
                >
                  <Text style={styles.checkoutButtonText}>
                    {placing ? "Placing order..." : "Proceed to Checkout"}
                  </Text>

                  <FontAwesome6 name="arrow-right" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCartCard}>
              <View style={styles.emptyIcon}>
                <FontAwesome6 name="cart-shopping" size={22} color="#C23122" />
              </View>

              <Text style={styles.emptyTitle}>Your cart is empty</Text>

              <Text style={styles.emptyText}>
                Add products from the shop to see them here.
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.replace("/dashboard/products" as any)}
                style={styles.shopButton}
              >
                <Text style={styles.shopButtonText}>Browse products</Text>

                <FontAwesome6 name="bag-shopping" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F2",
  },

  screen: {
    flex: 1,
    paddingTop: 14,
  },

  scrollContent: {
    paddingBottom: 120,
  },

  cartLayout: {
    gap: 14,
  },

  wideCartLayout: {
    alignItems: "flex-start",
    flexDirection: "row",
  },

  cartItemsColumn: {
    flex: 1,
    gap: 10,
  },

  sectionHeader: {
    marginBottom: 2,
  },

  sectionTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 17,
  },

  sectionSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 1,
  },

  cartItemCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    flexDirection: "row",
    padding: 11,
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  itemImageWrap: {
    alignItems: "center",
    borderRadius: 15,
    height: 82,
    justifyContent: "center",
    width: 74,
  },

  itemImage: {
    borderRadius: 12,
    height: 58,
    width: 54,
  },

  itemInfo: {
    flex: 1,
    marginLeft: 11,
  },

  itemName: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  itemUnit: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 1,
  },

  itemPrice: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    marginTop: 6,
  },

  quantityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  quantityButton: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 26,
    justifyContent: "center",
    width: 26,
  },

  quantityText: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    minWidth: 16,
    textAlign: "center",
  },

  itemRight: {
    alignItems: "flex-end",
    gap: 12,
  },

  lineTotal: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  removeButton: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 12,
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  summaryIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },

  summaryTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 17,
    marginTop: 12,
  },

  summaryRow: {
    alignItems: "center",
    borderBottomColor: "#F1E8E4",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },

  summaryLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
  },

  summaryValue: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  discountValue: {
    color: "#3A8B5D",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  totalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 14,
  },

  totalLabel: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  totalValue: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 20,
  },

  checkoutButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 14,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 14,
  },

  checkoutButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  emptyCartCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
  },

  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },

  emptyTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 18,
    marginTop: 14,
  },

  emptyText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: "center",
  },

  shopButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  shopButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },
});