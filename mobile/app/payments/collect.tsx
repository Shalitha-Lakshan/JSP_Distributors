import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Truck,
  User,
  Wallet
} from "lucide-react-native";
import { apiClient } from "../../src/api/client";
import { fetchCustomerById, fetchCustomers, fetchUnpaidInvoices } from "../../src/api/customers";
import { receivePayment } from "../../src/api/payments";
import { Customer, Payment, ReceivePaymentInput, TripSession, UnpaidInvoice } from "../../src/types";
import { CustomerSelectorModal } from "../../src/components/pos/CustomerSelectorModal";
import {
  ChequeDetailsForm,
  InvoiceAllocationList,
  InvoiceAllocationMap,
  PaymentMethodSelector,
  PaymentReceiptModal
} from "../../src/components/payments";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { Badge } from "../../src/components/common/Badge";
import { useResponsive } from "../../src/hooks/useResponsive";
import { formatLKR } from "../../src/utils/formatters";
import { generateIdempotencyKey } from "../../src/utils/idempotency";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { assertOnline } from "../../src/utils/networkGuard";

export default function CollectPaymentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isTablet, contentMaxWidth } = useResponsive();
  const params = useLocalSearchParams<{ customerId?: string; invoiceId?: string }>();

  // Active Trip Verification
  const {
    data: activeTrip,
    isLoading: isLoadingTrip,
    refetch: refetchTrip
  } = useQuery({
    queryKey: ["active-trip"],
    queryFn: async () => {
      const res = await apiClient.get<TripSession | null>("/api/trips/active");
      return res.data;
    }
  });

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);

  // If customerId param passed, auto-fetch and pre-select customer
  const targetCustomerId = params.customerId || selectedCustomer?._id;
  const { data: preloadedCustomer } = useQuery({
    queryKey: ["customer", params.customerId],
    queryFn: () => fetchCustomerById(params.customerId!),
    enabled: !!params.customerId && !selectedCustomer
  });

  useEffect(() => {
    if (preloadedCustomer && !selectedCustomer) {
      setSelectedCustomer(preloadedCustomer);
    }
  }, [preloadedCustomer, selectedCustomer]);

  // Unpaid Invoices for selected customer
  const {
    data: unpaidInvoices = [],
    isLoading: isLoadingInvoices,
    refetch: refetchInvoices
  } = useQuery<UnpaidInvoice[]>({
    queryKey: ["customer-unpaid-invoices", targetCustomerId],
    queryFn: () => fetchUnpaidInvoices(targetCustomerId!),
    enabled: !!targetCustomerId
  });

  // Payment Form State
  const [amountStr, setAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "cheque">("cash");
  const [note, setNote] = useState("");

  // Cheque Fields
  const [chequeNo, setChequeNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split("T")[0]);

  // Errors State
  const [amountError, setAmountError] = useState<string | null>(null);
  const [chequeNoError, setChequeNoError] = useState<string | null>(null);
  const [bankNameError, setBankNameError] = useState<string | null>(null);

  // Invoice Allocations Map
  const [allocations, setAllocations] = useState<InvoiceAllocationMap>({});

  // Submission & Receipt States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState<Payment | null>(null);

  // Pre-select invoice if invoiceId param is provided
  useEffect(() => {
    if (params.invoiceId && unpaidInvoices.length > 0) {
      const targetInv = unpaidInvoices.find((i) => i._id === params.invoiceId);
      if (targetInv) {
        setAmountStr(String(targetInv.dueAmount));
        setAllocations({
          [targetInv._id]: {
            allocatedAmount: targetInv.dueAmount,
            invoiceNo: targetInv.invoiceNo,
            dueAmount: targetInv.dueAmount,
            isSelected: true
          }
        });
      }
    }
  }, [params.invoiceId, unpaidInvoices]);

  // Numeric amount calculation
  const paymentAmount = useMemo(() => {
    const num = Number(amountStr.replace(/[^0-9.]/g, ""));
    return isNaN(num) ? 0 : num;
  }, [amountStr]);

  // Total Allocated Calculation
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, item) => {
      return item.isSelected ? sum + (item.allocatedAmount || 0) : sum;
    }, 0);
  }, [allocations]);

  // Handler: Change single invoice allocation
  const handleChangeAllocation = (invoiceId: string, amount: number) => {
    setAllocations((prev) => {
      const current = prev[invoiceId];
      if (!current) return prev;
      return {
        ...prev,
        [invoiceId]: {
          ...current,
          allocatedAmount: amount,
          isSelected: amount > 0
        }
      };
    });
  };

  // Handler: Toggle single invoice selection
  const handleToggleSelectInvoice = (invoiceId: string) => {
    setAllocations((prev) => {
      const inv = unpaidInvoices.find((i) => i._id === invoiceId);
      if (!inv) return prev;
      const current = prev[invoiceId];
      const nextSelected = !current?.isSelected;

      return {
        ...prev,
        [invoiceId]: {
          invoiceNo: inv.invoiceNo,
          dueAmount: inv.dueAmount,
          allocatedAmount: nextSelected ? inv.dueAmount : 0,
          isSelected: nextSelected
        }
      };
    });
  };

  // Handler: Auto-Allocate FIFO (Oldest first)
  const handleAutoAllocateFIFO = () => {
    if (paymentAmount <= 0) {
      Alert.alert("Enter Amount", "Please enter a payment amount first to auto-allocate.");
      return;
    }

    let remainingFunds = paymentAmount;
    const nextAllocations: InvoiceAllocationMap = {};

    // Sort invoices oldest first
    const sorted = [...unpaidInvoices].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const inv of sorted) {
      if (remainingFunds <= 0) {
        nextAllocations[inv._id] = {
          invoiceNo: inv.invoiceNo,
          dueAmount: inv.dueAmount,
          allocatedAmount: 0,
          isSelected: false
        };
        continue;
      }

      const alloc = Math.min(remainingFunds, inv.dueAmount);
      nextAllocations[inv._id] = {
        invoiceNo: inv.invoiceNo,
        dueAmount: inv.dueAmount,
        allocatedAmount: alloc,
        isSelected: alloc > 0
      };
      remainingFunds -= alloc;
    }

    setAllocations(nextAllocations);
  };

  // Handler: Clear Allocations
  const handleClearAllocations = () => {
    setAllocations({});
  };

  // Quick Action: Pay Full Balance
  const handlePayFullOutstanding = () => {
    if (!selectedCustomer) return;
    const bal = selectedCustomer.outstandingBalance || 0;
    if (bal > 0) {
      setAmountStr(String(bal));
      setAmountError(null);
    }
  };

  // Validation before submission
  const validateForm = (): boolean => {
    let valid = true;

    if (!selectedCustomer) {
      Alert.alert("Customer Required", "Please select a customer to receive payment.");
      return false;
    }

    if (paymentAmount <= 0) {
      setAmountError("Please enter a valid payment amount greater than 0.");
      valid = false;
    } else {
      setAmountError(null);
    }

    if (paymentMethod === "cheque") {
      if (!chequeNo.trim()) {
        setChequeNoError("Cheque number is required.");
        valid = false;
      } else {
        setChequeNoError(null);
      }

      if (!bankName.trim()) {
        setBankNameError("Bank name is required.");
        valid = false;
      } else {
        setBankNameError(null);
      }
    }

    if (totalAllocated > paymentAmount) {
      Alert.alert(
        "Over-Allocated",
        `Total allocated to invoices (${formatLKR(totalAllocated)}) cannot exceed the payment amount (${formatLKR(paymentAmount)}).`
      );
      return false;
    }

    return valid;
  };

  // TanStack Mutation for Payment POST
  const paymentMutation = useMutation({
    mutationFn: receivePayment,
    onSuccess: (savedPayment) => {
      setIsSubmitting(false);

      // Invalidate all related queries for comprehensive financial sync
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", selectedCustomer?._id] });
      queryClient.invalidateQueries({ queryKey: ["customer-unpaid-invoices", selectedCustomer?._id] });
      queryClient.invalidateQueries({ queryKey: ["customer-ledger", selectedCustomer?._id] });
      queryClient.invalidateQueries({ queryKey: ["active-trip"] });
      queryClient.invalidateQueries({ queryKey: ["daily-closing"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });

      // Open receipt modal
      setConfirmedPayment(savedPayment);
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      Alert.alert("Payment Failed", err?.message || "Failed to process payment. Please check your connection.");
    }
  });

  const handleConfirmPayment = () => {
    if (!assertOnline("Payment Collection")) {
      return;
    }

    if (!validateForm() || isSubmitting) return;

    if (!activeTrip) {
      Alert.alert(
        "Active Trip Required",
        "You must have an active trip started to collect payments. Please start your trip first.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Trip", onPress: () => router.push("/trips/start") }
        ]
      );
      return;
    }

    // Format allocations payload
    const allocationPayload = Object.entries(allocations)
      .filter(([_, item]) => item.isSelected && item.allocatedAmount > 0)
      .map(([invId, item]) => ({
        invoice: invId,
        invoiceNo: item.invoiceNo,
        allocatedAmount: item.allocatedAmount
      }));

    Alert.alert(
      "Confirm Payment Collection",
      `Are you sure you want to collect ${formatLKR(paymentAmount)} via ${paymentMethod.toUpperCase()} from ${selectedCustomer!.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Collection",
          style: "default",
          onPress: () => {
            setIsSubmitting(true);
            const idempotencyKey = generateIdempotencyKey("COLL");

            paymentMutation.mutate({
              customer: selectedCustomer!._id,
              amount: paymentAmount,
              paymentMethod,
              allocations: allocationPayload,
              chequeNo: paymentMethod === "cheque" ? chequeNo.trim() : undefined,
              bankName: paymentMethod === "cheque" ? bankName.trim() : undefined,
              chequeDate: paymentMethod === "cheque" && chequeDate ? chequeDate : undefined,
              chequeStatus: paymentMethod === "cheque" ? "pending" : undefined,
              note: note.trim() || undefined,
              idempotencyKey
            });
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          hitSlop={8}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={Colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Collect Payment</Text>
          <Text style={styles.headerSubtitle}>Credit Settlement & Invoice Allocation</Text>
        </View>

        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && {
              maxWidth: contentMaxWidth ?? 880,
              alignSelf: "center",
              width: "100%"
            }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Active Trip Banner Warning */}
          {!activeTrip && !isLoadingTrip && (
            <View style={styles.tripWarningBanner}>
              <AlertTriangle size={18} color={Colors.warning} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tripWarningTitle}>No Active Trip Detected</Text>
                <Text style={styles.tripWarningSub}>
                  Payments collected during field visits must be linked to an active shift.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.startTripBtn}
                onPress={() => router.push("/trips/start")}
              >
                <Text style={styles.startTripBtnText}>Start Trip</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 1. Customer Selection Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CUSTOMER ACCOUNT</Text>

            <TouchableOpacity
              style={styles.customerSelector}
              onPress={() => setIsCustomerModalVisible(true)}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <View style={styles.customerIconWrap}>
                <User size={18} color={selectedCustomer ? Colors.leaf : Colors.textMuted} />
              </View>

              <View style={{ flex: 1 }}>
                {selectedCustomer ? (
                  <>
                    <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                    <Text style={styles.customerSub}>
                      {selectedCustomer.phone || "No phone"} • {selectedCustomer.customerType?.toUpperCase() || "RETAIL"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.customerPlaceholder}>Select Customer Account...</Text>
                    <Text style={styles.customerSub}>Tap to search retailer directory</Text>
                  </>
                )}
              </View>

              <ChevronDown size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Customer Financial Badges */}
            {selectedCustomer && (
              <View style={styles.financialRow}>
                <View style={styles.financialCol}>
                  <Text style={styles.financialLabel}>OUTSTANDING RECEIVABLE</Text>
                  <Text style={[styles.financialValue, { color: Colors.danger }]}>
                    {formatLKR(selectedCustomer.outstandingBalance || 0)}
                  </Text>
                </View>

                <View style={styles.financialDivider} />

                <View style={styles.financialCol}>
                  <Text style={styles.financialLabel}>CREDIT LIMIT</Text>
                  <Text style={styles.financialValue}>
                    {selectedCustomer.creditLimit > 0
                      ? formatLKR(selectedCustomer.creditLimit)
                      : "Strict Cash"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* 2. Payment Amount Input Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>COLLECTION AMOUNT</Text>
              {selectedCustomer && (selectedCustomer.outstandingBalance || 0) > 0 && (
                <TouchableOpacity
                  onPress={handlePayFullOutstanding}
                  disabled={isSubmitting}
                  style={styles.fullBalanceBtn}
                >
                  <Text style={styles.fullBalanceBtnText}>Pay Full Balance</Text>
                </TouchableOpacity>
              )}
            </View>

            <View
              style={[
                styles.amountInputContainer,
                !!amountError && styles.amountInputContainerError
              ]}
            >
              <Text style={styles.currencyPrefix}>Rs.</Text>
              <TextInput
                style={styles.largeAmountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                value={amountStr}
                onChangeText={(val) => {
                  setAmountStr(val);
                  if (amountError) setAmountError(null);
                }}
                keyboardType="decimal-pad"
                editable={!isSubmitting}
              />
            </View>

            {amountError && <Text style={styles.errorText}>{amountError}</Text>}
          </View>

          {/* 3. Payment Method Selector */}
          <PaymentMethodSelector
            selected={paymentMethod}
            onSelect={setPaymentMethod}
            disabled={isSubmitting}
          />

          {/* 4. Cheque Specific Particulars (if cheque) */}
          {paymentMethod === "cheque" && (
            <ChequeDetailsForm
              chequeNo={chequeNo}
              onChangeChequeNo={(v) => {
                setChequeNo(v);
                if (chequeNoError) setChequeNoError(null);
              }}
              bankName={bankName}
              onChangeBankName={(v) => {
                setBankName(v);
                if (bankNameError) setBankNameError(null);
              }}
              chequeDate={chequeDate}
              onChangeChequeDate={setChequeDate}
              chequeNoError={chequeNoError}
              bankNameError={bankNameError}
              disabled={isSubmitting}
            />
          )}

          {/* 5. Invoice Allocations Section */}
          {selectedCustomer && (
            <InvoiceAllocationList
              invoices={unpaidInvoices}
              allocations={allocations}
              onChangeAllocation={handleChangeAllocation}
              onToggleSelect={handleToggleSelectInvoice}
              onAutoAllocateFIFO={handleAutoAllocateFIFO}
              onClearAllocations={handleClearAllocations}
              totalPaymentAmount={paymentAmount}
              totalAllocated={totalAllocated}
              disabled={isSubmitting}
            />
          )}

          {/* 6. Optional Note */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>TRANSACTION NOTE (OPTIONAL)</Text>
            <Input
              placeholder="e.g. Settlement for May bulk delivery"
              value={note}
              onChangeText={setNote}
              disabled={isSubmitting}
              style={{ marginBottom: 0 }}
            />
          </View>

          {/* Confirmation Button */}
          <View style={styles.footerSubmitContainer}>
            <Button
              title={
                isSubmitting
                  ? "Processing Payment..."
                  : `Confirm & Record ${formatLKR(paymentAmount)}`
              }
              variant="primary"
              size="lg"
              onPress={handleConfirmPayment}
              disabled={isSubmitting || paymentAmount <= 0 || !selectedCustomer}
              loading={isSubmitting}
              style={{ width: "100%" }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Reusable Customer Selector Modal */}
      <CustomerSelectorModal
        visible={isCustomerModalVisible}
        selectedCustomer={selectedCustomer}
        onSelect={(cust) => {
          setSelectedCustomer(cust);
          setAllocations({});
        }}
        onClose={() => setIsCustomerModalVisible(false)}
        allowWalkIn={false}
      />

      {/* Successful Payment Receipt Modal */}
      <PaymentReceiptModal
        visible={!!confirmedPayment}
        payment={confirmedPayment}
        onClose={() => {
          setConfirmedPayment(null);
          router.replace("/(tabs)/sales");
        }}
      />
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
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  tripWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: Spacing.base
  },
  tripWarningTitle: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: "#92400e"
  },
  tripWarningSub: {
    fontSize: 10,
    color: "#b45309",
    marginTop: 2
  },
  startTripBtn: {
    backgroundColor: Colors.leaf,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.xs
  },
  startTripBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textInverse
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: Spacing.xs
  },
  fullBalanceBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: Colors.leafLight,
    borderRadius: BorderRadius.sm
  },
  fullBalanceBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.leafDark
  },
  customerSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  customerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md
  },
  customerName: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  customerPlaceholder: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.textMuted
  },
  customerSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2
  },
  financialRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border
  },
  financialCol: {
    flex: 1,
    alignItems: "center"
  },
  financialDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border
  },
  financialLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  financialValue: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 56
  },
  amountInputContainerError: {
    borderColor: Colors.danger
  },
  currencyPrefix: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.leaf,
    marginRight: Spacing.xs
  },
  largeAmountInput: {
    flex: 1,
    height: "100%",
    fontSize: Typography.xxl,
    fontWeight: "800",
    color: Colors.ink
  },
  errorText: {
    fontSize: Typography.xs,
    color: Colors.danger,
    marginTop: 4,
    fontWeight: "600"
  },
  footerSubmitContainer: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl
  }
});
