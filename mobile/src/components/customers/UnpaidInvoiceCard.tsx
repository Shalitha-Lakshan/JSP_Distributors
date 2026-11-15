import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertCircle, Banknote, Calendar, FileText, Truck } from "lucide-react-native";
import { UnpaidInvoice } from "../../types";
import { Badge } from "../common/Badge";
import { formatDateLK, formatLKR } from "../../utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface UnpaidInvoiceCardProps {
  invoice: UnpaidInvoice;
  onPress?: (invoice: UnpaidInvoice) => void;
  onCollect?: (invoice: UnpaidInvoice) => void;
}

export const UnpaidInvoiceCard: React.FC<UnpaidInvoiceCardProps> = ({
  invoice,
  onPress,
  onCollect
}) => {
  const isPartial = Number(invoice.paidAmount || 0) > 0;
  const isCredit = !isPartial;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.invoiceTitleRow}>
          <FileText size={16} color={Colors.leaf} style={{ marginRight: 6 }} />
          <Text style={styles.invoiceNo}>{invoice.invoiceNo}</Text>
        </View>

        <Badge
          label={invoice.paymentStatus ? invoice.paymentStatus.toUpperCase() : isPartial ? "PARTIAL" : "CREDIT"}
          variant={isPartial ? "warning" : "danger"}
          size="sm"
        />
      </View>

      {/* Meta: Order ID & Date */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Calendar size={12} color={Colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.metaText}>{formatDateLK(invoice.createdAt)}</Text>
        </View>

        {invoice.orderId && (
          <View style={styles.metaItem}>
            <Truck size={12} color={Colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.metaText}>Order {invoice.orderId.orderNo}</Text>
          </View>
        )}
      </View>

      {/* Amount Breakdown */}
      <View style={styles.amountBreakdown}>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>NET TOTAL</Text>
          <Text style={styles.amountSubValue}>{formatLKR(invoice.netTotal)}</Text>
        </View>

        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>PAID SO FAR</Text>
          <Text style={[styles.amountSubValue, { color: Colors.success }]}>
            {formatLKR(invoice.paidAmount)}
          </Text>
        </View>

        <View style={[styles.amountItem, { alignItems: "flex-end" }]}>
          <Text style={styles.amountLabelDanger}>DUE / OUTSTANDING</Text>
          <Text style={styles.dueAmountValue}>
            {formatLKR(invoice.dueAmount)}
          </Text>
        </View>
      </View>

      {/* Collect Action Button */}
      {onCollect ? (
        <TouchableOpacity
          style={styles.collectActionBtn}
          onPress={() => onCollect(invoice)}
          activeOpacity={0.8}
        >
          <Banknote size={14} color={Colors.leafDark} style={{ marginRight: 4 }} />
          <Text style={styles.collectActionText}>Collect Payment</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  invoiceTitleRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  invoiceNo: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center"
  },
  metaText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  amountBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  amountItem: {
    flex: 1
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  amountLabelDanger: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.danger,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  amountSubValue: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  dueAmountValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.danger
  },
  collectActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.leafLight,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm
  },
  collectActionText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leafDark
  }
});

