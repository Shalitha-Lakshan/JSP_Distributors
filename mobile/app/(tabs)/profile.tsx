import React from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import {
  CheckCircle,
  ChevronRight,
  Globe,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Package,
  Phone,
  Shield,
  Smartphone,
  Sun,
  Truck,
  User as UserIcon
} from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { useTripStore } from "../../src/store/tripStore";
import { offlineOrdersRepository } from "../../src/database/repositories/offlineOrdersRepository";
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
import { useResponsive } from "../../src/hooks/useResponsive";
import { API_BASE_URL } from "../../src/api/client";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../src/theme/colors";

export default function ProfileScreen() {
  const router = useRouter();
  const { isTablet } = useResponsive();
  const { theme, isDark, mode, setMode } = useAppTheme();
  const { user, logout } = useAuthStore();
  const activeTrip = useTripStore((state) => state.activeTrip);

  const handleLogout = async () => {
    let pendingMsg = "";
    if (user?.id) {
      try {
        const count = await offlineOrdersRepository.getUnsyncedCount(user.id);
        if (count > 0) {
          pendingMsg = `\n\nNotice: You have ${count} unsynchronized offline order draft(s) stored on this device. They will remain securely saved for your account.`;
        }
      } catch {
        // Fallback
      }
    }

    Alert.alert(
      "Sign Out",
      `Are you sure you want to sign out of JSP Distributors?${pendingMsg}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          }
        }
      ]
    );
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("")
    : "SR";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 640, alignSelf: "center", width: "100%" }
        ]}
      >
        {/* User Profile Card */}
        <Card style={styles.profileCard}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
            <Text style={[styles.avatarText, { color: isDark ? "#0b1220" : "#ffffff" }]}>{initials}</Text>
          </View>

          <Text style={[styles.userName, { color: theme.textPrimary }]}>{user?.name || "Representative"}</Text>
          <Text style={[styles.userRole, { color: theme.primary }]}>Field Sales Representative</Text>

          <View style={styles.badgeRow}>
            <Badge label="Sales Rep" variant="leaf" size="sm" />
            <Badge label="Approved" variant="success" size="sm" />
            <Badge label="Active" variant="success" size="sm" />
          </View>
        </Card>

        {/* Appearance / Theme Selector Card */}
        <Card style={styles.infoCard}>
          <Text style={[styles.cardSectionTitle, { color: theme.textPrimary }]}>Appearance</Text>
          <Text style={{ fontSize: Typography.xs, color: theme.textSecondary, marginBottom: Spacing.md }}>
            Adjust app styling for bright daytime route glare or evening low-light conditions.
          </Text>

          <View style={styles.themeSelectorRow}>
            {/* Light Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                mode === "light" && {
                  borderColor: theme.primary,
                  backgroundColor: isDark ? "#134e4a" : "#ccfbf1"
                }
              ]}
              onPress={() => setMode("light")}
              activeOpacity={0.8}
            >
              <Sun
                size={20}
                color={mode === "light" ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: theme.textSecondary },
                  mode === "light" && { color: theme.primary, fontWeight: "700" }
                ]}
              >
                Light
              </Text>
              {mode === "light" && (
                <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>

            {/* Dark Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                mode === "dark" && {
                  borderColor: theme.primary,
                  backgroundColor: isDark ? "#134e4a" : "#ccfbf1"
                }
              ]}
              onPress={() => setMode("dark")}
              activeOpacity={0.8}
            >
              <Moon
                size={20}
                color={mode === "dark" ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: theme.textSecondary },
                  mode === "dark" && { color: theme.primary, fontWeight: "700" }
                ]}
              >
                Dark
              </Text>
              {mode === "dark" && (
                <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>

            {/* System Default Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                mode === "system" && {
                  borderColor: theme.primary,
                  backgroundColor: isDark ? "#134e4a" : "#ccfbf1"
                }
              ]}
              onPress={() => setMode("system")}
              activeOpacity={0.8}
            >
              <Smartphone
                size={20}
                color={mode === "system" ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: theme.textSecondary },
                  mode === "system" && { color: theme.primary, fontWeight: "700" }
                ]}
              >
                System
              </Text>
              {mode === "system" && (
                <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Contact Info Card */}
        <Card style={styles.infoCard}>
          <Text style={[styles.cardSectionTitle, { color: theme.textPrimary }]}>Account Details</Text>

          <View style={styles.infoRow}>
            <Mail size={16} color={theme.primary} style={{ marginRight: 10 }} />
            <View>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Email</Text>
              <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{user?.email || "Not available"}</Text>
            </View>
          </View>

          {user?.phone ? (
            <View style={styles.infoRow}>
              <Phone size={16} color={theme.primary} style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Phone Number</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{user.phone}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Shield size={16} color={theme.primary} style={{ marginRight: 10 }} />
            <View>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>System Permissions</Text>
              <Text style={[styles.infoValue, { color: theme.textPrimary }]}>Field Route Sales, Invoicing & Collections</Text>
            </View>
          </View>
        </Card>

        {/* Active Shift Card */}
        <Card style={styles.infoCard}>
          <Text style={[styles.cardSectionTitle, { color: theme.textPrimary }]}>Current Shift Status</Text>

          {activeTrip ? (
            <View>
              <View style={styles.shiftActiveRow}>
                <Truck size={18} color={theme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.shiftRoute, { color: theme.textPrimary }]}>{activeTrip.route}</Text>
              </View>
              <Text style={[styles.shiftTripNo, { color: theme.textSecondary }]}>Session No: {activeTrip.tripNo}</Text>
            </View>
          ) : (
            <Text style={[styles.shiftInactiveText, { color: theme.textMuted }]}>
              No shift is currently active. Start a route delivery from the Home dashboard.
            </Text>
          )}
        </Card>

        {/* Server & Environment Card */}
        <Card style={styles.infoCard}>
          <Text style={[styles.cardSectionTitle, { color: theme.textPrimary }]}>System Environment</Text>
          <View style={styles.infoRow}>
            <Globe size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Central Backend API</Text>
              <Text style={[styles.infoValue, { color: theme.textPrimary }]} numberOfLines={1}>
                {API_BASE_URL}
              </Text>
            </View>
          </View>
          <Text style={[styles.versionText, { color: theme.textMuted }]}>JSP Distributors Mobile v1.0.0 (Milestone 1 & 2)</Text>
        </Card>

        {/* Offline Van Orders Navigation */}
        <Card style={styles.infoCard}>
          <TouchableOpacity
            onPress={() => router.push("/orders/offline" as any)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Package size={20} color={theme.clay} style={{ marginRight: 12 }} />
              <View>
                <Text style={{ fontSize: Typography.base, fontWeight: "700", color: theme.textPrimary }}>
                  Offline Van Orders
                </Text>
                <Text style={{ fontSize: Typography.xs, color: theme.textSecondary, marginTop: 2 }}>
                  Review & synchronize drafts saved offline
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="danger"
          size="lg"
          icon={<LogOut size={18} color="#ffffff" />}
          onPress={handleLogout}
          style={styles.logoutButton}
        />
      </ScrollView>
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
  profileCard: {
    alignItems: "center",
    padding: Spacing.xl,
    marginBottom: Spacing.base
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  avatarText: {
    fontSize: Typography.xxl,
    fontWeight: "800",
    color: Colors.textInverse
  },
  userName: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.ink
  },
  userRole: {
    fontSize: Typography.xs,
    color: Colors.leaf,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
    marginBottom: Spacing.sm
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xs
  },
  infoCard: {
    marginBottom: Spacing.base,
    padding: Spacing.base
  },
  cardSectionTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.md
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  infoLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: "uppercase",
    fontWeight: "600"
  },
  infoValue: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.ink,
    marginTop: 1
  },
  shiftActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4
  },
  shiftRoute: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  shiftTripNo: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginLeft: 26
  },
  shiftInactiveText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    lineHeight: 18
  },
  versionText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: "center"
  },
  themeSelectorRow: {
    flexDirection: "row",
    gap: Spacing.sm
  },
  themeOptionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    position: "relative"
  },
  themeOptionText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    marginTop: 6
  },
  activeDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3
  },
  logoutButton: {
    marginTop: Spacing.sm
  }
});

