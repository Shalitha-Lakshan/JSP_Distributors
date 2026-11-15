import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, CheckCircle2, MapPin, Navigation, Truck } from "lucide-react-native";
import { useTripStore } from "../../src/store/tripStore";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { Card } from "../../src/components/common/Card";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";

const ROUTE_PRESETS = [
  "Gampaha Delivery Route",
  "Negombo Main Route",
  "Horana & Bandaragama Route",
  "Colombo North Route",
  "Kalutara Town & Aluthgama",
  "Kandy Wholesale Route",
  "Custom Route"
];

export default function StartTripScreen() {
  const router = useRouter();
  const { isTablet } = useResponsive();
  const { startTrip, isLoading, error, clearError } = useTripStore();

  const [selectedRoute, setSelectedRoute] = useState(ROUTE_PRESETS[0]);
  const [customRoute, setCustomRoute] = useState("");
  const [clientError, setClientError] = useState("");

  const handleStartTrip = async () => {
    setClientError("");
    clearError();

    const finalRoute = selectedRoute === "Custom Route" ? customRoute.trim() : selectedRoute;

    if (!finalRoute) {
      setClientError("Please enter a route name to start your trip.");
      return;
    }

    const success = await startTrip(finalRoute);
    if (success) {
      Alert.alert(
        "Trip Started",
        `Your trip session for "${finalRoute}" is now active. You may now book orders, issue sales, and collect payments.`,
        [
          {
            text: "Go to Dashboard",
            onPress: () => router.replace("/(tabs)")
          }
        ]
      );
    }
  };

  const displayError = clientError || error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && { maxWidth: 580, alignSelf: "center", width: "100%" }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Card */}
          <Card style={styles.headerCard}>
            <View style={styles.iconCircle}>
              <Truck size={32} color={Colors.leaf} />
            </View>
            <Text style={styles.title}>Start Route Delivery</Text>
            <Text style={styles.subtitle}>
              Select your assigned delivery route to begin your sales representative shift.
            </Text>
          </Card>

          {/* Error Banner */}
          {displayError ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={18} color={Colors.danger} style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {/* Route Selection Card */}
          <Card style={styles.routeCard}>
            <Text style={styles.sectionTitle}>Select Delivery Route</Text>

            <View style={styles.presetList}>
              {ROUTE_PRESETS.map((route) => {
                const isSelected = selectedRoute === route;
                return (
                  <TouchableOpacity
                    key={route}
                    style={[styles.presetItem, isSelected && styles.presetItemSelected]}
                    onPress={() => {
                      setSelectedRoute(route);
                      setClientError("");
                      clearError();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetTextCol}>
                      <MapPin
                        size={16}
                        color={isSelected ? Colors.leaf : Colors.textMuted}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.presetLabel,
                          isSelected && styles.presetLabelSelected
                        ]}
                      >
                        {route}
                      </Text>
                    </View>
                    {isSelected && <CheckCircle2 size={18} color={Colors.leaf} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedRoute === "Custom Route" && (
              <View style={styles.customInputWrapper}>
                <Input
                  label="Custom Route Name"
                  required
                  placeholder="e.g. Panadura Retail Route"
                  value={customRoute}
                  onChangeText={(text) => {
                    setCustomRoute(text);
                    if (displayError) {
                      setClientError("");
                      clearError();
                    }
                  }}
                  leftIcon={<Navigation size={18} color={Colors.textMuted} />}
                />
              </View>
            )}

            <Button
              title="Start Trip Session"
              variant="primary"
              size="lg"
              loading={isLoading}
              onPress={handleStartTrip}
              style={styles.startButton}
            />
          </Card>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Business Rule Reminder</Text>
            <Text style={styles.infoBody}>
              • Every order, POS invoice, and payment received during your shift will automatically link to this trip.
              {"\n"}• At end of day, you must record road expenses and submit your collections for manager audit.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  headerCard: {
    alignItems: "center",
    textAlign: "center",
    padding: Spacing.xl,
    marginBottom: Spacing.base
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.leafLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.ink
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.xs,
    lineHeight: 18
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base
  },
  errorText: {
    flex: 1,
    color: "#991b1b",
    fontSize: Typography.sm,
    lineHeight: 18,
    fontWeight: "500"
  },
  routeCard: {
    padding: Spacing.base,
    marginBottom: Spacing.base
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  presetList: {
    marginBottom: Spacing.md
  },
  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm
  },
  presetItemSelected: {
    borderColor: Colors.leaf,
    backgroundColor: "#f0fdfa"
  },
  presetTextCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  presetLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: "500"
  },
  presetLabelSelected: {
    color: Colors.leaf,
    fontWeight: "700"
  },
  customInputWrapper: {
    marginTop: Spacing.sm
  },
  startButton: {
    marginTop: Spacing.sm
  },
  infoCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border
  },
  infoTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: Spacing.xs
  },
  infoBody: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 18
  }
});
