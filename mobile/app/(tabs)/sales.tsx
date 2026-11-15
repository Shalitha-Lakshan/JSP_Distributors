import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
  Banknote,
  ChevronRight,
  FileCheck,
  FileText,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Truck
} from "lucide-react-native";
import { fetchSales } from "../../src/api/sales";
import { fetchOrders } from "../../src/api/orders";
import { Order, Sale } from "../../src/types";
import { Input } from "../../src/components/common/Input";
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { InvoiceReceiptModal } from "../../src/components/pos/InvoiceReceiptModal";
import { OrderDeliveryModal } from "../../src/components/pos/OrderDeliveryModal";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { useAuthStore } from "../../src/store/authStore";
import { salesRepository } from "../../src/database/repositories/salesRepository";
import { cacheManager } from "../../src/database/cacheManager";
import { syncMetadataRepository } from "../../src/database/repositories/syncMetadataRepository";
import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";
import { LastSyncedLabel } from "../../src/components/common/LastSyncedLabel";
import { assertOnline } from "../../src/utils/networkGuard";
import { offlineOrderService } from "../../src/services/offlineOrderService";

type TabMode = "sales" | "orders";

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatTime = (iso?: string) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function SalesScreen() {
  const router = useRouter();
  const { isTablet, contentMaxWidth } = useResponsive();
  const user = useAuthStore((state) => state.user);
  const { isOffline, isServerUnavailable } = useNetworkStatus();
  const isOfflineMode = isOffline || isServerUnavailable;

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshSyncMetadata = useCallback(async () => {
    if (user?.id) {
      const meta = await syncMetadataRepository.getLastSync(user.id, "sales");
      setLastSyncedAt(meta?.lastSyncedAt || null);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshSyncMetadata();
  }, [refreshSyncMetadata]);

  const [tabMode, setTabMode] = useState<TabMode>("sales");
  const [search, setSearch] = useState("");
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [orderToDeliver, setOrderToDeliver] = useState<Order | null>(null);
  const [unsyncedDraftsCount, setUnsyncedDraftsCount] = useState(0);

  const checkUnsyncedDrafts = useCallback(async () => {
    if (user?.id) {
      try {
        const count = await offlineOrderService.getPendingDraftsCount(user.id);
        setUnsyncedDraftsCount(count);
      } catch {
        setUnsyncedDraftsCount(0);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    checkUnsyncedDrafts();
  }, [checkUnsyncedDrafts, tabMode]);

  // 1. Fetch Sales with SQLite fallback & caching
  const {
    data: sales = [],
    isLoading: isLoadingSales,
    isError: isSalesError,
    error: salesError,
    refetch: refetchSales,
    isRefetching: isRefetchingSales
  } = useQuery<Sale[]>({
    queryKey: ["sales-history"],
    queryFn: async () => {
      try {
        const remote = await fetchSales();
        if (user?.id && remote.length > 0) {
          await cacheManager.cacheSales(user.id, remote);
          await refreshSyncMetadata();
        }
        return remote;
      } catch (err) {
        if (user?.id) {
          const cached = await salesRepository.getSales(user.id);
          if (cached.length > 0) {
            await refreshSyncMetadata();
            return cached;
          }
        }
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000
  });

  // 2. Fetch Orders
  const {
    data: orders = [],
    isLoading: isLoadingOrders,
    isError: isOrdersError,
    error: ordersError,
    refetch: refetchOrders,
    isRefetching: isRefetchingOrders
  } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    staleTime: 2 * 60 * 1000
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchSales(), refetchOrders(), checkUnsyncedDrafts()]);
  }, [refetchSales, refetchOrders, checkUnsyncedDrafts]);

  const isRefetching = isRefetchingSales || isRefetchingOrders;

  // Filter Sales
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const custName = typeof s.customer === "object" ? s.customer?.name : "";
      return (
        s.invoiceNo?.toLowerCase().includes(q) ||
        (custName && custName.toLowerCase().includes(q))
      );
    });
  }, [sales, search]);

  // Filter Orders
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const custName = o.customer?.name || "";
      return (
        o.orderNo?.toLowerCase().includes(q) ||
        custName.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const pendingOrdersCount = orders.filter((o) => o.orderStatus === "pending_delivery").length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isTablet && { maxWidth: contentMaxWidth ?? 1000, alignSelf: "center", width: "100%" }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Field Billing & Orders</Text>
            <Text style={styles.subtitle}>
              Active route shift receipts and order fulfillment
            </Text>
            <LastSyncedLabel timestamp={lastSyncedAt} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                if (isOfflineMode) {
                  assertOnline("Payment Collections");
                  return;
                }
                router.push("/payments/index" as any);
              }}
              style={[styles.paymentsHeaderBtn, isOfflineMode && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Payment Collections"
            >
              <Banknote size={15} color={Colors.leafDark} style={{ marginRight: 3 }} />
              <Text style={styles.paymentsHeaderBtnText}>Payments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                router.push("/pos/cart" as any);
              }}
              style={styles.newSaleBtn}
              accessibilityRole="button"
              accessibilityLabel="New Sale or Order"
            >
              <Plus size={16} color={Colors.textInverse} style={{ marginRight: 4 }} />
              <Text style={styles.newSaleBtnText}>
                {isOfflineMode ? "New Draft" : "New POS"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Offline Notice Banner */}
        {isOfflineMode && (
          <View style={styles.offlineNoticeWrap}>
            <AlertCircle size={15} color="#92400e" style={{ marginRight: 6 }} />
            <Text style={styles.offlineNoticeText}>
              Showing saved records. Live sales and deliveries are disabled offline. Van Order drafts can be prepared and saved locally.
            </Text>
          </View>
        )}

        {/* Unsynced Offline Drafts Notification Banner */}
        {unsyncedDraftsCount > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/orders/offline" as any)}
            style={styles.offlineDraftsBanner}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Package size={16} color={Colors.clay} style={{ marginRight: 8 }} />
              <Text style={styles.offlineDraftsBannerText}>
                {unsyncedDraftsCount} Offline Order Draft{unsyncedDraftsCount === 1 ? "" : "s"} waiting to sync
              </Text>
            </View>
            <View style={styles.offlineDraftsBannerAction}>
              <Text style={styles.offlineDraftsBannerActionText}>Review & Sync</Text>
              <ChevronRight size={14} color={Colors.clay} />
            </View>
          </TouchableOpacity>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setTabMode("sales")}
            style={[styles.tab, tabMode === "sales" && styles.tabActive]}
          >
            <Receipt size={16} color={tabMode === "sales" ? Colors.leaf : Colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, tabMode === "sales" && styles.tabTextActive]}>
              Sales Invoices ({sales.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTabMode("orders")}
            style={[styles.tab, tabMode === "orders" && styles.tabActive]}
          >
            <Truck size={16} color={tabMode === "orders" ? Colors.clay : Colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, tabMode === "orders" && styles.tabTextActiveClay]}>
              Van Orders ({pendingOrdersCount})
            </Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <Input
          placeholder={
            tabMode === "sales"
              ? "Search invoice no or customer name..."
              : "Search order no or customer name..."
          }
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={18} color={Colors.textMuted} />}
          style={{ marginBottom: Spacing.sm }}
        />

        {/* Sales List Tab */}
        {tabMode === "sales" && (
          isLoadingSales ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.leaf} />
              <Text style={styles.loadingText}>Loading shift sales...</Text>
            </View>
          ) : isSalesError ? (
            <View style={styles.centered}>
              <AlertCircle size={32} color={Colors.danger} style={{ marginBottom: 8 }} />
              <Text style={styles.errorTitle}>Failed to load sales</Text>
              <Text style={styles.errorMsg}>
                {(salesError as any)?.message || "Please check your network connection."}
              </Text>
            </View>
          ) : (
            <FlatList
              key={`sales-list-${isTablet ? "tablet-2" : "phone-1"}`}
              data={filteredSales}
              keyExtractor={(item) => item._id}
              numColumns={isTablet ? 2 : 1}
              columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
              renderItem={({ item }) => {
                const isPaid = item.paymentStatus === "paid";
                const isCredit = item.paymentStatus === "credit";
                const custName = typeof item.customer === "object" ? item.customer?.name : "Walk-in Customer";

                return (
                  <TouchableOpacity
                    onPress={() => setSelectedReceiptSale(item)}
                    activeOpacity={0.8}
                    style={isTablet ? { flex: 1, marginHorizontal: Spacing.xs } : undefined}
                  >
                    <Card style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.invoiceRow}>
                          <Receipt size={16} color={Colors.leaf} style={{ marginRight: 6 }} />
                          <Text style={styles.invoiceNo}>{item.invoiceNo}</Text>
                        </View>
                        <Badge
                          label={item.paymentStatus.toUpperCase()}
                          variant={isPaid ? "success" : isCredit ? "danger" : "warning"}
                          size="sm"
                        />
                      </View>

                      <View style={styles.bodyRow}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.customerName} numberOfLines={1}>
                            {custName || "Walk-in Customer"}
                          </Text>
                          <Text style={styles.timeText}>
                            {formatTime(item.createdAt)} • Method: {item.paymentMethod.toUpperCase()}
                          </Text>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.netTotal}>{formatLKR(item.netTotal)}</Text>
                          {item.dueAmount > 0 && (
                            <Text style={styles.dueText}>Due: {formatLKR(item.dueAmount)}</Text>
                          )}
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Receipt size={48} color={Colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyTitle}>No sales recorded yet</Text>
                  <Text style={styles.emptySub}>
                    Invoices billed during this shift will appear here. Tap "New POS" to create one.
                  </Text>
                </View>
              }
            />
          )
        )}

        {/* Orders List Tab */}
        {tabMode === "orders" && (
          isLoadingOrders ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.leaf} />
              <Text style={styles.loadingText}>Loading van orders...</Text>
            </View>
          ) : isOrdersError ? (
            <View style={styles.centered}>
              <AlertCircle size={32} color={Colors.danger} style={{ marginBottom: 8 }} />
              <Text style={styles.errorTitle}>Failed to load orders</Text>
              <Text style={styles.errorMsg}>
                {(ordersError as any)?.message || "Please check your network connection."}
              </Text>
            </View>
          ) : (
            <FlatList
              key={`orders-list-${isTablet ? "tablet-2" : "phone-1"}`}
              data={filteredOrders}
              keyExtractor={(item) => item._id}
              numColumns={isTablet ? 2 : 1}
              columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
              renderItem={({ item }) => {
                const isPending = item.orderStatus === "pending_delivery";
                const isDelivered = item.orderStatus === "delivered";

                return (
                  <TouchableOpacity
                    onPress={() => setSelectedReceiptOrder(item)}
                    activeOpacity={0.8}
                    style={isTablet ? { flex: 1, marginHorizontal: Spacing.xs } : undefined}
                  >
                    <Card style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.invoiceRow}>
                          <Truck size={16} color={Colors.clay} style={{ marginRight: 6 }} />
                          <Text style={styles.invoiceNo}>{item.orderNo}</Text>
                        </View>
                        <Badge
                          label={isPending ? "PENDING DELIVERY" : isDelivered ? "DELIVERED" : "CANCELLED"}
                          variant={isPending ? "warning" : isDelivered ? "success" : "neutral"}
                          size="sm"
                        />
                      </View>

                      <View style={styles.bodyRow}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.customerName} numberOfLines={1}>
                            {item.customer?.name || "Walk-in Order"}
                          </Text>
                          <Text style={styles.timeText}>
                            {item.items.length} reserved line items • Value: {formatLKR(item.netTotal)}
                          </Text>
                        </View>

                        {isPending && (
                          <TouchableOpacity
                            style={[styles.deliverActionBtn, isOfflineMode && { opacity: 0.6 }]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              if (isOfflineMode) {
                                assertOnline("Order Delivery");
                                return;
                              }
                              setOrderToDeliver(item);
                            }}
                            activeOpacity={0.8}
                          >
                            <FileCheck size={14} color={Colors.textInverse} style={{ marginRight: 4 }} />
                            <Text style={styles.deliverActionText}>Deliver</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Truck size={48} color={Colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyTitle}>No van orders found</Text>
                  <Text style={styles.emptySub}>
                    Orders booked for field reservation will appear here.
                  </Text>
                </View>
              }
            />
          )
        )}

        {/* View Receipt Modal */}
        {selectedReceiptSale ? (
          <InvoiceReceiptModal
            visible={!!selectedReceiptSale}
            sale={selectedReceiptSale}
            onClose={() => setSelectedReceiptSale(null)}
          />
        ) : null}

        {/* View Order Confirmation Modal */}
        {selectedReceiptOrder ? (
          <InvoiceReceiptModal
            visible={!!selectedReceiptOrder}
            order={selectedReceiptOrder}
            onClose={() => setSelectedReceiptOrder(null)}
          />
        ) : null}

        {/* Deliver Order Modal */}
        {orderToDeliver ? (
          <OrderDeliveryModal
            visible={!!orderToDeliver}
            order={orderToDeliver}
            onClose={() => setOrderToDeliver(null)}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background
  },
  container: {
    flex: 1,
    padding: Spacing.base
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.ink
  },
  subtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  paymentsHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.leafLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.md
  },
  paymentsHeaderBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leafDark
  },
  newSaleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.leaf,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.md
  },
  newSaleBtnText: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.textInverse
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md
  },
  tabActive: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border
  },
  tabText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textMuted
  },
  tabTextActive: {
    color: Colors.leaf
  },
  tabTextActiveClay: {
    color: Colors.clay
  },
  listContent: {
    paddingBottom: Spacing.xl
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginHorizontal: -Spacing.xs
  },
  card: {
    marginBottom: Spacing.sm + 2,
    padding: Spacing.md
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs + 2
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  invoiceNo: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  bodyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    paddingTop: Spacing.xs + 4
  },
  customerName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.textPrimary
  },
  timeText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  netTotal: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  dueText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.danger,
    marginTop: 1
  },
  deliverActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.clay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm
  },
  deliverActionText: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.textInverse
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl
  },
  loadingText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm
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
    marginTop: 4
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.textPrimary
  },
  emptySub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 260
  },
  offlineNoticeWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.sm
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: Typography.xs,
    color: "#92400e",
    fontWeight: "600",
    lineHeight: 16
  },
  offlineDraftsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm
  },
  offlineDraftsBannerText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  offlineDraftsBannerAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffedd5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm
  },
  offlineDraftsBannerActionText: {
    fontSize: Typography.xs - 1,
    fontWeight: "700",
    color: Colors.clay,
    marginRight: 2
  }
});
