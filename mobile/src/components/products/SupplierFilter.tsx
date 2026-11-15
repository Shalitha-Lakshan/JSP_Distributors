import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from "react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

export type SupplierFilterOption = "All" | "Ruhunu Foods" | "Gajamuthu Foods";

interface SupplierFilterProps {
  selected: SupplierFilterOption;
  onSelect: (supplier: SupplierFilterOption) => void;
  counts?: Partial<Record<SupplierFilterOption, number>>;
  style?: ViewStyle;
}

const SUPPLIER_OPTIONS: SupplierFilterOption[] = [
  "All",
  "Ruhunu Foods",
  "Gajamuthu Foods"
];

export const SupplierFilter: React.FC<SupplierFilterProps> = ({
  selected,
  onSelect,
  counts,
  style
}) => {
  return (
    <View style={[styles.wrapper, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {SUPPLIER_OPTIONS.map((supplier) => {
          const isSelected = selected === supplier;
          const count = counts?.[supplier];

          return (
            <Pressable
              key={supplier}
              onPress={() => onSelect(supplier)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.chip,
                isSelected ? styles.chipSelected : styles.chipUnselected,
                pressed && styles.chipPressed
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextSelected : styles.chipTextUnselected
                ]}
              >
                {supplier}
              </Text>
              {typeof count === "number" && (
                <View
                  style={[
                    styles.countBadge,
                    isSelected ? styles.countBadgeSelected : styles.countBadgeUnselected
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      isSelected ? styles.countTextSelected : styles.countTextUnselected
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: Spacing.xs
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    flexDirection: "row",
    alignItems: "center"
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5
  },
  chipUnselected: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border
  },
  chipSelected: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf
  },
  chipPressed: {
    opacity: 0.85
  },
  chipText: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  chipTextUnselected: {
    color: Colors.textSecondary
  },
  chipTextSelected: {
    color: Colors.textInverse
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full
  },
  countBadgeUnselected: {
    backgroundColor: Colors.surfaceSubtle
  },
  countBadgeSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.25)"
  },
  countText: {
    fontSize: 10,
    fontWeight: "800"
  },
  countTextUnselected: {
    color: Colors.textSecondary
  },
  countTextSelected: {
    color: Colors.textInverse
  }
});

