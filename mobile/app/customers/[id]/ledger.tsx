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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Wallet
} from "lucide-react-native";
import { fetchCustomerLedger } from "../../../src/api/customers";
import { CustomerLedgerResponse, LedgerEntry } from "../../../src/types";
import { Input } from "../../../src/components/common/Input";
import { LedgerTransactionRow } from "../../../src/components/customers";
import { useResponsive } from "../../../src/hooks/useResponsive";
import { formatLKR } from "../../../src/utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../../src/theme/colors";

export default function CustomerLedgerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isTablet, contentMaxWidth } = useResponsive();

  const customerId = Array.isArray(id) ? id[0] : id;
  const [search, setSearch] = useState("");

  const {
    data: ledgerData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching
  } = useQuery<CustomerLedgerResponse>({
    queryKey: ["customer-ledger", customerId],
    queryFn: () => fetchCustomerLedger(customerId!),
    enabled: !!customerId
  });

  const customer = ledgerData?.customer;
  const totals = ledgerData?.totals;
  const ledgerEntries = ledgerData?.ledger || [];

  // Reverse chronological order for ledger display (most recent at top)
  const sortedAndFilteredEntries = useMemo(() => {
    const list = [...ledgerEntries].reverse();
    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (entry) =>
        entry.ref.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q)
    );
  }, [ledgerEntries, search]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.loadingText}>Loading customer ledger...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !ledgerData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorBox}>
          <AlertCircle size={36} color={Colors.danger} style={{ marginBottom: 8 }} />
          <Text style={styles.errorTitle}>Ledger Unavailable</Text>
          <Text style={styles.errorMsg}>
            {(error as any)?.message || "Failed to retrieve ledger data for this customer."}
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
            {customer?.name}
          </Text>
          <Text style={styles.headerSubtitle}>Official Customer Ledger</Text>
        </View>

        <View style={{ width: 28 }} />
      </View>

      <View
        style={[
          styles.container,
          isTablet && {
            maxWidth: contentMaxWidth ?? 880,
            alignSelf: "center",
            width: "100%"
          }
        ]}
      >
        {/* Ledger Summary Cards */}
        <View style={styles.summaryGrid}>
          {/* Total Debits (Invoices/Sales) */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryLabelRow}>
              <ArrowUpRight size={14} color={Colors.clay} style={{ marginRight: 4 }} />
              <Text style={styles.summaryLabel}>TOTAL DEBITS</Text>
            </View>
            <Text style={[styles.summaryValue, { color: Colors.clay }]}>
              {formatLKR(totals?.totalDebit || 0)}
            </Text>
            <Text style={styles.summarySub}>Total Billed Sales</Text>
          </View>

          {/* Total Credits (Payments/Collections) */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryLabelRow}>
              <ArrowDownLeft size={14} color={Colors.success} style={{ marginRight: 4 }} />
              <Text style={styles.summaryLabel}>TOTAL CREDITS</Text>
            </View>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              {formatLKR(totals?.totalCredit || 0)}
            </Text>
            <Text style={styles.summarySub}>Total Collected Payments</Text>
          </View>

          {/* Closing / Outstanding Balance */}
          <View style={[styles.summaryCard, styles.summaryCardHighlight]}>
            <View style={styles.summaryLabelRow}>
              <Wallet size={14} color={Colors.leaf} style={{ marginRight: 4 }} />
              <Text style={styles.summaryLabel}>CLOSING BALANCE</Text>
            </View>
            <Text
              style={[
                styles.summaryValue,
                (totals?.closingBalance || 0) > 0 ? styles.textDanger : styles.textClean
              ]}
            >
              {formatLKR(totals?.closingBalance || 0)}
            </Text>
            <Text style={styles.summarySub}>Current Net Receivables</Text>
          </View>
        </View>

        {/* Search within ledger */}
        <Input
          placeholder="Filter ledger by reference or invoice #..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={18} color={Colors.textMuted} />}
          style={styles.ledgerSearchInput}
        />

        {/* Ledger Transactions List */}
        <FlatList
          data={sortedAndFilteredEntries}
          keyExtractor={(item, idx) => `${item.ref}-${item.date}-${idx}`}
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
          renderItem={({ item }) => <LedgerTransactionRow entry={item} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FileSpreadsheet size={44} color={Colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>
                {search.trim() ? "No matching entries" : "No Ledger Activity"}
              </Text>
              <Text style={styles.emptySub}>
                {search.trim()
                  ? `No transactions matching "${search}".`
                  : "This customer has no historical sales or payment records yet."}
              </Text>
            </View>
          }
        />
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
  summaryGrid: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border
  },
  summaryCardHighlight: {
    backgroundColor: "rgba(15, 118, 110, 0.04)",
    borderColor: "rgba(15, 118, 110, 0.2)"
  },
  summaryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2
  },
  summaryLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  summaryValue: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink,
    marginTop: 2
  },
  textDanger: {
    color: Colors.danger
  },
  textClean: {
    color: Colors.success
  },
  summarySub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2
  },
  ledgerSearchInput: {
    marginBottom: Spacing.xs
  },
  listContent: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
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
    padding: Spacing.xxl
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
