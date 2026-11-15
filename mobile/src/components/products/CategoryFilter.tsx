import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from "react-native";
import { Category } from "../../types";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface CategoryFilterProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  style?: ViewStyle;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  style
}) => {
  // If no categories loaded yet, don't show empty bar or just show All
  const activeCategories = categories.filter((c) => c.status === "active");

  return (
    <View style={[styles.wrapper, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All Categories Chip */}
        <Pressable
          onPress={() => onSelectCategory("all")}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedCategoryId === "all" }}
          style={({ pressed }) => [
            styles.chip,
            selectedCategoryId === "all" ? styles.chipSelected : styles.chipUnselected,
            pressed && styles.chipPressed
          ]}
        >
          <Text
            style={[
              styles.chipText,
              selectedCategoryId === "all"
                ? styles.chipTextSelected
                : styles.chipTextUnselected
            ]}
          >
            All Categories
          </Text>
        </Pressable>

        {/* Dynamic Categories from Backend */}
        {activeCategories.map((cat) => {
          const isSelected = selectedCategoryId === cat._id;

          return (
            <Pressable
              key={cat._id}
              onPress={() => onSelectCategory(cat._id)}
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
                {cat.name}
              </Text>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: Colors.surface
  },
  chipUnselected: {
    borderColor: Colors.border
  },
  chipSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink
  },
  chipPressed: {
    opacity: 0.85
  },
  chipText: {
    fontSize: Typography.xs,
    fontWeight: "600"
  },
  chipTextUnselected: {
    color: Colors.textSecondary
  },
  chipTextSelected: {
    color: Colors.textInverse
  }
});

