import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, PackageX, RotateCcw, ShoppingBag } from "lucide-react-native";
import { fetchCategories, fetchProducts } from "../../src/api/products";
import { Category, Product } from "../../src/types";
import { useDebounce } from "../../src/hooks/useDebounce";
import {
  CategoryFilter,
  ProductCard,
  ProductSearchBar,
  QuantitySelectionModal,
  SupplierFilter,
  SupplierFilterOption
} from "../../src/components/products";
import { CartFloatingBar } from "../../src/components/pos/CartFloatingBar";
import { useCartStore } from "../../src/store/cartStore";
import { useAuthStore } from "../../src/store/authStore";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { productsRepository } from "../../src/database/repositories/productsRepository";
import { cacheManager } from "../../src/database/cacheManager";
import { syncMetadataRepository } from "../../src/database/repositories/syncMetadataRepository";
import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";
import { LastSyncedLabel } from "../../src/components/common/LastSyncedLabel";
import { assertOnline } from "../../src/utils/networkGuard";

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isFromCart = params.from === "cart";
  const { isTablet, columns, contentMaxWidth } = useResponsive();
  const { items: cartItems, addItem, getSubtotal } = useCartStore();
  const cartSubtotal = getSubtotal();
  const user = useAuthStore((state) => state.user);
  const { isOffline, isServerUnavailable } = useNetworkStatus();
  const isOfflineMode = isOffline || isServerUnavailable;

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshSyncMetadata = useCallback(async () => {
    if (user?.id) {
      const meta = await syncMetadataRepository.getLastSync(user.id, "products");
      setLastSyncedAt(meta?.lastSyncedAt || null);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshSyncMetadata();
  }, [refreshSyncMetadata]);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierFilterOption>("All");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [productForQuantity, setProductForQuantity] = useState<Product | null>(null);

  // Debounced Search (300ms) to ensure smooth input without stutter
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch Categories with SQLite fallback
  const {
    data: categories = [],
    isLoading: isLoadingCategories
  } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const remote = await fetchCategories();
        if (user?.id && remote.length > 0) {
          await productsRepository.upsertCategories(user.id, remote);
        }
        return remote;
      } catch (err) {
        if (user?.id) {
          const cached = await productsRepository.getCategories(user.id);
          if (cached.length > 0) return cached;
        }
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000 // Cache categories for 10 minutes
  });

  // Fetch Products with SQLite fallback & caching
  const {
    data: products = [],
    isLoading: isLoadingProducts,
    isError: isProductsError,
    error: productsError,
    refetch: refetchProducts,
    isRefetching
  } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        const remote = await fetchProducts();
        if (user?.id && remote.length > 0) {
          await cacheManager.cacheProducts(user.id, remote, categories);
          await refreshSyncMetadata();
        }
        return remote;
      } catch (err) {
        if (user?.id) {
          const cached = await productsRepository.getProducts(user.id);
          if (cached.length > 0) {
            await refreshSyncMetadata();
            return cached;
          }
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000 // Cache products for 5 minutes
  });

  // Build Category Map for instant ID -> Name lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(cat._id, cat.name);
    });
    return map;
  }, [categories]);

  // Compute Supplier Product Counts for filter chips
  const supplierCounts = useMemo(() => {
    const counts: Partial<Record<SupplierFilterOption, number>> = {
      All: products.length,
      "Ruhunu Foods": 0,
      "Gajamuthu Foods": 0
    };

    products.forEach((p) => {
      if (p.supplier === "Ruhunu Foods") {
        counts["Ruhunu Foods"] = (counts["Ruhunu Foods"] || 0) + 1;
      } else if (p.supplier === "Gajamuthu Foods") {
        counts["Gajamuthu Foods"] = (counts["Gajamuthu Foods"] || 0) + 1;
      }
    });

    return counts;
  }, [products]);

  // Filtered Products based on:
  // 1. Debounced Search (item code or product name, case-insensitive, partial match)
  // 2. Supplier (All, Ruhunu Foods, Gajamuthu Foods)
  // 3. Category (all or category ID)
  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    return products.filter((product) => {
      // 1. Supplier Filter
      if (selectedSupplier !== "All" && product.supplier !== selectedSupplier) {
        return false;
      }

      // 2. Category Filter
      if (selectedCategoryId !== "all") {
        const prodCatId =
          typeof product.category === "object" && product.category
            ? product.category._id
            : product.category;
        if (prodCatId !== selectedCategoryId) {
          return false;
        }
      }

      // 3. Search Term Match (Item Code, Product Name, Display Name, Variant, Keywords)
      if (term.length > 0) {
        const itemCodeMatch =
          product.itemCode && product.itemCode.toLowerCase().includes(term);
        const nameMatch =
          product.productName && product.productName.toLowerCase().includes(term);
        const displayNameMatch =
          product.displayName && product.displayName.toLowerCase().includes(term);
        const variantMatch =
          product.variant && product.variant.toLowerCase().includes(term);
        const keywordsMatch =
          Array.isArray(product.searchKeywords) &&
          product.searchKeywords.some((kw) => kw.toLowerCase().includes(term));

        if (!itemCodeMatch && !nameMatch && !displayNameMatch && !variantMatch && !keywordsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [products, debouncedSearch, selectedSupplier, selectedCategoryId]);

  // Reset all filters to default
  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedSupplier("All");
    setSelectedCategoryId("all");
  }, []);

  const onRefresh = useCallback(async () => {
    await refetchProducts();
  }, [refetchProducts]);

  const isLoading = isLoadingProducts && products.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isTablet && { maxWidth: contentMaxWidth ?? 1100, alignSelf: "center", width: "100%" }]}>
        {/* Return to Cart Banner when navigated from Cart */}
        {isFromCart && (
          <TouchableOpacity
            style={styles.cartBackBanner}
            onPress={() => router.push("/pos/cart" as any)}
            activeOpacity={0.85}
            accessibilityLabel="Return to Cart"
          >
            <View style={styles.cartBackBannerLeft}>
              <ArrowLeft size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.cartBackBannerTitle}>Back to Cart</Text>
            </View>
            <View style={styles.cartBackBannerRight}>
              <Text style={styles.cartBackBannerSub}>
                {cartItems.length} {cartItems.length === 1 ? "line" : "lines"} • {formatLKR(cartSubtotal)}
              </Text>
              <ShoppingBag size={16} color="#ffffff" style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
        )}

        {/* Sticky Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Products</Text>
          <Text style={styles.subtitle}>Find products by name or item code</Text>
        </View>

        {/* Search Bar with 300ms debounce and clear button */}
        <View style={styles.searchSection}>
          <ProductSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder="Search name or item code"
          />
        </View>

        {/* Supplier Filter Chips */}
        <SupplierFilter
          selected={selectedSupplier}
          onSelect={setSelectedSupplier}
          counts={supplierCounts}
        />

        {/* Dynamic Category Filter Chips */}
        <CategoryFilter
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />

        {/* Result Counter & Active Filter Reset Indicator */}
        <View style={styles.countRow}>
          <View>
            <Text style={styles.countText}>
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "product" : "products"} available
            </Text>
            <LastSyncedLabel timestamp={lastSyncedAt} />
          </View>

          {(searchQuery.trim().length > 0 ||
            selectedSupplier !== "All" ||
            selectedCategoryId !== "all") && (
            <TouchableOpacity
              onPress={handleResetFilters}
              hitSlop={8}
              style={styles.clearAllButton}
            >
              <RotateCcw size={12} color={Colors.leaf} />
              <Text style={styles.clearAllText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content Area */}
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.leaf} />
            <Text style={styles.loadingText}>Loading product catalogue...</Text>
          </View>
        ) : isProductsError ? (
          <View style={styles.centered}>
            <View style={styles.errorIconWrap}>
              <AlertCircle size={32} color={Colors.danger} />
            </View>
            <Text style={styles.errorTitle}>Failed to load catalogue</Text>
            <Text style={styles.errorMsg}>
              {(productsError as any)?.message ||
                "Unable to retrieve products. Please check your network connection."}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchProducts()}
              activeOpacity={0.8}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            key={`products-grid-${columns}`}
            data={filteredProducts}
            keyExtractor={(item) => item._id}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
            renderItem={({ item }) => {
              const catId =
                typeof item.category === "object" && item.category
                  ? item.category._id
                  : item.category;
              const catName = categoryMap.get(catId);
              const cartItem = cartItems.find((i) => i.productId === item._id);

              return (
                <ProductCard
                  product={item}
                  categoryName={catName}
                  cartQuantity={cartItem?.quantity || 0}
                  isOffline={isOfflineMode}
                  onAddToCart={(p) => setProductForQuantity(p)}
                  style={columns > 1 ? { flex: 1, marginHorizontal: Spacing.xs } : undefined}
                />
              );
            }}
            contentContainerStyle={[
              styles.listContent,
              cartItems.length > 0 && { paddingBottom: 80 }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={onRefresh}
                colors={[Colors.leaf]}
                tintColor={Colors.leaf}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <PackageX size={40} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No matching products</Text>
                <Text style={styles.emptySub}>
                  {searchQuery.trim().length > 0
                    ? `No products found matching "${searchQuery}". Check the item code or product name spelling.`
                    : "No products available under the selected filters."}
                </Text>

                {(searchQuery.trim().length > 0 ||
                  selectedSupplier !== "All" ||
                  selectedCategoryId !== "all") && (
                  <TouchableOpacity
                    style={styles.resetFiltersBtn}
                    onPress={handleResetFilters}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resetFiltersBtnText}>Reset all filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}

        {/* Quantity Selection Modal (Activated exclusively by Add (+) button) */}
        <QuantitySelectionModal
          product={productForQuantity}
          visible={!!productForQuantity}
          onClose={() => setProductForQuantity(null)}
          onAddToCart={(p, qty) => addItem(p, qty)}
          cartQuantity={cartItems.find((i) => i.productId === productForQuantity?._id)?.quantity || 0}
        />

        {/* Floating Cart & Quick Checkout Bar */}
        <CartFloatingBar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background
  },
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xs
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  searchSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 2
  },
  countText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4
  },
  clearAllText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxl
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginHorizontal: -Spacing.xs
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl
  },
  loadingText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    fontWeight: "500"
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dangerLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  errorTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  errorMsg: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: Spacing.base,
    lineHeight: 18,
    maxWidth: 280
  },
  retryButton: {
    backgroundColor: Colors.leaf,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md
  },
  retryText: {
    color: Colors.textInverse,
    fontWeight: "700",
    fontSize: Typography.sm
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl + 10,
    paddingHorizontal: Spacing.xl
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  emptySub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280
  },
  resetFiltersBtn: {
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  resetFiltersBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textPrimary
  },
  cartBackBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.leaf,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: "#0f766e"
  },
  cartBackBannerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  cartBackBannerTitle: {
    fontSize: Typography.sm + 1,
    fontWeight: "700",
    color: "#ffffff"
  },
  cartBackBannerRight: {
    flexDirection: "row",
    alignItems: "center"
  },
  cartBackBannerSub: {
    fontSize: Typography.xs + 1,
    fontWeight: "600",
    color: "#e6fffa"
  }
});
