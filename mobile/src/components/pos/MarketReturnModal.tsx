import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Package, RotateCcw, Search, Tag, X } from "lucide-react-native";
import { Product, ReturnItem } from "../../types";
import { fetchProducts } from "../../api/products";
import { productsRepository } from "../../database/repositories/productsRepository";
import { useAuthStore } from "../../store/authStore";
import { useResponsive } from "../../hooks/useResponsive";
import { QuantitySelector } from "./QuantitySelector";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export interface MarketReturnModalProps {
  visible: boolean;
  initialReturn?: ReturnItem | null;
  initialIndex?: number;
  onClose: () => void;
  onSave: (returnItem: ReturnItem, editIndex?: number) => void;
}

export const MarketReturnModal: React.FC<MarketReturnModalProps> = ({
  visible,
  initialReturn,
  initialIndex,
  onClose,
  onSave
}) => {
  const { theme, isDark } = useAppTheme();
  const { isTablet, modalMaxWidth } = useResponsive();
  const user = useAuthStore((state) => state.user);

  // Form State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [returnPriceStr, setReturnPriceStr] = useState<string>("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [condition, setCondition] = useState<"resellable" | "damaged" | "expired">("resellable");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"select_product" | "enter_details">("select_product");

  // Fetch Products (Live with SQLite offline fallback)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        return await fetchProducts();
      } catch (err) {
        if (user?.id) {
          const cached = await productsRepository.getProducts(user.id);
          if (cached.length > 0) return cached;
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000
  });

  // Pre-fill form when editing an existing return item
  useEffect(() => {
    if (visible && initialReturn) {
      const matched = products.find(
        (p) =>
          p._id === initialReturn.productId ||
          p.itemCode.toLowerCase() === initialReturn.itemCode.toLowerCase()
      );

      setSelectedProduct(
        matched || {
          _id: initialReturn.productId || `manual_${Date.now()}`,
          itemCode: initialReturn.itemCode,
          productName: initialReturn.itemName,
          displayName: initialReturn.itemName,
          variant: "",
          category: "",
          currentSellingPrice: initialReturn.returnPrice,
          totalStock: 0,
          reorderLevel: 0,
          isFastMoving: false,
          status: "active",
          supplier: "Ruhunu Foods"
        }
      );
      setQuantity(initialReturn.quantity || 1);
      const initPrice = initialReturn.returnPrice || matched?.currentSellingPrice || 0;
      setReturnPriceStr(String(initPrice));
      setPriceError(null);
      setCondition(initialReturn.condition || "resellable");
      setReason(initialReturn.reason || "");
      setStep("enter_details");
    } else if (visible && !initialReturn) {
      setSelectedProduct(null);
      setSearchQuery("");
      setQuantity(1);
      setReturnPriceStr("");
      setPriceError(null);
      setCondition("resellable");
      setReason("");
      setStep("select_product");
    }
  }, [visible, initialReturn, products]);

  // Filtered Products for Search
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 50);

    return products
      .filter(
        (p) =>
          p.itemCode.toLowerCase().includes(q) ||
          p.productName.toLowerCase().includes(q) ||
          (p.displayName && p.displayName.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [products, searchQuery]);

  const parsedReturnPrice = parseFloat(returnPriceStr);
  const unitReturnPrice = !isNaN(parsedReturnPrice) && parsedReturnPrice > 0 ? parsedReturnPrice : 0;
  const lineReturnTotal = Math.round(quantity * unitReturnPrice * 100) / 100;

  const handlePriceChange = (val: string) => {
    // Sanitize non-digits except single decimal point
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    let normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    if (parts.length === 2 && parts[1].length > 2) {
      normalized = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    setReturnPriceStr(normalized);

    const num = parseFloat(normalized);
    const maxPrice = selectedProduct?.currentSellingPrice || 0;
    if (!normalized || isNaN(num) || num <= 0) {
      setPriceError("Please enter a valid unit return price greater than 0");
    } else if (maxPrice > 0 && num > maxPrice) {
      setPriceError(`Exceeds catalogue price (${formatLKR(maxPrice)})`);
    } else {
      setPriceError(null);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    const defaultPrice = product.currentSellingPrice || 0;
    setReturnPriceStr(String(defaultPrice));
    setPriceError(null);
    setStep("enter_details");
  };

  const handleSubmit = () => {
    if (!selectedProduct) return;

    const num = parseFloat(returnPriceStr);
    const maxPrice = selectedProduct.currentSellingPrice || 0;
    if (isNaN(num) || num <= 0) {
      setPriceError("Please enter a valid unit return price greater than 0");
      return;
    }
    if (maxPrice > 0 && num > maxPrice) {
      setPriceError(`Return price cannot exceed catalogue selling price (${formatLKR(maxPrice)})`);
      return;
    }

    const returnItem: ReturnItem = {
      productId: selectedProduct._id,
      itemCode: selectedProduct.itemCode,
      itemName: selectedProduct.displayName || selectedProduct.productName,
      quantity,
      returnPrice: num,
      returnTotal: lineReturnTotal,
      condition,
      reason: reason.trim() || undefined,
      inspectionStatus: "pending_inspection"
    };

    onSave(returnItem, initialIndex);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isTablet ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isTablet && styles.backdropTablet]}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: theme.surface },
            isTablet && {
              width: modalMaxWidth,
              borderRadius: BorderRadius.xl + 4,
              alignSelf: "center",
              marginBottom: Spacing.xl
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                {initialReturn ? "Edit Market Return" : "Add Market Return"}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {step === "select_product"
                  ? "Select product being returned by customer"
                  : "Specify returned quantity, condition & reason"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Step 1: Select Product */}
          {step === "select_product" ? (
            <View style={styles.stepContainer}>
              {/* Search Box */}
              <View style={[styles.searchBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Search size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search item code or product name..."
                  placeholderTextColor={theme.textMuted}
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  autoFocus={true}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                    <X size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Product Selection List */}
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item._id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.productList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectProduct(item)}
                    style={[styles.productListItem, { borderBottomColor: theme.border }]}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <Text style={styles.itemCodeBadge}>{item.itemCode}</Text>
                        <Text style={[styles.supplierText, { color: theme.textSecondary }]}>{item.supplier}</Text>
                      </View>
                      <Text style={[styles.productNameText, { color: theme.textPrimary }]} numberOfLines={1}>
                        {item.displayName || item.productName}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.productPriceText, { color: theme.textPrimary }]}>
                        {formatLKR(item.currentSellingPrice)}
                      </Text>
                      <Text style={[styles.unitLabel, { color: theme.textMuted }]}>Unit Price</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Package size={36} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No matching products found</Text>
                  </View>
                }
              />
            </View>
          ) : (
            /* Step 2: Enter Details */
            <ScrollView
              style={styles.stepContainer}
              contentContainerStyle={styles.scrollDetailsContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Selected Product Summary Card */}
              <View style={[styles.selectedProductCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Text style={styles.itemCodeBadge}>{selectedProduct?.itemCode}</Text>
                    <Text style={[styles.supplierText, { color: theme.textSecondary }]}>{selectedProduct?.supplier || "Ruhunu Foods"}</Text>
                  </View>
                  <Text style={[styles.selectedProductName, { color: theme.textPrimary }]}>
                    {selectedProduct?.displayName || selectedProduct?.productName}
                  </Text>
                  <Text style={[styles.unitValuationText, { color: theme.textSecondary }]}>
                    Valuation Price:{" "}
                    <Text style={{ fontWeight: "700", color: theme.textPrimary }}>
                      {formatLKR(unitReturnPrice)}
                    </Text>
                  </Text>
                </View>

                {!initialReturn && (
                  <TouchableOpacity
                    onPress={() => setStep("select_product")}
                    style={styles.changeProductBtn}
                  >
                    <Text style={styles.changeProductText}>Change</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Return Condition Selector */}
              <View style={styles.sectionBox}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>RETURN CONDITION</Text>
                <View style={styles.conditionRow}>
                  <Pressable
                    onPress={() => setCondition("resellable")}
                    style={[
                      styles.conditionChip,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      condition === "resellable" && styles.conditionChipActiveResellable
                    ]}
                  >
                    <Text
                      style={[
                        styles.conditionChipText,
                        { color: theme.textPrimary },
                        condition === "resellable" && styles.conditionChipTextActive
                      ]}
                    >
                      Resellable
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setCondition("damaged")}
                    style={[
                      styles.conditionChip,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      condition === "damaged" && styles.conditionChipActiveDamaged
                    ]}
                  >
                    <Text
                      style={[
                        styles.conditionChipText,
                        { color: theme.textPrimary },
                        condition === "damaged" && styles.conditionChipTextActive
                      ]}
                    >
                      Damaged
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setCondition("expired")}
                    style={[
                      styles.conditionChip,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      condition === "expired" && styles.conditionChipActiveExpired
                    ]}
                  >
                    <Text
                      style={[
                        styles.conditionChipText,
                        { color: theme.textPrimary },
                        condition === "expired" && styles.conditionChipTextActive
                      ]}
                    >
                      Expired
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.conditionSubtext, { color: theme.textMuted }]}>
                  {condition === "resellable"
                    ? "Resellable returns will enter warehouse inspection before stock restoration."
                    : condition === "damaged"
                    ? "Damaged returns will be credited but excluded from warehouse sellable inventory."
                    : "Expired goods will be routed for manufacturer recall / credit."}
                </Text>
              </View>

              {/* Quantity Selector */}
              <View style={styles.sectionBox}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>RETURN QUANTITY</Text>
                <QuantitySelector
                  quantity={quantity}
                  onChangeQuantity={(q) => setQuantity(Math.max(1, q))}
                  min={1}
                  size="lg"
                />
              </View>

              {/* Editable Return Unit Price Field */}
              <View style={styles.sectionBox}>
                <View style={styles.priceHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>RETURN UNIT PRICE (LKR)</Text>
                  {selectedProduct?.currentSellingPrice ? (
                    <Text style={[styles.benchmarkPriceText, { color: theme.textMuted }]}>
                      Catalogue: {formatLKR(selectedProduct.currentSellingPrice)}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.priceInputWrap,
                    { backgroundColor: theme.surface, borderColor: priceError ? theme.danger : theme.border },
                    !!priceError && styles.priceInputWrapError
                  ]}
                >
                  <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>Rs.</Text>
                  <TextInput
                    value={returnPriceStr}
                    onChangeText={handlePriceChange}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.priceInput, { color: theme.textPrimary }]}
                    selectTextOnFocus={true}
                  />
                </View>
                {priceError ? (
                  <View style={styles.priceErrorRow}>
                    <AlertCircle size={12} color={theme.danger} style={{ marginRight: 4 }} />
                    <Text style={[styles.priceErrorText, { color: theme.danger }]}>{priceError}</Text>
                  </View>
                ) : (
                  <Text style={[styles.priceHelpText, { color: theme.textMuted }]}>
                    Custom credit price per unit. Cannot exceed product catalogue selling price.
                  </Text>
                )}
              </View>

              {/* Reason / Notes */}
              <View style={styles.sectionBox}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>REASON / REMARKS (OPTIONAL)</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Overstocked, seal damaged, customer request..."
                  placeholderTextColor={theme.textMuted}
                  style={[styles.reasonInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
                  multiline={true}
                  numberOfLines={2}
                />
              </View>

              {/* Estimated Line Total Banner */}
              <View
                style={[
                  styles.lineTotalBanner,
                  {
                    backgroundColor: isDark ? "#042f2e" : "#f0fdf4",
                    borderColor: isDark ? "#134e4a" : "#bbf7d0"
                  }
                ]}
              >
                <Text style={[styles.lineTotalLabel, { color: theme.primary }]}>ESTIMATED RETURN VALUE</Text>
                <Text style={[styles.lineTotalAmount, { color: theme.primary }]}>{formatLKR(lineReturnTotal)}</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionBtnRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="md"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
                <Button
                  title={initialReturn ? "Update Return" : "Add Return"}
                  variant="primary"
                  size="md"
                  onPress={handleSubmit}
                  style={{ flex: 2 }}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  backdropTablet: {
    justifyContent: "center",
    padding: Spacing.xl
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "90%",
    paddingBottom: Spacing.xl
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  closeBtn: {
    padding: Spacing.xs
  },
  stepContainer: {
    padding: Spacing.base
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.ink,
    paddingVertical: 2
  },
  productList: {
    paddingBottom: Spacing.xl
  },
  productListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  itemCodeBadge: {
    fontSize: Typography.xs - 1,
    fontWeight: "800",
    color: Colors.leaf,
    backgroundColor: Colors.leafLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm
  },
  supplierText: {
    fontSize: Typography.xs - 1,
    color: Colors.textMuted
  },
  productNameText: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink,
    marginTop: 2
  },
  productPriceText: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  unitLabel: {
    fontSize: Typography.xs - 2,
    color: Colors.textMuted
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm
  },
  scrollDetailsContent: {
    gap: Spacing.base,
    paddingBottom: Spacing.xl
  },
  selectedProductCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  selectedProductName: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  unitValuationText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 4
  },
  changeProductBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border
  },
  changeProductText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  sectionBox: {
    gap: Spacing.xs
  },
  sectionLabel: {
    fontSize: Typography.xs - 1,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  conditionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  conditionChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: Colors.border
  },
  conditionChipActiveResellable: {
    backgroundColor: Colors.leafLight,
    borderColor: Colors.leaf
  },
  conditionChipActiveDamaged: {
    backgroundColor: "#fee2e2",
    borderColor: Colors.danger
  },
  conditionChipActiveExpired: {
    backgroundColor: "#fef3c7",
    borderColor: Colors.clay
  },
  conditionChipText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  conditionChipTextActive: {
    color: Colors.ink
  },
  conditionSubtext: {
    fontSize: Typography.xs - 1,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 15
  },
  reasonInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: Typography.sm,
    color: Colors.ink,
    minHeight: 60,
    textAlignVertical: "top"
  },
  lineTotalBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: Spacing.md,
    borderRadius: BorderRadius.md
  },
  lineTotalLabel: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.clay
  },
  lineTotalAmount: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.clay
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm
  },
  priceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  benchmarkPriceText: {
    fontSize: Typography.xs - 1,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48
  },
  priceInputWrapError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight
  },
  currencyPrefix: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.textSecondary,
    marginRight: 6
  },
  priceInput: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    height: "100%"
  },
  priceErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  priceErrorText: {
    fontSize: Typography.xs - 1,
    color: Colors.danger,
    fontWeight: "600"
  },
  priceHelpText: {
    fontSize: Typography.xs - 1,
    color: Colors.textMuted,
    marginTop: 2
  }
});
