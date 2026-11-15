import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AlertCircle, Package, Tag, X } from "lucide-react-native";
import { Product } from "../../types";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { QuantitySelector } from "../pos/QuantitySelector";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

export interface QuantitySelectionModalProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
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

  // Reset quantity to 1 whenever product changes or modal opens
  useEffect(() => {
    setQuantity(1);
  }, [product?._id, visible]);

  // Unconditional hook declarations complete. Safe to early-return if no product
  if (!product) {
    return null;
  }

  const inStock = Number(product.totalStock || 0) > 0;
  const maxStock = Number(product.totalStock || 0);
  const remainingStock = Math.max(0, maxStock - cartQuantity);
  const canAdd = inStock && remainingStock > 0;
  const unitPrice = Number(product.currentSellingPrice || 0);
  const totalAmount = quantity * unitPrice;

  const handleConfirmAdd = () => {
    if (!canAdd || remainingStock <= 0) {
      return;
    }
    const safeQty = Math.max(1, Math.min(remainingStock, Math.floor(quantity)));
    onAddToCart(product, safeQty);
    onClose();
  };

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

              <Text style={styles.unitPriceText}>
                Unit: <Text style={{ fontWeight: "700", color: Colors.ink }}>{formatLKR(unitPrice)}</Text>
              </Text>
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
                  {!inStock
                    ? "This product has 0 available warehouse stock and cannot be added."
                    : `All available warehouse stock (${maxStock} units) is already in your cart.`}
                </Text>
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
                title={!inStock ? "Out of Stock (0 Available)" : "Max Stock Already in Cart"}
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

