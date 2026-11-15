import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Banknote,
  Calendar,
  ChevronRight,
  FileText,
  Landmark,
  Receipt
} from "lucide-react-native";
import { Payment } from "../../types";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { formatDateTimeLK, formatLKR } from "../../utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface PaymentCardProps {
  payment: Payment;
  onPress: (payment: Payment) => void;
}

export const PaymentCard: React.FC<PaymentCardProps> = ({ payment, onPress }) => {
  const isCheque = payment.paymentMethod === "cheque";
  const customerName =
    typeof payment.customer === "object" ? payment.customer.name : "Customer";
  const allocationsCount = payment.allocations?.length || 0;

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        onPress={() => onPress(payment)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View receipt for ${payment.paymentNo}`}
      >
        {/* Top Row: Payment No & Badges */}
        <View style={styles.topRow}>
          <View style={styles.refRow}>
            <Receipt size={15} color={Colors.leaf} style={{ marginRight: 6 }} />
            <Text style={styles.paymentNo}>{payment.paymentNo}</Text>
          </View>

          <View style={styles.badgeGroup}>
            <Badge
              label={payment.paymentMethod ? payment.paymentMethod.toUpperCase() : "CASH"}
              variant={isCheque ? "warning" : "success"}
              size="sm"
            />
            {isCheque && (
              <Badge
                label={payment.chequeStatus ? payment.chequeStatus.toUpperCase() : "PENDING"}
                variant={
                  payment.chequeStatus === "cleared"
                    ? "success"
                    : payment.chequeStatus === "returned"
                    ? "danger"
                    : "warning"
                }
                size="sm"
                style={{ marginLeft: 4 }}
              />
            )}
            <ChevronRight size={16} color={Colors.textMuted} style={{ marginLeft: 4 }} />
          </View>
        </View>

        {/* Customer & Timestamp */}
        <View style={styles.middleRow}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customerName}
          </Text>
          <View style={styles.dateRow}>
            <Calendar size={12} color={Colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.dateText}>{formatDateTimeLK(payment.createdAt)}</Text>
          </View>
        </View>

        {/* Bottom Row: Amount & Allocation Count */}
        <View style={styles.bottomRow}>
          <View style={styles.allocationSummary}>
            {allocationsCount > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <FileText size={12} color={Colors.leaf} style={{ marginRight: 4 }} />
                <Text style={styles.allocationText}>
                  Allocated to {allocationsCount} {allocationsCount === 1 ? "invoice" : "invoices"}
                </Text>
              </View>
            ) : (
              <Text style={styles.unappliedText}>Unallocated / General Credit</Text>
            )}
          </View>

          <Text style={styles.amountText}>{formatLKR(payment.amount)}</Text>
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  paymentNo: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.leafDark,
    letterSpacing: 0.2
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center"
  },
  middleRow: {
    marginVertical: 4
  },
  customerName: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },
  dateText: {
    fontSize: 10,
    color: Colors.textMuted
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  allocationSummary: {
    flex: 1,
    marginRight: Spacing.sm
  },
  allocationText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  unappliedText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: "italic"
  },
  amountText: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  }
});

