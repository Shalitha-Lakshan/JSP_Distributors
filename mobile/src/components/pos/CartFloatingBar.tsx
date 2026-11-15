import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, ShoppingBag } from "lucide-react-native";
import { useCartStore } from "../../store/cartStore";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

const formatLKR = (val: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;

export const CartFloatingBar: React.FC = () => {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const getTotalQuantity = useCartStore((state) => state.getTotalQuantity);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const transactionMode = useCartStore((state) => state.transactionMode);

  if (items.length === 0) return null;

  const totalQty = getTotalQuantity();
  const subtotal = getSubtotal();

  return (
    <View style={styles.floatingWrapper}>
      <Pressable
        onPress={() => router.push("/pos/cart" as any)}
        accessibilityRole="button"
        accessibilityLabel="View Cart and Checkout"
        style={({ pressed }) => [
          styles.container,
          pressed && styles.containerPressed
        ]}
      >
        <View style={styles.leftSection}>
          <View style={styles.iconCircle}>
            <ShoppingBag size={18} color={Colors.textInverse} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalQty}</Text>
            </View>
          </View>
          <View style={styles.metaInfo}>
            <Text style={styles.modeText}>
              {transactionMode === "order" ? "Van Pre-Order" : "Direct POS Sale"}
            </Text>
            <Text style={styles.itemSummary}>
              {items.length} {items.length === 1 ? "line" : "lines"} ({totalQty} units)
            </Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <View style={styles.amountBox}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>{formatLKR(subtotal)}</Text>
          </View>
          <View style={styles.arrowCircle}>
            <ChevronRight size={16} color={Colors.leaf} />
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: "absolute",
    bottom: Spacing.base,
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 999
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.ink,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  containerPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }]
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center"
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.leaf,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    position: "relative"
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.clay,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.ink
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: Colors.textInverse
  },
  metaInfo: {
    justifyContent: "center"
  },
  modeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.leafLight,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  itemSummary: {
    fontSize: Typography.xs,
    color: Colors.slatewash,
    fontWeight: "500"
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm
  },
  amountBox: {
    alignItems: "flex-end"
  },
  totalLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  totalAmount: {
    fontSize: Typography.base,
    fontWeight: "900",
    color: Colors.textInverse
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center"
  }
});

