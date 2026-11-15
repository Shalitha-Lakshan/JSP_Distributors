import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
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
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  Fuel,
  MapPin,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  X
} from "lucide-react-native";
import { tripsApi } from "../../src/api/trips";
import { TripSession, TripStatus } from "../../src/types";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";

const formatCurrency = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export default function TripHistoryScreen() {
  const router = useRouter();
  const { isTablet, contentMaxWidth } = useResponsive();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const {
    data: trips = [],
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TripSession[]>({
    queryKey: ["trips-history"],
    queryFn: () => tripsApi.listTrips(),
    staleTime: 60 * 1000
  });

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.tripNo.toLowerCase().includes(q) ||
        t.route.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [trips, search, statusFilter]);

  const renderTripCard = ({ item }: { item: TripSession }) => {
    const isApproved = item.status === "approved";
    const isPending = item.status === "pending_audit";
    const isActive = item.status === "active";

    const totalExpenses = (item.expenses || []).reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );

    const cashVariance = item.varianceCollections?.cash || 0;
    const chequeVariance = item.varianceCollections?.cheque || 0;

    return (
      <View style={styles.tripCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.routeRow}>
              <MapPin size={16} color={Colors.leaf} style={{ marginRight: 6 }} />
              <Text style={styles.routeName}>{item.route}</Text>
            </View>
            <Text style={styles.tripNoText}>Trip #{item.tripNo}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              isActive && { backgroundColor: "#dcfce7" },
              isPending && { backgroundColor: "#fef3c7" },
              isApproved && { backgroundColor: "#e0f2fe" }
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isActive && { color: "#15803d" },
                isPending && { color: "#b45309" },
                isApproved && { color: "#0369a1" }
              ]}
            >
              {isActive ? "Active" : isPending ? "Pending Audit" : "Approved"}
            </Text>
          </View>
        </View>

        {/* Timestamps */}
        <View style={styles.timeRow}>
          <Calendar size={13} color={Colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.timeText}>
            Started: {formatDateTime(item.startTime)}
          </Text>
        </View>
        {item.endTime && (
          <View style={[styles.timeRow, { marginTop: 2 }]}>
            <Clock size={13} color={Colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.timeText}>
              Ended: {formatDateTime(item.endTime)}
            </Text>
          </View>
        )}

        {/* Collections & Reconciliation Table */}
        <View style={styles.metricsBox}>
          {/* Expected vs Declared Cash */}
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Expected Cash (Net):</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(
                Math.max(0, (item.expectedCollections?.cash || 0) - totalExpenses)
              )}
            </Text>
          </View>

          {item.actualCollections?.cash !== undefined && !isActive && (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Declared Cash:</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(item.actualCollections.cash)}
              </Text>
            </View>
          )}

          {/* Cash Variance */}
          {!isActive && (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Cash Variance:</Text>
              <View style={styles.varianceBadge}>
                {Math.abs(cashVariance) < 0.01 ? (
                  <Text style={[styles.varianceText, { color: "#15803d" }]}>Balanced (0.00)</Text>
                ) : cashVariance < 0 ? (
                  <Text style={[styles.varianceText, { color: "#b91c1c" }]}>
                    Shortage: -{formatCurrency(Math.abs(cashVariance))}
                  </Text>
                ) : (
                  <Text style={[styles.varianceText, { color: "#0369a1" }]}>
                    Excess: +{formatCurrency(cashVariance)}
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* Expected vs Declared Cheques */}
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Expected Cheques:</Text>
            <Text style={[styles.metricValue, { color: "#4f46e5" }]}>
              {formatCurrency(item.expectedCollections?.cheque)}
            </Text>
          </View>

          {item.actualCollections?.cheque !== undefined && !isActive && (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Declared Cheques:</Text>
              <Text style={[styles.metricValue, { color: "#4f46e5" }]}>
                {formatCurrency(item.actualCollections.cheque)}
              </Text>
            </View>
          )}

          {/* Expenses */}
          <View style={[styles.metricRow, { marginTop: 4 }]}>
            <Text style={styles.metricLabel}>Road Expenses:</Text>
            <Text style={[styles.metricValue, { color: Colors.clay }]}>
              {formatCurrency(totalExpenses)} ({item.expenses?.length || 0} entries)
            </Text>
          </View>
        </View>

        {/* Sales Rep Closing Remarks (if entered) */}
        {item.repRemarks ? (
          <View style={[styles.auditNotesBox, { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" }]}>
            <View style={styles.auditNotesHeader}>
              <Text style={[styles.auditNotesTitle, { color: Colors.textSecondary }]}>Sales Rep Handover Remarks</Text>
            </View>
            <Text style={styles.auditNotesText}>"{item.repRemarks}"</Text>
          </View>
        ) : null}

        {/* Manager Audit Notes (if approved or audited) */}
        {item.auditNotes ? (
          <View style={styles.auditNotesBox}>
            <View style={styles.auditNotesHeader}>
              <ShieldCheck size={14} color="#15803d" style={{ marginRight: 4 }} />
              <Text style={styles.auditNotesTitle}>Manager Audit Review</Text>
            </View>
            <Text style={styles.auditNotesText}>"{item.auditNotes}"</Text>
            {item.auditedAt && (
              <Text style={styles.auditedMeta}>
                Audited: {formatDateTime(item.auditedAt)}
              </Text>
            )}
          </View>
        ) : null}

        {/* Action Button: View Full Closing Audit */}
        <TouchableOpacity
          style={styles.viewDetailBtn}
          onPress={() => router.push(`/daily-closing?tripId=${item._id}` as any)}
          activeOpacity={0.8}
        >
          <FileSpreadsheet size={15} color={Colors.leaf} style={{ marginRight: 6 }} />
          <Text style={styles.viewDetailBtnText}>View Shift Reconciliation</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={Colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Trip Shift History</Text>
          <Text style={styles.headerSubtitle}>Closed & Audited Sessions</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <View
        style={[
          styles.contentWrapper,
          isTablet && { maxWidth: contentMaxWidth ?? 960, alignSelf: "center", width: "100%" }
        ]}
      >
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by route or trip number..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Filter Chips */}
        <View style={styles.filterChipRow}>
          {["all", "approved", "pending_audit", "active"].map((st) => {
            const isSelected = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive
                ]}
                onPress={() => setStatusFilter(st)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive
                  ]}
                >
                  {st === "all"
                    ? "All Sessions"
                    : st === "pending_audit"
                    ? "Pending Audit"
                    : st.charAt(0).toUpperCase() + st.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Trips List */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.leaf} />
            <Text style={styles.loadingText}>Loading shift history...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTrips}
            keyExtractor={(item) => item._id}
            renderItem={renderTripCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => {
                  refetch();
                }}
                colors={[Colors.leaf]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Truck size={36} color={Colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Trip Sessions Found</Text>
                <Text style={styles.emptyDesc}>
                  {trips.length === 0
                    ? "No previous trip sessions have been recorded yet."
                    : "No trip sessions match your search criteria."}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background
  },
  headerTitleContainer: {
    alignItems: "center"
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
  headerPlaceholder: {
    width: 40
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.ink,
    paddingVertical: 10
  },
  filterChipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.md
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  filterChipActive: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf
  },
  filterChipText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700"
  },
  listContent: {
    paddingBottom: Spacing.xxl
  },
  tripCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  routeName: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  tripNoText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full
  },
  statusBadgeText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  timeText: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  metricsBox: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  metricLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  metricValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  varianceBadge: {
    alignItems: "flex-end"
  },
  varianceText: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4
  },
  auditNotesBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginTop: Spacing.sm
  },
  auditNotesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2
  },
  auditNotesTitle: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#15803d"
  },
  auditNotesText: {
    fontSize: Typography.xs,
    fontStyle: "italic",
    color: "#166534",
    lineHeight: 18
  },
  auditedMeta: {
    fontSize: 10,
    color: "#15803d",
    marginTop: 4
  },
  viewDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e6f4f1",
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm
  },
  viewDetailBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: Spacing.xxl
  },
  loadingText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 8
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  emptyDesc: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18
  }
});
