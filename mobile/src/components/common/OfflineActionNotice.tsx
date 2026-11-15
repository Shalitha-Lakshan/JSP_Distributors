import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { AlertCircle } from "lucide-react-native";

interface OfflineActionNoticeProps {
  message?: string;
  style?: ViewStyle;
}

export const OfflineActionNotice: React.FC<OfflineActionNoticeProps> = ({
  message = "Transactions cannot be finalized offline to prevent stock discrepancies.",
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      <AlertCircle size={16} color="#b45309" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 6
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    fontWeight: "500",
    lineHeight: 16
  }
});
