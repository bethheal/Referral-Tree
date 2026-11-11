import {
  getAllCustomerProducts,
  type CustomerProduct,
} from "@/components/backendApi";
import {
  addCartItem,
  getCartItems,
  getUnmatchedLegacyCartCount,
} from "@/components/cartStore";
import PageHeader from "@/components/pageHeader";
import { formatMinorCurrency } from "@/components/productMoney";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Product = CustomerProduct;
type SortOption = "name" | "lowToHigh" | "highToLow";
type AnimatedIconButtonProps = {
  color?: string;
  disabled?: boolean;
  icon: string;
  onPress: () => void;
  rotateOnHover?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};
type AnimatedTextButtonProps = {
  label: string;
  onPress: () => void;
};

const priceRanges = [
  { label: "All prices", maxMinor: null, minMinor: "0" },
  { label: "Under GHS 75", maxMinor: "7500", minMinor: "0" },
  { label: "GHS 75 - 150", maxMinor: "15000", minMinor: "7500" },
  { label: "Above GHS 150", maxMinor: null, minMinor: "15000" },
];

const getColumnCount = (width: number) => {
  if (width >= 900) return 4;
  if (width >= 620) return 3;
  return 2;
};

function AnimatedIconButton({
  color = "#192536",
  disabled = false,
  icon,
  onPress,
  rotateOnHover = false,
  size = 13,
  style,
}: AnimatedIconButtonProps) {
  const isHovered = useRef(false);
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const animateTo = (scaleValue: number, rotateValue: number) => {
    Animated.parallel([
      Animated.spring(scale, {
        friction: 5,
        tension: 140,
        toValue: scaleValue,
        useNativeDriver: true,
      }),
      Animated.spring(rotate, {
        friction: 6,
        tension: 120,
        toValue: rotateOnHover ? rotateValue : 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "135deg"],
  });

  return (
    <Animated.View
      style={[style, { transform: [{ scale }, { rotate: rotateInterpolate }] }]}
    >
      <Pressable
        disabled={disabled}
        onHoverIn={() => {
          isHovered.current = true;
          setHovered(true);
          animateTo(1.14, 1);
        }}
        onHoverOut={() => {
          isHovered.current = false;
          setHovered(false);
          animateTo(1, 0);
        }}
        onPress={onPress}
        onPressIn={() => animateTo(0.9, rotateOnHover ? 1 : 0)}
        onPressOut={() =>
          animateTo(isHovered.current ? 1.14 : 1, isHovered.current ? 1 : 0)
        }
        style={[styles.iconOnlyButton, disabled && styles.disabledButton]}
      >
        <FontAwesome6
          name={icon as any}
          size={size}
          color={hovered ? "#FFB900" : color}
        />
      </Pressable>
    </Animated.View>
  );
}

function AnimatedTextButton({ label, onPress }: AnimatedTextButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      friction: 5,
      tension: 140,
      toValue: value,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onHoverIn={() => {
          setHovered(true);
          animateTo(1.12);
        }}
        onHoverOut={() => {
          setHovered(false);
          animateTo(1);
        }}
        onPress={onPress}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        style={styles.sectionActionButton}
      >
        <Text style={[styles.sectionAction, hovered && styles.hoverText]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function Products() {
  const { width } = useWindowDimensions();
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const detailScale = useRef(new Animated.Value(0.94)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-14)).current;
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [unmatchedLegacyCount, setUnmatchedLegacyCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [priceRangeIndex, setPriceRangeIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [toastText, setToastText] = useState("");

  const columnCount = getColumnCount(width);
  const horizontalPadding = width >= 620 ? 22 : 18;
  const gridGap = 12;
  const cardWidth =
    (width - horizontalPadding * 2 - gridGap * (columnCount - 1)) / columnCount;

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const result = await getAllCustomerProducts();
      setProducts(result.rows);
      const items = await getCartItems(result.rows);
      setCartCount(items.reduce((total, item) => total + item.quantity, 0));
      setUnmatchedLegacyCount(await getUnmatchedLegacyCartCount());
    } catch {
      setCatalogError(
        "We couldn't load the product catalog. Check your connection and try again.",
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCatalog();
    }, [loadCatalog]),
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selectedPriceRange = priceRanges[priceRangeIndex]!;
    const minMinor = BigInt(selectedPriceRange.minMinor);
    const maxMinor =
      selectedPriceRange.maxMinor === null
        ? null
        : BigInt(selectedPriceRange.maxMinor);

    return products
      .filter((product) => {
        const matchesSearch =
          !normalizedQuery ||
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.sku.toLowerCase().includes(normalizedQuery) ||
          product.description.toLowerCase().includes(normalizedQuery);
        const priceMinor = BigInt(product.priceMinor);
        const matchesPrice =
          priceMinor >= minMinor &&
          (maxMinor === null || priceMinor <= maxMinor);

        return matchesSearch && matchesPrice;
      })
      .sort((first, second) => {
        if (sortOption === "lowToHigh") {
          const firstPrice = BigInt(first.priceMinor);
          const secondPrice = BigInt(second.priceMinor);
          return firstPrice < secondPrice
            ? -1
            : firstPrice > secondPrice
              ? 1
              : first.name.localeCompare(second.name);
        }

        if (sortOption === "highToLow") {
          const firstPrice = BigInt(first.priceMinor);
          const secondPrice = BigInt(second.priceMinor);
          return firstPrice > secondPrice
            ? -1
            : firstPrice < secondPrice
              ? 1
              : first.name.localeCompare(second.name);
        }

        return first.name.localeCompare(second.name);
      });
  }, [priceRangeIndex, products, query, sortOption]);

  const visibleProducts = showAll
    ? filteredProducts
    : filteredProducts.slice(0, columnCount * 2);

  const showAddedToast = (productName: string) => {
    setToastText(`${productName} added to cart`);
    toastOpacity.stopAnimation();
    toastTranslateY.stopAnimation();
    toastOpacity.setValue(0);
    toastTranslateY.setValue(-14);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(toastOpacity, {
          duration: 180,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(toastTranslateY, {
          friction: 7,
          tension: 120,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1350),
      Animated.parallel([
        Animated.timing(toastOpacity, {
          duration: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          duration: 180,
          toValue: -14,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleAddToCart = async (product: Product) => {
    if (!product.inStock) return;
    const items = await addCartItem(product.id);
    setCartCount(items.reduce((total, item) => total + item.quantity, 0));
    showAddedToast(product.name);
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    detailOpacity.setValue(0);
    detailScale.setValue(0.94);

    Animated.parallel([
      Animated.timing(detailOpacity, {
        duration: 170,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(detailScale, {
        friction: 7,
        tension: 130,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeProductDetails = () => {
    Animated.parallel([
      Animated.timing(detailOpacity, {
        duration: 130,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(detailScale, {
        duration: 130,
        toValue: 0.96,
        useNativeDriver: true,
      }),
    ]).start(() => setSelectedProduct(null));
  };

  const resetFilters = () => {
    setPriceRangeIndex(0);
    setQuery("");
    setShowAll(false);
    setSortOption("name");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.screen, { paddingHorizontal: horizontalPadding }]}>
        <PageHeader title="Products" subtitle="Browse Angelic mkts products" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <FontAwesome6 name="magnifying-glass" size={13} color="#B9AAA4" />

              <TextInput
                placeholder="Search products"
                placeholderTextColor="#B9AAA4"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setFilterVisible(true)}
              style={[
                styles.filterButton,
                (priceRangeIndex !== 0 || sortOption !== "name") &&
                  styles.activeFilterButton,
              ]}
            >
              <FontAwesome6
                name="sliders"
                size={14}
                color={
                  priceRangeIndex !== 0 || sortOption !== "name"
                    ? "#FFFFFF"
                    : "#192536"
                }
              />
            </TouchableOpacity>
          </View>

          {catalogLoading && products.length === 0 ? (
            <View style={styles.catalogState}>
              <ActivityIndicator color="#192536" />
              <Text style={styles.emptyText}>Loading products…</Text>
            </View>
          ) : null}
          {catalogError ? (
            <View style={styles.catalogError}>
              <Text style={styles.emptyTitle}>Product catalog unavailable</Text>
              <Text style={styles.emptyText}>{catalogError}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => void loadCatalog()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {unmatchedLegacyCount > 0 ? (
            <Text style={styles.legacyNotice}>
              {unmatchedLegacyCount} previous cart item(s) could not be matched
              to the active catalog and were preserved on this device.
            </Text>
          ) : null}

          {products.length > 0 ? (
            <View style={styles.featuredCard}>
              <View style={styles.featuredInfo}>
                <View style={styles.featuredBadge}>
                  <FontAwesome6
                    name="basket-shopping"
                    size={11}
                    color="#D7B126"
                  />

                  <Text style={styles.featuredBadgeText}>Active catalog</Text>
                </View>

                <Text numberOfLines={1} style={styles.featuredTitle}>
                  {products[0]!.name}
                </Text>

                <Text style={styles.featuredText}>
                  {products[0]!.description || products[0]!.sku}
                </Text>

                <View style={styles.featuredActions}>
                  <TouchableOpacity
                    disabled={!products[0]!.inStock}
                    activeOpacity={0.85}
                    onPress={() => void handleAddToCart(products[0]!)}
                    style={[
                      styles.featuredButton,
                      !products[0]!.inStock && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.featuredButtonText}>
                      {products[0]!.inStock ? "Add to cart" : "Out of stock"}
                    </Text>

                    <FontAwesome6 name="plus" size={12} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.replace("/dashboard/cart" as any)}
                    style={styles.cartPill}
                  >
                    <FontAwesome6
                      name="cart-shopping"
                      size={12}
                      color="#192536"
                    />

                    <Text style={styles.cartPillText}>{cartCount}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => openProductDetails(products[0]!)}
                style={styles.featuredImageWrap}
              >
                <View
                  style={[styles.featuredImage, styles.productImageFallback]}
                >
                  <FontAwesome6
                    name="basket-shopping"
                    size={34}
                    color="#192536"
                  />
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Found {filteredProducts.length} Results
              </Text>

              <Text style={styles.sectionSubtitle}>
                {sortOption === "lowToHigh"
                  ? "Sorted by lowest price"
                  : sortOption === "highToLow"
                    ? "Sorted by highest price"
                    : "Sorted by product name"}
              </Text>
            </View>

            <AnimatedTextButton
              label={showAll ? "Show less" : "View more"}
              onPress={() => setShowAll((current) => !current)}
            />
          </View>

          <View style={[styles.productGrid, { gap: gridGap }]}>
            {visibleProducts.map((product) => (
              <View
                key={product.id}
                style={[styles.productCard, { width: cardWidth }]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => openProductDetails(product)}
                  style={styles.productImageWrap}
                >
                  <View
                    style={[styles.productImage, styles.productImageFallback]}
                  >
                    <FontAwesome6
                      name="basket-shopping"
                      size={26}
                      color="#192536"
                    />
                  </View>

                  <View style={styles.productIcon}>
                    <FontAwesome6
                      name="basket-shopping"
                      size={12}
                      color="#192536"
                    />
                  </View>
                </TouchableOpacity>

                <View style={styles.productBody}>
                  <Text numberOfLines={1} style={styles.productName}>
                    {product.name}
                  </Text>

                  <Text numberOfLines={1} style={styles.productUnit}>
                    {product.sku}
                  </Text>

                  <View style={styles.ratingRow}>
                    <FontAwesome6
                      name={product.inStock ? "circle-check" : "circle-minus"}
                      size={10}
                      color={product.inStock ? "#2F7C50" : "#A39894"}
                    />
                    <Text style={styles.ratingText}>
                      {product.inStock ? "In stock" : "Out of stock"}
                    </Text>
                  </View>

                  <View style={styles.productBottom}>
                    <Text style={styles.productPrice}>
                      {formatMinorCurrency(
                        product.priceMinor,
                        product.currency,
                      )}
                    </Text>

                    <AnimatedIconButton
                      color="#1E3631"
                      icon="plus"
                      disabled={!product.inStock}
                      onPress={() => void handleAddToCart(product)}
                      rotateOnHover
                      style={styles.addButton}
                    />
                  </View>

                  <AnimatedIconButton
                    icon="arrow-right"
                    onPress={() => openProductDetails(product)}
                    size={11}
                    style={styles.viewDetailsButton}
                  />
                </View>
              </View>
            ))}
          </View>

          {!catalogLoading && !catalogError && filteredProducts.length === 0 ? (
            <View style={styles.emptyCard}>
              <FontAwesome6 name="magnifying-glass" size={18} color="#192536" />

              <Text style={styles.emptyTitle}>
                {products.length === 0
                  ? "No active products yet"
                  : "No products found"}
              </Text>

              <Text style={styles.emptyText}>
                {products.length === 0
                  ? "Active products will appear here when they are added to the catalog."
                  : "Try another search or price filter."}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslateY }],
          },
        ]}
      >
        <FontAwesome6 name="circle-check" size={14} color="#FFFFFF" />

        <Text style={styles.toastText}>{toastText}</Text>
      </Animated.View>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(selectedProduct)}
        onRequestClose={closeProductDetails}
      >
        <Pressable style={styles.modalOverlay} onPress={closeProductDetails}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: detailOpacity,
                transform: [{ scale: detailScale }],
              },
            ]}
          >
            {selectedProduct ? (
              <Pressable onPress={(event) => event.stopPropagation()}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={closeProductDetails}
                  style={styles.closeButton}
                >
                  <FontAwesome6 name="xmark" size={15} color="#1E3631" />
                </TouchableOpacity>

                <View style={styles.modalImageWrap}>
                  <View
                    style={[styles.modalImage, styles.productImageFallback]}
                  >
                    <FontAwesome6
                      name="basket-shopping"
                      size={42}
                      color="#192536"
                    />
                  </View>
                </View>

                <Text style={styles.modalCategory}>{selectedProduct.sku}</Text>

                <Text style={styles.modalTitle}>{selectedProduct.name}</Text>

                <Text style={styles.modalText}>
                  {selectedProduct.description}
                </Text>

                <View style={styles.modalMetaRow}>
                  <Text style={styles.modalPrice}>
                    {formatMinorCurrency(
                      selectedProduct.priceMinor,
                      selectedProduct.currency,
                    )}
                  </Text>

                  <Text style={styles.modalUnit}>
                    {selectedProduct.inStock ? "In stock" : "Out of stock"}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!selectedProduct.inStock}
                  onPress={() => void handleAddToCart(selectedProduct)}
                  style={[
                    styles.modalButton,
                    !selectedProduct.inStock && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.modalButtonText}>Add to cart</Text>

                  <FontAwesome6 name="cart-plus" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </Pressable>
            ) : null}
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={filterVisible}
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <View>
                <Text style={styles.filterTitle}>Filter Products</Text>

                <Text style={styles.filterSubtitle}>
                  Choose a price range and sort order
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setFilterVisible(false)}
                style={styles.closeButton}
              >
                <FontAwesome6 name="xmark" size={15} color="#1E3631" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterGroupTitle}>Price</Text>

            <View style={styles.filterChipWrap}>
              {priceRanges.map((range, index) => {
                const isActive = priceRangeIndex === index;

                return (
                  <TouchableOpacity
                    key={range.label}
                    activeOpacity={0.85}
                    onPress={() => {
                      setPriceRangeIndex(index);
                      setShowAll(false);
                    }}
                    style={[
                      styles.filterOptionChip,
                      isActive && styles.activeCategoryChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        isActive && styles.activeCategoryText,
                      ]}
                    >
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterGroupTitle}>Sort</Text>

            <View style={styles.filterChipWrap}>
              {[
                { label: "Product name", value: "name" },
                { label: "Lowest price", value: "lowToHigh" },
                { label: "Highest price", value: "highToLow" },
              ].map((sort) => {
                const isActive = sortOption === sort.value;

                return (
                  <TouchableOpacity
                    key={sort.value}
                    activeOpacity={0.85}
                    onPress={() => setSortOption(sort.value as SortOption)}
                    style={[
                      styles.filterOptionChip,
                      isActive && styles.activeCategoryChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        isActive && styles.activeCategoryText,
                      ]}
                    >
                      {sort.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={resetFilters}
                style={styles.resetButton}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setFilterVisible(false)}
                style={styles.applyButton}
              >
                <Text style={styles.applyButtonText}>
                  Apply ({filteredProducts.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  searchBox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F1E8E4",
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
  },

  searchInput: {
    color: "#314640",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    padding: 0,
  },

  filterButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    height: 46,
    justifyContent: "center",
    width: 46,
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  activeFilterButton: {
    backgroundColor: "#192536",
  },

  categoryList: {
    gap: 9,
    paddingBottom: 4,
  },

  categoryChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F1E8E4",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  activeCategoryChip: {
    backgroundColor: "#192536",
    borderColor: "#192536",
  },

  categoryText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  activeCategoryText: {
    color: "#FFFFFF",
  },

  featuredCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    flexDirection: "row",
    marginTop: 15,
    overflow: "hidden",
    padding: 16,
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },

  featuredInfo: {
    flex: 1,
    paddingRight: 8,
  },

  featuredBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  featuredBadgeText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  featuredTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 18,
    lineHeight: 23,
    marginTop: 12,
  },

  featuredText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  featuredActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 13,
  },

  featuredButton: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  featuredButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  cartPill: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  cartPillText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  featuredImageWrap: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 18,
    height: 118,
    justifyContent: "center",
    width: 104,
  },

  featuredImage: {
    borderRadius: 15,
    height: 94,
    width: 80,
  },

  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 24,
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

  sectionAction: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  hoverText: {
    color: "#FFB900",
  },

  sectionActionButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },

  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    overflow: "hidden",
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },

  productImageWrap: {
    alignItems: "center",
    borderRadius: 16,
    height: 126,
    justifyContent: "center",
    margin: 10,
  },

  productImage: {
    borderRadius: 14,
    height: 92,
    width: 86,
  },

  productIcon: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    bottom: 8,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    width: 28,
  },

  productBody: {
    paddingBottom: 12,
    paddingHorizontal: 12,
  },

  productName: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  productUnit: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    marginTop: 6,
  },

  ratingText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 9,
    marginLeft: 3,
  },

  productBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  productPrice: {
    color: "#192536",
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  addButton: {
    alignItems: "center",
    justifyContent: "center",
  },

  iconOnlyButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },

  viewDetailsButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 9,
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginTop: 12,
    padding: 20,
  },

  catalogState: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    gap: 8,
    marginTop: 12,
    padding: 24,
  },

  catalogError: {
    alignItems: "center",
    backgroundColor: "#FFF5F3",
    borderRadius: 18,
    marginTop: 12,
    padding: 18,
  },

  retryButton: {
    backgroundColor: "#192536",
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
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
    marginTop: 10,
    padding: 12,
  },

  productImageFallback: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.45,
  },

  emptyTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 14,
    marginTop: 10,
  },

  emptyText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 2,
  },

  modalOverlay: {
    backgroundColor: "rgba(38,29,26,0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
  },

  closeButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  modalImageWrap: {
    alignItems: "center",
    borderRadius: 22,
    height: 180,
    justifyContent: "center",
    marginTop: 10,
  },

  modalImage: {
    borderRadius: 18,
    height: 138,
    width: 128,
  },

  modalCategory: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 11,
    marginTop: 16,
  },

  modalTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 22,
    marginTop: 3,
  },

  modalText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },

  modalMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },

  modalPrice: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 20,
  },

  modalUnit: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  modalButton: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 15,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    marginTop: 18,
    paddingVertical: 15,
  },

  modalButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  filterCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
  },

  filterHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  filterTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 20,
  },

  filterSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 1,
  },

  filterGroupTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginTop: 16,
  },

  filterChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 9,
  },

  filterOptionChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F1E8E4",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  resetButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F1E8E4",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 14,
  },

  resetButtonText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  applyButton: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 14,
  },

  applyButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  toast: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#1E3631",
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    left: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: "absolute",
    right: 18,
    top: 58,
    zIndex: 20,
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },

  toastText: {
    color: "#FFFFFF",
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },
});
