import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle
} from "react-native";
import { Check, Plus, X } from "lucide-react-native";
import { Product } from "../../types";
import { StockStatusBadge } from "./StockStatusBadge";
import { Badge } from "../common/Badge";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

interface ProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  cartQuantity?: number;
  categoryName?: string;
  isOffline?: boolean;
  style?: ViewStyle;
}

const formatLKR = (amount: number): string => {
  return `Rs. ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  cartQuantity = 0,
  categoryName,
  isOffline = false,
  style
}) => {
  const { theme, isDark } = useAppTheme();
  const isGajamuthu = product.supplier === "Gajamuthu Foods";
  const isOutOfStock = product.totalStock <= 0;
  const isMaxInCart = product.totalStock > 0 && cartQuantity >= product.totalStock;

  const numBilling =
    product.currentBillingPrice !== undefined
      ? Number(product.currentBillingPrice)
      : (product as any).customerBillingPrice !== undefined
      ? Number((product as any).customerBillingPrice)
      : (product as any).billingPrice !== undefined
      ? Number((product as any).billingPrice)
      : 0;

  const hasValidBillingPrice = !isNaN(numBilling) && numBilling > 0;
  const billingPrice = hasValidBillingPrice ? numBilling : null;

  const canAddToCart = !isOutOfStock && !isMaxInCart && hasValidBillingPrice;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        isOutOfStock && styles.cardOutOfStock,
        style
      ]}
    >
      {/* Top Meta Row: Item Code & Supplier Badge */}
      <View style={styles.topRow}>
        <View style={[styles.itemCodeContainer, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
          <Text style={[styles.itemCodeLabel, { color: theme.textMuted }]}>ITEM</Text>
          <Text style={[styles.itemCodeValue, { color: theme.textPrimary }]}>{product.itemCode}</Text>
        </View>

        <View style={styles.badgeGroup}>
          {isMaxInCart ? (
            <Badge
              label={`Max in Cart (${cartQuantity})`}
              variant="warning"
              size="sm"
              style={styles.metaBadge}
            />
          ) : cartQuantity > 0 ? (
            <Badge
              label={`In Cart (${cartQuantity})`}
              variant="success"
              size="sm"
              style={styles.metaBadge}
            />
          ) : null}
          {product.isFastMoving && (
            <Badge label="Fast Moving" variant="warning" size="sm" style={styles.metaBadge} />
          )}
          <Badge
            label={product.supplier || "Ruhunu Foods"}
            variant={isGajamuthu ? "info" : "leaf"}
            size="sm"
          />
        </View>
      </View>

      {/* Product Title and Variant */}
      <View style={styles.titleContainer}>
        <Text style={[styles.productName, { color: theme.textPrimary }, isOutOfStock && styles.textMuted]} numberOfLines={2}>
          {product.displayName || product.productName}
        </Text>
        <View style={styles.pillRow}>
          {product.variant ? (
            <View style={[styles.variantPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Text style={[styles.variantText, { color: theme.textSecondary }]}>{product.variant}</Text>
            </View>
          ) : null}
          {categoryName ? (
            <View style={[styles.categoryPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Text style={[styles.categoryText, { color: theme.textSecondary }]}>{categoryName}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Bottom Pricing & Stock Row */}
      <View style={styles.bottomRow}>
        <View style={styles.priceColumn}>
          <Text style={[styles.priceLabel, { color: theme.textMuted }]}>
            {product.hasMultiplePrices ? "FIFO BILLING" : "BILLING PRICE"}
          </Text>
          {hasValidBillingPrice ? (
            <Text
              style={[
                styles.priceValue,
                { color: isDark ? theme.leafLight || "#4ade80" : Colors.leaf },
                isOutOfStock && styles.priceValueMuted
              ]}
            >
              {product.hasMultiplePrices && product.minBillingPrice !== undefined
                ? `From ${formatLKR(product.minBillingPrice)}`
                : formatLKR(billingPrice!)}
            </Text>
          ) : (
            <Text style={[styles.priceUnavailableText, { color: theme.danger }]}>
              Billing Price Unavailable
            </Text>
          )}
        </View>

        <View style={styles.stockColumn}>
          <Text style={[styles.stockLabel, { color: theme.textSecondary }, isOutOfStock && { color: theme.danger }]}>
            {isOffline
              ? `Last known: ${product.totalStock} units`
              : product.totalStock > 0
              ? `${product.totalStock} units`
              : "Out of Stock"}
          </Text>
          <StockStatusBadge
            stock={product.totalStock}
            reorderLevel={product.reorderLevel}
            size="sm"
          />
        </View>

        {onAddToCart && (
          <TouchableOpacity
            style={[
              styles.quickAddBtn,
              { backgroundColor: theme.primary },
              !canAddToCart && styles.quickAddBtnDisabled,
              isMaxInCart && styles.quickAddBtnMax
            ]}
            onPress={() => {
              if (canAddToCart) {
                onAddToCart(product);
              }
            }}
            disabled={!canAddToCart}
            hitSlop={6}
            activeOpacity={canAddToCart ? 0.8 : 1}
            accessibilityLabel={
              !hasValidBillingPrice
                ? `${product.displayName}: Billing Price Unavailable`
                : isOutOfStock
                ? `${product.displayName} is out of stock`
                : isMaxInCart
                ? `Maximum stock (${product.totalStock}) already in cart`
                : `Add ${product.displayName} to cart`
            }
          >
            {isOutOfStock ? (
              <X size={14} color={theme.textMuted} />
            ) : isMaxInCart ? (
              <Check size={14} color={isDark ? "#0b1220" : "#ffffff"} />
            ) : (
              <Plus size={16} color={isDark ? "#0b1220" : "#ffffff"} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: Colors.borderDark,
    backgroundColor: "#fafbfc"
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm
  },
  itemCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.slatewash
  },
  itemCodeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    marginRight: 4,
    letterSpacing: 0.5
  },
  itemCodeValue: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: 0.5
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  metaBadge: {
    marginRight: 2
  },
  titleContainer: {
    marginBottom: Spacing.md
  },
  productName: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    lineHeight: 22,
    marginBottom: 6
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6
  },
  variantPill: {
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm
  },
  variantText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  categoryPill: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.leafDark
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    paddingTop: Spacing.sm + 2
  },
  priceColumn: {
    flex: 1,
    justifyContent: "flex-end"
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 2
  },
  priceValue: {
    fontSize: Typography.lg,
    fontWeight: "800"
  },
  priceUnavailableText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1
  },
  stockColumn: {
    alignItems: "flex-end",
    marginRight: Spacing.sm
  },
  stockLabel: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 3
  },
  quickAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.leaf,
    justifyContent: "center",
    alignItems: "center"
  },
  quickAddBtnDisabled: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.6
  },
  quickAddBtnMax: {
    backgroundColor: "#16a34a"
  },
  cardOutOfStock: {
    backgroundColor: "#fafaf9",
    borderColor: Colors.slatewash,
    opacity: 0.8
  },
  textMuted: {
    color: Colors.textSecondary
  },
  priceValueMuted: {
    color: Colors.textMuted
  }
});

