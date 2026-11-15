import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle
} from "react-native";
import { AlertCircle, Minus, Plus } from "lucide-react-native";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

export interface QuantitySelectorProps {
  quantity: number;
  onChangeQuantity?: (newQuantity: number) => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  style?: ViewStyle;
  showWarning?: boolean;
  onWarning?: (warning: string | null) => void;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onChangeQuantity,
  onIncrement,
  onDecrement,
  min = 1,
  max,
  size = "md",
  disabled = false,
  style,
  showWarning = false,
  onWarning
}) => {
  const isSm = size === "sm";
  const isLg = size === "lg";

  // Local text input state to allow smooth typing without parent re-render fighting
  const [textVal, setTextVal] = useState<string>(String(quantity || min));
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const isEditingRef = useRef(false);

  // Sync external quantity changes when not actively typing
  useEffect(() => {
    if (!isEditingRef.current) {
      setTextVal(String(quantity));
      if (max !== undefined && quantity > max) {
        const msg = `Only ${max} units available.`;
        setLocalWarning(msg);
        onWarning?.(msg);
      } else {
        setLocalWarning(null);
        onWarning?.(null);
      }
    }
  }, [quantity, max]);

  const canDecrement = !disabled && quantity > min;
  const canIncrement = !disabled && (max === undefined || quantity < max);

  const handleMinusPress = () => {
    if (disabled || !canDecrement) return;
    const next = Math.max(min, (quantity || min) - 1);
    setTextVal(String(next));
    setLocalWarning(null);
    onWarning?.(null);

    if (onDecrement) {
      onDecrement();
    } else if (onChangeQuantity) {
      onChangeQuantity(next);
    }
  };

  const handlePlusPress = () => {
    if (disabled || !canIncrement) return;
    const next = (quantity || min) + 1;
    if (max !== undefined && next > max) {
      const msg = `Only ${max} units available.`;
      setLocalWarning(msg);
      onWarning?.(msg);
      return;
    }
    setTextVal(String(next));
    setLocalWarning(null);
    onWarning?.(null);

    if (onIncrement) {
      onIncrement();
    } else if (onChangeQuantity) {
      onChangeQuantity(next);
    }
  };

  const handleTextChange = (raw: string) => {
    // Only accept whole positive digits
    const cleaned = raw.replace(/[^0-9]/g, "");
    setTextVal(cleaned);

    // If completely cleared while typing, keep local empty string but don't commit yet
    if (cleaned === "") {
      setLocalWarning(null);
      onWarning?.(null);
      return;
    }

    const parsed = parseInt(cleaned, 10);
    if (isNaN(parsed)) return;

    if (max !== undefined && parsed > max) {
      const msg = `Only ${max} units available.`;
      setLocalWarning(msg);
      onWarning?.(msg);
    } else {
      setLocalWarning(null);
      onWarning?.(null);
      if (parsed >= min) {
        onChangeQuantity?.(parsed);
      }
    }
  };

  const commitValidation = () => {
    isEditingRef.current = false;
    let parsed = parseInt(textVal, 10);

    if (isNaN(parsed) || parsed < min) {
      parsed = min;
    }

    if (max !== undefined && parsed > max) {
      parsed = max;
      const msg = `Only ${max} units available.`;
      setLocalWarning(msg);
      onWarning?.(msg);
    } else {
      setLocalWarning(null);
      onWarning?.(null);
    }

    setTextVal(String(parsed));
    onChangeQuantity?.(parsed);
  };

  const { theme, isDark } = useAppTheme();

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.surfaceSubtle,
            borderColor: localWarning ? theme.danger : theme.border
          },
          isSm && styles.containerSm,
          isLg && styles.containerLg,
          disabled && styles.containerDisabled
        ]}
      >
        {/* Decrement Button */}
        <Pressable
          onPress={handleMinusPress}
          disabled={!canDecrement}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border
            },
            isSm && styles.btnSm,
            isLg && styles.btnLg,
            !canDecrement && styles.btnDisabled,
            pressed && canDecrement && { backgroundColor: theme.borderSubtle }
          ]}
        >
          <Minus
            size={isSm ? 12 : isLg ? 16 : 14}
            color={canDecrement ? theme.textPrimary : theme.textMuted}
          />
        </Pressable>

        {/* Editable Quantity TextInput */}
        <View style={[styles.inputBox, isSm && styles.inputBoxSm, isLg && styles.inputBoxLg]}>
          <TextInput
            style={[
              styles.input,
              { color: theme.textPrimary },
              isSm && styles.inputSm,
              isLg && styles.inputLg,
              disabled && { color: theme.textMuted }
            ]}
            value={textVal}
            onChangeText={handleTextChange}
            onFocus={() => {
              isEditingRef.current = true;
            }}
            onBlur={commitValidation}
            onSubmitEditing={commitValidation}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus={true}
            blurOnSubmit={true}
            editable={!disabled}
            maxLength={5}
            accessibilityLabel="Quantity value"
            accessibilityHint="Type a number to set the quantity"
          />
        </View>

        {/* Increment Button */}
        <Pressable
          onPress={handlePlusPress}
          disabled={!canIncrement}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border
            },
            isSm && styles.btnSm,
            isLg && styles.btnLg,
            !canIncrement && styles.btnDisabled,
            pressed && canIncrement && { backgroundColor: theme.borderSubtle }
          ]}
        >
          <Plus
            size={isSm ? 12 : isLg ? 16 : 14}
            color={canIncrement ? theme.textPrimary : theme.textMuted}
          />
        </Pressable>
      </View>

      {/* Optional In-Place Warning Message */}
      {showWarning && localWarning ? (
        <View style={styles.warningRow}>
          <AlertCircle size={12} color={theme.danger} style={{ marginRight: 4 }} />
          <Text style={[styles.warningText, { color: theme.danger }]}>{localWarning}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center"
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 2
  },
  containerSm: {
    borderRadius: BorderRadius.sm,
    padding: 1
  },
  containerLg: {
    borderRadius: BorderRadius.lg,
    padding: 3
  },
  containerDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.surfaceSubtle
  },
  containerWarning: {
    borderColor: Colors.danger,
    backgroundColor: "#fffafa"
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border
  },
  btnSm: {
    width: 24,
    height: 24,
    borderRadius: 3
  },
  btnLg: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md
  },
  btnPressed: {
    backgroundColor: Colors.slatewash
  },
  btnDisabled: {
    opacity: 0.35,
    borderColor: "transparent"
  },
  inputBox: {
    minWidth: 44,
    paddingHorizontal: Spacing.xs,
    justifyContent: "center",
    alignItems: "center"
  },
  inputBoxSm: {
    minWidth: 30,
    paddingHorizontal: 2
  },
  inputBoxLg: {
    minWidth: 60,
    paddingHorizontal: Spacing.sm
  },
  input: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink,
    textAlign: "center",
    paddingVertical: 2,
    paddingHorizontal: 4,
    minHeight: 28
  },
  inputSm: {
    fontSize: Typography.xs,
    minHeight: 22,
    paddingVertical: 0
  },
  inputLg: {
    fontSize: Typography.base,
    minHeight: 36,
    paddingVertical: 4
  },
  inputDisabled: {
    color: Colors.textMuted
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingHorizontal: 4
  },
  warningText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.danger
  }
});
