import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  Banknote,
  CheckCircle2,
  FileText,
  Landmark,
  Receipt,
  Truck,
  X
} from "lucide-react-native";
import { Payment } from "../../types";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { formatDateTimeLK, formatLKR } from "../../utils/formatters";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface PaymentReceiptModalProps {
  visible: boolean;
  payment: Payment | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  visible,
  payment,
  onClose
}) => {
  const { modalMaxWidth } = useResponsive();

  if (!visible || !payment) return null;

  const isCheque = payment.paymentMethod === "cheque";
  const customerName =
    typeof payment.customer === "object" ? payment.customer.name : "Customer";
  const customerPhone =
    typeof payment.customer === "object" ? payment.customer.phone : undefined;
  const repName =
    typeof payment.receivedBy === "object" ? payment.receivedBy.name : "Sales Rep";
  const tripNo =
    typeof payment.tripId === "object" ? payment.tripId.tripNo : undefined;

  const allocations = payment.allocations || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxWidth: modalMaxWidth }]}>
          {/* Header Icon */}
          <View style={styles.headerIconWrap}>
            <CheckCircle2 size={38} color={Colors.success} />
          </View>

          <Text style={styles.successTitle}>Payment Collected!</Text>
          <Text style={styles.successSub}>
            Transaction recorded on the server and credited to customer ledger.
          </Text>

          {/* Receipt Reference Banner */}
          <View style={styles.refBanner}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Receipt size={16} color={Colors.leaf} style={{ marginRight: 6 }} />
              <Text style={styles.refLabel}>RECEIPT NO:</Text>
            </View>
            <Text style={styles.refValue}>{payment.paymentNo}</Text>
          </View>

          {/* Receipt Details Scroll */}
          <ScrollView
            style={styles.receiptScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Customer & Rep Meta */}
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>CUSTOMER</Text>
                <Text style={styles.metaValue}>{customerName}</Text>
              </View>

              {customerPhone ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>PHONE</Text>
                  <Text style={styles.metaValueSub}>{customerPhone}</Text>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>COLLECTED BY</Text>
                <Text style={styles.metaValueSub}>{repName}</Text>
              </View>

              {tripNo ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>ACTIVE TRIP</Text>
                  <Text style={styles.metaValueSub}>{tripNo}</Text>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>DATE & TIME</Text>
                <Text style={styles.metaValueSub}>
                  {formatDateTimeLK(payment.createdAt)}
                </Text>
              </View>
            </View>

            {/* Total Collected Highlight */}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOTAL AMOUNT RECEIVED</Text>
              <Text style={styles.totalValue}>{formatLKR(payment.amount)}</Text>

              <View style={styles.methodBadgeRow}>
                <Badge
                  label={payment.paymentMethod ? payment.paymentMethod.toUpperCase() : "CASH"}
                  variant={isCheque ? "warning" : "success"}
                  size="sm"
                />
                {isCheque && (
                  <Badge
                    label={payment.chequeStatus ? payment.chequeStatus.toUpperCase() : "PENDING"}
                    variant={payment.chequeStatus === "cleared" ? "success" : "warning"}
                    size="sm"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
            </View>

            {/* Cheque Specific Details */}
            {isCheque && (
              <View style={styles.chequeDetailsBox}>
                <Text style={styles.boxTitle}>CHEQUE INFORMATION</Text>
                <View style={styles.chequeRow}>
                  <Text style={styles.chequeLabel}>Cheque Number:</Text>
                  <Text style={styles.chequeValue}>{payment.chequeNo || "-"}</Text>
                </View>
                <View style={styles.chequeRow}>
                  <Text style={styles.chequeLabel}>Bank & Branch:</Text>
                  <Text style={styles.chequeValue}>{payment.bankName || "-"}</Text>
                </View>
                <View style={styles.chequeRow}>
                  <Text style={styles.chequeLabel}>Cheque Date:</Text>
                  <Text style={styles.chequeValue}>
                    {payment.chequeDate ? new Date(payment.chequeDate).toLocaleDateString() : "-"}
                  </Text>
                </View>
              </View>
            )}

            {/* Invoice Allocations Breakdown */}
            {allocations.length > 0 && (
              <View style={styles.allocationsSection}>
                <Text style={styles.boxTitle}>INVOICE ALLOCATIONS ({allocations.length})</Text>

                {allocations.map((item, idx) => (
                  <View key={`${item.invoiceNo}-${idx}`} style={styles.allocationRow}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <FileText size={13} color={Colors.leaf} style={{ marginRight: 4 }} />
                      <Text style={styles.allocInvoiceNo}>{item.invoiceNo}</Text>
                    </View>
                    <Text style={styles.allocAmount}>{formatLKR(item.allocatedAmount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Optional Note */}
            {payment.note ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Note:</Text>
                <Text style={styles.noteText}>{payment.note}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Action Button */}
          <View style={styles.modalFooter}>
            <Button
              title="Done & Close Receipt"
              variant="primary"
              onPress={onClose}
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.base
  },
  card: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl + 4,
    padding: Spacing.base,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: Colors.border
  },
  headerIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.successLight,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: Spacing.sm
  },
  successTitle: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink,
    textAlign: "center"
  },
  successSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
    marginBottom: Spacing.md,
    lineHeight: 16
  },
  refBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  refLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  refValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.leafDark
  },
  receiptScroll: {
    maxHeight: 340,
    marginBottom: Spacing.md
  },
  metaBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 4
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  metaValue: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  metaValueSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  totalBox: {
    backgroundColor: "rgba(15, 118, 110, 0.05)",
    borderWidth: 1.5,
    borderColor: Colors.leaf,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    alignItems: "center",
    marginBottom: Spacing.sm
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6
  },
  totalValue: {
    fontSize: Typography.xxl,
    fontWeight: "800",
    color: Colors.leafDark,
    marginVertical: 4
  },
  methodBadgeRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  chequeDetailsBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  boxTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: Spacing.xs
  },
  chequeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 2
  },
  chequeLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  chequeValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  allocationsSection: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  allocationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.slatewash
  },
  allocInvoiceNo: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  allocAmount: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.leafDark
  },
  noteBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  noteLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted
  },
  noteText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    paddingTop: Spacing.sm
  }
});

