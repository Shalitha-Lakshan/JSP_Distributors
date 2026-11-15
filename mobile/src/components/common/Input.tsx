import React, { ElementRef, forwardRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
  required?: boolean;
  disabled?: boolean;
}

export const Input = forwardRef<ElementRef<typeof TextInput>, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      isPassword = false,
      required = false,
      disabled = false,
      style,
      onFocus,
      onBlur,
      editable,
      ...props
    },
    ref
  ) => {
    const { theme, isDark } = useAppTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(!isPassword);

    return (
      <View style={styles.container}>
        {label && (
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
            {required && <Text style={[styles.requiredAsterisk, { color: theme.danger }]}> *</Text>}
          </View>
        )}

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: disabled ? theme.surfaceSubtle : theme.surface,
              borderColor: error
                ? theme.danger
                : isFocused
                ? theme.primary
                : theme.border
            },
            disabled && styles.disabledContainer
          ]}
        >
          {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            placeholderTextColor={theme.textMuted}
            secureTextEntry={isPassword && !showPassword}
            editable={disabled ? false : editable}
            style={[
              styles.textInput,
              { color: theme.textPrimary },
              style,
              disabled && { color: theme.textMuted }
            ]}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />

          {isPassword && (
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showPassword ? (
                <EyeOff size={18} color={theme.textSecondary} />
              ) : (
                <Eye size={18} color={theme.textSecondary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs + 2
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  requiredAsterisk: {
    color: Colors.danger,
    fontSize: Typography.sm
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 50
  },
  unfocusedInput: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  // CRITICAL FIX: Only change borderColor & backgroundColor on focus.
  // Never add elevation, shadow, margin, or layout shifts on focus,
  // as dynamic elevation on Android invalidates View hierarchy and drops focus.
  focusedInput: {
    borderColor: Colors.leaf,
    backgroundColor: "#ffffff"
  },
  errorInput: {
    borderColor: Colors.danger,
    backgroundColor: "#fffbfa"
  },
  disabledContainer: {
    backgroundColor: Colors.surfaceSubtle,
    borderColor: Colors.border,
    opacity: 0.7
  },
  disabledInput: {
    color: Colors.textMuted
  },
  leftIconWrapper: {
    marginRight: Spacing.sm
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    paddingVertical: Platform.OS === "android" ? Spacing.sm : Spacing.md,
    minHeight: 44
  },
  eyeButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.xs,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs
  }
});
