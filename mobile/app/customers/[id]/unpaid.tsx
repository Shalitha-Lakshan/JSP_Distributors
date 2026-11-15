import React, { useMemo } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  FileCheck,
  RotateCcw,
  Wallet
} from "lucide-react-native";
import { fetchCustomerById, fetchUnpaidInvoices } from "../../../src/api/customers";
import { Customer, UnpaidInvoice } from "../../../src/types";
import { UnpaidInvoiceCard } from "../../../src/components/customers";
import { useResponsive } from "../../../src/hooks/useResponsive";
import { formatLKR } from "../../../src/utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../../src/theme/colors";

export default function CustomerUnpaidInvoicesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isTablet, contentMaxWidth } = useResponsive();

  const customerId = Array.isArray(id) ? id[0] : id;

  // 1. Fetch Customer
  const { data: customer } = useQuery<Customer>({
    queryKey: ["customer", customerId],
    queryFn: () => fetchCustomerById(customerId!),
    enabled: !!customerId
  });

  // 2. Fetch Unpaid Invoices
  const {
    data: unpaidInvoices = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching
  } = useQuery<UnpaidInvoice[]>({
    queryKey: ["customer-unpaid-invoices", customerId],
    queryFn: () => fetchUnpaidInvoices(customerId!),
    enabled: !!customerId
  });

  // Total Outstanding from unpaid invoices
  const totalOutstanding = useMemo(() => {
    return unpaidInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
  }, [unpaidInvoices]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.loadingText}>Loading unpaid invoices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorBox}>
          <AlertCircle size={36} color={Colors.danger} style={{ marginBottom: 8 }} />
          <Text style={styles.errorTitle}>Failed to Load Invoices</Text>
          <Text style={styles.errorMsg}>
            {(error as any)?.message || "Failed to retrieve unpaid invoices."}
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
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {customer?.name || "Customer"}
          </Text>
          <Text style={styles.headerSubtitle}>Unpaid & Partial Invoices</Text>
        </View>

        <View style={{ width: 28 }} />
      </View>

      <View
        style={[
          styles.container,
          isTablet && {
            maxWidth: contentMaxWidth ?? 800,
            alignSelf: "center",
            width: "100%"
          }
        ]}
      >
        {/* Total Outstanding Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTitleGroup}>
              <Wallet size={18} color={Colors.danger} style={{ marginRight: 6 }} />
              <Text style={styles.summaryLabel}>TOTAL OUTSTANDING RECEIVABLE</Text>
            </View>
            <View style={styles.invoiceCountBadge}>
              <Text style={styles.invoiceCountText}>
                {unpaidInvoices.length} {unpaidInvoices.length === 1 ? "Invoice" : "Invoices"}
              </Text>
            </View>
          </View>

          <Text style={styles.outstandingTotalValue}>
            {formatLKR(totalOutstanding)}
          </Text>

          <Text style={styles.summaryDisclaimer}>
            Authoritative balance based on active credit and partially-paid sales.
          </Text>
        </View>

        {/* Unpaid Invoices List */}
        <FlatList
          data={unpaidInvoices}
          keyExtractor={(item) => item._id}
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
            <UnpaidInvoiceCard
              invoice={item}
              onCollect={(inv) =>
                router.push({
                  pathname: "/payments/collect",
                  params: { customerId: customerId!, invoiceId: inv._id }
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <CheckCircle2 size={40} color={Colors.success} />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySub}>
                This customer has zero unpaid or overdue invoices. All historical deliveries are fully settled.
              </Text>
            </View>
          }
        />

        {/* Bottom Collect Payment Shortcut */}
        {unpaidInvoices.length > 0 && (
          <View style={styles.footerActionContainer}>
            <TouchableOpacity
              style={styles.collectAllBtn}
              onPress={() =>
                router.push({
                  pathname: "/payments/collect",
                  params: { customerId: customerId! }
                })
              }
              activeOpacity={0.8}
            >
              <Banknote size={18} color={Colors.textInverse} style={{ marginRight: 6 }} />
              <Text style={styles.collectAllBtnText}>
                Collect Payment for this Customer
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  container: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  summaryTitleGroup: {
    flexDirection: "row",
    alignItems: "center"
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.danger,
    letterSpacing: 0.5
  },
  invoiceCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle
  },
  invoiceCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  outstandingTotalValue: {
    fontSize: Typography.xxl,
    fontWeight: "800",
    color: Colors.danger,
    letterSpacing: -0.5
  },
  summaryDisclaimer: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4
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
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md
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
    lineHeight: 18,
    maxWidth: 280
  },
  footerActionContainer: {
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background
  },
  collectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.leaf,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl
  },
  collectAllBtnText: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.textInverse
  }
});
