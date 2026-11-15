import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Filter,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Wallet
} from "lucide-react-native";
import { fetchPayments } from "../../src/api/payments";
import { Payment } from "../../src/types";
import { PaymentCard, PaymentReceiptModal } from "../../src/components/payments";
import { Input } from "../../src/components/common/Input";
import { useResponsive } from "../../src/hooks/useResponsive";
import { formatLKR } from "../../src/utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { isTablet, columns, contentMaxWidth } = useResponsive();

  const [scope, setScope] = useState<"trip" | "all">("trip");
  const [methodFilter, setMethodFilter] = useState<"all" | "cash" | "cheque">("all");
  const [search, setSearch] = useState("");
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);

  // TanStack Query for Payments
  const {
    data: payments = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching
  } = useQuery<Payment[]>({
    queryKey: ["payments", scope],
    queryFn: () => fetchPayments(scope),
    staleTime: 60 * 1000
  });

  // KPI Collections Totals
  const totals = useMemo(() => {
    let cash = 0;
    let cheque = 0;

    payments.forEach((p) => {
      if (p.paymentMethod === "cash") {
        cash += p.amount || 0;
      } else if (p.paymentMethod === "cheque") {
        cheque += p.amount || 0;
      }
    });

    return {
      total: cash + cheque,
      cash,
      cheque,
      count: payments.length
    };
  }, [payments]);

  // Filtered List
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // 1. Method filter
      if (methodFilter !== "all" && p.paymentMethod !== methodFilter) {
        return false;
      }

      // 2. Search query
      const q = search.trim().toLowerCase();
      if (!q) return true;

      const custName =
        typeof p.customer === "object" ? p.customer.name.toLowerCase() : "";
      const payNo = p.paymentNo.toLowerCase();
      const checkNo = p.chequeNo?.toLowerCase() || "";
      const bank = p.bankName?.toLowerCase() || "";

      return (
        custName.includes(q) ||
        payNo.includes(q) ||
        checkNo.includes(q) ||
        bank.includes(q)
      );
    });
  }, [payments, methodFilter, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={Colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Payment Collections</Text>
          <Text style={styles.headerSubtitle}>
            {scope === "trip" ? "Current Active Trip" : "All Rep Collections"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.newPaymentBtn}
          onPress={() => router.push("/payments/collect")}
          activeOpacity={0.8}
        >
          <Plus size={15} color={Colors.textInverse} style={{ marginRight: 2 }} />
          <Text style={styles.newPaymentText}>Collect</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.container,
          isTablet && {
            maxWidth: contentMaxWidth ?? 900,
            alignSelf: "center",
            width: "100%"
          }
        ]}
      >
        {/* KPI Summary Card */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>TOTAL COLLECTED</Text>
            <Text style={[styles.kpiValue, { color: Colors.leafDark }]}>
              {formatLKR(totals.total)}
            </Text>
            <Text style={styles.kpiSub}>{totals.count} Collections</Text>
          </View>

          <View style={styles.kpiDivider} />

          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>CASH FUNDS</Text>
            <Text style={styles.kpiValue}>{formatLKR(totals.cash)}</Text>
            <Text style={styles.kpiSub}>Cleared</Text>
          </View>

          <View style={styles.kpiDivider} />

          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>CHEQUES</Text>
            <Text style={[styles.kpiValue, { color: Colors.clay }]}>
              {formatLKR(totals.cheque)}
            </Text>
            <Text style={styles.kpiSub}>Pending clearance</Text>
          </View>
        </View>

        {/* Scope and Filter Chips */}
        <View style={styles.filtersRow}>
          {/* Trip vs All Scope Toggle */}
          <View style={styles.scopeToggle}>
            <TouchableOpacity
              style={[styles.scopeBtn, scope === "trip" && styles.scopeBtnActive]}
              onPress={() => setScope("trip")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.scopeText,
                  scope === "trip" && styles.scopeTextActive
                ]}
              >
                Current Trip
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopeBtn, scope === "all" && styles.scopeBtnActive]}
              onPress={() => setScope("all")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.scopeText,
                  scope === "all" && styles.scopeTextActive
                ]}
              >
                All History
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cash / Cheque Filters */}
          <View style={styles.methodChips}>
            {(["all", "cash", "cheque"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.methodChip,
                  methodFilter === m && styles.methodChipActive
                ]}
                onPress={() => setMethodFilter(m)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    methodFilter === m && styles.methodChipTextActive
                  ]}
                >
                  {m === "all" ? "All Methods" : m.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Search Input */}
        <Input
          placeholder="Search by customer, payment #, cheque # or bank..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={Colors.textMuted} />}
          style={styles.searchInput}
        />

        {/* Payments List */}
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.leaf} />
            <Text style={styles.loadingText}>Loading collection records...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorBox}>
            <AlertCircle size={32} color={Colors.danger} style={{ marginBottom: 8 }} />
            <Text style={styles.errorTitle}>Failed to load payments</Text>
            <Text style={styles.errorMsg}>
              {(error as any)?.message || "Please check your network connection."}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => refetch()}
              activeOpacity={0.8}
            >
              <RotateCcw size={16} color={Colors.leaf} style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            key={`payments-${columns}`}
            data={filteredPayments}
            keyExtractor={(item) => item._id}
            numColumns={columns}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => {
                  refetch();
                }}
                colors={[Colors.leaf]}
                tintColor={Colors.leaf}
              />
            }
            renderItem={({ item }) => (
              <PaymentCard
                payment={item}
                onPress={(p) => setSelectedReceiptPayment(p)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Receipt size={40} color={Colors.textMuted} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No payments found</Text>
                <Text style={styles.emptySub}>
                  {search.trim()
                    ? `No payments matching "${search}".`
                    : scope === "trip"
                    ? "No payments recorded yet on your current route trip."
                    : "No payment collections recorded under this filter."}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* View Full Receipt Modal */}
      <PaymentReceiptModal
        visible={!!selectedReceiptPayment}
        payment={selectedReceiptPayment}
        onClose={() => setSelectedReceiptPayment(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  headerIconButton: {
    padding: Spacing.xs
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: "center"
  },
  headerTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 1
  },
  newPaymentBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.leaf,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md
  },
  newPaymentText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textInverse
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base
  },
  kpiCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm
  },
  kpiCol: {
    flex: 1,
    alignItems: "center"
  },
  kpiDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  kpiValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  kpiSub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2
  },
  filtersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: Spacing.xs,
    gap: Spacing.xs
  },
  scopeToggle: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.full,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.border
  },
  scopeBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full
  },
  scopeBtnActive: {
    backgroundColor: Colors.leaf
  },
  scopeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  scopeTextActive: {
    color: Colors.textInverse
  },
  methodChips: {
    flexDirection: "row",
    gap: 4
  },
  methodChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border
  },
  methodChipActive: {
    backgroundColor: Colors.leafLight,
    borderColor: Colors.leaf
  },
  methodChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  methodChipTextActive: {
    color: Colors.leafDark,
    fontWeight: "700"
  },
  searchInput: {
    marginBottom: Spacing.xs
  },
  listContent: {
    paddingBottom: Spacing.xxl
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl
  },
  loadingText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm
  },
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl
  },
  errorTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.danger
  },
  errorMsg: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: Spacing.md
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.leafLight,
    borderRadius: BorderRadius.md
  },
  retryBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leafDark
  },
  emptyContainer: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    marginTop: Spacing.sm
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  emptySub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280
  }
});

