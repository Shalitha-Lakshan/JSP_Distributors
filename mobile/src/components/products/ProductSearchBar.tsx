import React from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewStyle
} from "react-native";
import { Search, X } from "lucide-react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface ProductSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  style?: ViewStyle;
  autoFocus?: boolean;
}

export const ProductSearchBar: React.FC<ProductSearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = "Search name or item code",
  style,
  autoFocus = false
}) => {
  const handleClear = () => {
    onChangeText("");
    if (onClear) onClear();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchIconContainer}>
        <Search size={18} color={Colors.textMuted} />
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never" // Custom clear button handles both iOS and Android uniformly
      />
      {value.length > 0 && (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.clearButton,
            pressed && styles.clearButtonPressed
          ]}
        >
          <X size={14} color={Colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  searchIconContainer: {
    marginRight: Spacing.sm,
    justifyContent: "center",
    alignItems: "center"
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: Typography.base,
    color: Colors.textPrimary,
    paddingVertical: 0
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.xs
  },
  clearButtonPressed: {
    backgroundColor: Colors.slatewash,
    opacity: 0.8
  }
});

