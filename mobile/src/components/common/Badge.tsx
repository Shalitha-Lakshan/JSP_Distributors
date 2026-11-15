import React from "react";
import { StyleSheet, Text, View, ViewProps } from "react-native";
import { BorderRadius, Spacing, Typography, useAppTheme } from "../../theme/colors";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "leaf";

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "neutral",
  size = "md",
  style,
  ...props
}) => {
  const { theme, isDark } = useAppTheme();

  const getContainerStyle = () => {
    switch (variant) {
      case "success":
        return { backgroundColor: theme.successLight };
      case "warning":
        return { backgroundColor: theme.warningLight };
      case "danger":
        return { backgroundColor: theme.dangerLight };
      case "info":
        return { backgroundColor: theme.infoLight };
      case "leaf":
        return { backgroundColor: theme.leafLight };
      default:
        return { backgroundColor: isDark ? theme.surfaceSubtle : theme.slatewash };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "success":
        return { color: theme.success };
      case "warning":
        return { color: isDark ? theme.warning : "#b45309" };
      case "danger":
        return { color: theme.danger };
      case "info":
        return { color: theme.info };
      case "leaf":
        return { color: theme.leaf };
      default:
        return { color: theme.textSecondary };
    }
  };

  return (
    <View
      style={[
        styles.base,
        getContainerStyle(),
        size === "sm" ? styles.sm : styles.md,
        style
      ]}
      {...props}
    >
      <Text style={[styles.text, getTextStyle(), size === "sm" && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center"
  },
  sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs
  },
  text: {
    fontSize: Typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  textSm: {
    fontSize: 9
  }
});

