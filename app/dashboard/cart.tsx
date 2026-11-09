import {
  getCartItems,
  getUnmatchedLegacyCartCount,
  removeCartItem,
  updateCartItemQuantity,
} from "@/components/cartStore";
import type { CartItem } from "@/components/cartStore";
import { ApiError, createCustomerOrder, getAllCustomerOrders, getAllCustomerProducts, type CreateCustomerOrderResponse, type CustomerProduct } from "@/components/backendApi";
import { clearPendingOrderSubmission, getPendingOrderSubmission, reconcileSubmittedCart, savePendingOrderSubmission } from "@/components/cartStore";
import { formatMinorCurrency } from "@/components/productMoney";
import { buildCustomerOrderPayload, isDefinitiveOrderRejection } from "@/components/orderSubmission";
import PageHeader from "@/components/pageHeader";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export default function Cart() {
  const { width } = useWindowDimensions();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<CustomerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unmatchedLegacyCount, setUnmatchedLegacyCount] = useState(0);
  const [pendingOrder, setPendingOrder] = useState<Awaited<ReturnType<typeof getPendingOrderSubmission>>>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<CreateCustomerOrderResponse | null>(null);
  const checkoutLock = useRef(false);

  const horizontalPadding = width >= 620 ? 22 : 18;
  const isWide = width >= 760;

  const hydratedCartItems = useMemo(
    () =>
      cartItems
        .map((item) => ({
          ...item,
          product: products.find((product) => product.id === item.productId) ?? null,
        })),
    [cartItems, products]
  );

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const item of hydratedCartItems) {
      if (!item.product) continue;
      totals.set(item.product.currency, (totals.get(item.product.currency) ?? 0n) + BigInt(item.product.priceMinor) * BigInt(item.quantity));
    }
    return [...totals.entries()];
  }, [hydratedCartItems]);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const catalog = await getAllCustomerProducts();
      setProducts(catalog.rows);
      setCartItems(await getCartItems(catalog.rows));
      setUnmatchedLegacyCount(await getUnmatchedLegacyCartCount());
      setPendingOrder(await getPendingOrderSubmission());
    } catch {
      setError("We couldn't load current product prices. Retry before reviewing your cart.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadCart(); }, [loadCart]));

  const changeQuantity = async (productId: string, quantity: number) => {
    const items = await updateCartItemQuantity(productId, quantity);
    setCartItems(items);
  };

  const removeItem = async (productId: string) => {
    const items = await removeCartItem(productId);
    setCartItems(items);
  };

  const submitOrder = async () => {
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setCheckoutBusy(true);
    setCheckoutMessage("");
    setConfirmedOrder(null);
    try {
      let submission = pendingOrder;
      if (!submission) {
        const items = cartItems.filter((item) => products.some((product) => product.id === item.productId && product.inStock)).map(({ productId, quantity }) => ({ productId, quantity }));
        if (items.length === 0) { setCheckoutMessage("Your cart has no available items to order."); return; }
        submission = { idempotencyKey: `af-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`, payload: buildCustomerOrderPayload(items) };
        await savePendingOrderSubmission(submission);
        setPendingOrder(submission);
      }
      const order = await createCustomerOrder(submission.payload, submission.idempotencyKey);
      setConfirmedOrder(order);
      try {
        const cart = await reconcileSubmittedCart(submission.payload.items);
        setCartItems(cart);
        await clearPendingOrderSubmission();
        setPendingOrder(null);
      } catch {
        setCheckoutMessage("Your order is confirmed, but the cart could not be updated on this device. Retry the saved request to safely finish syncing it.");
      }
      try { await getAllCustomerOrders(); } catch { /* History refresh can be retried on the Orders screen. */ }
    } catch (cause) {
      if (cause instanceof ApiError && isDefinitiveOrderRejection(cause.status)) {
        await clearPendingOrderSubmission();
        setPendingOrder(null);
        if (cause.status === 401) setCheckoutMessage("Your session has expired. Sign in again, then submit your order.");
        else if (cause.code === "INSUFFICIENT_STOCK") setCheckoutMessage("Some items are no longer available in the requested quantities. Your cart is unchanged.");
        else setCheckoutMessage(`${cause.message} Your cart is unchanged.`);
      } else {
        setCheckoutMessage("We couldn't confirm whether the order was created. Your cart is unchanged. Retry to safely check using the same saved request.");
      }
    } finally {
      checkoutLock.current = false;
      setCheckoutBusy(false);
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
          {error ? <View style={styles.catalogError}><Text style={styles.emptyText}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void loadCart()} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></View> : null}
          {unmatchedLegacyCount > 0 ? <Text style={styles.legacyNotice}>{unmatchedLegacyCount} old cart item(s) could not be matched to current products and were preserved on this device.</Text> : null}
          {loading && products.length === 0 ? (
            <View style={styles.loadingState}><ActivityIndicator color="#192536" /><Text style={styles.emptyText}>Loading current product prices…</Text></View>
          ) : !error && hydratedCartItems.length > 0 ? (
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
                    return <View key={item.productId} style={styles.cartItemCard}><View style={styles.itemInfo}><Text style={styles.itemName}>Product unavailable</Text><Text style={styles.itemUnit}>This item is no longer in the active catalog.</Text></View><TouchableOpacity accessibilityRole="button" onPress={() => void removeItem(item.productId)} style={styles.removeButton}><FontAwesome6 name="trash" size={12} color="#192536" /></TouchableOpacity></View>;
                  }

                  return (
                    <View key={item.productId} style={styles.cartItemCard}>
                      <View
                        style={[
                          styles.itemImageWrap,
                        ]}
                      >
                        <FontAwesome6 name="basket-shopping" size={22} color="#192536" />
                      </View>

                      <View style={styles.itemInfo}>
                        <Text numberOfLines={1} style={styles.itemName}>
                          {product.name}
                        </Text>

                        <Text numberOfLines={1} style={styles.itemUnit}>
                          {product.sku} · {product.inStock ? "In stock" : "Out of stock"}
                        </Text>

                        <Text style={styles.itemPrice}>{formatMinorCurrency(product.priceMinor, product.currency)}</Text>

                        <View style={styles.quantityRow}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() =>
                              void changeQuantity(product.id, item.quantity - 1)
                            }
                            style={styles.quantityButton}
                          >
                            <FontAwesome6 name="minus" size={10} color="#192536" />
                          </TouchableOpacity>

                          <Text style={styles.quantityText}>{item.quantity}</Text>

                          <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={!product.inStock}
                            onPress={() => void changeQuantity(product.id, item.quantity + 1)}
                            style={styles.quantityButton}
                          >
                            <FontAwesome6 name="plus" size={10} color="#192536" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.itemRight}>
                        <Text style={styles.lineTotal}>
                          {formatMinorCurrency((BigInt(product.priceMinor) * BigInt(item.quantity)).toString(), product.currency)}
                        </Text>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => void removeItem(product.id)}
                          style={styles.removeButton}
                        >
                          <FontAwesome6 name="trash" size={12} color="#192536" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <FontAwesome6 name="receipt" size={16} color="#192536" />
                </View>

                <Text style={styles.summaryTitle}>Order Summary</Text>

                {totalsByCurrency.map(([currency, amount]) => <View key={currency} style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal · {currency}</Text><Text style={styles.summaryValue}>{formatMinorCurrency(amount.toString(), currency)}</Text></View>)}
                {totalsByCurrency.map(([currency, amount]) => <View key={`total-${currency}`} style={styles.totalRow}><Text style={styles.totalLabel}>Total · {currency}</Text><Text style={styles.totalValue}>{formatMinorCurrency(amount.toString(), currency)}</Text></View>)}

                {confirmedOrder ? <View style={styles.confirmedCard}><Text style={styles.confirmedTitle}>Order confirmed</Text><Text style={styles.checkoutNotice}>Reference {confirmedOrder.orderNumber}</Text><Text style={styles.confirmedTotal}>{formatMinorCurrency(confirmedOrder.totalMinor, confirmedOrder.currency)}</Text><Text style={styles.checkoutNotice}>Status: PENDING_PAYMENT. Payment has not been completed.</Text></View> : null}
                {checkoutMessage ? <Text accessibilityRole="alert" style={styles.checkoutNotice}>{checkoutMessage}</Text> : null}
                {pendingOrder ? <Text style={styles.checkoutNotice}>An order request is awaiting confirmation. Retry will use the same saved request.</Text> : null}
                <TouchableOpacity activeOpacity={0.85} disabled={checkoutBusy || loading || (hydratedCartItems.length === 0 && !pendingOrder)} onPress={() => void submitOrder()} style={[styles.checkoutButton, checkoutBusy && { opacity: 0.65 }]}>
                  {checkoutBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
                  <Text style={styles.checkoutButtonText}>{checkoutBusy ? "Submitting order…" : pendingOrder ? "Retry order submission" : "Submit order"}</Text>
                </TouchableOpacity>
                <Text style={styles.checkoutNotice}>Submitting creates an order only. Payment is not collected here.</Text>
              </View>
            </View>
          ) : !loading && !error ? (
            <View style={styles.emptyCartCard}>
              <View style={styles.emptyIcon}>
                <FontAwesome6 name="cart-shopping" size={22} color="#192536" />
              </View>

              <Text style={styles.emptyTitle}>Your cart is empty</Text>

              <Text style={styles.emptyText}>{unmatchedLegacyCount > 0 ? "Your previous items were preserved, but none match an active product yet." : "Add products from the shop to see them here."}</Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.replace("/dashboard/products" as any)}
                style={styles.shopButton}
              >
                <Text style={styles.shopButtonText}>Browse products</Text>

                <FontAwesome6 name="bag-shopping" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    color: "#192536",
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
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 20,
  },

  checkoutButton: {
    alignItems: "center",
    backgroundColor: "#192536",
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
  checkoutNotice: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
    textAlign: "center",
  },
  confirmedCard: { backgroundColor: "#EEF8F0", borderRadius: 14, marginTop: 14, padding: 14 },
  confirmedTitle: { color: "#245A36", fontFamily: "PoppinsBold", fontSize: 14 },
  confirmedTotal: { color: "#192536", fontFamily: "PoppinsBold", fontSize: 20, marginTop: 6, textAlign: "center" },

  emptyCartCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
  },

  loadingState: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    gap: 8,
    padding: 24,
  },

  catalogError: {
    alignItems: "center",
    backgroundColor: "#FFF5F3",
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
  },

  retryButton: {
    backgroundColor: "#192536",
    borderRadius: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  legacyNotice: {
    backgroundColor: "#FFF8E5",
    borderRadius: 12,
    color: "#705A16",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginBottom: 12,
    padding: 12,
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
    backgroundColor: "#192536",
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
