import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Clock } from "lucide-react-native";
import { formatDateTimeLK } from "../../utils/formatters";
import { Colors } from "../../theme/colors";

interface LastSyncedLabelProps {
  timestamp?: string | null;
  prefix?: string;
  style?: ViewStyle;
}

export const LastSyncedLabel: React.FC<LastSyncedLabelProps> = ({
  timestamp,
  prefix = "Last synced:",
  style
}) => {
  const formatted = timestamp ? formatDateTimeLK(timestamp) : "Not yet synced";

  return (
    <View style={[styles.container, style]}>
      <Clock size={12} color={Colors.textSecondary} />
      <Text style={styles.text}>
        {prefix} {formatted}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2
  },
  text: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500"
  }
});
