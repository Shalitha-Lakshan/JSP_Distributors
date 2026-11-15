import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../theme/colors";

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Loading JSP Distributors..."
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={require("../../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.spinner} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl
  },
  card: {
    alignItems: "center",
    justifyContent: "center"
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: Spacing.lg
  },
  spinner: {
    marginBottom: Spacing.md
  },
  text: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center"
  }
});

