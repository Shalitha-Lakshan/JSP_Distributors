import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { BorderRadius, Colors, Spacing, useAppTheme } from "../../theme/colors";

interface CardProps extends ViewProps {
  variant?: "elevated" | "outlined" | "flat";
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "elevated",
  style,
  ...props
}) => {
  const { theme, isDark } = useAppTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: variant === "flat" ? theme.surfaceSubtle : theme.surface,
          borderColor: isDark ? theme.border : variant === "elevated" ? "#f1f5f9" : theme.border,
          shadowColor: isDark ? "#000000" : "#0f172a"
        },
        variant === "elevated" && styles.elevated,
        variant === "outlined" && styles.outlined,
        variant === "flat" && styles.flat,
        style
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base
  },
  elevated: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9"
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border
  },
  flat: {
    backgroundColor: Colors.surfaceSubtle
  }
});

