import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Banknote, Landmark } from "lucide-react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface PaymentMethodSelectorProps {
  selected: "cash" | "cheque";
  onSelect: (method: "cash" | "cheque") => void;
  disabled?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selected,
  onSelect,
  disabled = false
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>COLLECTION METHOD</Text>
      <View style={styles.grid}>
        {/* Cash Option */}
        <TouchableOpacity
          style={[
            styles.option,
            selected === "cash" && styles.optionSelected,
            disabled && styles.optionDisabled
          ]}
          onPress={() => onSelect("cash")}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === "cash" }}
        >
          <View
            style={[
              styles.iconWrap,
              selected === "cash" ? styles.iconWrapActive : styles.iconWrapInactive
            ]}
          >
            <Banknote
              size={20}
              color={selected === "cash" ? Colors.leaf : Colors.textSecondary}
            />
          </View>
          <View style={styles.textGroup}>
            <Text
              style={[
                styles.optionTitle,
                selected === "cash" && styles.optionTitleSelected
              ]}
            >
              Cash Collection
            </Text>
            <Text style={styles.optionSubtitle}>Immediate cleared funds</Text>
          </View>
        </TouchableOpacity>

        {/* Cheque Option */}
        <TouchableOpacity
          style={[
            styles.option,
            selected === "cheque" && styles.optionSelected,
            disabled && styles.optionDisabled
          ]}
          onPress={() => onSelect("cheque")}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === "cheque" }}
        >
          <View
            style={[
              styles.iconWrap,
              selected === "cheque" ? styles.iconWrapActive : styles.iconWrapInactive
            ]}
          >
            <Landmark
              size={20}
              color={selected === "cheque" ? Colors.leaf : Colors.textSecondary}
            />
          </View>
          <View style={styles.textGroup}>
            <Text
              style={[
                styles.optionTitle,
                selected === "cheque" && styles.optionTitleSelected
              ]}
            >
              Cheque Payment
            </Text>
            <Text style={styles.optionSubtitle}>Pending bank deposit</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base
  },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: Spacing.xs
  },
  grid: {
    flexDirection: "row",
    gap: Spacing.sm
  },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border
  },
  optionSelected: {
    borderColor: Colors.leaf,
    backgroundColor: "rgba(15, 118, 110, 0.04)"
  },
  optionDisabled: {
    opacity: 0.5
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm
  },
  iconWrapActive: {
    backgroundColor: Colors.leafLight
  },
  iconWrapInactive: {
    backgroundColor: Colors.surfaceSubtle
  },
  textGroup: {
    flex: 1
  },
  optionTitle: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  optionTitleSelected: {
    color: Colors.leafDark
  },
  optionSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1
  }
});

