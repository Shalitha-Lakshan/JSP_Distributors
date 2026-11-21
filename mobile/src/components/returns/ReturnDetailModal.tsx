import React from "react";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  MapPin,
  Package,
  Send,
  Shield,
  Truck,
  User,
  X
} from "lucide-react-native";
import { CustomerReturn, CustomerReturnItem } from "../../types";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

interface ReturnDetailModalProps {
  visible: boolean;
  onClose: () => void;
  returnRecord: CustomerReturn | null;
  selectedItemCode?: string;
}

const formatCurrency = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const ReturnDetailModal: React.FC<ReturnDetailModalProps> = ({
  visible,
  onClose,
  returnRecord,
  selectedItemCode
}) => {
  const { theme, isDark } = useAppTheme();

  if (!returnRecord) return null;

  // Determine which item to highlight
  const targetItem: CustomerReturnItem =
    returnRecord.items.find((it) => it.itemCode === selectedItemCode) ||
    returnRecord.items[0] ||
    ({} as CustomerReturnItem);

  const productObj: any = targetItem.productId || {};
  const supplierName =
    productObj.supplier || targetItem.itemCode?.startsWith("TP") || targetItem.itemCode?.startsWith("CP")
      ? "Ruhunu Foods"
      : productObj.supplier || "Gajamuthu Foods";

  const customerName = (returnRecord.customer as any)?.name || "Registered Customer";
  const customerCode = (returnRecord.customer as any)?.code || "CUST";
  const customerPhone = (returnRecord.customer as any)?.phone;
  const cashierName = (returnRecord.cashier as any)?.name || "Sales Representative";
  const tripNo = (returnRecord.tripId as any)?.tripNo;
  const tripRoute = (returnRecord.tripId as any)?.route;

  const handoverStatus = targetItem.handoverStatus || returnRecord.handoverStatus || "pending_handover";
  const inspectionStatus = targetItem.inspectionStatus || returnRecord.inspectionStatus || "pending_inspection";
  const isDispatched = targetItem.status === "dispatched" || returnRecord.status === "dispatched";
  const supplierInvoice = targetItem.supplierInvoiceNo || returnRecord.supplierInvoiceNo;

  // Step Tracker calculation
  const step1Done = true; // Collected from Customer
  const step2Done = handoverStatus === "received" || inspectionStatus !== "pending_inspection";
  const step3Done = inspectionStatus === "approved" || inspectionStatus === "partially_approved";
  const step4Done = isDispatched || !!supplierInvoice;
  const step5Done = false; // Supplier Credit Note / Settled

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

  const renderHandoverBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge label="Handed Over to Warehouse" variant="success" size="sm" />;
      case "partially_received":
        return <Badge label="Partially Handed Over" variant="warning" size="sm" />;
      default:
        return <Badge label="Pending Warehouse Handover" variant="neutral" size="sm" />;
    }
  };

  const renderInspectionBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge label="Approved & Restocked" variant="success" size="sm" />;
      case "partially_approved":
        return <Badge label="Partially Approved" variant="warning" size="sm" />;
      case "rejected":
        return <Badge label="Rejected / Supplier Bound" variant="danger" size="sm" />;
      default:
        return <Badge label="Pending Warehouse Inspection" variant="neutral" size="sm" />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        {/* Top Modal Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Return Item Details</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Inv #{returnRecord.invoiceNo} · Ref #{returnRecord._id.slice(-6).toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.surfaceSubtle }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Section 1: Product Information */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Package size={18} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>1. Product Information</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Product Name</Text>
              <Text style={[styles.infoValueBold, { color: theme.textPrimary }]}>
                {targetItem.itemName || productObj.displayName || targetItem.itemCode}
              </Text>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Item Code</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{targetItem.itemCode}</Text>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Supplier / Principal</Text>
                <View style={styles.supplierBadge}>
                  <Building2 size={12} color={theme.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.supplierBadgeText, { color: theme.primary }]}>{supplierName}</Text>
                </View>
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Unit Billing Price</Text>
                <Text style={[styles.infoValue, { color: theme.leaf, fontWeight: "700" }]}>
                  {formatCurrency(targetItem.returnPrice)}
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Catalogue Selling</Text>
                <Text style={[styles.infoValue, { color: theme.textSecondary }]}>
                  {formatCurrency(productObj.currentSellingPrice || targetItem.returnPrice)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Section 2: Customer & Trip Details */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <User size={18} color={theme.leaf} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>2. Customer & Trip Details</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Customer</Text>
              <Text style={[styles.infoValueBold, { color: theme.textPrimary }]}>
                {customerName} <Text style={{ color: theme.textMuted, fontSize: Typography.xs }}>({customerCode})</Text>
              </Text>
              {customerPhone ? (
                <Text style={{ fontSize: Typography.xs, color: theme.textSecondary, marginTop: 2 }}>
                  Phone: {customerPhone}
                </Text>
              ) : null}
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Trip Session</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                  {tripNo ? `Trip #${tripNo}` : "Standalone Field Return"}
                </Text>
                {tripRoute ? (
                  <Text style={{ fontSize: 10, color: theme.textMuted }}>{tripRoute}</Text>
                ) : null}
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Collected By</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{cashierName}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Collection Date & Time</Text>
              <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                {formatDate(returnRecord.createdAt)}
              </Text>
            </View>
          </Card>

          {/* Section 3: Quantity & Financials */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Coins size={18} color={theme.clay} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>3. Quantity & Financials</Text>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Returned Quantity</Text>
                <Text style={[styles.infoValueBig, { color: theme.textPrimary }]}>
                  {targetItem.quantity} <Text style={{ fontSize: Typography.sm }}>units</Text>
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Line Return Value</Text>
                <Text style={[styles.infoValueBig, { color: theme.clay }]}>
                  {formatCurrency(targetItem.returnTotal || (targetItem.quantity * targetItem.returnPrice))}
                </Text>
              </View>
            </View>

            <View style={[styles.highlightBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Text style={{ fontSize: Typography.xs, color: theme.textSecondary }}>
                <Text style={{ fontWeight: "700", color: theme.leaf }}>Account Settlement:</Text> Credited against original invoice <Text style={{ fontWeight: "700" }}>#{targetItem.originalInvoiceNo || returnRecord.invoiceNo}</Text> and customer ledger.
              </Text>
            </View>
          </Card>

          {/* Section 4: Reason & Condition */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <AlertTriangle size={18} color={theme.warning} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>4. Reason & Condition</Text>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Item Condition</Text>
                <View style={{ marginTop: 4 }}>{renderConditionBadge(targetItem.condition)}</View>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Return Reason</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                  {targetItem.reason || "Customer requested return"}
                </Text>
              </View>
            </View>
          </Card>

          {/* Section 5: Warehouse Handover Details */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Truck size={18} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>5. Warehouse Handover</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Handover Status</Text>
              <View style={{ marginTop: 4 }}>{renderHandoverBadge(handoverStatus)}</View>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Warehouse Received Qty</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                  {targetItem.warehouseReceivedQty ?? (handoverStatus === "received" ? targetItem.quantity : 0)} / {targetItem.quantity} units
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Received Date</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                  {formatDate(targetItem.warehouseReceivedAt || returnRecord.warehouseReceivedAt)}
                </Text>
              </View>
            </View>

            {(targetItem.handoverNotes || returnRecord.handoverNotes) ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Handover Notes</Text>
                <Text style={[styles.infoValue, { color: theme.textSecondary }]}>
                  {targetItem.handoverNotes || returnRecord.handoverNotes}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Section 6: Warehouse Inspection Details */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Shield size={18} color={theme.leaf} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>6. Warehouse Inspection</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Inspection Status</Text>
              <View style={{ marginTop: 4 }}>{renderInspectionBadge(inspectionStatus)}</View>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Approved Resellable Qty</Text>
                <Text style={[styles.infoValueBold, { color: theme.leaf }]}>
                  {targetItem.approvedResellableQty || 0} units
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Rejected / Damaged Qty</Text>
                <Text style={[styles.infoValueBold, { color: theme.danger }]}>
                  {targetItem.rejectedQty || 0} units
                </Text>
              </View>
            </View>

            {targetItem.inspectedAt || returnRecord.inspectedAt ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Inspected At</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                  {formatDate(targetItem.inspectedAt || returnRecord.inspectedAt)}
                </Text>
              </View>
            ) : null}

            {returnRecord.inspectionNotes ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Inspection Notes</Text>
                <Text style={[styles.infoValue, { color: theme.textSecondary }]}>
                  {returnRecord.inspectionNotes}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Section 7: Supplier Return Status */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Send size={18} color={theme.clay} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>7. Supplier Return Status</Text>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Principal Supplier</Text>
                <Text style={[styles.infoValueBold, { color: theme.textPrimary }]}>{supplierName}</Text>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Supplier Invoice Ref</Text>
                <Text style={[styles.infoValue, { color: theme.primary, fontWeight: "700" }]}>
                  {supplierInvoice || "Pending Batch Dispatch"}
                </Text>
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Dispatch Status</Text>
                <View style={{ marginTop: 4 }}>
                  {isDispatched ? (
                    <Badge label="Dispatched to Company" variant="success" size="sm" />
                  ) : (
                    <Badge label="Scheduled for Month End" variant="neutral" size="sm" />
                  )}
                </View>
              </View>
              <View style={styles.col}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Dispatch Date</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                  {formatDate(targetItem.dispatchedAt || returnRecord.dispatchedAt)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Section 8: Complete Lifecycle Timeline */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Clock size={18} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>8. Complete Lifecycle Timeline</Text>
            </View>

            <View style={styles.timelineContainer}>
              {/* Step 1 */}
              <View style={styles.timelineStep}>
                <View style={[styles.timelineIconBox, { backgroundColor: theme.primary }]}>
                  <CheckCircle2 size={16} color="#ffffff" />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>1. Collected from Customer</Text>
                  <Text style={[styles.timelineDesc, { color: theme.textSecondary }]}>
                    Collected during route sales · {formatDate(returnRecord.createdAt)}
                  </Text>
                </View>
              </View>
              <View style={[styles.timelineConnector, { backgroundColor: step2Done ? theme.primary : theme.border }]} />

              {/* Step 2 */}
              <View style={styles.timelineStep}>
                <View
                  style={[
                    styles.timelineIconBox,
                    { backgroundColor: step2Done ? theme.primary : theme.surfaceSubtle }
                  ]}
                >
                  {step2Done ? (
                    <CheckCircle2 size={16} color="#ffffff" />
                  ) : (
                    <Clock size={16} color={theme.textMuted} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>2. Warehouse Handover</Text>
                  <Text style={[styles.timelineDesc, { color: theme.textSecondary }]}>
                    {step2Done
                      ? `Received at central warehouse · ${formatDate(targetItem.warehouseReceivedAt || returnRecord.warehouseReceivedAt)}`
                      : "Pending physical delivery to warehouse"}
                  </Text>
                </View>
              </View>
              <View style={[styles.timelineConnector, { backgroundColor: step3Done ? theme.primary : theme.border }]} />

              {/* Step 3 */}
              <View style={styles.timelineStep}>
                <View
                  style={[
                    styles.timelineIconBox,
                    { backgroundColor: step3Done ? theme.primary : theme.surfaceSubtle }
                  ]}
                >
                  {step3Done ? (
                    <CheckCircle2 size={16} color="#ffffff" />
                  ) : (
                    <Clock size={16} color={theme.textMuted} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>3. Warehouse Inspection</Text>
                  <Text style={[styles.timelineDesc, { color: theme.textSecondary }]}>
                    {step3Done
                      ? `Inspected by manager · ${formatDate(targetItem.inspectedAt || returnRecord.inspectedAt)}`
                      : "Awaiting quality & resellability verification"}
                  </Text>
                </View>
              </View>
              <View style={[styles.timelineConnector, { backgroundColor: step4Done ? theme.primary : theme.border }]} />

              {/* Step 4 */}
              <View style={styles.timelineStep}>
                <View
                  style={[
                    styles.timelineIconBox,
                    { backgroundColor: step4Done ? theme.primary : theme.surfaceSubtle }
                  ]}
                >
                  {step4Done ? (
                    <CheckCircle2 size={16} color="#ffffff" />
                  ) : (
                    <Clock size={16} color={theme.textMuted} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>4. Dispatched to Supplier</Text>
                  <Text style={[styles.timelineDesc, { color: theme.textSecondary }]}>
                    {step4Done
                      ? `Sent to ${supplierName} via SRI-${supplierInvoice}`
                      : "Scheduled for month-end batch supplier run"}
                  </Text>
                </View>
              </View>
              <View style={[styles.timelineConnector, { backgroundColor: step5Done ? theme.primary : theme.border }]} />

              {/* Step 5 */}
              <View style={styles.timelineStep}>
                <View
                  style={[
                    styles.timelineIconBox,
                    { backgroundColor: step5Done ? theme.primary : theme.surfaceSubtle }
                  ]}
                >
                  {step5Done ? (
                    <CheckCircle2 size={16} color="#ffffff" />
                  ) : (
                    <Clock size={16} color={theme.textMuted} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>5. Supplier Settlement</Text>
                  <Text style={[styles.timelineDesc, { color: theme.textSecondary }]}>
                    {step5Done ? "Supplier credit note issued & reconciled" : "Awaiting principal credit settlement"}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: "800"
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    marginTop: 2
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  card: {
    marginBottom: Spacing.base,
    padding: Spacing.base
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs
  },
  cardTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  infoRow: {
    marginBottom: Spacing.sm
  },
  infoLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "600",
    letterSpacing: 0.4
  },
  infoValue: {
    fontSize: Typography.sm,
    marginTop: 2
  },
  infoValueBold: {
    fontSize: Typography.sm,
    fontWeight: "700",
    marginTop: 2
  },
  infoValueBig: {
    fontSize: Typography.lg,
    fontWeight: "800",
    marginTop: 2
  },
  twoColRow: {
    flexDirection: "row",
    gap: Spacing.base,
    marginBottom: Spacing.sm
  },
  col: {
    flex: 1
  },
  supplierBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },
  supplierBadgeText: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  highlightBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs
  },
  timelineContainer: {
    paddingLeft: Spacing.xs,
    marginTop: Spacing.xs
  },
  timelineStep: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  timelineIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    zIndex: 1
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 4
  },
  timelineTitle: {
    fontSize: Typography.sm,
    fontWeight: "700"
  },
  timelineDesc: {
    fontSize: Typography.xs,
    marginTop: 2
  },
  timelineConnector: {
    width: 2,
    height: 20,
    marginLeft: 13,
    marginVertical: -2
  }
});
