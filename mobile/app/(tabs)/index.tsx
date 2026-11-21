import React, { useCallback } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Calendar,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Fuel,
  History,
  Lock,
  PlusCircle,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Users
} from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { useTripStore } from "../../src/store/tripStore";
import { useCartStore } from "../../src/store/cartStore";
import { apiClient } from "../../src/api/client";
import { TripBanner } from "../../src/components/common/TripBanner";
import { Card } from "../../src/components/common/Card";
import { useResponsive } from "../../src/hooks/useResponsive";
import { DailyClosingSummary } from "../../src/types";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";

const formatCurrency = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;

export default function DashboardScreen() {
  const router = useRouter();
  const { isTablet, isLargeTablet, contentMaxWidth } = useResponsive();
  const user = useAuthStore((state) => state.user);
  const { activeTrip, fetchActiveTrip } = useTripStore();

  // Query Daily Closing summary (auto-scoped to the active or recent pending_audit trip on server)
  const {
    data: closingData,
    isLoading: isLoadingClosing,
    refetch: refetchClosing
  } = useQuery<DailyClosingSummary>({
    queryKey: ["daily-closing"],
    queryFn: async () => {
      const res = await apiClient.get<DailyClosingSummary>("/api/reports/daily-closing");
      return res.data;
    }
  });

  const onRefresh = useCallback(async () => {
    await fetchActiveTrip();
    await refetchClosing();
  }, [fetchActiveTrip, refetchClosing]);

  // Initial load of active trip
  React.useEffect(() => {
    fetchActiveTrip();
  }, [fetchActiveTrip]);

  // Trip Session Gatekeeper for transaction actions
  const handleRestrictedAction = (destination: string, actionName: string) => {
    if (!activeTrip) {
      Alert.alert(
        "Active Trip Required",
        `You cannot ${actionName} without an active route delivery session. Please start a trip first.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Trip", onPress: () => router.push("/trips/start" as any) }
        ]
      );
      return;
    }

    router.push(destination as any);
  };

  const currentDateFormatted = new Date().toLocaleDateString("en-LK", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  const hasShiftMetrics =
    !!activeTrip ||
    (closingData && closingData.status !== "none" && closingData.status !== undefined);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: contentMaxWidth ?? 1080, alignSelf: "center", width: "100%" }
        ]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.repInfo}
            onPress={() => router.push("/profile" as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Profile & Settings"
          >
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.repName}>{user?.name || "Representative"}</Text>
            <View style={styles.dateRow}>
              <Calendar size={13} color={Colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.dateText}>{currentDateFormatted}</Text>
            </View>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              style={styles.profileAvatarButton}
              onPress={() => router.push("/profile" as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View Profile"
            >
              <Text style={styles.profileAvatarText}>
                {user?.name
                  ? user.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("")
                  : "SR"}
              </Text>
            </TouchableOpacity>

            <View style={styles.logoBadge}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* Active Trip Banner or Pending Audit Notice */}
        <View style={styles.bannerSection}>
          {activeTrip ? (
            <TripBanner trip={activeTrip} />
          ) : closingData?.status === "pending_audit" ? (
            <View style={styles.pendingAuditBanner}>
              <View style={styles.pendingAuditIconBox}>
                <Clock size={20} color="#b45309" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingAuditTitle}>Shift Awaiting Manager Approval</Text>
                <Text style={styles.pendingAuditDesc}>
                  Trip #{closingData.tripNo} on {closingData.route} is submitted. Transactions are locked.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewClosingPill}
                onPress={() => router.push("/daily-closing" as any)}
              >
                <Text style={styles.viewClosingPillText}>Audit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TripBanner trip={null} />
          )}
        </View>

        {/* Financial KPI Cards (When trip is active or just submitted for audit) */}
        {hasShiftMetrics ? (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionHeading}>
              {closingData?.status === "pending_audit" ? "Closed Shift Summary" : "Today's Shift Summary"}
            </Text>

            <View style={[styles.kpiContainer, isLargeTablet && styles.kpiContainerWide]}>
              {/* Gross Sales */}
              <Card style={[styles.kpiCard, isLargeTablet && styles.kpiCardWide, { borderLeftColor: Colors.leaf }]}>
                <View style={styles.kpiIconRow}>
                  <Text style={styles.kpiLabel}>Net Sales</Text>
                  <ShoppingCart size={16} color={Colors.leaf} />
                </View>
                <Text style={styles.kpiValue}>
                  {formatCurrency(closingData?.netSales || 0)}
                </Text>
                <Text style={styles.kpiSub}>Gross: {formatCurrency(closingData?.grossSales || 0)}</Text>
              </Card>

              {/* Collections */}
              <Card style={[styles.kpiCard, isLargeTablet && styles.kpiCardWide, { borderLeftColor: Colors.success }]}>
                <View style={styles.kpiIconRow}>
                  <Text style={styles.kpiLabel}>Cash In Hand</Text>
                  <Banknote size={16} color={Colors.success} />
                </View>
                <Text style={[styles.kpiValue, { color: Colors.success }]}>
                  {formatCurrency(closingData?.netCashCollection || 0)}
                </Text>
                <Text style={styles.kpiSub}>
                  Expected: {formatCurrency(closingData?.expectedCollections?.cash ?? activeTrip?.expectedCollections?.cash ?? 0)}
                </Text>
              </Card>

              {/* Cheques Collected */}
              <Card style={[styles.kpiCard, isLargeTablet && styles.kpiCardWide, { borderLeftColor: "#6366f1" }]}>
                <View style={styles.kpiIconRow}>
                  <Text style={styles.kpiLabel}>Cheques</Text>
                  <CreditCard size={16} color="#6366f1" />
                </View>
                <Text style={[styles.kpiValue, { color: "#4f46e5" }]}>
                  {formatCurrency(closingData?.expectedCollections?.cheque ?? activeTrip?.expectedCollections?.cheque ?? 0)}
                </Text>
                <Text style={styles.kpiSub}>Pending clearance</Text>
              </Card>

              {/* Road Expenses */}
              <Card style={[styles.kpiCard, isLargeTablet && styles.kpiCardWide, { borderLeftColor: Colors.clay }]}>
                <View style={styles.kpiIconRow}>
                  <Text style={styles.kpiLabel}>Expenses</Text>
                  <Fuel size={16} color={Colors.clay} />
                </View>
                <Text style={[styles.kpiValue, { color: Colors.clay }]}>
                  {formatCurrency(closingData?.expenses || 0)}
                </Text>
                <Text style={styles.kpiSub}>Van & road costs</Text>
              </Card>

              {/* Market Returns */}
              <Card style={[styles.kpiCard, isLargeTablet && styles.kpiCardWide, { borderLeftColor: "#f59e0b" }]}>
                <View style={styles.kpiIconRow}>
                  <Text style={styles.kpiLabel}>Returns</Text>
                  <RotateCcw size={16} color="#d97706" />
                </View>
                <Text style={[styles.kpiValue, { color: "#d97706" }]}>
                  {formatCurrency(closingData?.returns || 0)}
                </Text>
                <Text style={styles.kpiSub}>Customer returns</Text>
              </Card>
            </View>
          </View>
        ) : null}

        {/* Quick Actions Grid */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeading}>Field Operations</Text>

          <View style={styles.actionGrid}>
            {/* New Sale */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null,
                !activeTrip && styles.actionCardDisabled
              ]}
              onPress={() => {
                useCartStore.getState().setTransactionMode("sale");
                handleRestrictedAction("/(tabs)/products", "issue sales");
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#e0f2fe" }]}>
                <ShoppingCart size={22} color="#0284c7" />
              </View>
              <Text style={styles.actionTitle}>New Sale</Text>
              <Text style={styles.actionDesc}>Point of Sale billing</Text>
              {!activeTrip && (
                <View style={styles.lockBadge}>
                  <Lock size={12} color={Colors.clay} />
                </View>
              )}
            </TouchableOpacity>

            {/* Collect Payment */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null,
                !activeTrip && styles.actionCardDisabled
              ]}
              onPress={() => handleRestrictedAction("/payments/collect", "collect payments")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#dcfce7" }]}>
                <Banknote size={22} color="#16a34a" />
              </View>
              <Text style={styles.actionTitle}>Collect Payment</Text>
              <Text style={styles.actionDesc}>Cash / cheque bills</Text>
              {!activeTrip && (
                <View style={styles.lockBadge}>
                  <Lock size={12} color={Colors.clay} />
                </View>
              )}
            </TouchableOpacity>

            {/* Book Van Order */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null,
                !activeTrip && styles.actionCardDisabled
              ]}
              onPress={() => {
                useCartStore.getState().setTransactionMode("order");
                handleRestrictedAction("/(tabs)/products", "book orders");
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#f3e8ff" }]}>
                <PlusCircle size={22} color="#9333ea" />
              </View>
              <Text style={styles.actionTitle}>Book Order</Text>
              <Text style={styles.actionDesc}>Pre-order reservation</Text>
              {!activeTrip && (
                <View style={styles.lockBadge}>
                  <Lock size={12} color={Colors.clay} />
                </View>
              )}
            </TouchableOpacity>

            {/* Customer Returns (Milestone 7) */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null,
                !activeTrip && styles.actionCardDisabled
              ]}
              onPress={() => handleRestrictedAction("/returns", "record returns")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#fef3c7" }]}>
                <RotateCcw size={22} color="#d97706" />
              </View>
              <Text style={styles.actionTitle}>Returns</Text>
              <Text style={styles.actionDesc}>Field customer returns</Text>
              {!activeTrip && (
                <View style={styles.lockBadge}>
                  <Lock size={12} color={Colors.clay} />
                </View>
              )}
            </TouchableOpacity>

            {/* Customers & Ledgers */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null
              ]}
              onPress={() => router.push("/(tabs)/customers" as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#f1f5f9" }]}>
                <Users size={22} color={Colors.textSecondary} />
              </View>
              <Text style={styles.actionTitle}>Retailers</Text>
              <Text style={styles.actionDesc}>Accounts & ledgers</Text>
            </TouchableOpacity>

            {/* Van Expenses */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null,
                !activeTrip && styles.actionCardDisabled
              ]}
              onPress={() => handleRestrictedAction("/expenses", "log expenses")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#ffedd5" }]}>
                <Fuel size={22} color={Colors.clay} />
              </View>
              <Text style={styles.actionTitle}>Van Expenses</Text>
              <Text style={styles.actionDesc}>Fuel, food, repairs</Text>
              {!activeTrip && (
                <View style={styles.lockBadge}>
                  <Lock size={12} color={Colors.clay} />
                </View>
              )}
            </TouchableOpacity>

            {/* Daily Closing */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null
              ]}
              onPress={() => router.push("/daily-closing" as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#ccfbf1" }]}>
                <FileSpreadsheet size={22} color={Colors.leaf} />
              </View>
              <Text style={styles.actionTitle}>Daily Closing</Text>
              <Text style={styles.actionDesc}>Reconciliation & audit</Text>
            </TouchableOpacity>

            {/* Trip History (Milestone 8) */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                isLargeTablet ? styles.actionCardWide : isTablet ? styles.actionCardMedium : null
              ]}
              onPress={() => router.push("/trips/history" as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#e0e7ff" }]}>
                <History size={22} color="#4f46e5" />
              </View>
              <Text style={styles.actionTitle}>Trip History</Text>
              <Text style={styles.actionDesc}>Closed shifts & audits</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.base
  },
  repInfo: {
    flex: 1
  },
  greeting: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.leaf,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  repName: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.ink
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },
  dateText: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2
  },
  profileAvatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  profileAvatarText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: Typography.sm
  },
  logo: {
    width: 30,
    height: 30
  },
  bannerSection: {
    marginBottom: Spacing.lg
  },
  metricsSection: {
    marginBottom: Spacing.lg
  },
  sectionHeading: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm
  },
  kpiGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm
  },
  kpiContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.sm
  },
  kpiContainerWide: {
    flexWrap: "nowrap"
  },
  kpiCard: {
    flex: 1,
    minWidth: "47%",
    padding: Spacing.md,
    borderLeftWidth: 4
  },
  kpiCardWide: {
    minWidth: "23.5%"
  },
  kpiIconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  kpiLabel: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  kpiValue: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink
  },
  kpiSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  actionsSection: {
    marginBottom: Spacing.base
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm
  },
  actionCard: {
    width: "48.5%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
    position: "relative"
  },
  actionCardMedium: {
    width: "31.8%"
  },
  actionCardWide: {
    width: "23.8%"
  },
  actionCardDisabled: {
    opacity: 0.65,
    backgroundColor: "#fafaf9"
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm
  },
  actionTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 2
  },
  actionDesc: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  lockBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "#fef3c7",
    padding: 4,
    borderRadius: BorderRadius.full
  },
  pendingAuditBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#fde68a"
  },
  pendingAuditIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fef9c3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md
  },
  pendingAuditTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: "#b45309"
  },
  pendingAuditDesc: {
    fontSize: Typography.xs,
    color: "#92400e",
    marginTop: 2
  },
  viewClosingPill: {
    backgroundColor: "#b45309",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    marginLeft: 8
  },
  viewClosingPillText: {
    color: "#ffffff",
    fontSize: Typography.xs,
    fontWeight: "700"
  }
});

