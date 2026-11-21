import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  FileText,
  Filter,
  History,
  Info,
  Package,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Truck,
  Users
} from "lucide-react-native";
import { returnsApi } from "../../src/api/returns";
import { tripsApi } from "../../src/api/trips";
import { useTripStore } from "../../src/store/tripStore";
import {
  CustomerReturn,
  CustomerReturnItem,
  MonthlySupplierSummary,
  ReturnCondition,
  ReturnSummaryMetrics,
  SupplierReturnProductLine,
  SupplierReturnGroup,
  TripSession
} from "../../src/types";
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
import { ReturnDetailModal } from "../../src/components/returns/ReturnDetailModal";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../src/theme/colors";

const formatCurrency = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

export default function ReturnsHubScreen() {
  const router = useRouter();
  const { theme, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const { activeTrip } = useTripStore();

  // Navigation tab: 'trip' | 'history' | 'company'
  const [activeSection, setActiveSection] = useState<"trip" | "history" | "company">("trip");

  // Date Filter: 'month' | 'trip' | 'today' | 'custom'
  const [dateFilter, setDateFilter] = useState<"month" | "trip" | "today" | "custom">("month");

  // Selected Month for Company Returns: "YYYY-MM"
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Search & Filters for Trip Returns
  const [tripSearch, setTripSearch] = useState("");

  // Search & Filters for History
  const [historySearch, setHistorySearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Accordion state for Company Returns: record expanded suppliers by name
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({
    "Ruhunu Foods": true,
    "Gajamuthu Foods": true
  });

  // Return Detail Modal state
  const [selectedReturn, setSelectedReturn] = useState<CustomerReturn | null>(null);
  const [selectedItemCode, setSelectedItemCode] = useState<string | undefined>(undefined);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const toggleSupplierExpand = (supplierName: string) => {
    setExpandedSuppliers((prev) => ({
      ...prev,
      [supplierName]: !prev[supplierName]
    }));
  };

  const handleOpenDetail = (ret: CustomerReturn, itemCode?: string) => {
    setSelectedReturn(ret);
    setSelectedItemCode(itemCode);
    setDetailModalVisible(true);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const formattedMonthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-LK", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  // Queries
  // 1. KPI Summary
  const {
    data: summaryMetrics,
    isLoading: isLoadingSummary,
    refetch: refetchSummary
  } = useQuery<ReturnSummaryMetrics>({
    queryKey: ["returns-summary", dateFilter, activeTrip?._id, selectedMonth],
    queryFn: () =>
      returnsApi.getReturnsSummary({
        period: dateFilter,
        tripId: dateFilter === "trip" ? activeTrip?._id : undefined,
        month: dateFilter === "month" ? selectedMonth : undefined
      }),
    staleTime: 30 * 1000
  });

  // 2. Returns List (Scoped or All)
  const {
    data: returnsList = [],
    isLoading: isLoadingReturns,
    isRefetching: isRefetchingReturns,
    refetch: refetchReturns
  } = useQuery<CustomerReturn[]>({
    queryKey: ["returns-list", activeSection, activeTrip?._id],
    queryFn: () =>
      returnsApi.getReturns({
        tripId: activeSection === "trip" && activeTrip?._id ? activeTrip._id : undefined,
        allReps: true
      }),
    staleTime: 30 * 1000
  });

  // 3. Monthly Supplier Summary
  const {
    data: monthlySupplierData,
    isLoading: isLoadingMonthly,
    refetch: refetchMonthly
  } = useQuery<MonthlySupplierSummary>({
    queryKey: ["returns-monthly-supplier", selectedMonth],
    queryFn: () => returnsApi.getMonthlySupplierSummary(selectedMonth),
    staleTime: 30 * 1000
  });

  const onRefresh = async () => {
    await Promise.all([refetchSummary(), refetchReturns(), refetchMonthly()]);
  };

  // Filtered Trip Returns
  const tripReturns = useMemo(() => {
    if (!returnsList) return [];
    let list = returnsList;
    if (activeTrip?._id) {
      list = list.filter((r) => {
        const trip = r.tripId as any;
        return trip?._id === activeTrip._id || trip === activeTrip._id;
      });
    }
    if (tripSearch.trim()) {
      const q = tripSearch.toLowerCase();
      list = list.filter((r) => {
        const invMatch = r.invoiceNo?.toLowerCase().includes(q);
        const custName = (r.customer as any)?.name?.toLowerCase() || "";
        const custMatch = custName.includes(q);
        const itemMatch = (r.items || []).some(
          (it) => it.itemCode?.toLowerCase().includes(q) || it.itemName?.toLowerCase().includes(q)
        );
        return invMatch || custMatch || itemMatch;
      });
    }
    return list;
  }, [returnsList, activeTrip?._id, tripSearch]);

  // Filtered Historical Returns
  const historyReturns = useMemo(() => {
    if (!returnsList) return [];
    let list = returnsList;

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter((r) => {
        const invMatch = r.invoiceNo?.toLowerCase().includes(q);
        const custName = (r.customer as any)?.name?.toLowerCase() || "";
        const custCode = (r.customer as any)?.code?.toLowerCase() || "";
        const custMatch = custName.includes(q) || custCode.includes(q);
        const itemMatch = (r.items || []).some(
          (it) => it.itemCode?.toLowerCase().includes(q) || it.itemName?.toLowerCase().includes(q)
        );
        return invMatch || custMatch || itemMatch;
      });
    }

    if (conditionFilter !== "all") {
      list = list.filter((r) => (r.items || []).some((it) => it.condition === conditionFilter));
    }

    if (statusFilter !== "all") {
      list = list.filter((r) => {
        if (statusFilter === "pending_inspection") {
          return r.inspectionStatus === "pending_inspection" || !r.inspectionStatus;
        }
        if (statusFilter === "approved") {
          return r.inspectionStatus === "approved" || r.inspectionStatus === "partially_approved";
        }
        if (statusFilter === "dispatched") {
          return r.status === "dispatched";
        }
        return true;
      });
    }

    if (supplierFilter !== "all") {
      list = list.filter((r) =>
        (r.items || []).some((it) => {
          const sup = (it.productId as any)?.supplier || (it.itemCode?.startsWith("TP") || it.itemCode?.startsWith("CP") ? "Ruhunu Foods" : "Gajamuthu Foods");
          return sup === supplierFilter;
        })
      );
    }

    return list;
  }, [returnsList, historySearch, conditionFilter, statusFilter, supplierFilter]);

  // Render Condition Badge
  const renderConditionBadge = (condition: string) => {
    switch (condition) {
      case "resellable":
        return <Badge label="Resellable" variant="leaf" size="sm" />;
      case "damaged":
        return <Badge label="Damaged" variant="warning" size="sm" />;
      case "expired":
        return <Badge label="Expired" variant="danger" size="sm" />;
      default:
        return <Badge label={condition} variant="neutral" size="sm" />;
    }
  };

  // Render Handover Badge
  const renderHandoverBadge = (status?: string) => {
    switch (status) {
      case "received":
        return <Badge label="Handed Over" variant="success" size="sm" />;
      case "partially_received":
        return <Badge label="Partial Handover" variant="warning" size="sm" />;
      default:
        return <Badge label="Pending Handover" variant="neutral" size="sm" />;
    }
  };

  // Render Inspection Badge
  const renderInspectionBadge = (status?: string) => {
    switch (status) {
      case "approved":
        return <Badge label="Approved" variant="success" size="sm" />;
      case "partially_approved":
        return <Badge label="Partial" variant="warning" size="sm" />;
      case "rejected":
        return <Badge label="Rejected" variant="danger" size="sm" />;
      default:
        return <Badge label="Pending Inspection" variant="neutral" size="sm" />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* 1. Header Section */}
      <View style={[styles.headerContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Returns</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Trip collections & monthly company returns
            </Text>
          </View>

          {/* Primary Action Button: + Add Return */}
          <TouchableOpacity
            style={[styles.addReturnButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/returns" as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add Return"
          >
            <Plus size={16} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.addReturnButtonText}>+ Add Return</Text>
          </TouchableOpacity>
        </View>

        {/* Active Trip Indicator Pill */}
        <View style={styles.tripIndicatorRow}>
          <View
            style={[
              styles.tripIndicatorPill,
              {
                backgroundColor: activeTrip ? (isDark ? "#064e3b" : "#d1fae5") : (isDark ? "#374151" : "#f3f4f6"),
                borderColor: activeTrip ? (isDark ? "#059669" : "#a7f3d0") : theme.border
              }
            ]}
          >
            <Truck size={13} color={activeTrip ? theme.leaf : theme.textMuted} style={{ marginRight: 6 }} />
            <Text
              style={[
                styles.tripIndicatorText,
                { color: activeTrip ? (isDark ? "#6ee7b7" : "#047857") : theme.textSecondary }
              ]}
              numberOfLines={1}
            >
              {activeTrip
                ? `Active Trip #${activeTrip.tripNo} · ${activeTrip.route || "General Route"}`
                : "No Active Trip Session"}
            </Text>
          </View>
        </View>

        {/* Date Filter Bar */}
        <View style={styles.dateFilterBar}>
          {(["month", "trip", "today"] as const).map((key) => {
            const labels: Record<string, string> = {
              month: "This Month",
              trip: "This Trip",
              today: "Today"
            };
            const isSelected = dateFilter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterPill,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                  isSelected && {
                    backgroundColor: isDark ? "#134e4a" : "#ccfbf1",
                    borderColor: theme.primary
                  }
                ]}
                onPress={() => setDateFilter(key)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: theme.textSecondary },
                    isSelected && { color: theme.primary, fontWeight: "700" }
                  ]}
                >
                  {labels[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: contentMaxWidth ?? 1080, alignSelf: "center", width: "100%" }
        ]}
        refreshControl={<RefreshControl refreshing={isLoadingReturns && isRefetchingReturns} onRefresh={onRefresh} />}
      >
        {/* 2. Summary KPI Cards (4 Cards) */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Collected Units */}
          <Card style={[styles.kpiCard, { borderLeftColor: theme.leaf }]}>
            <View style={styles.kpiIconRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Collected Units</Text>
              <Package size={16} color={theme.leaf} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
              {summaryMetrics?.collectedUnits || 0}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>Physical units returned</Text>
          </Card>

          {/* Card 2: Total Return Value */}
          <Card style={[styles.kpiCard, { borderLeftColor: theme.clay }]}>
            <View style={styles.kpiIconRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Total Return Value</Text>
              <Coins size={16} color={theme.clay} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.clay }]}>
              {formatCurrency(summaryMetrics?.totalReturnValue)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>At billing prices</Text>
          </Card>

          {/* Card 3: Pending Warehouse Inspection */}
          <Card style={[styles.kpiCard, { borderLeftColor: theme.warning }]}>
            <View style={styles.kpiIconRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Pending Inspection</Text>
              <ShieldAlert size={16} color={theme.warning} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.warning }]}>
              {summaryMetrics?.pendingInspectionUnits || 0}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>Awaiting verification</Text>
          </Card>

          {/* Card 4: Pending Company Dispatch */}
          <Card style={[styles.kpiCard, { borderLeftColor: theme.primary }]}>
            <View style={styles.kpiIconRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Company Dispatch</Text>
              <Send size={16} color={theme.primary} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.primary }]}>
              {summaryMetrics?.pendingDispatchUnits || 0}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>Ready for month end</Text>
          </Card>
        </View>

        {/* 3. Section Navigation Segment Tabs */}
        <View style={[styles.sectionTabsContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.sectionTabBtn,
              activeSection === "trip" && [styles.sectionTabBtnActive, { borderBottomColor: theme.primary }]
            ]}
            onPress={() => setActiveSection("trip")}
          >
            <Truck
              size={16}
              color={activeSection === "trip" ? theme.primary : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.sectionTabText,
                { color: theme.textSecondary },
                activeSection === "trip" && [styles.sectionTabTextActive, { color: theme.primary }]
              ]}
            >
              Trip Returns ({tripReturns.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sectionTabBtn,
              activeSection === "history" && [styles.sectionTabBtnActive, { borderBottomColor: theme.primary }]
            ]}
            onPress={() => setActiveSection("history")}
          >
            <History
              size={16}
              color={activeSection === "history" ? theme.primary : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.sectionTabText,
                { color: theme.textSecondary },
                activeSection === "history" && [styles.sectionTabTextActive, { color: theme.primary }]
              ]}
            >
              Return History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sectionTabBtn,
              activeSection === "company" && [styles.sectionTabBtnActive, { borderBottomColor: theme.primary }]
            ]}
            onPress={() => setActiveSection("company")}
          >
            <Building2
              size={16}
              color={activeSection === "company" ? theme.primary : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.sectionTabText,
                { color: theme.textSecondary },
                activeSection === "company" && [styles.sectionTabTextActive, { color: theme.primary }]
              ]}
            >
              Company Returns
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---------------- SECTION A: TRIP RETURNS ---------------- */}
        {activeSection === "trip" && (
          <View style={styles.sectionBody}>
            {!activeTrip && (
              <View
                style={[
                  styles.noticeBanner,
                  { backgroundColor: isDark ? "#1e293b" : "#f1f5f9", borderColor: theme.border }
                ]}
              >
                <Info size={18} color={theme.textSecondary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noticeTitle, { color: theme.textPrimary }]}>No Active Trip Active</Text>
                  <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                    Displaying recent returns. To isolate collections by route, start a route session from Home.
                  </Text>
                </View>
              </View>
            )}

            {/* Quick Search */}
            <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Search size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholder="Search by product name, item code, or customer..."
                placeholderTextColor={theme.textMuted}
                value={tripSearch}
                onChangeText={setTripSearch}
              />
            </View>

            {/* Returns Cards List */}
            {tripReturns.length === 0 ? (
              <Card style={styles.emptyCard}>
                <RotateCcw size={36} color={theme.textMuted} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Returns on This Trip</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  When customers hand over damaged, expired, or resellable products during route visits, record them using the "+ Add Return" button.
                </Text>
                <Button
                  title="+ Add Return from Customer"
                  variant="primary"
                  size="md"
                  onPress={() => router.push("/returns" as any)}
                  style={{ marginTop: Spacing.md }}
                />
              </Card>
            ) : (
              tripReturns.map((ret) => (
                <Card key={ret._id} style={styles.returnCard}>
                  {/* Card Top Header */}
                  <View style={styles.cardTopHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.returnInvNo, { color: theme.textPrimary }]}>
                        Inv #{ret.invoiceNo}
                      </Text>
                      <Text style={[styles.returnCustomer, { color: theme.textSecondary }]}>
                        {(ret.customer as any)?.name || "Customer"} · {formatDate(ret.createdAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.returnTotal, { color: theme.clay }]}>
                        {formatCurrency(ret.returnTotal)}
                      </Text>
                      <View style={{ marginTop: 2 }}>{renderHandoverBadge(ret.handoverStatus)}</View>
                    </View>
                  </View>

                  {/* Product Rows inside Return */}
                  <View style={styles.itemRowsContainer}>
                    {(ret.items || []).map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.itemRow,
                          {
                            backgroundColor: theme.surfaceSubtle,
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleOpenDetail(ret, item.itemCode)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.itemCodeBadge, { color: theme.primary, backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                              {item.itemCode}
                            </Text>
                            <Text style={[styles.itemTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                              {item.itemName}
                            </Text>
                          </View>

                          <View style={styles.itemMetaRow}>
                            <Text style={[styles.itemQtyPrice, { color: theme.textSecondary }]}>
                              {item.quantity} units × {formatCurrency(item.returnPrice)} = <Text style={{ fontWeight: "700", color: theme.textPrimary }}>{formatCurrency(item.returnTotal || item.quantity * item.returnPrice)}</Text>
                            </Text>
                          </View>

                          {item.reason ? (
                            <Text style={[styles.itemReason, { color: theme.textMuted }]} numberOfLines={1}>
                              Reason: {item.reason}
                            </Text>
                          ) : null}
                        </View>

                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          {renderConditionBadge(item.condition)}
                          {renderInspectionBadge(item.inspectionStatus)}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Card Footer Details Action */}
                  <TouchableOpacity
                    style={[styles.cardFooterBtn, { borderTopColor: theme.border }]}
                    onPress={() => handleOpenDetail(ret)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cardFooterBtnText, { color: theme.primary }]}>
                      View 8-Point Audit Details →
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ---------------- SECTION B: RETURN HISTORY ---------------- */}
        {activeSection === "history" && (
          <View style={styles.sectionBody}>
            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Search size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholder="Search history by customer, item, invoice..."
                placeholderTextColor={theme.textMuted}
                value={historySearch}
                onChangeText={setHistorySearch}
              />
            </View>

            {/* Filter Pills: Condition */}
            <View style={styles.filterGroupRow}>
              <Text style={[styles.filterGroupLabel, { color: theme.textMuted }]}>Condition:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
                {["all", "resellable", "damaged", "expired"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.filterTag,
                      { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                      conditionFilter === c && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setConditionFilter(c)}
                  >
                    <Text
                      style={[
                        styles.filterTagText,
                        { color: theme.textSecondary },
                        conditionFilter === c && { color: "#ffffff", fontWeight: "700" }
                      ]}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Filter Pills: Status */}
            <View style={styles.filterGroupRow}>
              <Text style={[styles.filterGroupLabel, { color: theme.textMuted }]}>Status:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
                {[
                  { id: "all", label: "All Status" },
                  { id: "pending_inspection", label: "Pending Inspection" },
                  { id: "approved", label: "Approved" },
                  { id: "dispatched", label: "Dispatched" }
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.filterTag,
                      { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                      statusFilter === s.id && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setStatusFilter(s.id)}
                  >
                    <Text
                      style={[
                        styles.filterTagText,
                        { color: theme.textSecondary },
                        statusFilter === s.id && { color: "#ffffff", fontWeight: "700" }
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Filter Pills: Supplier */}
            <View style={styles.filterGroupRow}>
              <Text style={[styles.filterGroupLabel, { color: theme.textMuted }]}>Supplier:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
                {[
                  { id: "all", label: "All Principals" },
                  { id: "Ruhunu Foods", label: "Ruhunu Foods" },
                  { id: "Gajamuthu Foods", label: "Gajamuthu Foods" }
                ].map((sup) => (
                  <TouchableOpacity
                    key={sup.id}
                    style={[
                      styles.filterTag,
                      { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                      supplierFilter === sup.id && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setSupplierFilter(sup.id)}
                  >
                    <Text
                      style={[
                        styles.filterTagText,
                        { color: theme.textSecondary },
                        supplierFilter === sup.id && { color: "#ffffff", fontWeight: "700" }
                      ]}
                    >
                      {sup.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Results Count */}
            <Text style={[styles.resultsCountText, { color: theme.textMuted }]}>
              Showing {historyReturns.length} return record(s)
            </Text>

            {/* Historical Cards */}
            {historyReturns.length === 0 ? (
              <Card style={styles.emptyCard}>
                <History size={36} color={theme.textMuted} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Returns Match Filters</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Try clearing search keywords or switching filters to view records.
                </Text>
              </Card>
            ) : (
              historyReturns.map((ret) => (
                <Card key={ret._id} style={styles.returnCard}>
                  <View style={styles.cardTopHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.returnInvNo, { color: theme.textPrimary }]}>
                        Inv #{ret.invoiceNo}
                      </Text>
                      <Text style={[styles.returnCustomer, { color: theme.textSecondary }]}>
                        {(ret.customer as any)?.name || "Customer"} · {formatDate(ret.createdAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.returnTotal, { color: theme.clay }]}>
                        {formatCurrency(ret.returnTotal)}
                      </Text>
                      <View style={{ marginTop: 2 }}>{renderInspectionBadge(ret.inspectionStatus)}</View>
                    </View>
                  </View>

                  <View style={styles.itemRowsContainer}>
                    {(ret.items || []).map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.itemRow,
                          {
                            backgroundColor: theme.surfaceSubtle,
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleOpenDetail(ret, item.itemCode)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.itemCodeBadge, { color: theme.primary, backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                              {item.itemCode}
                            </Text>
                            <Text style={[styles.itemTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                              {item.itemName}
                            </Text>
                          </View>

                          <View style={styles.itemMetaRow}>
                            <Text style={[styles.itemQtyPrice, { color: theme.textSecondary }]}>
                              {item.quantity} units · {formatCurrency(item.returnTotal || item.quantity * item.returnPrice)}
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          {renderConditionBadge(item.condition)}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.cardFooterBtn, { borderTopColor: theme.border }]}
                    onPress={() => handleOpenDetail(ret)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cardFooterBtnText, { color: theme.primary }]}>
                      View 8-Point Audit Details →
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ---------------- SECTION C: MONTHLY COMPANY RETURNS ---------------- */}
        {activeSection === "company" && (
          <View style={styles.sectionBody}>
            {/* Month Navigator Header */}
            <View style={[styles.monthNavCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.monthNavBtn, { backgroundColor: theme.surfaceSubtle }]}
                onPress={handlePrevMonth}
                accessibilityRole="button"
                accessibilityLabel="Previous Month"
              >
                <ChevronLeft size={20} color={theme.textPrimary} />
              </TouchableOpacity>

              <View style={{ alignItems: "center" }}>
                <Text style={[styles.monthNavTitle, { color: theme.textPrimary }]}>{formattedMonthLabel}</Text>
                <Text style={[styles.monthNavSub, { color: theme.textSecondary }]}>
                  Month-End Principal Reconciliations
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.monthNavBtn, { backgroundColor: theme.surfaceSubtle }]}
                onPress={handleNextMonth}
                accessibilityRole="button"
                accessibilityLabel="Next Month"
              >
                <ChevronRight size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Notice on Monthly Supplier Workflow */}
            <View
              style={[
                styles.noticeBanner,
                { backgroundColor: isDark ? "#1e293b" : "#f0fdf4", borderColor: isDark ? "#334155" : "#bbf7d0" }
              ]}
            >
              <Building2 size={18} color={theme.leaf} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: theme.leaf }]}>Month-End Company Returns</Text>
                <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                  Accumulated returns are grouped by supplier for van/lorry dispatch to Ruhunu Foods & Gajamuthu Foods with official delivery notes.
                </Text>
              </View>
            </View>

            {/* Supplier Groups */}
            {isLoadingMonthly ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 32 }} />
            ) : !monthlySupplierData?.suppliers || monthlySupplierData.suppliers.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Building2 size={36} color={theme.textMuted} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Company Returns for {formattedMonthLabel}</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Customer returns logged in this calendar month will accumulate here automatically.
                </Text>
              </Card>
            ) : (
              monthlySupplierData.suppliers.map((supplierGroup: SupplierReturnGroup) => {
                const isExpanded = !!expandedSuppliers[supplierGroup.supplierName];

                return (
                  <Card key={supplierGroup.supplierName} style={styles.supplierCard}>
                    {/* Supplier Header */}
                    <View style={styles.supplierHeaderRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={[styles.supplierIconBox, { backgroundColor: isDark ? "#134e4a" : "#ccfbf1" }]}>
                          <Building2 size={20} color={theme.primary} />
                        </View>
                        <View>
                          <Text style={[styles.supplierName, { color: theme.textPrimary }]}>
                            {supplierGroup.supplierName}
                          </Text>
                          <Text style={[styles.supplierTotals, { color: theme.textSecondary }]}>
                            {supplierGroup.totalUnits} units · <Text style={{ fontWeight: "700", color: theme.clay }}>{formatCurrency(supplierGroup.totalValue)}</Text>
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Status Breakdown Pills */}
                    <View style={styles.statusBreakdownContainer}>
                      <View style={[styles.statusBox, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.statusBoxCount, { color: theme.leaf }]}>
                          {supplierGroup.statusCounts.readyForDispatchUnits}
                        </Text>
                        <Text style={[styles.statusBoxLabel, { color: theme.textMuted }]}>Ready</Text>
                      </View>

                      <View style={[styles.statusBox, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.statusBoxCount, { color: theme.primary }]}>
                          {supplierGroup.statusCounts.dispatchedUnits}
                        </Text>
                        <Text style={[styles.statusBoxLabel, { color: theme.textMuted }]}>Dispatched</Text>
                      </View>

                      <View style={[styles.statusBox, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.statusBoxCount, { color: theme.clay }]}>
                          {supplierGroup.statusCounts.settledUnits}
                        </Text>
                        <Text style={[styles.statusBoxLabel, { color: theme.textMuted }]}>Settled</Text>
                      </View>

                      <View style={[styles.statusBox, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.statusBoxCount, { color: theme.warning }]}>
                          {supplierGroup.statusCounts.pendingInspectionUnits}
                        </Text>
                        <Text style={[styles.statusBoxLabel, { color: theme.textMuted }]}>Pending</Text>
                      </View>
                    </View>

                    {/* Dispatches List (if any) */}
                    {supplierGroup.dispatches && supplierGroup.dispatches.length > 0 ? (
                      <View style={styles.dispatchNoticeBox}>
                        <Text style={[styles.dispatchNoticeTitle, { color: theme.textPrimary }]}>
                          Monthly Dispatches ({supplierGroup.dispatches.length})
                        </Text>
                        {supplierGroup.dispatches.map((disp) => (
                          <View key={disp._id} style={styles.dispatchRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.dispatchInvNo, { color: theme.primary }]}>
                                {disp.supplierInvoiceNo}
                              </Text>
                              <Text style={[styles.dispatchDate, { color: theme.textMuted }]}>
                                {formatDate(disp.dispatchedAt)} · {disp.itemCount} items
                              </Text>
                            </View>
                            <Badge
                              label={disp.status.toUpperCase()}
                              variant={disp.status === "settled" ? "success" : "leaf"}
                              size="sm"
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* Expand / Collapse Button */}
                    <TouchableOpacity
                      style={[styles.accordionToggleBtn, { borderTopColor: theme.border }]}
                      onPress={() => toggleSupplierExpand(supplierGroup.supplierName)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.accordionToggleText, { color: theme.primary }]}>
                        {isExpanded ? "Hide Product Lines" : `View Product Breakdown (${supplierGroup.products.length} Products)`}
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={18} color={theme.primary} />
                      ) : (
                        <ChevronDown size={18} color={theme.primary} />
                      )}
                    </TouchableOpacity>

                    {/* Expanded Product Breakdown */}
                    {isExpanded && (
                      <View style={styles.productListContainer}>
                        {supplierGroup.products.length === 0 ? (
                          <Text style={[styles.noProductsText, { color: theme.textMuted }]}>
                            No items recorded for this supplier this month.
                          </Text>
                        ) : (
                          supplierGroup.products.map((prod: SupplierReturnProductLine) => (
                            <View
                              key={prod.itemCode}
                              style={[
                                styles.productLineCard,
                                {
                                  backgroundColor: theme.surfaceSubtle,
                                  borderColor: theme.border
                                }
                              ]}
                            >
                              <View style={styles.productLineHeader}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <Text style={[styles.itemCodeBadge, { color: theme.primary, backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                                      {prod.itemCode}
                                    </Text>
                                    <Text style={[styles.productLineName, { color: theme.textPrimary }]} numberOfLines={1}>
                                      {prod.itemName}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.productLineTotal, { color: theme.clay }]}>
                                  {formatCurrency(prod.totalValue)}
                                </Text>
                              </View>

                              {/* Breakdown Pills */}
                              <View style={styles.productPillsRow}>
                                <Text style={[styles.pillText, { color: theme.textSecondary }]}>
                                  Total: <Text style={{ fontWeight: "700", color: theme.textPrimary }}>{prod.collectedQty} units</Text>
                                </Text>
                                {prod.resellableQty > 0 ? (
                                  <Text style={[styles.pillText, { color: theme.leaf }]}>
                                    Resellable: {prod.resellableQty}
                                  </Text>
                                ) : null}
                                {prod.damagedQty > 0 ? (
                                  <Text style={[styles.pillText, { color: theme.warning }]}>
                                    Damaged: {prod.damagedQty}
                                  </Text>
                                ) : null}
                                {prod.expiredQty > 0 ? (
                                  <Text style={[styles.pillText, { color: theme.danger }]}>
                                    Expired: {prod.expiredQty}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* 8-Point Detail Audit Modal */}
      <ReturnDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        returnRecord={selectedReturn}
        selectedItemCode={selectedItemCode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  headerContainer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: "800",
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    marginTop: 2
  },
  addReturnButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    elevation: 2
  },
  addReturnButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: Typography.xs
  },
  tripIndicatorRow: {
    marginTop: Spacing.sm
  },
  tripIndicatorPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start"
  },
  tripIndicatorText: {
    fontSize: Typography.xs,
    fontWeight: "600"
  },
  dateFilterBar: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.sm
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1
  },
  filterPillText: {
    fontSize: Typography.xs,
    fontWeight: "600"
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.base
  },
  kpiCard: {
    width: "48.5%",
    padding: Spacing.md,
    borderLeftWidth: 4
  },
  kpiIconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "600"
  },
  kpiValue: {
    fontSize: Typography.lg,
    fontWeight: "800",
    marginTop: 2
  },
  kpiSub: {
    fontSize: 10,
    marginTop: 2
  },
  sectionTabsContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.base,
    overflow: "hidden"
  },
  sectionTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent"
  },
  sectionTabBtnActive: {
    backgroundColor: "transparent"
  },
  sectionTabText: {
    fontSize: Typography.xs,
    fontWeight: "600"
  },
  sectionTabTextActive: {
    fontWeight: "800"
  },
  sectionBody: {
    gap: Spacing.base
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm
  },
  noticeTitle: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  noticeText: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    height: 42
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sm
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    marginVertical: Spacing.md
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: "700"
  },
  emptySubtitle: {
    fontSize: Typography.xs,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 320
  },
  returnCard: {
    padding: Spacing.base,
    marginBottom: Spacing.sm
  },
  cardTopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm
  },
  returnInvNo: {
    fontSize: Typography.base,
    fontWeight: "700"
  },
  returnCustomer: {
    fontSize: Typography.xs,
    marginTop: 2
  },
  returnTotal: {
    fontSize: Typography.base,
    fontWeight: "800"
  },
  itemRowsContainer: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1
  },
  itemCodeBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  itemTitle: {
    fontSize: Typography.xs,
    fontWeight: "600",
    flex: 1
  },
  itemMetaRow: {
    marginTop: 3
  },
  itemQtyPrice: {
    fontSize: 11
  },
  itemReason: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: "italic"
  },
  cardFooterBtn: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    alignItems: "center"
  },
  cardFooterBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  filterGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: "600",
    width: 65
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: Spacing.xs
  },
  filterTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1
  },
  filterTagText: {
    fontSize: 11,
    fontWeight: "600"
  },
  resultsCountText: {
    fontSize: Typography.xs,
    marginVertical: 4
  },
  monthNavCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  monthNavTitle: {
    fontSize: Typography.base,
    fontWeight: "800"
  },
  monthNavSub: {
    fontSize: 10,
    marginTop: 1
  },
  supplierCard: {
    padding: Spacing.base,
    marginBottom: Spacing.sm
  },
  supplierHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md
  },
  supplierIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  supplierName: {
    fontSize: Typography.base,
    fontWeight: "800"
  },
  supplierTotals: {
    fontSize: Typography.xs,
    marginTop: 2
  },
  statusBreakdownContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md
  },
  statusBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md
  },
  statusBoxCount: {
    fontSize: Typography.base,
    fontWeight: "800"
  },
  statusBoxLabel: {
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 2
  },
  dispatchNoticeBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(0,0,0,0.03)",
    marginBottom: Spacing.md
  },
  dispatchNoticeTitle: {
    fontSize: Typography.xs,
    fontWeight: "700",
    marginBottom: Spacing.xs
  },
  dispatchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2
  },
  dispatchInvNo: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  dispatchDate: {
    fontSize: 10
  },
  accordionToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    gap: Spacing.xs
  },
  accordionToggleText: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  productListContainer: {
    marginTop: Spacing.md,
    gap: Spacing.xs
  },
  noProductsText: {
    fontSize: Typography.xs,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: Spacing.sm
  },
  productLineCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1
  },
  productLineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  productLineName: {
    fontSize: Typography.xs,
    fontWeight: "700",
    flex: 1
  },
  productLineTotal: {
    fontSize: Typography.xs,
    fontWeight: "800"
  },
  productPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: 4
  },
  pillText: {
    fontSize: 10
  }
});
