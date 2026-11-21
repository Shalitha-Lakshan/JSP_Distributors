import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AlertCircle, Package, Tag, X } from "lucide-react-native";
import { FifoAllocation, Product, StockBatch } from "../../types";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { QuantitySelector } from "../pos/QuantitySelector";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";
import { calculateFifoAllocation } from "../../utils/fifo";
import { fetchBatchesForProduct } from "../../api/products";

export interface QuantitySelectionModalProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, allocations?: FifoAllocation[]) => void;
  cartQuantity?: number;
}

const formatLKR = (amount: number): string => {
  return `Rs. ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const QuantitySelectionModal: React.FC<QuantitySelectionModalProps> = ({
  product,
  visible,
  onClose,
  onAddToCart,
  cartQuantity = 0
}) => {
  const { isTablet, modalMaxWidth } = useResponsive();
  const [quantity, setQuantity] = useState(1);
  const [liveBatches, setLiveBatches] = useState<StockBatch[]>(product?.batches || []);

  // Reset quantity to 1 and ensure live FIFO batches are fetched whenever product changes or modal opens
  useEffect(() => {
    setQuantity(1);
    if (product?._id) {
      if (Array.isArray(product.batches) && product.batches.length > 0) {
        setLiveBatches(product.batches);
      } else {
        fetchBatchesForProduct(product._id).then((batches) => {
          if (batches.length > 0) {
            setLiveBatches(batches);
          }
        });
      }
    }
  }, [product?._id, visible]);

  const numBilling =
    product?.currentBillingPrice !== undefined
      ? Number(product.currentBillingPrice)
      : (product as any)?.customerBillingPrice !== undefined
      ? Number((product as any).customerBillingPrice)
      : (product as any)?.billingPrice !== undefined
      ? Number((product as any).billingPrice)
      : 0;

  const hasValidBillingPrice = !isNaN(numBilling) && numBilling > 0;
  const billingPrice = hasValidBillingPrice ? numBilling : null;

  const inStock = Number(product?.totalStock || 0) > 0;
  const maxStock = Number(product?.totalStock || 0);
  const remainingStock = Math.max(0, maxStock - cartQuantity);

  const safeQty = Math.max(1, Math.min(remainingStock, Math.floor(quantity)));

  const activeBatches = liveBatches.length > 0 ? liveBatches : product?.batches;

  const fifoResult = useMemo(() => {
    if (!product || !hasValidBillingPrice || safeQty <= 0) {
      return {
        allocations: [],
        allocatedQty: 0,
        lineTotal: 0,
        effectiveUnitPrice: 0,
        hasMultipleBatches: false,
        isFullyAllocated: false,
        isPricingUnavailable: true
      };
    }
    return calculateFifoAllocation(
      activeBatches,
      safeQty,
      billingPrice!,
      product.currentSellingPrice
    );
  }, [product, safeQty, hasValidBillingPrice, billingPrice, activeBatches]);

  const canAdd =
    Boolean(product) &&
    inStock &&
    remainingStock > 0 &&
    hasValidBillingPrice &&
    !fifoResult.isPricingUnavailable &&
    fifoResult.allocations.length > 0;

  const totalAmount = fifoResult.lineTotal;

  const handleConfirmAdd = () => {
    if (!product || !canAdd || remainingStock <= 0) {
      return;
    }
    onAddToCart(product, safeQty, fifoResult.allocations);
    onClose();
  };

  // All React Hooks have been declared unconditionally above. Safe to early-return if no product or not visible.
  if (!visible || !product) {
    return null;
  }

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
            isTablet && {
              width: modalMaxWidth,
              borderRadius: BorderRadius.xl + 4,
              alignSelf: "center",
              marginBottom: Spacing.xl
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Select Quantity</Text>
              <Text style={styles.headerSubtitle}>Set unit count for order / sale</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close quantity picker"
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed
              ]}
            >
              <X size={18} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Product Summary Card */}
          <View style={styles.productSummaryCard}>
            <View style={styles.metaRow}>
              <View style={styles.itemCodeBadge}>
                <Text style={styles.itemCodeText}>{product.itemCode}</Text>
              </View>
              <Badge
                label={product.supplier || "Ruhunu Foods"}
                variant={product.supplier === "Gajamuthu Foods" ? "info" : "leaf"}
                size="sm"
              />
            </View>

            <Text style={styles.productName} numberOfLines={2}>
              {product.displayName || product.productName}
            </Text>

            <View style={styles.detailsRow}>
              {product.variant ? (
                <View style={styles.variantPill}>
                  <Tag size={12} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.variantText}>{product.variant}</Text>
                </View>
              ) : null}

              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: Colors.textMuted, letterSpacing: 0.5 }}>
                  BILLING PRICE
                </Text>
                {hasValidBillingPrice ? (
                  <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.leaf }}>
                    {formatLKR(billingPrice!)}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.danger }}>
                    Billing Price Unavailable
                  </Text>
                )}
              </View>
            </View>

            {/* Warehouse Stock Alert */}
            <View style={[styles.stockBadgeRow, !inStock && styles.stockBadgeRowDanger]}>
              <Package size={14} color={inStock ? Colors.leaf : Colors.danger} style={{ marginRight: 6 }} />
              <Text style={[styles.stockText, !inStock && { color: Colors.danger, fontWeight: "700" }]}>
                {!inStock
                  ? "Out of Stock (0 units)"
                  : cartQuantity > 0
                  ? `Warehouse: ${maxStock} units (${cartQuantity} in cart • ${remainingStock} more available)`
                  : `Available warehouse stock: ${maxStock} units`}
              </Text>
            </View>
          </View>

          {/* Quantity Selector Section */}
          <View style={styles.selectorSection}>
            <Text style={styles.sectionLabel}>ENTER OR ADJUST QUANTITY</Text>

            {canAdd ? (
              <QuantitySelector
                quantity={quantity}
                onChangeQuantity={setQuantity}
                min={1}
                max={remainingStock}
                size="lg"
                showWarning={true}
              />
            ) : (
              <View style={styles.outOfStockBox}>
                <AlertCircle size={16} color={Colors.danger} style={{ marginRight: 6 }} />
                <Text style={styles.outOfStockBoxText}>
                  {!hasValidBillingPrice
                    ? "Billing Price Unavailable: This product cannot be added to a bill without an approved Customer Billing Price."
                    : !inStock
                    ? "This product has 0 available warehouse stock and cannot be added."
                    : `All available warehouse stock (${maxStock} units) is already in your cart.`}
                </Text>
              </View>
            )}

            {canAdd && fifoResult.allocations.length > 0 && (
              <View style={styles.fifoContainer}>
                <Text style={styles.fifoHeaderTitle}>FIFO BATCH ALLOCATION</Text>
                {fifoResult.allocations.map((alloc) => (
                  <View key={alloc.label + alloc.batchId} style={styles.fifoRow}>
                    <Text style={styles.fifoBatchLabel}>
                      {alloc.label} • Batch {alloc.batchNo}
                    </Text>
                    <Text style={styles.fifoBatchMath}>
                      {alloc.quantity} × {formatLKR(alloc.billingPrice)} ={" "}
                      <Text style={styles.fifoBatchTotal}>{formatLKR(alloc.lineTotal)}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {canAdd && (
              <View style={styles.totalPreviewRow}>
                <Text style={styles.totalPreviewLabel}>Line Total</Text>
                <Text style={styles.totalPreviewVal}>{formatLKR(totalAmount)}</Text>
              </View>
            )}
          </View>

          {/* Action Button */}
          <View style={styles.footer}>
            {canAdd ? (
              <Button
                title={`Add to Cart • ${formatLKR(totalAmount)}`}
                variant="primary"
                size="lg"
                onPress={handleConfirmAdd}
                style={styles.actionBtn}
              />
            ) : (
              <Button
                title={
                  fifoResult.isPricingUnavailable
                    ? "FIFO Pricing Unavailable"
                    : !hasValidBillingPrice
                    ? "Billing Price Unavailable"
                    : !inStock
                    ? "Out of Stock (0 Available)"
                    : "Max Stock Already in Cart"
                }
                variant="secondary"
                size="lg"
                disabled={true}
                style={styles.actionBtn}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end"
  },
  backdropTablet: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg
  },
  backdropDismiss: {
    flex: 1
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl + 4,
    borderTopRightRadius: BorderRadius.xl + 4,
    paddingBottom: Platform.OS === "ios" ? 34 : Spacing.xl,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  headerTitleGroup: {
    flex: 1
  },
  headerTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 1
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center"
  },
  closeButtonPressed: {
    backgroundColor: Colors.slatewash
  },
  productSummaryCard: {
    margin: Spacing.base,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  itemCodeBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border
  },
  itemCodeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: 0.5
  },
  productName: {
    fontSize: Typography.sm + 1,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: Spacing.xs
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2
  },
  variantPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm
  },
  variantText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "500"
  },
  unitPriceText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  stockBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm
  },
  stockBadgeRowDanger: {
    backgroundColor: Colors.dangerLight
  },
  stockText: {
    fontSize: Typography.xs,
    color: Colors.leafDark,
    fontWeight: "600"
  },
  selectorSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.md
  },
  outOfStockBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md
  },
  outOfStockBoxText: {
    fontSize: Typography.xs,
    color: Colors.danger,
    fontWeight: "600"
  },
  totalPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  fifoContainer: {
    width: "100%",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  fifoHeaderTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs
  },
  fifoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3
  },
  fifoBatchLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textPrimary
  },
  fifoBatchMath: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  fifoBatchTotal: {
    fontWeight: "800",
    color: Colors.leaf
  },
  totalPreviewLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  totalPreviewVal: {
    fontSize: Typography.base,
    fontWeight: "900",
    color: Colors.leaf
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm
  },
  actionBtn: {
    width: "100%"
  }
});

