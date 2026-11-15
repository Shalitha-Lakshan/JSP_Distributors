import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View
} from "react-native";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  style,
  ...props
}) => {
  const { theme, isDark } = useAppTheme();
  const isInteractive = !disabled && !loading;

  const getContainerDynamicStyle = () => {
    switch (variant) {
      case "secondary":
        return {
          backgroundColor: theme.surface,
          borderColor: theme.primary
        };
      case "danger":
        return {
          backgroundColor: theme.danger
        };
      case "ghost":
        return {
          backgroundColor: "transparent"
        };
      default:
        return {
          backgroundColor: theme.primary,
          shadowColor: theme.primary
        };
    }
  };

  const getTextDynamicStyle = () => {
    switch (variant) {
      case "secondary":
      case "ghost":
        return { color: theme.primary };
      case "danger":
        return { color: "#ffffff" };
      default:
        return { color: isDark ? "#0b1220" : "#ffffff" };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case "sm":
        return styles.smSize;
      case "lg":
        return styles.lgSize;
      default:
        return styles.mdSize;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!isInteractive}
      style={[
        styles.base,
        getContainerDynamicStyle(),
        getSizeStyle(),
        !isInteractive && styles.disabledContainer,
        style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "secondary" || variant === "ghost" ? theme.primary : isDark ? "#0b1220" : "#ffffff"}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text style={[styles.baseText, getTextDynamicStyle(), !isInteractive && styles.disabledText]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapper: {
    marginRight: Spacing.sm
  },
  baseText: {
    fontWeight: "600",
    letterSpacing: 0.2
  },

  // Variants
  primaryContainer: {
    backgroundColor: Colors.leaf,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  primaryText: {
    color: Colors.textInverse,
    fontSize: Typography.base
  },
  secondaryContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.leaf
  },
  secondaryText: {
    color: Colors.leaf,
    fontSize: Typography.base
  },
  dangerContainer: {
    backgroundColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  dangerText: {
    color: Colors.textInverse,
    fontSize: Typography.base
  },
  ghostContainer: {
    backgroundColor: "transparent"
  },
  ghostText: {
    color: Colors.leaf,
    fontSize: Typography.base
  },

  // Sizes
  smSize: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md
  },
  mdSize: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl
  },
  lgSize: {
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xxl
  },

  // Disabled
  disabledContainer: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0
  },
  disabledText: {
    opacity: 0.9
  }
});

