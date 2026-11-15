import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

export type StockStatusType = "in_stock" | "low_stock" | "out_of_stock";

interface StockStatusBadgeProps {
  stock: number;
  reorderLevel?: number;
  size?: "sm" | "md";
  showCount?: boolean;
  style?: ViewStyle;
}

export const getStockStatus = (
  stock: number,
  reorderLevel: number = 0
): { status: StockStatusType; label: string; countLabel: string } => {
  const effectiveReorder = reorderLevel > 0 ? reorderLevel : 10;

  if (stock <= 0) {
    return {
      status: "out_of_stock",
      label: "Out of Stock",
      countLabel: "0 in stock"
    };
  }

  if (stock <= effectiveReorder) {
    return {
      status: "low_stock",
      label: "Low Stock",
      countLabel: `${stock} left`
    };
  }

  return {
    status: "in_stock",
    label: "In Stock",
    countLabel: `${stock} in stock`
  };
};

export const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({
  stock,
  reorderLevel = 0,
  size = "sm",
  showCount = false,
  style
}) => {
  const { status, label, countLabel } = getStockStatus(stock, reorderLevel);

  const getContainerStyle = () => {
    switch (status) {
      case "in_stock":
        return styles.inStockContainer;
      case "low_stock":
        return styles.lowStockContainer;
      case "out_of_stock":
        return styles.outOfStockContainer;
    }
  };

  const getDotStyle = () => {
    switch (status) {
      case "in_stock":
        return styles.inStockDot;
      case "low_stock":
        return styles.lowStockDot;
      case "out_of_stock":
        return styles.outOfStockDot;
    }
  };

  const getTextStyle = () => {
    switch (status) {
      case "in_stock":
        return styles.inStockText;
      case "low_stock":
        return styles.lowStockText;
      case "out_of_stock":
        return styles.outOfStockText;
    }
  };

  const displayText = showCount ? countLabel : label;

  return (
    <View
      style={[
        styles.base,
        getContainerStyle(),
        size === "sm" ? styles.sm : styles.md,
        style
      ]}
    >
      <View style={[styles.dot, getDotStyle()]} />
      <Text style={[styles.text, getTextStyle(), size === "sm" && styles.textSm]}>
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start"
  },
  sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  text: {
    fontSize: Typography.xs,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  textSm: {
    fontSize: 10
  },
  // In stock
  inStockContainer: {
    backgroundColor: Colors.successLight
  },
  inStockDot: {
    backgroundColor: Colors.success
  },
  inStockText: {
    color: "#047857"
  },
  // Low stock
  lowStockContainer: {
    backgroundColor: Colors.warningLight
  },
  lowStockDot: {
    backgroundColor: Colors.warning
  },
  lowStockText: {
    color: "#b45309"
  },
  // Out of stock
  outOfStockContainer: {
    backgroundColor: Colors.dangerLight
  },
  outOfStockDot: {
    backgroundColor: Colors.danger
  },
  outOfStockText: {
    color: Colors.danger
  }
});

