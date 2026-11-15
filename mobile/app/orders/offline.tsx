import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  Package,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Users,
  Wifi,
  WifiOff,
  X
} from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { useTripStore } from "../../src/store/tripStore";
import { useCartStore } from "../../src/store/cartStore";
import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";
import { offlineOrderService } from "../../src/services/offlineOrderService";
import { offlineOrderSyncService } from "../../src/services/offlineOrderSyncService";
import { customersRepository } from "../../src/database/repositories/customersRepository";
import {
  ConflictDetail,
  OfflineOrderDraft,
  OfflineOrderSyncStatus,
  ReviewValidationResult
} from "../../src/types/offlineOrder";
import { Button } from "../../src/components/common/Button";
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { InvoiceReceiptModal } from "../../src/components/pos/InvoiceReceiptModal";
import { Order } from "../../src/types";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
};

type FilterTab = "all" | "ready_to_sync" | "needs_review" | "synced";

export default function OfflineOrdersScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { activeTrip } = useTripStore();
  const { loadDraftIntoCart } = useCartStore();
  const { isOffline, isServerUnavailable } = useNetworkStatus();
  const isNetworkOffline = isOffline || isServerUnavailable;

  const [drafts, setDrafts] = useState<OfflineOrderDraft[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Review & Sync Modal State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedDraftForReview, setSelectedDraftForReview] = useState<OfflineOrderDraft | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewValidationResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Receipt Modal State for synced drafts
  const [viewReceiptOrder, setViewReceiptOrder] = useState<Order | null>(null);

  const loadDrafts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await offlineOrderService.getDrafts(user.id);
      setDrafts(data);
    } catch (err: any) {
      console.error("[OfflineOrdersScreen] Failed to load drafts:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDrafts();
  }, [loadDrafts]);

  // Filtered Drafts
  const filteredDrafts = drafts.filter((d) => {
    if (filterTab === "all") return true;
    if (filterTab === "ready_to_sync") {
      return d.syncStatus === "ready_to_sync" || d.syncStatus === "draft";
    }
    if (filterTab === "needs_review") {
      return d.syncStatus === "needs_review" || d.syncStatus === "failed";
    }
    if (filterTab === "synced") {
      return d.syncStatus === "synced";
    }
    return true;
  });

  const pendingCount = drafts.filter(
    (d) => d.syncStatus !== "synced"
  ).length;

  const pendingEstimatedValue = drafts
    .filter((d) => d.syncStatus !== "synced")
    .reduce((sum, d) => sum + (d.estimatedTotal || 0), 0);

  // Handlers
  const handleEditDraft = async (draft: OfflineOrderDraft) => {
    if (!user?.id) return;
    try {
      // Look up cached customer
      const cust = await customersRepository.getCustomerById(user.id, draft.customerId);
      const fallbackCustomer = cust || {
        _id: draft.customerId,
        name: draft.customerName,
        phone: draft.customerPhone,
        customerType: (draft.customerType as any) || "retail",
        creditLimit: 0,
        outstandingBalance: 0,
        status: "active" as const
      };

      loadDraftIntoCart(draft, fallbackCustomer);
      router.push("/pos/cart" as any);
    } catch (err: any) {
      Alert.alert("Error", `Could not load draft into cart: ${err.message}`);
    }
  };

  const handleDeleteDraft = (draft: OfflineOrderDraft) => {
    Alert.alert(
      "Delete Offline Draft?",
      `Are you sure you want to delete draft "${draft.draftNo}" for "${draft.customerName}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            try {
              await offlineOrderService.deleteDraft(user.id, draft.id);
              await loadDrafts();
            } catch (err: any) {
              Alert.alert("Error", `Failed to delete draft: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  const handleOpenReview = async (draft: OfflineOrderDraft) => {
    if (isNetworkOffline) {
      Alert.alert(
        "Network Connection Required",
        "Synchronizing and reviewing drafts requires an active internet connection to verify live server inventory, prices, and trip status."
      );
      return;
    }

    if (!user?.id) return;

    setSelectedDraftForReview(draft);
    setReviewResult(null);
    setReviewError(null);
    setReviewModalVisible(true);
    setIsReviewing(true);

    try {
      const result = await offlineOrderSyncService.reviewDraftBeforeSync(user.id, draft.id);
      setReviewResult(result);
    } catch (err: any) {
      setReviewError(err.message || "Failed to validate draft against server.");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleConfirmSync = async () => {
    if (!selectedDraftForReview || !user?.id) return;
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const res = await offlineOrderSyncService.syncDraft(user.id, selectedDraftForReview.id);
      if (res.success && res.order) {
        Alert.alert(
          "Order Synchronized Successfully!",
          `Central Server Order No: ${res.order.orderNo}\n\nWarehouse stock has been reserved for route fulfillment.`,
          [
            {
              text: "OK",
              onPress: () => {
                setReviewModalVisible(false);
                setSelectedDraftForReview(null);
                setReviewResult(null);
                loadDrafts();
              }
            }
          ]
        );
      } else {
        Alert.alert("Sync Blocked", res.error || "Order could not be synchronized.");
        await loadDrafts();
      }
    } catch (err: any) {
      Alert.alert("Sync Error", err.message || "An unexpected error occurred during sync.");
      await loadDrafts();
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: OfflineOrderSyncStatus) => {
    switch (status) {
      case "ready_to_sync":
      case "draft":
        return <Badge label="Ready to Sync" variant="warning" />;
      case "needs_review":
        return <Badge label="Needs Review" variant="danger" />;
      case "syncing":
        return <Badge label="Syncing..." variant="info" />;
      case "synced":
        return <Badge label="Synced" variant="success" />;
      case "failed":
        return <Badge label="Sync Failed" variant="danger" />;
      default:
        return <Badge label={status} variant="neutral" />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color={Colors.ink} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Offline Van Orders</Text>
            <Text style={styles.headerSubtitle}>
              {pendingCount} unsynced draft{pendingCount === 1 ? "" : "s"} saved locally
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          hitSlop={8}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh drafts"
        >
          <RefreshCw size={18} color={Colors.leaf} />
        </TouchableOpacity>
      </View>

      {/* Connectivity Banner */}
      <View
        style={[
          styles.networkBanner,
          isNetworkOffline ? styles.bannerOffline : styles.bannerOnline
        ]}
      >
        {isNetworkOffline ? (
          <>
            <WifiOff size={16} color="#b45309" style={{ marginRight: 6 }} />
            <Text style={styles.bannerTextOffline}>
              Offline Mode — You can prepare, edit, and save Van Order drafts. Synchronization will unlock when connected.
            </Text>
          </>
        ) : (
          <>
            <Wifi size={16} color={Colors.leafDark} style={{ marginRight: 6 }} />
            <Text style={styles.bannerTextOnline}>
              Online — Ready to review live inventory and synchronize orders.
            </Text>
          </>
        )}
      </View>

      {/* Summary KPI Strip */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>UNSYNCED DRAFTS</Text>
          <Text style={[styles.kpiValue, { color: Colors.clay }]}>{pendingCount}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>ESTIMATED VALUE</Text>
          <Text style={[styles.kpiValue, { color: Colors.ink }]}>
            {formatLKR(pendingEstimatedValue)}
          </Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>SAVED ON DEVICE</Text>
          <Text style={[styles.kpiValue, { color: Colors.leaf }]}>{drafts.length}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <Pressable
          onPress={() => setFilterTab("all")}
          style={[styles.filterTab, filterTab === "all" && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, filterTab === "all" && styles.filterTabTextActive]}>
            All ({drafts.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterTab("ready_to_sync")}
          style={[styles.filterTab, filterTab === "ready_to_sync" && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, filterTab === "ready_to_sync" && styles.filterTabTextActive]}>
            Ready ({drafts.filter((d) => d.syncStatus === "ready_to_sync" || d.syncStatus === "draft").length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterTab("needs_review")}
          style={[styles.filterTab, filterTab === "needs_review" && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, filterTab === "needs_review" && styles.filterTabTextActive]}>
            Review ({drafts.filter((d) => d.syncStatus === "needs_review" || d.syncStatus === "failed").length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterTab("synced")}
          style={[styles.filterTab, filterTab === "synced" && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, filterTab === "synced" && styles.filterTabTextActive]}>
            Synced ({drafts.filter((d) => d.syncStatus === "synced").length})
          </Text>
        </Pressable>
      </View>

      {/* Drafts List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.loadingText}>Loading offline drafts...</Text>
        </View>
      ) : filteredDrafts.length === 0 ? (
        <View style={styles.centerBox}>
          <Package size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No offline drafts found</Text>
          <Text style={styles.emptySub}>
            {filterTab === "all"
              ? "When you add items to cart and save a Van Order while offline, drafts will appear here."
              : `No drafts found in the "${filterTab.replace("_", " ")}" category.`}
          </Text>
          <Button
            title="Create Van Order Draft"
            variant="primary"
            size="md"
            onPress={() => router.push("/pos/cart" as any)}
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      ) : (
        <FlatList
          data={filteredDrafts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[Colors.leaf]}
              tintColor={Colors.leaf}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSynced = item.syncStatus === "synced";
            const hasConflict = item.syncStatus === "needs_review" || item.syncStatus === "failed";

            return (
              <Card style={styles.draftCard}>
                {/* Card Top Row */}
                <View style={styles.draftCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.draftNo}>{item.draftNo}</Text>
                    {getStatusBadge(item.syncStatus)}
                  </View>
                  <Text style={styles.draftDate}>{formatDate(item.createdAt)}</Text>
                </View>

                {/* Customer Details */}
                <View style={styles.customerRow}>
                  <Users size={16} color={Colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={styles.customerName}>{item.customerName}</Text>
                  {item.customerPhone ? (
                    <Text style={styles.customerPhone}>({item.customerPhone})</Text>
                  ) : null}
                </View>

                {/* Trip Reference */}
                <View style={styles.metaRow}>
                  <Truck size={14} color={Colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={styles.metaText}>
                    Trip: {item.tripNo} {item.tripRoute ? `• ${item.tripRoute}` : ""}
                  </Text>
                </View>

                {/* Items & Financials */}
                <View style={styles.itemSummaryRow}>
                  <Text style={styles.itemsCountText}>
                    {item.items.length} items • {item.items.reduce((s, i) => s + i.quantity, 0)} units
                  </Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={styles.estimatedAmount}>{formatLKR(item.estimatedTotal)}</Text>
                      {!isSynced && (
                        <View style={styles.estimatedTag}>
                          <Text style={styles.estimatedTagText}>ESTIMATED</Text>
                        </View>
                      )}
                    </View>
                    {item.discountPercent > 0 && (
                      <Text style={styles.discountSubtext}>
                        {item.discountPercent}% Discount applied
                      </Text>
                    )}
                  </View>
                </View>

                {/* Synced Confirmation Banner */}
                {isSynced && item.confirmedOrderNo && (
                  <View style={styles.syncedBanner}>
                    <CheckCircle size={15} color={Colors.leafDark} style={{ marginRight: 6 }} />
                    <Text style={styles.syncedBannerText}>
                      Confirmed Server Order:{" "}
                      <Text style={{ fontWeight: "700" }}>{item.confirmedOrderNo}</Text>
                    </Text>
                  </View>
                )}

                {/* Conflict / Review Warning */}
                {hasConflict && item.lastSyncError && (
                  <View style={styles.conflictBanner}>
                    <AlertTriangle size={15} color={Colors.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.conflictBannerText}>{item.lastSyncError}</Text>
                  </View>
                )}

                {/* Card Action Buttons */}
                <View style={styles.cardActions}>
                  {!isSynced ? (
                    <>
                      <TouchableOpacity
                        onPress={() => handleOpenReview(item)}
                        style={[
                          styles.actionBtn,
                          styles.actionBtnPrimary,
                          isNetworkOffline && { opacity: 0.5 }
                        ]}
                      >
                        <RefreshCw size={14} color={Colors.textInverse} style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnPrimaryText}>Review & Sync</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleEditDraft(item)}
                        style={[styles.actionBtn, styles.actionBtnOutline]}
                      >
                        <Edit3 size={14} color={Colors.ink} style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnOutlineText}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteDraft(item)}
                        style={[styles.actionBtn, styles.actionBtnDanger]}
                      >
                        <Trash2 size={14} color={Colors.danger} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <Text style={styles.syncedNoticeText}>
                        Order committed to server. Inventory reserved.
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteDraft(item)}
                        hitSlop={8}
                        style={{ padding: 6 }}
                      >
                        <Trash2 size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Review & Sync Pre-Validation Modal */}
      <Modal
        visible={reviewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isSyncing) setReviewModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Review & Sync {selectedDraftForReview?.draftNo}
                </Text>
                <Text style={styles.modalSub}>
                  Live Server Inventory & Price Validation
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReviewModalVisible(false)}
                disabled={isSyncing}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {isReviewing ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color={Colors.leaf} />
                <Text style={styles.modalLoadingText}>
                  Validating against live warehouse inventory and prices...
                </Text>
              </View>
            ) : reviewError ? (
              <View style={styles.modalErrorBox}>
                <AlertCircle size={36} color={Colors.danger} />
                <Text style={styles.modalErrorTitle}>Pre-Validation Failed</Text>
                <Text style={styles.modalErrorText}>{reviewError}</Text>
                <Button
                  title="Retry Review"
                  variant="primary"
                  size="md"
                  onPress={() => selectedDraftForReview && handleOpenReview(selectedDraftForReview)}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            ) : reviewResult ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. Trip Status Verification */}
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>1. ROUTE TRIP VERIFICATION</Text>
                  {reviewResult.currentTrip ? (
                    <View style={styles.verificationRow}>
                      <CheckCircle size={16} color={Colors.success} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.verificationText}>
                          Active Trip: {reviewResult.currentTrip.tripNo} ({reviewResult.currentTrip.route})
                        </Text>
                        <Text style={styles.verificationSub}>
                          Trip shift is active and verified by server.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.verificationRow, styles.verificationRowDanger]}>
                      <AlertTriangle size={16} color={Colors.danger} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.verificationText, { color: Colors.danger }]}>
                          No Active Trip Session Found
                        </Text>
                        <Text style={styles.verificationSub}>
                          A live active route trip is required to synchronize Van Orders.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* 2. Customer Verification */}
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>2. CUSTOMER VERIFICATION</Text>
                  {reviewResult.currentCustomer ? (
                    <View style={styles.verificationRow}>
                      <CheckCircle size={16} color={Colors.success} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.verificationText}>
                          Customer: {reviewResult.currentCustomer.name}
                        </Text>
                        <Text style={styles.verificationSub}>
                          Status: {reviewResult.currentCustomer.status.toUpperCase()} • Type:{" "}
                          {reviewResult.currentCustomer.customerType}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.verificationRow, styles.verificationRowDanger]}>
                      <AlertTriangle size={16} color={Colors.danger} style={{ marginRight: 8 }} />
                      <Text style={[styles.verificationText, { color: Colors.danger }]}>
                        Customer could not be verified on the server.
                      </Text>
                    </View>
                  )}
                </View>

                {/* 3. Items & Live Stock Breakdown */}
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>3. INVENTORY & PRICE VALIDATION</Text>
                  {selectedDraftForReview?.items.map((item, idx) => {
                    const conflict = reviewResult.conflicts.find(
                      (c) => c.itemCode === item.itemCode
                    );
                    const isInsufficient = conflict?.type === "insufficient_quantity";
                    const isPriceChanged = conflict?.type === "price_changed";

                    return (
                      <View key={idx} style={styles.reviewItemCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewItemName}>
                            {item.displayName || item.productName}
                          </Text>
                          <Text style={styles.reviewItemCode}>Code: {item.itemCode}</Text>

                          {isPriceChanged && (
                            <View style={styles.priceChangeNotice}>
                              <Text style={styles.priceChangeText}>
                                Price change: Rs. {conflict.oldPrice} → Rs. {conflict.newPrice}
                              </Text>
                            </View>
                          )}

                          {isInsufficient && (
                            <View style={styles.stockErrorNotice}>
                              <AlertCircle size={13} color={Colors.danger} style={{ marginRight: 4 }} />
                              <Text style={styles.stockErrorText}>
                                Requested {item.quantity}, but only {conflict.availableQuantity} available!
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.reviewItemQty}>Qty: {item.quantity}</Text>
                          <Text style={styles.reviewItemPrice}>{formatLKR(item.estimatedLineTotal)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* 4. Financial Recalculation */}
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>4. AUTHORITATIVE TOTALS</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>
                      {formatLKR(reviewResult.recalculatedSubtotal)}
                    </Text>
                  </View>
                  {reviewResult.recalculatedDiscount > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: Colors.danger }]}>
                        Discount ({selectedDraftForReview?.discountPercent}%)
                      </Text>
                      <Text style={[styles.summaryValue, { color: Colors.danger }]}>
                        -{formatLKR(reviewResult.recalculatedDiscount)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                    <Text style={styles.summaryTotalLabel}>AUTHORITATIVE NET TOTAL</Text>
                    <Text style={styles.summaryTotalValue}>
                      {formatLKR(reviewResult.recalculatedTotal)}
                    </Text>
                  </View>
                </View>

                {/* 5. Blocking Conflicts Notice */}
                {!reviewResult.canSync && (
                  <View style={styles.blockingBox}>
                    <AlertTriangle size={20} color={Colors.danger} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockingTitle}>Sync Blocked</Text>
                      <Text style={styles.blockingText}>
                        This draft cannot be synchronized because live stock is insufficient or the trip/customer is inactive. Please edit the draft to adjust quantities.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Bottom Action inside modal */}
                <View style={styles.modalBottomActions}>
                  {!reviewResult.canSync ? (
                    <Button
                      title="Edit Draft in Cart"
                      variant="primary"
                      size="lg"
                      onPress={() => {
                        setReviewModalVisible(false);
                        if (selectedDraftForReview) {
                          handleEditDraft(selectedDraftForReview);
                        }
                      }}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    <Button
                      title={
                        isSyncing
                          ? "Reserving Stock & Submitting..."
                          : `Confirm & Submit Order (${formatLKR(reviewResult.recalculatedTotal)})`
                      }
                      variant="primary"
                      size="lg"
                      disabled={isSyncing}
                      onPress={handleConfirmSync}
                      style={{ width: "100%" }}
                    />
                  )}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Synced Receipt Modal */}
      <InvoiceReceiptModal
        visible={!!viewReceiptOrder}
        order={viewReceiptOrder}
        onClose={() => setViewReceiptOrder(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  backBtn: {
    marginRight: Spacing.md,
    padding: Spacing.xs
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: "700",
    color: Colors.ink
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  refreshBtn: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSubtle
  },
  networkBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm
  },
  bannerOffline: {
    backgroundColor: "#fef3c7"
  },
  bannerOnline: {
    backgroundColor: Colors.leafLight
  },
  bannerTextOffline: {
    fontSize: Typography.xs,
    color: "#92400e",
    flex: 1,
    lineHeight: 16
  },
  bannerTextOnline: {
    fontSize: Typography.xs,
    color: Colors.leafDark,
    flex: 1,
    lineHeight: 16
  },
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  kpiBox: {
    flex: 1,
    alignItems: "center"
  },
  kpiLabel: {
    fontSize: Typography.xs - 1,
    fontWeight: "600",
    color: Colors.textMuted,
    marginBottom: 4
  },
  kpiValue: {
    fontSize: Typography.base,
    fontWeight: "800"
  },
  kpiDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4
  },
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    gap: 8
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle
  },
  filterTabActive: {
    backgroundColor: Colors.leaf
  },
  filterTabText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  filterTabTextActive: {
    color: Colors.textInverse
  },
  listContent: {
    padding: Spacing.base,
    gap: Spacing.md
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sm,
    color: Colors.textSecondary
  },
  emptyTitle: {
    marginTop: Spacing.md,
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  emptySub: {
    marginTop: 4,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    maxWidth: 280
  },
  draftCard: {
    padding: Spacing.md
  },
  draftCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm
  },
  draftNo: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  draftDate: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4
  },
  customerName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  customerPhone: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginLeft: 6
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm
  },
  metaText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  itemSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm
  },
  itemsCountText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  estimatedAmount: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  estimatedTag: {
    backgroundColor: "#ffedd5",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm
  },
  estimatedTagText: {
    fontSize: Typography.xs - 2,
    fontWeight: "700",
    color: Colors.clay
  },
  discountSubtext: {
    fontSize: Typography.xs - 1,
    color: Colors.danger,
    marginTop: 2
  },
  syncedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.leafLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm
  },
  syncedBannerText: {
    fontSize: Typography.xs,
    color: Colors.leafDark
  },
  conflictBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm
  },
  conflictBannerText: {
    fontSize: Typography.xs,
    color: Colors.danger,
    flex: 1
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: BorderRadius.md
  },
  actionBtnPrimary: {
    flex: 2,
    backgroundColor: Colors.leaf
  },
  actionBtnPrimaryText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textInverse
  },
  actionBtnOutline: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border
  },
  actionBtnOutlineText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.ink
  },
  actionBtnDanger: {
    paddingHorizontal: 12,
    backgroundColor: "#fee2e2"
  },
  syncedNoticeText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontStyle: "italic"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
    paddingBottom: Spacing.xl
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink
  },
  modalSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  modalCloseBtn: {
    padding: Spacing.xs
  },
  modalLoadingBox: {
    padding: Spacing.xxl,
    alignItems: "center",
    justifyContent: "center"
  },
  modalLoadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: "center"
  },
  modalErrorBox: {
    padding: Spacing.xxl,
    alignItems: "center"
  },
  modalErrorTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.danger,
    marginTop: Spacing.sm
  },
  modalErrorText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4
  },
  modalScroll: {
    paddingHorizontal: Spacing.base
  },
  modalScrollContent: {
    paddingVertical: Spacing.md,
    gap: Spacing.base
  },
  reviewSection: {
    backgroundColor: Colors.surfaceSubtle,
    padding: Spacing.md,
    borderRadius: BorderRadius.md
  },
  reviewSectionTitle: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textMuted,
    marginBottom: Spacing.sm
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  verificationRowDanger: {
    backgroundColor: "#fee2e2",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm
  },
  verificationText: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  verificationSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  reviewItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  reviewItemName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  reviewItemCode: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 1
  },
  reviewItemQty: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  reviewItemPrice: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  priceChangeNotice: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
    alignSelf: "flex-start"
  },
  priceChangeText: {
    fontSize: Typography.xs - 1,
    fontWeight: "600",
    color: "#92400e"
  },
  stockErrorNotice: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  stockErrorText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.danger
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  summaryLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary
  },
  summaryValue: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.ink
  },
  summaryTotalRow: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  summaryTotalLabel: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  summaryTotalValue: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.leaf
  },
  blockingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    padding: Spacing.md,
    borderRadius: BorderRadius.md
  },
  blockingTitle: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.danger
  },
  blockingText: {
    fontSize: Typography.xs,
    color: Colors.danger,
    marginTop: 2,
    lineHeight: 16
  },
  modalBottomActions: {
    marginTop: Spacing.md
  }
});
