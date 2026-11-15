import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Fuel,
  Lock,
  Plus,
  Receipt,
  Trash2,
  Truck,
  Utensils,
  Wrench
} from "lucide-react-native";
import { tripsApi } from "../../src/api/trips";
import { useTripStore } from "../../src/store/tripStore";
import { ExpenseCategory, TripExpense, TripSession } from "../../src/types";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { assertOnline } from "../../src/utils/networkGuard";

const CATEGORIES: { label: ExpenseCategory; icon: any }[] = [
  { label: "Fuel", icon: Fuel },
  { label: "Food", icon: Utensils },
  { label: "Toll", icon: Truck },
  { label: "Vehicle Repairs", icon: Wrench },
  { label: "Other", icon: Receipt }
];

const formatCurrency = (val: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;

export default function TripExpensesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isTablet, contentMaxWidth } = useResponsive();
  const { fetchActiveTrip } = useTripStore();

  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>("Fuel");
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch active trip with TanStack Query
  const {
    data: activeTrip,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TripSession | null>({
    queryKey: ["active-trip"],
    queryFn: tripsApi.getActiveTrip,
    staleTime: 60 * 1000
  });

  // Invalidate and sync trip queries
  const syncTripData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["active-trip"] });
    await queryClient.invalidateQueries({ queryKey: ["daily-closing"] });
    await fetchActiveTrip();
  };

  // Add Expense Mutation (in-flight locking, no auto-retries)
  const addMutation = useMutation({
    mutationFn: async ({ reason, amount }: { reason: string; amount: number }) => {
      return await tripsApi.addExpense(reason, amount);
    },
    onSuccess: async () => {
      setDescription("");
      setAmountStr("");
      setValidationError(null);
      await syncTripData();
      Alert.alert("Success", "Trip expense has been logged successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to log expense. Please try again.");
    }
  });

  // Delete Expense Mutation
  const deleteMutation = useMutation({
    mutationFn: async (index: number) => {
      return await tripsApi.deleteExpense(index);
    },
    onSuccess: async () => {
      await syncTripData();
      Alert.alert("Deleted", "Expense record has been removed.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to delete expense. Please try again.");
    }
  });

  const handleAddExpense = () => {
    if (!assertOnline("Logging Expense")) {
      return;
    }

    setValidationError(null);
    const trimmedDesc = description.trim();
    const parsedAmount = parseFloat(amountStr.replace(/[^0-9.]/g, ""));

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError("Please enter a valid expense amount greater than 0.");
      return;
    }

    const fullReason = trimmedDesc
      ? `${selectedCategory}: ${trimmedDesc}`
      : selectedCategory;

    addMutation.mutate({ reason: fullReason, amount: parsedAmount });
  };

  const confirmDelete = (index: number, expense: TripExpense) => {
    if (!assertOnline("Deleting Expense")) {
      return;
    }

    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to remove this expense?\n\n"${expense.reason}" — ${formatCurrency(expense.amount)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(index)
        }
      ]
    );
  };

  const expenses: TripExpense[] = activeTrip?.expenses || [];
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={Colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Trip Expenses</Text>
          <Text style={styles.headerSubtitle}>Van, Fuel & Road Costs</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: contentMaxWidth ?? 960, alignSelf: "center", width: "100%" }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isRefetching}
            onRefresh={() => {
              refetch();
            }}
            colors={[Colors.leaf]}
          />
        }
      >
        {/* Active Trip Banner / Summary Card */}
        {activeTrip ? (
          <View style={styles.tripSummaryCard}>
            <View style={styles.tripHeaderRow}>
              <View>
                <Text style={styles.tripRouteLabel}>Active Route Session</Text>
                <Text style={styles.tripRouteName}>{activeTrip.route}</Text>
                <Text style={styles.tripNoText}>Trip #{activeTrip.tripNo}</Text>
              </View>
              <View style={styles.tripStatusBadge}>
                <CheckCircle size={14} color="#16a34a" />
                <Text style={styles.tripStatusText}>Active</Text>
              </View>
            </View>

            <View style={styles.totalExpenseBox}>
              <Text style={styles.totalExpenseLabel}>Total Trip Expenses</Text>
              <Text style={styles.totalExpenseValue}>{formatCurrency(totalExpenses)}</Text>
              <Text style={styles.totalExpenseCount}>
                {expenses.length} {expenses.length === 1 ? "entry" : "entries"} recorded
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noTripWarningCard}>
            <View style={styles.warningIconBox}>
              <Lock size={24} color="#ea580c" />
            </View>
            <View style={styles.warningTextBox}>
              <Text style={styles.warningTitle}>No Active Trip Session</Text>
              <Text style={styles.warningDesc}>
                Expenses must be linked to an active delivery trip. Please start a trip first.
              </Text>
              <TouchableOpacity
                style={styles.startTripButton}
                onPress={() => router.push("/trips/start" as any)}
              >
                <Text style={styles.startTripButtonText}>Start Route Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Add Expense Form (Active Trip Only) */}
        {activeTrip && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Log New Expense</Text>

            {/* Category Pills */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryPillsContainer}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                const IconComponent = cat.icon;
                return (
                  <TouchableOpacity
                    key={cat.label}
                    style={[
                      styles.categoryPill,
                      isSelected && styles.categoryPillSelected
                    ]}
                    onPress={() => setSelectedCategory(cat.label)}
                    activeOpacity={0.7}
                  >
                    <IconComponent
                      size={15}
                      color={isSelected ? "#ffffff" : Colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextSelected
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description Input */}
            <Text style={styles.fieldLabel}>Description / Notes (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder={`e.g. ${
                selectedCategory === "Fuel"
                  ? "Negombo Shell 20L diesel"
                  : selectedCategory === "Food"
                  ? "Driver & rep lunch"
                  : selectedCategory === "Toll"
                  ? "Highway exit fee"
                  : selectedCategory === "Vehicle Repairs"
                  ? "Puncture repair"
                  : "Parking or other cost"
              }`}
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={120}
            />

            {/* Amount Input */}
            <Text style={styles.fieldLabel}>Amount (LKR) *</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.amountPrefix}>Rs.</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="numeric"
              />
            </View>

            {validationError && (
              <View style={styles.errorRow}>
                <AlertCircle size={15} color="#dc2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                addMutation.isPending && styles.submitButtonDisabled
              ]}
              onPress={handleAddExpense}
              disabled={addMutation.isPending}
              activeOpacity={0.8}
            >
              {addMutation.isPending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Plus size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.submitButtonText}>Log Expense</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Expense History List */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>
            Expense Records ({expenses.length})
          </Text>

          {expenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Receipt size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Expenses Logged</Text>
              <Text style={styles.emptyDesc}>
                {activeTrip
                  ? "Record fuel, food, toll, or maintenance expenses as you travel your route."
                  : "No expenses recorded."}
              </Text>
            </View>
          ) : (
            expenses.map((expense, idx) => {
              // Parse category for icon selection
              let IconComp = Receipt;
              if (expense.reason.toLowerCase().includes("fuel")) IconComp = Fuel;
              else if (expense.reason.toLowerCase().includes("food")) IconComp = Utensils;
              else if (expense.reason.toLowerCase().includes("toll")) IconComp = Truck;
              else if (expense.reason.toLowerCase().includes("repair")) IconComp = Wrench;

              return (
                <View key={`expense-${idx}`} style={styles.expenseItemCard}>
                  <View style={styles.expenseIconBox}>
                    <IconComp size={18} color={Colors.clay} />
                  </View>

                  <View style={styles.expenseDetails}>
                    <Text style={styles.expenseReason} numberOfLines={2}>
                      {expense.reason}
                    </Text>
                    <Text style={styles.expenseIndexText}>Record #{idx + 1}</Text>
                  </View>

                  <View style={styles.expenseRightCol}>
                    <Text style={styles.expenseAmount}>
                      {formatCurrency(expense.amount)}
                    </Text>
                    {activeTrip && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => confirmDelete(idx, expense)}
                        disabled={deleteMutation.isPending}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  tripSummaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  tripHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm
  },
  tripRouteLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  tripRouteName: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    marginTop: 2
  },
  tripNoText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  tripStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4
  },
  tripStatusText: {
    fontSize: Typography.xs,
    color: "#15803d",
    fontWeight: "700"
  },
  totalExpenseBox: {
    alignItems: "center",
    paddingVertical: Spacing.sm
  },
  totalExpenseLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  totalExpenseValue: {
    fontSize: Typography.xxl,
    fontWeight: "800",
    color: Colors.clay,
    marginTop: 4
  },
  totalExpenseCount: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2
  },
  noTripWarningCard: {
    flexDirection: "row",
    backgroundColor: "#fff7ed",
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#fdba74",
    marginBottom: Spacing.base,
    alignItems: "center"
  },
  warningIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffedd5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.base
  },
  warningTextBox: {
    flex: 1
  },
  warningTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: "#c2410c"
  },
  warningDesc: {
    fontSize: Typography.xs,
    color: "#9a3412",
    marginTop: 2,
    lineHeight: 18
  },
  startTripButton: {
    backgroundColor: Colors.clay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
    marginTop: 8
  },
  startTripButtonText: {
    color: "#ffffff",
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: Spacing.sm
  },
  fieldLabel: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: 6,
    textTransform: "uppercase"
  },
  categoryPillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.sm
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background
  },
  categoryPillSelected: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf
  },
  categoryPillText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.ink
  },
  categoryPillTextSelected: {
    color: "#ffffff",
    fontWeight: "700"
  },
  textInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.sm,
    color: Colors.ink
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md
  },
  amountPrefix: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.leaf,
    marginRight: 6
  },
  amountInput: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    paddingVertical: 10
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm
  },
  errorText: {
    fontSize: Typography.xs,
    color: "#dc2626",
    fontWeight: "600"
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.leaf,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.base
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: Typography.sm,
    fontWeight: "700"
  },
  historySection: {
    marginTop: Spacing.sm
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    marginTop: Spacing.sm
  },
  emptyDesc: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18
  },
  expenseItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  expenseIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffedd5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md
  },
  expenseDetails: {
    flex: 1
  },
  expenseReason: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.ink
  },
  expenseIndexText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2
  },
  expenseRightCol: {
    alignItems: "flex-end"
  },
  expenseAmount: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.clay
  },
  deleteButton: {
    marginTop: 4,
    padding: 4
  }
});
