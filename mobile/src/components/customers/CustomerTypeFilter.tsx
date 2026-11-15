import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { CustomerType } from "../../types";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

export type CustomerFilterOption = "all" | CustomerType;

interface FilterTab {
  key: CustomerFilterOption;
  label: string;
}

const FILTER_TABS: FilterTab[] = [
  { key: "all", label: "All" },
  { key: "retail", label: "Retail" },
  { key: "wholesale", label: "Wholesale" },
  { key: "credit", label: "Credit" },
  { key: "walk-in", label: "Walk-in" }
];

interface CustomerTypeFilterProps {
  selected: CustomerFilterOption;
  onSelect: (option: CustomerFilterOption) => void;
  counts?: Partial<Record<CustomerFilterOption, number>>;
}

export const CustomerTypeFilter: React.FC<CustomerTypeFilterProps> = ({
  selected,
  onSelect,
  counts
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = selected === tab.key;
          const count = counts ? counts[tab.key] : undefined;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.pill,
                isActive && styles.pillActive
              ]}
              onPress={() => onSelect(tab.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive && styles.pillTextActive
                ]}
              >
                {tab.label}
              </Text>

              {count !== undefined && (
                <View
                  style={[
                    styles.countBadge,
                    isActive && styles.countBadgeActive
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      isActive && styles.countTextActive
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    alignItems: "center"
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border
  },
  pillActive: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf
  },
  pillText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  pillTextActive: {
    color: Colors.textInverse,
    fontWeight: "700"
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle
  },
  countBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)"
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  countTextActive: {
    color: Colors.textInverse
  }
});

