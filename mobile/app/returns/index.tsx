import React, { useMemo, useState } from "react";
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
  Calendar,
  CheckCircle,
  Clock,
  Filter,
  FileText,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Tag,
  User,
  Users,
  X
} from "lucide-react-native";
import { returnsApi } from "../../src/api/returns";
import { tripsApi } from "../../src/api/trips";
import { useTripStore } from "../../src/store/tripStore";
import { assertOnline } from "../../src/utils/networkGuard";
import {
  Customer,
  CustomerReturn,
  CustomerReturnItem,
  EligibleInvoice,
  EligibleInvoiceItem,
  ReturnCondition,
  TripSession
} from "../../src/types";
import { CustomerSelectorModal } from "../../src/components/pos/CustomerSelectorModal";
import { QuantitySelector } from "../../src/components/pos/QuantitySelector";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";

const formatCurrency = (val: number) =>
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

interface ReturnItemDraft {
  productId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  returnPrice: number;
  condition: ReturnCondition;
  reason: string;
}

export default function ReturnsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isTablet, contentMaxWidth } = useResponsive();
  const { fetchActiveTrip } = useTripStore();

  // Navigation tab: 'new' | 'history'
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  // --- New Return State ---
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, ReturnItemDraft>>({});
  const [priceStrings, setPriceStrings] = useState<Record<string, string>>({});
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});

  // --- Return History Filters ---
  const [historySearch, setHistorySearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Query: Active Trip Session
  const { data: activeTrip } = useQuery<TripSession | null>({
    queryKey: ["active-trip"],
    queryFn: tripsApi.getActiveTrip,
    staleTime: 60 * 1000
  });

  // Query: Eligible Invoices for Selected Customer
  const {
    data: eligibleInvoices = [],
    isLoading: isLoadingInvoices,
    refetch: refetchInvoices
  } = useQuery<EligibleInvoice[]>({
    queryKey: ["eligible-invoices", selectedCustomer?._id],
    queryFn: () => returnsApi.getEligibleInvoices(selectedCustomer!._id),
    enabled: !!selectedCustomer?._id
  });

  // Query: Return History
  const {
    data: returnHistory = [],
    isLoading: isLoadingHistory,
    isRefetching: isRefetchingHistory,
    refetch: refetchHistory
  } = useQuery<CustomerReturn[]>({
    queryKey: ["returns"],
    queryFn: () => returnsApi.getReturns(),
    staleTime: 60 * 1000
  });

  // Selected invoice object
  const currentInvoice = useMemo(() => {
    if (!selectedInvoiceNo) return null;
    return eligibleInvoices.find((inv) => inv.invoiceNo === selectedInvoiceNo) || null;
  }, [eligibleInvoices, selectedInvoiceNo]);

  // Handle invoice selection
  const handleSelectInvoice = (invoice: EligibleInvoice) => {
    setSelectedInvoiceNo(invoice.invoiceNo);
    // Initialize drafts with 0 quantity
    const initialDrafts: Record<string, ReturnItemDraft> = {};
    const initialPriceStrings: Record<string, string> = {};
    invoice.items.forEach((item) => {
      initialDrafts[item.itemCode] = {
        productId: item.productId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: 0,
        returnPrice: item.returnPrice,
        condition: "resellable",
        reason: ""
      };
      initialPriceStrings[item.itemCode] = String(item.returnPrice);
    });
    setItemDrafts(initialDrafts);
    setPriceStrings(initialPriceStrings);
    setPriceErrors({});
  };

  // Update item draft return unit price
  const handlePriceChange = (itemCode: string, text: string, maxPrice: number) => {
    const sanitized = text.replace(/[^0-9.]/g, "");
    const parts = sanitized.split(".");
    let cleanVal = sanitized;
    if (parts.length > 2) {
      cleanVal = `${parts[0]}.${parts.slice(1).join("")}`;
    }
    if (parts[1] && parts[1].length > 2) {
      cleanVal = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }

    setPriceStrings((prev) => ({ ...prev, [itemCode]: cleanVal }));

    const num = parseFloat(cleanVal);
    if (!cleanVal || isNaN(num) || num <= 0) {
      setPriceErrors((prev) => ({
        ...prev,
        [itemCode]: "Unit return price must be greater than Rs. 0"
      }));
    } else if (num > maxPrice) {
      setPriceErrors((prev) => ({
        ...prev,
        [itemCode]: `Return price cannot exceed invoiced price (${formatCurrency(maxPrice)})`
      }));
    } else {
      setPriceErrors((prev) => {
        const copy = { ...prev };
        delete copy[itemCode];
        return copy;
      });
      setItemDrafts((prev) => {
        const cur = prev[itemCode];
        if (!cur) return prev;
        return {
          ...prev,
          [itemCode]: { ...cur, returnPrice: num }
        };
      });
    }
  };

  // Update item draft quantity
  const handleQuantityChange = (itemCode: string, qty: number) => {
    setItemDrafts((prev) => {
      const current = prev[itemCode];
      if (!current) return prev;
      return {
        ...prev,
        [itemCode]: { ...current, quantity: qty }
      };
    });
  };

  // Update item draft condition
  const handleConditionChange = (itemCode: string, condition: ReturnCondition) => {
    setItemDrafts((prev) => {
      const current = prev[itemCode];
      if (!current) return prev;
      return {
        ...prev,
        [itemCode]: { ...current, condition }
      };
    });
  };

  // Update item draft reason
  const handleReasonChange = (itemCode: string, reason: string) => {
    setItemDrafts((prev) => {
      const current = prev[itemCode];
      if (!current) return prev;
      return {
        ...prev,
        [itemCode]: { ...current, reason }
      };
    });
  };

  // Active items being returned (quantity > 0)
  const activeReturnItems = useMemo(() => {
    return Object.values(itemDrafts).filter((d) => d.quantity > 0);
  }, [itemDrafts]);

  // Return Summary Totals
  const summaryTotals = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;
    let resellableUnits = 0;
    let resellableValue = 0;
    let nonResellableUnits = 0;
    let nonResellableValue = 0;

    activeReturnItems.forEach((item) => {
      const lineVal = item.quantity * item.returnPrice;
      totalUnits += item.quantity;
      totalValue += lineVal;
      if (item.condition === "resellable") {
        resellableUnits += item.quantity;
        resellableValue += lineVal;
      } else {
        nonResellableUnits += item.quantity;
        nonResellableValue += lineVal;
      }
    });

    return {
      totalUnits,
      totalValue,
      resellableUnits,
      resellableValue,
      nonResellableUnits,
      nonResellableValue
    };
  }, [activeReturnItems]);

  // Create Return Mutation (with in-flight locking)
  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer?._id || !selectedInvoiceNo) {
        throw new Error("Customer and Invoice must be selected.");
      }
      if (activeReturnItems.length === 0) {
        throw new Error("Please specify return quantities for at least one item.");
      }

      return await returnsApi.createCustomerReturn({
        customerId: selectedCustomer._id,
        invoiceNo: selectedInvoiceNo,
        items: activeReturnItems.map((item) => ({
          productId: item.productId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: item.quantity,
          returnPrice: item.returnPrice,
          condition: item.condition,
          reason: item.reason
        }))
      });
    },
    onSuccess: async () => {
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["returns"] });
      await queryClient.invalidateQueries({ queryKey: ["eligible-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["daily-closing"] });
      await queryClient.invalidateQueries({ queryKey: ["active-trip"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-ledger"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await fetchActiveTrip();

      Alert.alert(
        "Return Recorded Successfully",
        `Customer return of ${formatCurrency(
          summaryTotals.totalValue
        )} has been processed. Stock and ledger balances have been updated.`,
        [
          {
            text: "View History",
            onPress: () => {
              // Reset new return form
              setSelectedCustomer(null);
              setSelectedInvoiceNo(null);
              setItemDrafts({});
              setActiveTab("history");
            }
          }
        ]
      );
    },
    onError: (err: any) => {
      Alert.alert(
        "Return Failed",
        err.message || "Failed to process customer return. Please check inputs and try again."
      );
    }
  });

  const handleConfirmSubmit = () => {
    if (!assertOnline("Customer Return")) {
      return;
    }

    if (!activeTrip) {
      Alert.alert(
        "Active Trip Required",
        "An active delivery route trip is required to record customer returns in the field.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Trip", onPress: () => router.push("/trips/start" as any) }
        ]
      );
      return;
    }

    if (activeReturnItems.length === 0) {
      Alert.alert("No Items Selected", "Please select at least 1 unit to return.");
      return;
    }

    const hasPriceError = activeReturnItems.some((item) => {
      const origItem = currentInvoice?.items.find((i) => i.itemCode === item.itemCode);
      const maxPrice = origItem?.returnPrice || 0;
      return item.returnPrice <= 0 || item.returnPrice > maxPrice || !!priceErrors[item.itemCode];
    });

    if (hasPriceError) {
      Alert.alert(
        "Invalid Return Price",
        "Please resolve return unit price errors before confirming the return. Price must be greater than Rs. 0 and cannot exceed the original invoiced selling price."
      );
      return;
    }

    Alert.alert(
      "Confirm Customer Return",
      `Are you sure you want to confirm this return?\n\n` +
        `Customer: ${selectedCustomer?.name}\n` +
        `Invoice: ${selectedInvoiceNo}\n` +
        `Items: ${activeReturnItems.length} lines (${summaryTotals.totalUnits} units)\n` +
        `Total Return: ${formatCurrency(summaryTotals.totalValue)}\n\n` +
        `Resellable stock will be restored immediately. Damaged/expired goods will be held for manager supplier dispatch.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Return",
          onPress: () => createReturnMutation.mutate()
        }
      ]
    );
  };

  // Filtered Return History
  const filteredHistory = useMemo(() => {
    return returnHistory.filter((ret) => {
      const q = historySearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        ret.invoiceNo.toLowerCase().includes(q) ||
        (typeof ret.customer === "object" &&
          ret.customer?.name?.toLowerCase().includes(q));

      const matchesCondition =
        conditionFilter === "all" ||
        ret.items.some((it) => it.condition === conditionFilter);

      const matchesStatus =
        statusFilter === "all" || ret.status === statusFilter;

      return matchesSearch && matchesCondition && matchesStatus;
    });
  }, [returnHistory, historySearch, conditionFilter, statusFilter]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
          <Text style={styles.headerTitle}>Customer Returns</Text>
          <Text style={styles.headerSubtitle}>Field Stock & Credit Restorations</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Segmented Control / Tabs */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "new" && styles.tabButtonActive]}
          onPress={() => setActiveTab("new")}
          activeOpacity={0.8}
        >
          <RotateCcw
            size={16}
            color={activeTab === "new" ? Colors.leaf : Colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[styles.tabButtonText, activeTab === "new" && styles.tabButtonTextActive]}
          >
            New Return
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "history" && styles.tabButtonActive]}
          onPress={() => setActiveTab("history")}
          activeOpacity={0.8}
        >
          <Clock
            size={16}
            color={activeTab === "history" ? Colors.leaf : Colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "history" && styles.tabButtonTextActive
            ]}
          >
            Return History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: contentMaxWidth ?? 960, alignSelf: "center", width: "100%" }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingHistory || isRefetchingHistory}
            onRefresh={() => {
              refetchHistory();
              if (selectedCustomer) refetchInvoices();
            }}
            colors={[Colors.leaf]}
          />
        }
      >
        {activeTab === "new" ? (
          /* ==============================================================
             TAB 1: NEW CUSTOMER RETURN
             ============================================================== */
          <View>
            {/* Active Trip Notice */}
            {!activeTrip ? (
              <View style={styles.warningCard}>
                <Lock size={20} color="#ea580c" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Active Trip Required</Text>
                  <Text style={styles.warningText}>
                    Please start a delivery trip session before logging customer returns.
                  </Text>
                  <TouchableOpacity
                    style={styles.startTripBtn}
                    onPress={() => router.push("/trips/start" as any)}
                  >
                    <Text style={styles.startTripBtnText}>Start Trip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Step 1: Customer Selection */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.sectionTitle}>Select Retailer / Customer</Text>
              </View>

              {selectedCustomer ? (
                <View style={styles.selectedCustomerCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                    <Text style={styles.customerDetails}>
                      {selectedCustomer.phone || "No phone"} • {selectedCustomer.address || "No address"}
                    </Text>
                    <View style={styles.customerBalanceRow}>
                      <Text style={styles.balanceLabel}>Outstanding Balance:</Text>
                      <Text style={styles.balanceValue}>
                        {formatCurrency(selectedCustomer.outstandingBalance)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.changeCustomerBtn}
                    onPress={() => setCustomerModalVisible(true)}
                  >
                    <Text style={styles.changeCustomerBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectCustomerPlaceholder}
                  onPress={() => setCustomerModalVisible(true)}
                >
                  <Users size={22} color={Colors.leaf} style={{ marginRight: 10 }} />
                  <Text style={styles.selectCustomerPlaceholderText}>
                    Tap to Choose Customer
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Step 2: Invoice Selection */}
            {selectedCustomer && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Select Original Invoice</Text>
                </View>

                {isLoadingInvoices ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.leaf} />
                    <Text style={styles.loadingText}>Fetching eligible customer invoices...</Text>
                  </View>
                ) : eligibleInvoices.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <FileText size={28} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Eligible Invoices</Text>
                    <Text style={styles.emptyDesc}>
                      No recent sales with returnable quantities were found for this customer.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.invoiceListContainer}>
                    {eligibleInvoices.map((inv) => {
                      const isSelected = selectedInvoiceNo === inv.invoiceNo;
                      return (
                        <TouchableOpacity
                          key={inv.invoiceNo}
                          style={[
                            styles.invoiceCard,
                            isSelected && styles.invoiceCardSelected
                          ]}
                          onPress={() => handleSelectInvoice(inv)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.invoiceCardTopRow}>
                            <View style={styles.invoiceNoBox}>
                              <FileText
                                size={16}
                                color={isSelected ? Colors.leaf : Colors.textSecondary}
                                style={{ marginRight: 6 }}
                              />
                              <Text
                                style={[
                                  styles.invoiceNoText,
                                  isSelected && styles.invoiceNoTextSelected
                                ]}
                              >
                                {inv.invoiceNo}
                              </Text>
                            </View>
                            <Text style={styles.invoiceDateText}>
                              {formatDate(inv.createdAt)}
                            </Text>
                          </View>

                          <View style={styles.invoiceCardBottomRow}>
                            <Text style={styles.invoiceTotalText}>
                              Net Total: {formatCurrency(inv.netTotal)}
                            </Text>
                            <Text style={styles.invoiceItemsCountText}>
                              {inv.items.length} returnable {inv.items.length === 1 ? "item" : "items"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Step 3: Product Return Quantities & Conditions */}
            {currentInvoice && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>3</Text>
                  </View>
                  <Text style={styles.sectionTitle}>
                    Select Items & Quantities to Return
                  </Text>
                </View>

                {currentInvoice.items.map((item) => {
                  const draft = itemDrafts[item.itemCode] || {
                    quantity: 0,
                    condition: "resellable",
                    reason: ""
                  };

                  const isReturning = draft.quantity > 0;
                  const lineTotal = Math.round(draft.quantity * (draft.returnPrice || 0) * 100) / 100;

                  return (
                    <View
                      key={item.itemCode}
                      style={[
                        styles.itemReturnCard,
                        isReturning && styles.itemReturnCardActive
                      ]}
                    >
                      {/* Item Header */}
                      <View style={styles.itemReturnHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemReturnName}>{item.itemName}</Text>
                          <Text style={styles.itemReturnCode}>
                            Code: {item.itemCode} • Invoiced Price: {formatCurrency(item.returnPrice)}
                          </Text>
                          <Text style={styles.itemReturnStockInfo}>
                            Sold: {item.soldQty} | Previously Returned: {item.alreadyReturnedQty} | Available:{" "}
                            <Text style={{ fontWeight: "700", color: Colors.leaf }}>
                              {item.eligibleQty}
                            </Text>
                          </Text>
                        </View>
                      </View>

                      {/* Quantity Selector: [ - ] [ Input ] [ + ] */}
                      <View style={styles.qtyControlRow}>
                        <Text style={styles.qtyLabel}>Return Qty:</Text>
                        <QuantitySelector
                          quantity={draft.quantity}
                          min={0}
                          max={item.eligibleQty}
                          size="md"
                          onChangeQuantity={(qty) =>
                            handleQuantityChange(item.itemCode, qty)
                          }
                          showWarning
                        />
                      </View>

                      {/* Condition, Editable Price & Reason (when quantity > 0) */}
                      {isReturning && (
                        <View style={styles.itemReturnConfigBox}>
                          {/* Editable Return Unit Price */}
                          <View style={styles.priceSection}>
                            <View style={styles.priceHeaderRow}>
                              <Text style={styles.configLabel}>Return Unit Price (LKR):</Text>
                              <Text style={styles.priceBenchmarkText}>
                                Max: {formatCurrency(item.returnPrice)}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.priceInputWrapper,
                                !!priceErrors[item.itemCode] && styles.priceInputWrapperError
                              ]}
                            >
                              <Text style={styles.priceCurrencyPrefix}>Rs.</Text>
                              <TextInput
                                style={styles.priceInput}
                                keyboardType="decimal-pad"
                                value={
                                  priceStrings[item.itemCode] !== undefined
                                    ? priceStrings[item.itemCode]
                                    : String(draft.returnPrice)
                                }
                                onChangeText={(text) =>
                                  handlePriceChange(item.itemCode, text, item.returnPrice)
                                }
                                placeholder="0.00"
                                placeholderTextColor={Colors.textMuted}
                              />
                            </View>
                            {!!priceErrors[item.itemCode] && (
                              <View style={styles.priceErrorRow}>
                                <AlertCircle size={12} color={Colors.danger} style={{ marginRight: 4 }} />
                                <Text style={styles.priceErrorText}>{priceErrors[item.itemCode]}</Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.configLabel}>Return Condition:</Text>
                          <View style={styles.conditionPillsRow}>
                            {(["resellable", "damaged", "expired"] as ReturnCondition[]).map(
                              (cond) => {
                                const isCondSelected = draft.condition === cond;
                                return (
                                  <TouchableOpacity
                                    key={cond}
                                    style={[
                                      styles.conditionPill,
                                      isCondSelected && styles.conditionPillSelected,
                                      cond === "damaged" && isCondSelected && { backgroundColor: "#f59e0b" },
                                      cond === "expired" && isCondSelected && { backgroundColor: "#ef4444" }
                                    ]}
                                    onPress={() => handleConditionChange(item.itemCode, cond)}
                                  >
                                    <Text
                                      style={[
                                        styles.conditionPillText,
                                        isCondSelected && styles.conditionPillTextSelected
                                      ]}
                                    >
                                      {cond === "resellable"
                                        ? "Resellable (Restock)"
                                        : cond === "damaged"
                                        ? "Damaged"
                                        : "Expired"}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              }
                            )}
                          </View>

                          <Text style={styles.configLabel}>Reason (Optional):</Text>
                          <TextInput
                            style={styles.reasonInput}
                            placeholder="e.g. Broken seal, customer ordered excess, near expiry..."
                            placeholderTextColor={Colors.textMuted}
                            value={draft.reason}
                            onChangeText={(text) =>
                              handleReasonChange(item.itemCode, text)
                            }
                            maxLength={100}
                          />

                          <View style={styles.lineTotalRow}>
                            <Text style={styles.lineTotalLabel}>Line Return Total:</Text>
                            <Text style={styles.lineTotalValue}>
                              {formatCurrency(lineTotal)}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Step 4: Return Summary Card */}
            {activeReturnItems.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Return Summary</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Selected Lines:</Text>
                  <Text style={styles.summaryValue}>
                    {activeReturnItems.length} products
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Return Units:</Text>
                  <Text style={styles.summaryValue}>
                    {summaryTotals.totalUnits} units
                  </Text>
                </View>

                {summaryTotals.resellableUnits > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summarySubLabel}>
                      • Resellable (Restock van):
                    </Text>
                    <Text style={styles.summarySubValue}>
                      {summaryTotals.resellableUnits} units ({formatCurrency(summaryTotals.resellableValue)})
                    </Text>
                  </View>
                )}

                {summaryTotals.nonResellableUnits > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summarySubLabel}>
                      • Damaged/Expired (Held for supplier):
                    </Text>
                    <Text style={styles.summarySubValue}>
                      {summaryTotals.nonResellableUnits} units ({formatCurrency(summaryTotals.nonResellableValue)})
                    </Text>
                  </View>
                )}

                <View style={styles.summaryDivider} />

                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryGrandTotalLabel}>Total Return Value:</Text>
                  <Text style={styles.summaryGrandTotalValue}>
                    {formatCurrency(summaryTotals.totalValue)}
                  </Text>
                </View>

                <View style={styles.ledgerAdjustmentNotice}>
                  <CheckCircle size={14} color="#15803d" style={{ marginRight: 6 }} />
                  <Text style={styles.ledgerNoticeText}>
                    Retailer's balance will be credited by {formatCurrency(summaryTotals.totalValue)}.
                  </Text>
                </View>

                {/* Submit Return Button */}
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    createReturnMutation.isPending && styles.confirmButtonDisabled
                  ]}
                  onPress={handleConfirmSubmit}
                  disabled={createReturnMutation.isPending}
                  activeOpacity={0.8}
                >
                  {createReturnMutation.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <RotateCcw size={18} color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmButtonText}>
                        Confirm & Record Customer Return
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* ==============================================================
             TAB 2: RETURN HISTORY
             ============================================================== */
          <View>
            {/* Search Input */}
            <View style={styles.historySearchContainer}>
              <Search size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.historySearchInput}
                placeholder="Search by invoice number or customer name..."
                placeholderTextColor={Colors.textMuted}
                value={historySearch}
                onChangeText={setHistorySearch}
              />
              {historySearch ? (
                <TouchableOpacity onPress={() => setHistorySearch("")}>
                  <X size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Condition Filter Chips */}
            <View style={styles.filterChipRow}>
              {["all", "resellable", "damaged", "expired"].map((c) => {
                const isSelected = conditionFilter === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipActive
                    ]}
                    onPress={() => setConditionFilter(c)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive
                      ]}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* List of Return Records */}
            {isLoadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.leaf} />
                <Text style={styles.loadingText}>Loading return history...</Text>
              </View>
            ) : filteredHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <RotateCcw size={32} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Returns Found</Text>
                <Text style={styles.emptyDesc}>
                  {returnHistory.length === 0
                    ? "No customer returns have been recorded yet."
                    : "No return records match your search or filter criteria."}
                </Text>
              </View>
            ) : (
              filteredHistory.map((ret) => {
                const customerName =
                  typeof ret.customer === "object"
                    ? ret.customer?.name
                    : "Customer";

                return (
                  <View key={ret._id} style={styles.historyCard}>
                    {/* Header */}
                    <View style={styles.historyCardHeader}>
                      <View>
                        <Text style={styles.historyCustomerName}>{customerName}</Text>
                        <Text style={styles.historyInvoiceNo}>
                          Orig. Invoice: {ret.invoiceNo}
                        </Text>
                      </View>
                      <View style={styles.historyRightHeader}>
                        <Text style={styles.historyReturnTotal}>
                          {formatCurrency(ret.returnTotal)}
                        </Text>
                        <Text style={styles.historyDate}>
                          {formatDate(ret.createdAt)}
                        </Text>
                      </View>
                    </View>

                    {/* Items List */}
                    <View style={styles.historyItemsContainer}>
                      {ret.items.map((it, idx) => {
                        const isResellable = it.condition === "resellable";
                        const isDamaged = it.condition === "damaged";
                        return (
                          <View key={`item-${idx}`} style={styles.historyItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.historyItemName}>{it.itemName}</Text>
                              <Text style={styles.historyItemSub}>
                                Code: {it.itemCode} • Qty: {it.quantity} @ {formatCurrency(it.returnPrice)}
                              </Text>
                              {it.reason ? (
                                <Text style={styles.historyItemReason}>
                                  Note: "{it.reason}"
                                </Text>
                              ) : null}
                            </View>

                            <View
                              style={[
                                styles.historyConditionBadge,
                                isResellable && { backgroundColor: "#dcfce7" },
                                isDamaged && { backgroundColor: "#fef3c7" },
                                it.condition === "expired" && { backgroundColor: "#fee2e2" }
                              ]}
                            >
                              <Text
                                style={[
                                  styles.historyConditionBadgeText,
                                  isResellable && { color: "#15803d" },
                                  isDamaged && { color: "#b45309" },
                                  it.condition === "expired" && { color: "#b91c1c" }
                                ]}
                              >
                                {it.condition}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Footer */}
                    <View style={styles.historyCardFooter}>
                      <Text style={styles.historyCashierText}>
                        Processed by: {typeof ret.cashier === "object" ? ret.cashier?.name : "Rep"}
                      </Text>
                      <View
                        style={[
                          styles.historyStatusBadge,
                          ret.status === "dispatched" && { backgroundColor: "#e0f2fe" }
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyStatusBadgeText,
                            ret.status === "dispatched" && { color: "#0369a1" }
                          ]}
                        >
                          {ret.status === "dispatched" ? "Dispatched to Supplier" : "Recorded"}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Customer Selector Modal */}
      <CustomerSelectorModal
        visible={customerModalVisible}
        selectedCustomer={selectedCustomer}
        onSelect={(cust) => {
          setSelectedCustomer(cust);
          setSelectedInvoiceNo(null);
          setItemDrafts({});
          setCustomerModalVisible(false);
        }}
        onClose={() => setCustomerModalVisible(false)}
        allowWalkIn={false}
      />
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
  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background
  },
  tabButtonActive: {
    backgroundColor: "#e6f4f1"
  },
  tabButtonText: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.textMuted
  },
  tabButtonTextActive: {
    color: Colors.leaf,
    fontWeight: "700"
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  warningCard: {
    flexDirection: "row",
    backgroundColor: "#fff7ed",
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#fdba74",
    marginBottom: Spacing.base,
    alignItems: "flex-start"
  },
  warningTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: "#c2410c"
  },
  warningText: {
    fontSize: Typography.xs,
    color: "#9a3412",
    marginTop: 2,
    lineHeight: 18
  },
  startTripBtn: {
    backgroundColor: Colors.clay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
    marginTop: 8
  },
  startTripBtnText: {
    color: "#ffffff",
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  sectionCard: {
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.leaf,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8
  },
  stepBadgeText: {
    color: "#ffffff",
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  selectedCustomerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  customerName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  customerDetails: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  customerBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  balanceLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginRight: 4
  },
  balanceValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.clay
  },
  changeCustomerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: "#e0f2fe",
    marginLeft: 8
  },
  changeCustomerBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#0369a1"
  },
  selectCustomerPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg
  },
  selectCustomerPlaceholderText: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.leaf
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: "center"
  },
  loadingText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 8
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl
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
  invoiceListContainer: {
    gap: 8
  },
  invoiceCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  invoiceCardSelected: {
    borderColor: Colors.leaf,
    backgroundColor: "#f0fdfa"
  },
  invoiceCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  invoiceNoBox: {
    flexDirection: "row",
    alignItems: "center"
  },
  invoiceNoText: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  invoiceNoTextSelected: {
    color: Colors.leaf
  },
  invoiceDateText: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  invoiceCardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2
  },
  invoiceTotalText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  invoiceItemsCountText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  itemReturnCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm
  },
  itemReturnCardActive: {
    borderColor: Colors.leaf,
    backgroundColor: "#fafffe"
  },
  itemReturnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm
  },
  itemReturnName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  itemReturnCode: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  itemReturnStockInfo: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2
  },
  qtyControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm
  },
  qtyLabel: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.ink
  },
  itemReturnConfigBox: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  priceSection: {
    marginBottom: Spacing.sm
  },
  priceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  priceBenchmarkText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: "500"
  },
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md
  },
  priceInputWrapperError: {
    borderColor: Colors.danger,
    backgroundColor: "#fff5f5"
  },
  priceCurrencyPrefix: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginRight: 6
  },
  priceInput: {
    flex: 1,
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.ink,
    paddingVertical: 8
  },
  priceErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  priceErrorText: {
    fontSize: Typography.xs,
    color: Colors.danger,
    fontWeight: "500"
  },
  configLabel: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase"
  },
  conditionPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.sm
  },
  conditionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface
  },
  conditionPillSelected: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf
  },
  conditionPillText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.ink
  },
  conditionPillTextSelected: {
    color: "#ffffff",
    fontWeight: "700"
  },
  reasonInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    fontSize: Typography.xs,
    color: Colors.ink,
    marginBottom: Spacing.sm
  },
  lineTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },
  lineTotalLabel: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textMuted
  },
  lineTotalValue: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.leaf
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3
  },
  summaryCardTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: Spacing.sm
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  summaryLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  summaryValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  summarySubLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    paddingLeft: 8
  },
  summarySubValue: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  summaryGrandTotalLabel: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  summaryGrandTotalValue: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.leaf
  },
  ledgerAdjustmentNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm
  },
  ledgerNoticeText: {
    fontSize: Typography.xs,
    color: "#15803d",
    fontWeight: "600"
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.leaf,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md
  },
  confirmButtonDisabled: {
    opacity: 0.6
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: Typography.sm,
    fontWeight: "700"
  },
  historySearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm
  },
  historySearchInput: {
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
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  historyCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm
  },
  historyCustomerName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  historyInvoiceNo: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2
  },
  historyRightHeader: {
    alignItems: "flex-end"
  },
  historyReturnTotal: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.leaf
  },
  historyDate: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2
  },
  historyItemsContainer: {
    gap: 6
  },
  historyItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  historyItemName: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.ink
  },
  historyItemSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  historyItemReason: {
    fontSize: Typography.xs,
    color: "#9a3412",
    fontStyle: "italic",
    marginTop: 2
  },
  historyConditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full
  },
  historyConditionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  historyCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm
  },
  historyCashierText: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  historyStatusBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full
  },
  historyStatusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#b45309"
  }
});
