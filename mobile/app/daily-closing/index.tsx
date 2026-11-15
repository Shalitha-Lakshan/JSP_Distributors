import React, { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Fuel,
  History,
  Info,
  Lock,
  Receipt,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users
} from "lucide-react-native";
import { tripsApi } from "../../src/api/trips";
import { useTripStore } from "../../src/store/tripStore";
import { DailyClosingSummary, TripSession } from "../../src/types";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { assertOnline } from "../../src/utils/networkGuard";

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

export default function DailyClosingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isTablet, isLargeTablet, contentMaxWidth } = useResponsive();
  const { fetchActiveTrip } = useTripStore();

  // Actual Physical Count Inputs
  const [actualCashStr, setActualCashStr] = useState<string>("");
  const [actualChequeStr, setActualChequeStr] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [showChequesDetail, setShowChequesDetail] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch Daily Closing Summary (scoped to active or pending_audit trip)
  const {
    data: closingData,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<DailyClosingSummary>({
    queryKey: ["daily-closing"],
    queryFn: () => tripsApi.getDailyClosing(),
    staleTime: 30 * 1000
  });

  const tripStatus = closingData?.status || "none";
  const isTripActive = tripStatus === "active";
  const isPendingAudit = tripStatus === "pending_audit";
  const isApproved = tripStatus === "approved";

  // System Authoritative Expected Remittance Figures
  const expectedCashGross = closingData?.expectedCollections?.cashGross ?? 0;
  const totalExpenses = closingData?.expenses ?? 0;
  // Net cash expected to physically hand over = Gross Cash Collected - Van Expenses
  const expectedCashNet = closingData?.expectedCollections?.cash ?? Math.max(0, expectedCashGross - totalExpenses);
  const expectedCheque = closingData?.expectedCollections?.cheque ?? 0;
  const expectedTotalRemittance = expectedCashNet + expectedCheque;

  // Initialize entered values with saved counts or expected figures
  useEffect(() => {
    if (closingData && !isInitialized) {
      if (isPendingAudit || isApproved) {
        setActualCashStr(String(closingData.actualCollections?.cash ?? ""));
        setActualChequeStr(String(closingData.actualCollections?.cheque ?? ""));
        if (closingData.repRemarks) {
          setRemarks(closingData.repRemarks);
        }
      } else if (isTripActive) {
        // Pre-fill expected amounts as initial helper so rep only adjusts if variance exists
        setActualCashStr(String(expectedCashNet || ""));
        setActualChequeStr(String(expectedCheque || ""));
        if (closingData.repRemarks) {
          setRemarks(closingData.repRemarks);
        }
      }
      setIsInitialized(true);
    }
  }, [closingData, isInitialized, isTripActive, isPendingAudit, isApproved, expectedCashNet, expectedCheque]);

  // Parse numerical inputs
  const parsedActualCash = useMemo(() => {
    const clean = actualCashStr.replace(/[^0-9.]/g, "");
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }, [actualCashStr]);

  const parsedActualCheque = useMemo(() => {
    const clean = actualChequeStr.replace(/[^0-9.]/g, "");
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }, [actualChequeStr]);

  // Live Variances
  const cashVariance = useMemo(() => {
    if (!isTripActive && closingData?.varianceCollections) {
      return closingData.varianceCollections.cash || 0;
    }
    return Math.round((parsedActualCash - expectedCashNet) * 100) / 100;
  }, [isTripActive, closingData, parsedActualCash, expectedCashNet]);

  const chequeVariance = useMemo(() => {
    if (!isTripActive && closingData?.varianceCollections) {
      return closingData.varianceCollections.cheque || 0;
    }
    return Math.round((parsedActualCheque - expectedCheque) * 100) / 100;
  }, [isTripActive, closingData, parsedActualCheque, expectedCheque]);

  // Submit Audit Mutation
  const submitAuditMutation = useMutation({
    mutationFn: async () => {
      if (parsedActualCash < 0 || parsedActualCheque < 0) {
        throw new Error("Physical collections cannot be negative.");
      }
      return await tripsApi.submitAudit({
        cash: parsedActualCash,
        cheque: parsedActualCheque,
        remarks: remarks.trim()
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["daily-closing"] });
      await queryClient.invalidateQueries({ queryKey: ["active-trip"] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      await fetchActiveTrip();

      Alert.alert(
        "Shift Submitted for Audit",
        "Your trip shift session has been submitted to your manager. " +
          "All field operations for this trip are now locked pending manager review.",
        [
          {
            text: "View Trip History",
            onPress: () => router.push("/trips/history" as any)
          },
          { text: "OK" }
        ]
      );
    },
    onError: (err: any) => {
      Alert.alert(
        "Submission Failed",
        err.message || "Failed to submit trip for audit. Please try again."
      );
    }
  });

  const handleSubmit = () => {
    if (!assertOnline("Daily Shift Closing")) {
      return;
    }

    if (!isTripActive) return;

    if (parsedActualCash < 0 || parsedActualCheque < 0) {
      Alert.alert("Invalid Input", "Please enter valid non-negative collection amounts.");
      return;
    }

    // Policy 1: Cash Shortage Explanation Validation
    // Cash shortages of Rs. 1,000 or more strictly require an explanation
    if (cashVariance <= -1000 && !remarks.trim()) {
      Alert.alert(
        "Explanation Required",
        "A cash shortage of Rs. 1,000 or more requires an explanation before submitting the shift to your manager."
      );
      return;
    }

    const hasCashVariance = Math.abs(cashVariance) > 0.01;
    const hasChequeVariance = Math.abs(chequeVariance) > 0.01;

    let warningMessage = "";
    if (hasCashVariance || hasChequeVariance) {
      warningMessage =
        "A collection variance was detected:\n\n" +
        (hasCashVariance
          ? `• Cash: ${cashVariance < 0 ? "Shortage" : "Excess"} of ${formatCurrency(
              Math.abs(cashVariance)
            )}\n`
          : "• Cash: Balanced\n") +
        (hasChequeVariance
          ? `• Cheques: ${chequeVariance < 0 ? "Shortage" : "Excess"} of ${formatCurrency(
              Math.abs(chequeVariance)
            )}\n`
          : "• Cheques: Balanced\n") +
        (cashVariance > 0.01
          ? "\nNotice: Positive cash variance will be recorded as unreconciled excess pending manager review.\n"
          : "") +
        (remarks.trim() ? `\nRemarks: "${remarks.trim()}"\n` : "") +
        "\nDo you want to proceed and submit this declared shift count to your manager for review?";
    } else {
      warningMessage =
        `All declared collections are balanced.\n\n` +
        `• Physical Cash: ${formatCurrency(parsedActualCash)}\n` +
        `• Physical Cheques: ${formatCurrency(parsedActualCheque)}\n\n` +
        (remarks.trim() ? `Remarks: "${remarks.trim()}"\n\n` : "") +
        `Proceed with submitting your shift?`;
    }

    Alert.alert("Confirm Shift Closing", warningMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Submit for Audit",
        onPress: () => submitAuditMutation.mutate()
      }
    ]);
  };

  const chequesList = closingData?.chequesList || [];

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
          <Text style={styles.headerTitle}>Daily Shift Closing</Text>
          <Text style={styles.headerSubtitle}>Reconciliation & Manager Audit</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/trips/history" as any)}
          style={styles.historyBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <History size={20} color={Colors.leaf} />
        </TouchableOpacity>
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
        {/* State Banner: Pending Audit / Approved / No Active Session */}
        {isPendingAudit ? (
          <View style={styles.pendingAuditBanner}>
            <Clock size={20} color="#b45309" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingAuditTitle}>Awaiting Manager Audit</Text>
              <Text style={styles.pendingAuditDesc}>
                This shift was submitted on {formatDateTime(closingData?.endTime)}.
                Transactions are locked pending final manager approval.
              </Text>
            </View>
          </View>
        ) : isApproved ? (
          <View style={styles.approvedBanner}>
            <ShieldCheck size={20} color="#15803d" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.approvedTitle}>Shift Audited & Approved</Text>
              <Text style={styles.approvedDesc}>
                Approved by manager on {formatDateTime(closingData?.auditedAt)}.
                {closingData?.auditNotes ? ` Notes: "${closingData.auditNotes}"` : ""}
              </Text>
            </View>
          </View>
        ) : tripStatus === "none" ? (
          <View style={styles.noTripCard}>
            <Lock size={26} color={Colors.clay} style={{ marginBottom: 8 }} />
            <Text style={styles.noTripTitle}>No Active Shift Session</Text>
            <Text style={styles.noTripDesc}>
              You do not currently have an active route delivery trip.
              Please start a trip first before issuing orders or performing daily closing.
            </Text>
            <TouchableOpacity
              style={styles.startTripBtn}
              onPress={() => router.push("/trips/start" as any)}
            >
              <Text style={styles.startTripBtnText}>Start Route Trip</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 1. Trip Profile Card */}
        {tripStatus !== "none" && (
          <View style={styles.tripProfileCard}>
            <View style={styles.tripProfileHeader}>
              <View>
                <Text style={styles.tripRouteLabel}>Delivery Route Session</Text>
                <Text style={styles.tripRouteName}>{closingData?.route || "Standard Route"}</Text>
                <Text style={styles.tripNoText}>Trip #{closingData?.tripNo}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isTripActive && { backgroundColor: "#dcfce7" },
                  isPendingAudit && { backgroundColor: "#fef3c7" },
                  isApproved && { backgroundColor: "#e0f2fe" }
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isTripActive && { color: "#15803d" },
                    isPendingAudit && { color: "#b45309" },
                    isApproved && { color: "#0369a1" }
                  ]}
                >
                  {isTripActive ? "Active Shift" : isPendingAudit ? "Pending Audit" : "Approved"}
                </Text>
              </View>
            </View>

            <View style={styles.tripMetaRow}>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Sales Rep:</Text>
                <Text style={styles.metaValue}>{closingData?.repName}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Started At:</Text>
                <Text style={styles.metaValue}>{formatDateTime(closingData?.startTime)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 2. Financial Shift Summary KPI Grid */}
        {tripStatus !== "none" && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Financial Shift Summary</Text>

            <View style={[styles.kpiGrid, isTablet && styles.kpiGridTablet]}>
              {/* Gross Sales */}
              <View style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                <Text style={styles.kpiLabel}>Gross Sales</Text>
                <Text style={styles.kpiValue}>{formatCurrency(closingData?.grossSales)}</Text>
                <Text style={styles.kpiSub}>
                  {closingData?.totalInvoices || 0} bills • {closingData?.totalOrders || 0} orders
                </Text>
              </View>

              {/* Discounts */}
              <View style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                <Text style={styles.kpiLabel}>Discounts</Text>
                <Text style={[styles.kpiValue, { color: Colors.textSecondary }]}>
                  {formatCurrency(closingData?.discounts)}
                </Text>
                <Text style={styles.kpiSub}>Invoice promo rate</Text>
              </View>

              {/* Market Returns */}
              <View style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                <Text style={styles.kpiLabel}>Market Returns</Text>
                <Text style={[styles.kpiValue, { color: "#d97706" }]}>
                  {formatCurrency(closingData?.returns)}
                </Text>
                <Text style={styles.kpiSub}>Stock & credit returns</Text>
              </View>

              {/* Net Sales */}
              <View style={[styles.kpiCard, isTablet && styles.kpiCardTablet, { borderLeftColor: Colors.leaf, borderLeftWidth: 3 }]}>
                <Text style={styles.kpiLabel}>Net Sales</Text>
                <Text style={[styles.kpiValue, { color: Colors.leaf }]}>
                  {formatCurrency(closingData?.netSales)}
                </Text>
                <Text style={styles.kpiSub}>Gross - Returns - Disc</Text>
              </View>
            </View>
          </View>
        )}

        {/* 3. Field Collections Breakdown */}
        {tripStatus !== "none" && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Field Collections Breakdown</Text>

            <View style={styles.breakdownTable}>
              {/* POS Direct Sales */}
              <View style={styles.breakdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownTitle}>Direct POS Sales</Text>
                  <Text style={styles.breakdownSub}>Over-the-counter payments</Text>
                </View>
                <View style={styles.breakdownValues}>
                  <Text style={styles.breakdownCash}>
                    Cash: {formatCurrency(closingData?.collectionsBreakdown?.posSales?.cash)}
                  </Text>
                  <Text style={styles.breakdownCheque}>
                    Cheque: {formatCurrency(closingData?.collectionsBreakdown?.posSales?.cheque)}
                  </Text>
                </View>
              </View>

              {/* Order Deliveries */}
              <View style={styles.breakdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownTitle}>Van Order Deliveries</Text>
                  <Text style={styles.breakdownSub}>Pre-booked order delivery</Text>
                </View>
                <View style={styles.breakdownValues}>
                  <Text style={styles.breakdownCash}>
                    Cash: {formatCurrency(closingData?.collectionsBreakdown?.orderDeliveries?.cash)}
                  </Text>
                  <Text style={styles.breakdownCheque}>
                    Cheque: {formatCurrency(closingData?.collectionsBreakdown?.orderDeliveries?.cheque)}
                  </Text>
                </View>
              </View>

              {/* Credit Invoice Payments */}
              <View style={styles.breakdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownTitle}>Credit Bill Settlements</Text>
                  <Text style={styles.breakdownSub}>Past outstanding debt payments</Text>
                </View>
                <View style={styles.breakdownValues}>
                  <Text style={styles.breakdownCash}>
                    Cash: {formatCurrency(closingData?.collectionsBreakdown?.creditPayments?.cash)}
                  </Text>
                  <Text style={styles.breakdownCheque}>
                    Cheque: {formatCurrency(closingData?.collectionsBreakdown?.creditPayments?.cheque)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Subtotals & Expenses */}
            <View style={styles.collectionsSubtotalsBox}>
              <View style={styles.summaryLineRow}>
                <Text style={styles.summaryLineLabel}>Total Gross Cash Collected:</Text>
                <Text style={styles.summaryLineValue}>{formatCurrency(expectedCashGross)}</Text>
              </View>

              <View style={styles.summaryLineRow}>
                <Text style={[styles.summaryLineLabel, { color: Colors.clay }]}>
                  Less: Total Road Expenses:
                </Text>
                <Text style={[styles.summaryLineValue, { color: Colors.clay }]}>
                  - {formatCurrency(totalExpenses)}
                </Text>
              </View>

              <View style={styles.subtotalDivider} />

              <View style={styles.summaryLineRow}>
                <Text style={styles.netCashRemitLabel}>Expected Net Cash to Remit:</Text>
                <Text style={styles.netCashRemitValue}>{formatCurrency(expectedCashNet)}</Text>
              </View>

              <View style={[styles.summaryLineRow, { marginTop: 4 }]}>
                <Text style={styles.summaryLineLabel}>Expected Cheques to Remit:</Text>
                <Text style={[styles.summaryLineValue, { color: "#4f46e5" }]}>
                  {formatCurrency(expectedCheque)}
                </Text>
              </View>
            </View>

            {/* Cheque List Expand Toggle */}
            {chequesList.length > 0 && (
              <TouchableOpacity
                style={styles.chequeToggleRow}
                onPress={() => setShowChequesDetail(!showChequesDetail)}
              >
                <CreditCard size={15} color="#4f46e5" style={{ marginRight: 6 }} />
                <Text style={styles.chequeToggleText}>
                  {showChequesDetail ? "Hide" : "View"} {chequesList.length} Recorded Cheque{chequesList.length === 1 ? "" : "s"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Cheque Detail List */}
            {showChequesDetail && chequesList.length > 0 && (
              <View style={styles.chequeListContainer}>
                {chequesList.map((ch, idx) => (
                  <View key={`cheque-${idx}`} style={styles.chequeItemCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chequeCustomer}>{ch.customerName}</Text>
                      <Text style={styles.chequeMeta}>
                        Chq #{ch.chequeNo} • {ch.bankName}
                      </Text>
                      <Text style={styles.chequeDate}>
                        Date: {ch.chequeDate ? formatDate(ch.chequeDate) : "Current"}
                      </Text>
                    </View>
                    <Text style={styles.chequeAmount}>{formatCurrency(ch.amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 4. Physical Count Entry & Reconciliation (Core Task) */}
        {tripStatus !== "none" && (
          <View style={styles.reconciliationCard}>
            <Text style={styles.reconcileTitle}>Physical Collections & Reconciliation</Text>
            <Text style={styles.reconcileSub}>
              {isTripActive
                ? "Count your physical cash and cheques, declare the actual figures, and verify variances."
                : "Declared actual counts and verified closing variances."}
            </Text>

            {/* A. Cash Reconciliation */}
            <View style={styles.reconcileBlock}>
              <View style={styles.reconcileBlockHeader}>
                <Text style={styles.blockTitle}>1. Physical Cash Handed Over</Text>
                <Text style={styles.expectedRefText}>
                  Expected: {formatCurrency(expectedCashNet)}
                </Text>
              </View>

              {isTripActive ? (
                <View style={styles.amountInputBox}>
                  <Text style={styles.currencyPrefix}>Rs.</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={actualCashStr}
                    onChangeText={setActualCashStr}
                  />
                </View>
              ) : (
                <View style={styles.readOnlyCountBox}>
                  <Text style={styles.readOnlyCountLabel}>Declared Count:</Text>
                  <Text style={styles.readOnlyCountValue}>
                    {formatCurrency(closingData?.actualCollections?.cash)}
                  </Text>
                </View>
              )}

              {/* Cash Variance Badge */}
              <View
                style={[
                  styles.variancePill,
                  Math.abs(cashVariance) < 0.01 && styles.variancePillBalanced,
                  cashVariance < -0.01 && styles.variancePillShortage,
                  cashVariance > 0.01 && styles.variancePillExcess
                ]}
              >
                {Math.abs(cashVariance) < 0.01 ? (
                  <>
                    <CheckCircle size={14} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.varianceTextBalanced}>Cash Balanced (0.00)</Text>
                  </>
                ) : cashVariance < -0.01 ? (
                  <>
                    <AlertTriangle size={14} color="#b91c1c" style={{ marginRight: 6 }} />
                    <Text style={styles.varianceTextShortage}>
                      Shortage: - {formatCurrency(Math.abs(cashVariance))}
                    </Text>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.varianceTextExcess}>
                      Excess: + {formatCurrency(cashVariance)}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* B. Cheque Reconciliation */}
            <View style={styles.reconcileBlock}>
              <View style={styles.reconcileBlockHeader}>
                <Text style={styles.blockTitle}>2. Physical Cheques Handed Over</Text>
                <Text style={styles.expectedRefText}>
                  Expected: {formatCurrency(expectedCheque)}
                </Text>
              </View>

              {isTripActive ? (
                <View style={styles.amountInputBox}>
                  <Text style={styles.currencyPrefix}>Rs.</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={actualChequeStr}
                    onChangeText={setActualChequeStr}
                  />
                </View>
              ) : (
                <View style={styles.readOnlyCountBox}>
                  <Text style={styles.readOnlyCountLabel}>Declared Count:</Text>
                  <Text style={styles.readOnlyCountValue}>
                    {formatCurrency(closingData?.actualCollections?.cheque)}
                  </Text>
                </View>
              )}

              {/* Cheque Variance Badge */}
              <View
                style={[
                  styles.variancePill,
                  Math.abs(chequeVariance) < 0.01 && styles.variancePillBalanced,
                  chequeVariance < -0.01 && styles.variancePillShortage,
                  chequeVariance > 0.01 && styles.variancePillExcess
                ]}
              >
                {Math.abs(chequeVariance) < 0.01 ? (
                  <>
                    <CheckCircle size={14} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.varianceTextBalanced}>Cheques Balanced (0.00)</Text>
                  </>
                ) : chequeVariance < -0.01 ? (
                  <>
                    <AlertTriangle size={14} color="#b91c1c" style={{ marginRight: 6 }} />
                    <Text style={styles.varianceTextShortage}>
                      Shortage: - {formatCurrency(Math.abs(chequeVariance))}
                    </Text>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.varianceTextExcess}>
                      Excess: + {formatCurrency(chequeVariance)}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Excess Cash Notice (Policy 2) */}
            {cashVariance > 0.01 && (
              <View style={styles.excessNoticeCard}>
                <AlertTriangle size={16} color="#2563eb" />
                <Text style={styles.excessNoticeText}>
                  Unreconciled Cash Excess: You have declared {formatCurrency(cashVariance)} more than expected net cash.
                  This will be recorded as unreconciled excess for manager verification and will not automatically alter customer or income balances.
                </Text>
              </View>
            )}

            {/* Sales Rep Remarks / Shortage Explanation (Policy 1) */}
            {isTripActive ? (
              <View style={styles.remarksContainer}>
                <View style={styles.remarksHeaderRow}>
                  <Text style={styles.remarksLabel}>Sales Representative Remarks</Text>
                  {cashVariance <= -1000 ? (
                    <Text style={styles.remarksMandatoryTag}>* Mandatory for shortage ≥ Rs. 1,000</Text>
                  ) : (
                    <Text style={styles.remarksOptionalTag}>Optional notes for manager</Text>
                  )}
                </View>
                <TextInput
                  style={[
                    styles.remarksInput,
                    cashVariance <= -1000 && !remarks.trim() && styles.remarksInputError
                  ]}
                  placeholder={
                    cashVariance <= -1000
                      ? "Explain reason for cash shortage (mandatory)..."
                      : "Add any handover notes or remarks for manager..."
                  }
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  value={remarks}
                  onChangeText={setRemarks}
                />
              </View>
            ) : (
              <>
                {Boolean(closingData?.repRemarks) && (
                  <View style={styles.readOnlyRemarksBox}>
                    <Text style={styles.readOnlyRemarksLabel}>Sales Rep Handover Remarks:</Text>
                    <Text style={styles.readOnlyRemarksText}>{closingData?.repRemarks}</Text>
                  </View>
                )}
                {closingData?.excessHandling?.status === "unreconciled" && (
                  <View style={styles.excessNoticeCard}>
                    <AlertTriangle size={16} color="#2563eb" />
                    <Text style={styles.excessNoticeText}>
                      Unreconciled Cash Excess: Shift contains unreconciled cash excess pending manager review.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Overall Remittance Comparison Box */}
            <View style={styles.totalRemittanceBox}>
              <View style={styles.summaryLineRow}>
                <Text style={styles.remitBoxLabel}>Total System Expected Remittance:</Text>
                <Text style={styles.remitBoxValue}>{formatCurrency(expectedTotalRemittance)}</Text>
              </View>
              <View style={styles.summaryLineRow}>
                <Text style={styles.remitBoxLabel}>Total Physical Declared Remittance:</Text>
                <Text style={[styles.remitBoxValue, { color: Colors.ink }]}>
                  {formatCurrency(parsedActualCash + parsedActualCheque)}
                </Text>
              </View>
            </View>

            {/* Submit Closing Button (Active Trip Only) */}
            {isTripActive && (
              <TouchableOpacity
                style={[
                  styles.submitClosingBtn,
                  submitAuditMutation.isPending && styles.submitClosingBtnDisabled
                ]}
                onPress={handleSubmit}
                disabled={submitAuditMutation.isPending}
                activeOpacity={0.8}
              >
                {submitAuditMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Send size={18} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitClosingBtnText}>
                      Submit Shift Closing for Manager Audit
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

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
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e6f4f1"
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  pendingAuditBanner: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: Spacing.base,
    alignItems: "flex-start"
  },
  pendingAuditTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: "#b45309"
  },
  pendingAuditDesc: {
    fontSize: Typography.xs,
    color: "#92400e",
    marginTop: 2,
    lineHeight: 18
  },
  approvedBanner: {
    flexDirection: "row",
    backgroundColor: "#dcfce7",
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: Spacing.base,
    alignItems: "flex-start"
  },
  approvedTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: "#15803d"
  },
  approvedDesc: {
    fontSize: Typography.xs,
    color: "#166534",
    marginTop: 2,
    lineHeight: 18
  },
  noTripCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base
  },
  noTripTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  noTripDesc: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18
  },
  startTripBtn: {
    backgroundColor: Colors.leaf,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.base
  },
  startTripBtnText: {
    color: "#ffffff",
    fontSize: Typography.sm,
    fontWeight: "700"
  },
  tripProfileCard: {
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
  tripProfileHeader: {
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
    fontWeight: "600",
    color: Colors.textMuted,
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
  tripMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  metaCol: {
    flex: 1
  },
  metaLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  },
  metaValue: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.ink,
    marginTop: 2
  },
  sectionContainer: {
    marginBottom: Spacing.base
  },
  sectionHeading: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: Spacing.sm
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpiGridTablet: {
    gap: 12
  },
  kpiCard: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  kpiCardTablet: {
    minWidth: "22%"
  },
  kpiLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  kpiValue: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink,
    marginTop: 4
  },
  kpiSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2
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
  breakdownTable: {
    gap: 8,
    marginBottom: Spacing.sm
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  breakdownTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  breakdownSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2
  },
  breakdownValues: {
    alignItems: "flex-end"
  },
  breakdownCash: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  breakdownCheque: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#4f46e5",
    marginTop: 2
  },
  collectionsSubtotalsBox: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs
  },
  summaryLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  summaryLineLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  summaryLineValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  subtotalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6
  },
  netCashRemitLabel: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.leaf
  },
  netCashRemitValue: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.leaf
  },
  chequeToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.md
  },
  chequeToggleText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#4f46e5"
  },
  chequeListContainer: {
    marginTop: Spacing.sm,
    gap: 6
  },
  chequeItemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border
  },
  chequeCustomer: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  chequeMeta: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 1
  },
  chequeDate: {
    fontSize: 10,
    color: Colors.textMuted
  },
  chequeAmount: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#4f46e5"
  },
  reconciliationCard: {
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
  reconcileTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  reconcileSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.base
  },
  reconcileBlock: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  reconcileBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm
  },
  blockTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  expectedRefText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textMuted
  },
  amountInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm
  },
  currencyPrefix: {
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
  readOnlyCountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm
  },
  readOnlyCountLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  readOnlyCountValue: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  variancePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full
  },
  variancePillBalanced: {
    backgroundColor: "#dcfce7"
  },
  variancePillShortage: {
    backgroundColor: "#fee2e2"
  },
  variancePillExcess: {
    backgroundColor: "#e0f2fe"
  },
  varianceTextBalanced: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#15803d"
  },
  varianceTextShortage: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#b91c1c"
  },
  varianceTextExcess: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#0369a1"
  },
  totalRemittanceBox: {
    backgroundColor: "#f8fafc",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base
  },
  remitBoxLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: "600"
  },
  remitBoxValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  submitClosingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.leaf,
    paddingVertical: 14,
    borderRadius: BorderRadius.md
  },
  submitClosingBtnDisabled: {
    opacity: 0.6
  },
  submitClosingBtnText: {
    color: "#ffffff",
    fontSize: Typography.sm,
    fontWeight: "700"
  },
  remarksContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md
  },
  remarksHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs
  },
  remarksLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  remarksMandatoryTag: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: "#b91c1c"
  },
  remarksOptionalTag: {
    fontSize: Typography.xs,
    fontWeight: "500",
    color: Colors.textMuted
  },
  remarksInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: Typography.sm,
    color: Colors.ink,
    minHeight: 70,
    textAlignVertical: "top"
  },
  remarksInputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fff5f5"
  },
  excessNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm
  },
  excessNoticeText: {
    fontSize: Typography.xs,
    color: "#1e40af",
    flex: 1,
    marginLeft: Spacing.xs,
    lineHeight: 16
  },
  readOnlyRemarksBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm
  },
  readOnlyRemarksLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 4
  },
  readOnlyRemarksText: {
    fontSize: Typography.sm,
    color: Colors.ink
  }
});
