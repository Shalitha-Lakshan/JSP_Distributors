import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  FileText,
  MapPin,
  Phone,
  PhoneCall,
  RotateCcw,
  ShoppingCart,
  Truck
} from "lucide-react-native";
import {
  fetchCustomerById,
  fetchCustomerLedger,
  fetchUnpaidInvoices
} from "../../src/api/customers";
import { Customer, CustomerLedgerResponse, UnpaidInvoice } from "../../src/types";
import { Badge } from "../../src/components/common/Badge";
import {
  CreditSummaryCard,
  LedgerTransactionRow,
  UnpaidInvoiceCard
} from "../../src/components/customers";
import { useResponsive } from "../../src/hooks/useResponsive";
import { formatLKR } from "../../src/utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { useAuthStore } from "../../src/store/authStore";
import { customersRepository } from "../../src/database/repositories/customersRepository";
import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";
import { assertOnline } from "../../src/utils/networkGuard";

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isTablet, contentMaxWidth } = useResponsive();
  const user = useAuthStore((state) => state.user);
  const { isOffline, isServerUnavailable } = useNetworkStatus();
  const isOfflineMode = isOffline || isServerUnavailable;

  const customerId = Array.isArray(id) ? id[0] : id;

  // 1. Fetch Customer Details with SQLite offline fallback
  const {
    data: customer,
    isLoading: isLoadingCustomer,
    isError: isCustomerError,
    error: customerError,
    refetch: refetchCustomer,
    isRefetching: isRefetchingCustomer
  } = useQuery<Customer>({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      try {
        return await fetchCustomerById(customerId!);
      } catch (err) {
        if (user?.id && customerId) {
          const cached = await customersRepository.getCustomerById(user.id, customerId);
          if (cached) return cached;
        }
        throw err;
      }
    },
    enabled: !!customerId
  });

  // 2. Fetch Customer Ledger (Recent activity preview)
  const {
    data: ledgerData,
    isLoading: isLoadingLedger,
    refetch: refetchLedger
  } = useQuery<CustomerLedgerResponse>({
    queryKey: ["customer-ledger", customerId],
    queryFn: () => fetchCustomerLedger(customerId!),
    enabled: !!customerId
  });

  // 3. Fetch Unpaid Invoices
  const {
    data: unpaidInvoices = [],
    isLoading: isLoadingUnpaid,
    refetch: refetchUnpaid
  } = useQuery<UnpaidInvoice[]>({
    queryKey: ["customer-unpaid-invoices", customerId],
    queryFn: () => fetchUnpaidInvoices(customerId!),
    enabled: !!customerId
  });

  const onRefreshAll = async () => {
    await Promise.all([refetchCustomer(), refetchLedger(), refetchUnpaid()]);
  };

  const handleCallCustomer = () => {
    if (!customer?.phone) {
      Alert.alert("No Phone Number", "This customer does not have a registered contact number.");
      return;
    }

    const cleanPhone = customer.phone.replace(/[\s\-\(\)]/g, "");
    Alert.alert(
      "Call Customer",
      `Would you like to open your phone dialer to call ${customer.name} at ${customer.phone}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Dialer",
          style: "default",
          onPress: () => {
            Linking.openURL(`tel:${cleanPhone}`).catch(() => {
              Alert.alert("Dialer Error", "Unable to open phone dialer on this device.");
            });
          }
        }
      ]
    );
  };

  if (isLoadingCustomer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.loadingText}>Loading customer profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isCustomerError || !customer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorBox}>
          <AlertCircle size={36} color={Colors.danger} style={{ marginBottom: 8 }} />
          <Text style={styles.errorTitle}>Customer Not Found</Text>
          <Text style={styles.errorMsg}>
            {(customerError as any)?.message || "Failed to retrieve customer details."}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color={Colors.textInverse} style={{ marginRight: 6 }} />
            <Text style={styles.backBtnText}>Back to Directory</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const recentTransactions = ledgerData?.ledger?.slice(-3).reverse() || [];
  const previewUnpaid = unpaidInvoices.slice(0, 3);
  const totalUnpaidDue = unpaidInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);

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

        <Text style={styles.headerTitle} numberOfLines={1}>
          {customer.name}
        </Text>

        <TouchableOpacity
          style={[styles.headerEditBtn, isOfflineMode && { opacity: 0.6 }]}
          onPress={() => {
            if (isOfflineMode) {
              assertOnline("Customer Editing");
              return;
            }
            router.push({
              pathname: "/customers/[id]/edit",
              params: { id: customer._id }
            });
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Edit customer"
        >
          <Edit3 size={15} color={Colors.leaf} style={{ marginRight: 4 }} />
          <Text style={styles.headerEditText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && {
            maxWidth: contentMaxWidth ?? 800,
            alignSelf: "center",
            width: "100%"
          }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingCustomer}
            onRefresh={onRefreshAll}
            colors={[Colors.leaf]}
            tintColor={Colors.leaf}
          />
        }
      >
        {/* Customer Identity Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <Text style={styles.profileName}>{customer.name}</Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={customer.customerType ? customer.customerType.toUpperCase() : "WALK-IN"}
                  variant={customer.customerType === "credit" ? "warning" : "leaf"}
                  size="sm"
                />
                <Badge
                  label={customer.status ? customer.status.toUpperCase() : "ACTIVE"}
                  variant={customer.status === "inactive" ? "danger" : "neutral"}
                  size="sm"
                />
              </View>
            </View>

            {customer.phone ? (
              <TouchableOpacity
                style={styles.callFab}
                onPress={handleCallCustomer}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Call customer"
              >
                <PhoneCall size={18} color={Colors.textInverse} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Details Rows */}
          <View style={styles.contactDetails}>
            {customer.phone ? (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={handleCallCustomer}
                activeOpacity={0.7}
              >
                <Phone size={14} color={Colors.leaf} style={{ marginRight: 8 }} />
                <Text style={styles.contactTextPhone}>{customer.phone}</Text>
                <Text style={styles.tapToCallText}>(Tap to call)</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.contactRow}>
                <Phone size={14} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.contactTextMuted}>No phone registered</Text>
              </View>
            )}

            {customer.address ? (
              <View style={styles.contactRow}>
                <MapPin size={14} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.contactText}>{customer.address}</Text>
              </View>
            ) : (
              <View style={styles.contactRow}>
                <MapPin size={14} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.contactTextMuted}>No address specified</Text>
              </View>
            )}
          </View>
        </View>

        {/* Financial & Credit Summary */}
        <CreditSummaryCard customer={customer} />

        {/* Quick Action Navigation Grid */}
        <View style={styles.actionGrid}>
          {/* Collect Payment Action */}
          <TouchableOpacity
            style={[styles.actionCard, isOfflineMode && { opacity: 0.6 }]}
            onPress={() => {
              if (isOfflineMode) {
                assertOnline("Payment Collection");
                return;
              }
              router.push({
                pathname: "/payments/collect",
                params: { customerId: customer._id }
              });
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.successLight }]}>
              <Banknote size={20} color={Colors.success} />
            </View>
            <View style={styles.actionTextGroup}>
              <Text style={styles.actionTitle}>Collect Payment</Text>
              <Text style={styles.actionSub}>Record cash or cheque collection</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* View Full Ledger Button */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              router.push({
                pathname: "/customers/[id]/ledger",
                params: { id: customer._id }
              })
            }
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.leafLight }]}>
              <FileSpreadsheet size={20} color={Colors.leafDark} />
            </View>
            <View style={styles.actionTextGroup}>
              <Text style={styles.actionTitle}>Customer Ledger</Text>
              <Text style={styles.actionSub}>Full debit & credit history</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* View Unpaid Invoices Button */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              router.push({
                pathname: "/customers/[id]/unpaid",
                params: { id: customer._id }
              })
            }
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.actionIconWrap,
                {
                  backgroundColor:
                    unpaidInvoices.length > 0 ? Colors.dangerLight : Colors.surfaceSubtle
                }
              ]}
            >
              <FileText
                size={20}
                color={unpaidInvoices.length > 0 ? Colors.danger : Colors.textMuted}
              />
            </View>
            <View style={styles.actionTextGroup}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.actionTitle}>Unpaid Invoices</Text>
                {unpaidInvoices.length > 0 && (
                  <View style={styles.unpaidCountPill}>
                    <Text style={styles.unpaidCountPillText}>
                      {unpaidInvoices.length}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionSub}>
                {unpaidInvoices.length > 0
                  ? `Due: ${formatLKR(totalUnpaidDue)}`
                  : "All invoices settled"}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Unpaid Invoices Section Preview */}
        {unpaidInvoices.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>UNPAID INVOICES ({unpaidInvoices.length})</Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/customers/[id]/unpaid",
                    params: { id: customer._id }
                  })
                }
              >
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>

            {previewUnpaid.map((inv) => (
              <UnpaidInvoiceCard key={inv._id} invoice={inv} />
            ))}
          </View>
        )}

        {/* Recent Ledger Transactions Preview */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/customers/[id]/ledger",
                  params: { id: customer._id }
                })
              }
            >
              <Text style={styles.sectionLink}>Full Ledger</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length > 0 ? (
            <View style={styles.ledgerPreviewContainer}>
              {recentTransactions.map((entry, index) => (
                <LedgerTransactionRow key={`${entry.ref}-${index}`} entry={entry} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyActivityBox}>
              <Text style={styles.emptyActivityText}>
                No transaction records on file for this customer account.
              </Text>
            </View>
          )}
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
  headerTitle: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink,
    marginHorizontal: Spacing.sm,
    textAlign: "center"
  },
  headerEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    backgroundColor: Colors.leafLight,
    borderRadius: BorderRadius.md
  },
  headerEditText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leafDark
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  profileName: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: -0.2
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6
  },
  callFab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3
  },
  contactDetails: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    gap: Spacing.xs
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  contactText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    flex: 1
  },
  contactTextPhone: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leafDark
  },
  tapToCallText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 4
  },
  contactTextMuted: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontStyle: "italic"
  },
  actionGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.base
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md
  },
  actionTextGroup: {
    flex: 1
  },
  actionTitle: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  actionSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 1
  },
  unpaidCountPill: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6
  },
  unpaidCountPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textInverse
  },
  sectionContainer: {
    marginBottom: Spacing.base
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6
  },
  sectionLink: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  ledgerPreviewContainer: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border
  },
  emptyActivityBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center"
  },
  emptyActivityText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center"
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
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.leaf,
    borderRadius: BorderRadius.md
  },
  backBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textInverse
  }
});

