import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search, UserCheck, Users, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { fetchCustomers } from "../../api/customers";
import { Customer } from "../../types";
import { Badge } from "../common/Badge";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

interface CustomerSelectorModalProps {
  visible: boolean;
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onClose: () => void;
  allowWalkIn?: boolean;
}

const formatLKR = (val: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;

export const CustomerSelectorModal: React.FC<CustomerSelectorModalProps> = ({
  visible,
  selectedCustomer,
  onSelect,
  onClose,
  allowWalkIn = true
}) => {
  const router = useRouter();
  const { theme, isDark } = useAppTheme();
  const { isTablet, modalMaxWidth } = useResponsive();
  const [search, setSearch] = useState("");

  const {
    data: customers = [],
    isLoading,
    isError,
    refetch
  } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
    staleTime: 5 * 60 * 1000
  });

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const handleSelectWalkIn = () => {
    onSelect(null);
    onClose();
  };

  const handleSelectCustomer = (customer: Customer) => {
    onSelect(customer);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isTablet ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isTablet && styles.backdropTablet]}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: theme.surface },
            isTablet && {
              width: modalMaxWidth,
              borderRadius: BorderRadius.xl + 4,
              alignSelf: "center",
              marginBottom: Spacing.xl,
              height: "75%"
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1, marginRight: Spacing.xs }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Select Customer</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Choose account for sales invoicing & credit limits</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push("/customers/new");
                }}
                style={[styles.newCustBtn, { backgroundColor: isDark ? "#134e4a" : Colors.leafLight, borderColor: theme.primary }]}
              >
                <Plus size={13} color={theme.primary} style={{ marginRight: 2 }} />
                <Text style={[styles.newCustText, { color: theme.primary }]}>New</Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: theme.surfaceSubtle },
                  pressed && styles.closeBtnPressed
                ]}
              >
                <X size={18} color={theme.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* Search Input */}
          <View style={[styles.searchSection, { backgroundColor: theme.surface }]}>
            <View style={[styles.searchBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Search size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="Search by customer name or phone..."
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={6}>
                  <X size={14} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Customer List */}
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.leaf} />
              <Text style={styles.loadingText}>Loading customers...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                allowWalkIn ? (
                  <Pressable
                    onPress={handleSelectWalkIn}
                    style={({ pressed }) => [
                      styles.walkInRow,
                      { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                      selectedCustomer === null && { borderColor: theme.primary, backgroundColor: isDark ? "#134e4a" : "#f0fdfa" },
                      pressed && styles.rowPressed
                    ]}
                  >
                    <View style={[styles.walkInIconBox, { backgroundColor: isDark ? theme.surface : "#ffffff" }]}>
                      <Users size={18} color={selectedCustomer === null ? theme.primary : theme.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.walkInTitle, { color: theme.textPrimary }]}>Walk-in Customer (General Cash Sale)</Text>
                      <Text style={[styles.walkInSub, { color: theme.textSecondary }]}>No credit allowed. Immediate full payment required.</Text>
                    </View>
                    {selectedCustomer === null && (
                      <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
                        <Check size={14} color={isDark ? "#0b1220" : "#ffffff"} />
                      </View>
                    )}
                  </Pressable>
                ) : undefined
              }
              renderItem={({ item }) => {
                const isSelected = selectedCustomer?._id === item._id;
                const availableCredit = Math.max(0, (item.creditLimit || 0) - (item.outstandingBalance || 0));

                return (
                  <Pressable
                    onPress={() => handleSelectCustomer(item)}
                    style={({ pressed }) => [
                      styles.customerCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      isSelected && { borderColor: theme.primary, backgroundColor: isDark ? "#134e4a" : "#f0fdfa" },
                      pressed && styles.rowPressed
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.nameRow}>
                        <UserCheck size={16} color={isSelected ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.customerName, { color: theme.textPrimary }]}>{item.name}</Text>
                      </View>
                      <Badge
                        label={item.customerType || "retail"}
                        variant={item.customerType === "wholesale" ? "info" : "neutral"}
                        size="sm"
                      />
                    </View>

                    {item.phone || item.address ? (
                      <Text style={[styles.contactText, { color: theme.textSecondary }]}>
                        {[item.phone, item.address].filter(Boolean).join(" • ")}
                      </Text>
                    ) : null}

                    {/* Financial details */}
                    <View style={styles.balanceRow}>
                      <View>
                        <Text style={[styles.balLabel, { color: theme.textMuted }]}>OUTSTANDING</Text>
                        <Text style={[styles.balValue, { color: theme.textPrimary }, item.outstandingBalance > 0 && styles.balValueAlert]}>
                          {formatLKR(item.outstandingBalance || 0)}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.balLabel, { color: theme.textMuted }]}>AVAILABLE CREDIT</Text>
                        <Text style={[styles.balValue, { color: theme.primary }]}>
                          {formatLKR(availableCredit)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>No registered customers found.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end"
  },
  backdropTablet: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg
  },
  backdropDismiss: {
    flex: 1
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl + 4,
    borderTopRightRadius: BorderRadius.xl + 4,
    height: "85%",
    paddingBottom: Spacing.xl
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink
  },
  subtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center"
  },
  newCustBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    backgroundColor: Colors.leafLight,
    borderRadius: BorderRadius.md
  },
  newCustText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leafDark
  },
  closeBtnPressed: {
    backgroundColor: Colors.slatewash
  },
  searchSection: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 42
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: Typography.sm,
    color: Colors.textPrimary
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl
  },
  walkInRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  walkInRowSelected: {
    borderColor: Colors.leaf,
    backgroundColor: "#f0fdf4"
  },
  rowPressed: {
    opacity: 0.85
  },
  walkInIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md
  },
  walkInTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  walkInSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.leaf,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.sm
  },
  customerCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  customerCardSelected: {
    borderColor: Colors.leaf,
    borderWidth: 2,
    backgroundColor: "#f0fdf4"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm
  },
  customerName: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  contactText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    paddingTop: Spacing.xs + 2
  },
  balLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  balValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink,
    marginTop: 1
  },
  balValueAlert: {
    color: Colors.danger
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
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: "center"
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textMuted
  }
});
