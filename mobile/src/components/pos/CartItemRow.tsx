import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AlertCircle, AlertTriangle, Trash2 } from "lucide-react-native";
import { CartItem } from "../../types";
import { QuantitySelector } from "./QuantitySelector";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface CartItemRowProps {
  item: CartItem;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

const formatLKR = (val: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onIncrement,
  onDecrement,
  onUpdateQuantity,
  onRemove
}) => {
  const isOutOfStock = item.totalStock <= 0;
  const isOverStock = item.quantity > item.totalStock;

  return (
    <View style={[styles.card, (isOutOfStock || isOverStock) && styles.cardWarning]}>
      {/* Top Header: Item Code & Trash */}
      <View style={styles.topRow}>
        <View style={[styles.codeBadge, isOutOfStock && styles.codeBadgeDanger]}>
          <Text style={[styles.codeText, isOutOfStock && styles.codeTextDanger]}>
            {item.itemCode}
          </Text>
        </View>

        <Pressable
          onPress={() => onRemove(item.productId)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.displayName} from cart`}
          style={({ pressed }) => [
            styles.removeBtn,
            pressed && styles.removeBtnPressed
          ]}
        >
          <Trash2 size={16} color={Colors.danger} />
        </Pressable>
      </View>

      {/* Product Name & Variant */}
      <Text style={styles.productName} numberOfLines={2}>
        {item.displayName || item.productName}
      </Text>
      <View style={styles.metaRow}>
        {item.variant ? (
          <View style={styles.variantPill}>
            <Text style={styles.variantText}>{item.variant}</Text>
          </View>
        ) : null}
        <Text style={[styles.stockInfo, isOutOfStock && { color: Colors.danger, fontWeight: "700" }]}>
          Stock: {item.totalStock > 0 ? `${item.totalStock} units available` : "0 units (Out of Stock)"}
        </Text>
      </View>

      {/* Stock warning if 0 stock */}
      {isOutOfStock ? (
        <View style={styles.dangerBox}>
          <AlertCircle size={14} color={Colors.danger} style={{ marginRight: 6 }} />
          <Text style={styles.dangerText}>
            OUT OF STOCK: Item is currently unavailable. Remove this item to proceed with checkout.
          </Text>
        </View>
      ) : isOverStock ? (
        <View style={styles.warningBox}>
          <AlertTriangle size={14} color="#b45309" style={{ marginRight: 6 }} />
          <Text style={styles.warningText}>
            Requested ({item.quantity}) exceeds available stock ({item.totalStock}). Reduce quantity to proceed.
          </Text>
        </View>
      ) : null}

      {/* Bottom Controls Row: Unit Price & Quantity & Line Total */}
      <View style={styles.bottomRow}>
        <View style={styles.priceCol}>
          <Text style={styles.unitPriceLabel}>UNIT</Text>
          <Text style={styles.unitPriceValue}>{formatLKR(item.sellingPrice)}</Text>
        </View>

        <QuantitySelector
          quantity={item.quantity}
          onChangeQuantity={(q) => onUpdateQuantity?.(item.productId, q)}
          onIncrement={() => onIncrement(item.productId)}
          onDecrement={() => onDecrement(item.productId)}
          min={1}
          max={Math.max(1, item.totalStock)}
          size="md"
          showWarning={true}
        />

        <View style={styles.lineTotalCol}>
          <Text style={styles.lineTotalLabel}>LINE TOTAL</Text>
          <Text style={styles.lineTotalValue}>{formatLKR(item.lineTotal)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  cardWarning: {
    borderColor: "#fca5a5",
    backgroundColor: "#fffafa"
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  codeBadge: {
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.slatewash
  },
  codeBadgeDanger: {
    backgroundColor: Colors.dangerLight,
    borderColor: "#fca5a5"
  },
  codeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: 0.5
  },
  codeTextDanger: {
    color: Colors.danger
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dangerLight,
    justifyContent: "center",
    alignItems: "center"
  },
  removeBtnPressed: {
    opacity: 0.7
  },
  productName: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    lineHeight: 20,
    marginBottom: 4
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm
  },
  variantPill: {
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm
  },
  variantText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  stockInfo: {
    fontSize: 11,
    color: Colors.textMuted
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm
  },
  warningText: {
    fontSize: 10,
    color: "#92400e",
    fontWeight: "600",
    flex: 1
  },
  dangerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm
  },
  dangerText: {
    fontSize: 10,
    color: Colors.danger,
    fontWeight: "700",
    flex: 1
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    paddingTop: Spacing.sm
  },
  priceCol: {
    minWidth: 70
  },
  unitPriceLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  unitPriceValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  lineTotalCol: {
    alignItems: "flex-end",
    minWidth: 80
  },
  lineTotalLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  lineTotalValue: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.leaf
  }
});

