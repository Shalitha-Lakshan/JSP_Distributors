import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Plus,
  RotateCcw,
  Search,
  Users,
  Wallet
} from "lucide-react-native";
import { fetchCustomers } from "../../src/api/customers";
import { Customer } from "../../src/types";
import { useDebounce } from "../../src/hooks/useDebounce";
import { useResponsive } from "../../src/hooks/useResponsive";
import { Input } from "../../src/components/common/Input";
import {
  CustomerCard,
  CustomerFilterOption,
  CustomerTypeFilter
} from "../../src/components/customers";
import { formatLKR } from "../../src/utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { useAuthStore } from "../../src/store/authStore";
import { customersRepository } from "../../src/database/repositories/customersRepository";
import { cacheManager } from "../../src/database/cacheManager";
import { syncMetadataRepository } from "../../src/database/repositories/syncMetadataRepository";
import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";
import { LastSyncedLabel } from "../../src/components/common/LastSyncedLabel";
import { assertOnline } from "../../src/utils/networkGuard";

export default function CustomersScreen() {
  const router = useRouter();
  const { isTablet, columns, contentMaxWidth } = useResponsive();
  const user = useAuthStore((state) => state.user);
  const { isOffline, isServerUnavailable } = useNetworkStatus();
  const isOfflineMode = isOffline || isServerUnavailable;

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshSyncMetadata = useCallback(async () => {
    if (user?.id) {
      const meta = await syncMetadataRepository.getLastSync(user.id, "customers");
      setLastSyncedAt(meta?.lastSyncedAt || null);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshSyncMetadata();
  }, [refreshSyncMetadata]);

  // Search and filter state
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<CustomerFilterOption>("all");

  // 300ms search debounce
  const debouncedSearch = useDebounce(search, 300);

  // TanStack Query for customers list with SQLite fallback & caching
  const {
    data: customers = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching
  } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      try {
        const remote = await fetchCustomers();
        if (user?.id && remote.length > 0) {
          await cacheManager.cacheCustomers(user.id, remote);
          await refreshSyncMetadata();
        }
        return remote;
      } catch (err) {
        if (user?.id) {
          const cached = await customersRepository.getCustomers(user.id);
          if (cached.length > 0) {
            await refreshSyncMetadata();
            return cached;
          }
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000
  });

  // Calculate dynamic type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: customers.length,
      retail: 0,
      wholesale: 0,
      credit: 0,
      "walk-in": 0
    };

    customers.forEach((c) => {
      const t = c.customerType || "walk-in";
      if (counts[t] !== undefined) {
        counts[t]++;
      }
    });

    return counts;
  }, [customers]);

  // Overall directory metrics
  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  }, [customers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // 1. Type Filter
      if (selectedType !== "all") {
        if ((c.customerType || "walk-in") !== selectedType) {
          return false;
        }
      }

      // 2. Debounced Search (Name, Phone, Address)
      const q = debouncedSearch.trim().toLowerCase();
      if (!q) return true;

      const matchesName = c.name?.toLowerCase().includes(q);
      const matchesPhone = c.phone?.toLowerCase().includes(q);
      const matchesAddress = c.address?.toLowerCase().includes(q);

      return matchesName || matchesPhone || matchesAddress;
    });
  }, [customers, selectedType, debouncedSearch]);

  const handleResetFilters = () => {
    setSearch("");
    setSelectedType("all");
  };

  const navigateToCustomer = (customer: Customer) => {
    router.push({
      pathname: "/customers/[id]",
      params: { id: customer._id }
    });
  };

  const navigateToNewCustomer = () => {
    if (isOfflineMode) {
      assertOnline("Customer Registration");
      return;
    }
    router.push("/customers/new");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.container,
          isTablet && {
            maxWidth: contentMaxWidth ?? 1000,
            alignSelf: "center",
            width: "100%"
          }
        ]}
      >
        {/* Header with Title and Add Button */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Customer Directory</Text>
            <Text style={styles.subtitle}>
              {customers.length} registered retailer accounts & outlets
            </Text>
            <LastSyncedLabel timestamp={lastSyncedAt} />
          </View>

          <TouchableOpacity
            style={[styles.addBtn, isOfflineMode && { opacity: 0.6 }]}
            onPress={navigateToNewCustomer}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add new customer"
          >
            <Plus size={16} color={Colors.textInverse} style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>New Customer</Text>
          </TouchableOpacity>
        </View>

        {/* Directory KPI Summary Bar */}
        <View style={styles.metricsBar}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>OUTSTANDING RECEIVABLES</Text>
            <Text
              style={[
                styles.metricValue,
                totalOutstanding > 0 ? styles.textDanger : styles.textClean
              ]}
            >
              {formatLKR(totalOutstanding)}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CREDIT ACCOUNTS</Text>
            <Text style={styles.metricValue}>
              {typeCounts.credit || 0} active
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <Input
          placeholder="Search customer by name, phone or town..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={18} color={Colors.textMuted} />}
          style={styles.searchInput}
        />

        {/* Customer Type Filter Chips */}
        <CustomerTypeFilter
          selected={selectedType}
          onSelect={setSelectedType}
          counts={typeCounts}
        />

        {/* Customer List / States */}
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.leaf} />
            <Text style={styles.loadingText}>Loading customer records...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorBox}>
            <AlertCircle size={32} color={Colors.danger} style={{ marginBottom: 8 }} />
            <Text style={styles.errorTitle}>Failed to load customers</Text>
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
            key={`customers-grid-${columns}`}
            data={filteredCustomers}
            keyExtractor={(item) => item._id}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
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
              <CustomerCard
                customer={item}
                isOffline={isOfflineMode}
                onPress={navigateToCustomer}
                style={columns > 1 ? { flex: 1, marginHorizontal: Spacing.xs } : undefined}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Users size={36} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No matching customers</Text>
                <Text style={styles.emptySub}>
                  {debouncedSearch.trim().length > 0
                    ? `No customers found matching "${debouncedSearch}".`
                    : "No customers found under the selected category."}
                </Text>

                {(debouncedSearch.trim().length > 0 || selectedType !== "all") && (
                  <TouchableOpacity
                    style={styles.resetFiltersBtn}
                    onPress={handleResetFilters}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resetFiltersBtnText}>Reset all filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
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
  container: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.leaf,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg
  },
  addBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textInverse
  },
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm
  },
  metricItem: {
    flex: 1
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  metricValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  textDanger: {
    color: Colors.danger
  },
  textClean: {
    color: Colors.success
  },
  searchInput: {
    marginBottom: 0
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginHorizontal: -Spacing.xs
  },
  listContent: {
    paddingTop: Spacing.xs,
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
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
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
    maxWidth: 280
  },
  resetFiltersBtn: {
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  resetFiltersBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textPrimary
  }
});
