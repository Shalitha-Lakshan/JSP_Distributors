import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from "react-native";
import { Banknote, CreditCard, FileCheck } from "lucide-react-native";
import { PaymentMethod } from "../../types";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface PaymentMethodPickerProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  allowCredit?: boolean;
  style?: ViewStyle;
}

export const PaymentMethodPicker: React.FC<PaymentMethodPickerProps> = ({
  selected,
  onSelect,
  allowCredit = true,
  style
}) => {
  const options: {
    id: PaymentMethod;
    label: string;
    sub: string;
    icon: (color: string) => React.ReactNode;
    disabled?: boolean;
  }[] = [
    {
      id: "cash",
      label: "Cash",
      sub: "Immediate cash",
      icon: (c) => <Banknote size={18} color={c} />
    },
    {
      id: "credit",
      label: "Credit",
      sub: "Billed to ledger",
      disabled: !allowCredit,
      icon: (c) => <CreditCard size={18} color={c} />
    },
    {
      id: "cheque",
      label: "Cheque",
      sub: "Route clearance",
      icon: (c) => <FileCheck size={18} color={c} />
    }
  ];

  return (
    <View style={[styles.container, style]}>
      {options.map((opt) => {
        const isSelected = selected === opt.id;
        const isDisabled = opt.disabled;

        return (
          <Pressable
            key={opt.id}
            onPress={() => !isDisabled && onSelect(opt.id)}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.btn,
              isSelected && styles.btnSelected,
              isDisabled && styles.btnDisabled,
              pressed && !isDisabled && styles.btnPressed
            ]}
          >
            <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
              {opt.icon(isSelected ? Colors.textInverse : isDisabled ? Colors.textMuted : Colors.ink)}
            </View>
            <Text style={[styles.label, isSelected && styles.labelSelected, isDisabled && styles.labelDisabled]}>
              {opt.label}
            </Text>
            <Text style={[styles.sub, isSelected && styles.subSelected, isDisabled && styles.labelDisabled]}>
              {opt.sub}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: Spacing.sm
  },
  btn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: "center"
  },
  btnSelected: {
    borderColor: Colors.leaf,
    backgroundColor: "#f0fdf4"
  },
  btnDisabled: {
    opacity: 0.45,
    backgroundColor: Colors.surfaceSubtle
  },
  btnPressed: {
    opacity: 0.85
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4
  },
  iconWrapSelected: {
    backgroundColor: Colors.leaf
  },
  label: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  labelSelected: {
    color: Colors.leaf
  },
  labelDisabled: {
    color: Colors.textMuted
  },
  sub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: "center"
  },
  subSelected: {
    color: "#166534"
  }
});

