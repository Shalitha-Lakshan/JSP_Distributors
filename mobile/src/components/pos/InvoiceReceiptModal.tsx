import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { CheckCircle2, Eye, FileText, Printer, Receipt, Share2, X } from "lucide-react-native";
import { Order, Sale } from "../../types";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";
import { printInvoice, shareInvoicePdf } from "../../services/invoicePdf";
import { InvoicePreviewModal } from "./InvoicePreviewModal";

interface InvoiceReceiptModalProps {
  visible: boolean;
  sale?: Sale | null;
  order?: Order | null;
  onClose: () => void;
}

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatDate = (iso?: string) => {
  if (!iso) return new Date().toLocaleString();
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  visible,
  sale,
  order,
  onClose
}) => {
  const { theme, isDark } = useAppTheme();
  const { modalMaxWidth } = useResponsive();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!visible || (!sale && !order)) return null;

  const currentDoc = (sale || order) as Sale | Order;
  const isOrder = !sale && !!order;
  const refNo = sale ? sale.invoiceNo : order?.orderNo || "";
  const customerName =
    typeof (sale ? sale.customer : order?.customer) === "object"
      ? (sale ? (sale.customer as any)?.name : order?.customer?.name)
      : "Walk-in Customer";

  const subtotal = sale ? (sale.orderTotal || sale.subtotal) : order?.orderTotal || 0;
  const discountVal = sale ? sale.discount : order?.discount || 0;
  const rawDiscountPercent = sale ? sale.discountPercent : order?.discountPercent;
  const discountPercentVal: number =
    typeof rawDiscountPercent === "number"
      ? rawDiscountPercent
      : subtotal > 0 && discountVal > 0
      ? Math.round((discountVal / subtotal) * 100 * 10) / 10
      : 0;

  const netTotal = sale ? sale.netTotal : order?.netTotal || 0;
  const paidAmount = sale ? sale.paidAmount : order?.paidAmount || 0;
  const dueAmount = sale ? sale.dueAmount : order?.dueAmount || 0;
  const paymentStatus = sale ? sale.paymentStatus : order?.paymentStatus || "not_collected";
  const paymentMethod = sale ? sale.paymentMethod : order?.paymentMethod || "cash";

  const items = sale ? sale.items : order?.items || [];

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printInvoice(currentDoc, { isOrder });
    } catch (err: any) {
      Alert.alert("Print Error", err?.message || "Failed to trigger print dialog.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsSharing(true);
      await shareInvoicePdf(currentDoc, { isOrder });
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      if (
        msg.includes("canceled") ||
        msg.includes("cancelled") ||
        msg.includes("dismissed") ||
        msg.includes("user did not share") ||
        msg.includes("abort")
      ) {
        return;
      }
      console.error("[Share PDF Failed in Receipt Modal]", err);
      Alert.alert("Share Error", err?.message || "Failed to share invoice PDF.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, { maxWidth: modalMaxWidth, backgroundColor: theme.surface }]}>
            {/* Header check icon */}
            <View style={styles.headerIconWrap}>
              <CheckCircle2 size={36} color={theme.success} />
            </View>

            <Text style={[styles.successTitle, { color: theme.textPrimary }]}>
              {isOrder ? "Order Booked Successfully!" : "Sale Confirmed & Invoiced!"}
            </Text>
            <Text style={[styles.successSub, { color: theme.textSecondary }]}>
              {isOrder
                ? "Stock reserved on server. Official Order Confirmation generated."
                : "Authoritative server invoice generated and recorded in shift."}
            </Text>

            {/* Reference Badge */}
            <View style={[styles.refBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {isOrder ? (
                  <FileText size={16} color={theme.primary} style={{ marginRight: 6 }} />
                ) : (
                  <Receipt size={16} color={theme.primary} style={{ marginRight: 6 }} />
                )}
                <Text style={[styles.refLabel, { color: theme.primary }]}>{isOrder ? "ORDER NO:" : "INVOICE NO:"}</Text>
              </View>
              <Text style={[styles.refValue, { color: theme.primary }]}>{refNo}</Text>
            </View>

            {/* Receipt Content Scroll */}
            <ScrollView style={styles.receiptScroll} showsVerticalScrollIndicator={false}>
              {/* Meta Row */}
              <View style={[styles.metaBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>Customer</Text>
                  <Text style={[styles.metaVal, { color: theme.textPrimary }]}>{customerName || "Walk-in"}</Text>
                </View>
                <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>Date & Time</Text>
                  <Text style={[styles.metaVal, { color: theme.textPrimary }]}>{formatDate(sale?.createdAt || order?.createdAt)}</Text>
                </View>
                <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>Payment Method</Text>
                  <Text style={[styles.metaVal, { color: theme.textPrimary, textTransform: "capitalize" }]}>{paymentMethod}</Text>
                </View>
                <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>Status</Text>
                  <Badge
                    label={paymentStatus.toUpperCase()}
                    variant={paymentStatus === "paid" ? "success" : paymentStatus === "credit" ? "danger" : "warning"}
                    size="sm"
                  />
                </View>
              </View>

              {/* Itemized List */}
              <Text style={[styles.tableHeader, { color: theme.textSecondary }]}>ORDERED ITEMS</Text>
              <View style={[styles.itemsTable, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                {items.map((item, idx) => {
                  const name = (item as any).itemName || (item as any).displayName || "Product";
                  const qty = item.quantity;
                  const price = (item as any).sellingPrice || (item as any).unitPrice || 0;
                  const lineTotal = item.lineTotal;

                  return (
                    <View key={idx} style={[styles.tableRow, { borderBottomColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: theme.textPrimary }]} numberOfLines={1}>{name}</Text>
                        <Text style={[styles.itemSub, { color: theme.textSecondary }]}>{qty} x {formatLKR(price)}</Text>
                      </View>
                      <Text style={[styles.itemTotal, { color: theme.textPrimary }]}>{formatLKR(lineTotal)}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Financial Summary */}
              <View style={[styles.totalsBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                {discountVal > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalKey, { color: theme.textSecondary }]}>Subtotal</Text>
                    <Text style={[styles.totalVal, { color: theme.textPrimary }]}>{formatLKR(subtotal)}</Text>
                  </View>
                )}
                {discountVal > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalKey, { color: theme.danger }]}>
                      Discount{discountPercentVal > 0 ? ` (${discountPercentVal}%)` : ""}
                    </Text>
                    <Text style={[styles.totalVal, { color: theme.danger }]}>-{formatLKR(discountVal)}</Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={[styles.totalKey, { color: theme.textSecondary }]}>Net Total</Text>
                  <Text style={[styles.totalVal, { color: theme.textPrimary }]}>{formatLKR(netTotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalKey, { color: theme.textSecondary }]}>Amount Paid</Text>
                  <Text style={[styles.totalVal, { color: theme.success }]}>{formatLKR(paidAmount)}</Text>
                </View>
                {dueAmount > 0 && (
                  <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 4 }]}>
                    <Text style={[styles.totalKey, { color: theme.danger, fontWeight: "700" }]}>Due Balance</Text>
                    <Text style={[styles.totalVal, { color: theme.danger }]}>{formatLKR(dueAmount)}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Print & Share Action Row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setIsPreviewOpen(true)}
                style={[styles.actionBtnSecondary, { borderColor: theme.primary, backgroundColor: theme.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Preview Invoice"
              >
                <Eye size={16} color={theme.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.actionBtnSecondaryText, { color: theme.primary }]}>Preview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePrint}
                disabled={isPrinting || isSharing}
                style={[styles.actionBtnPrimary, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Print Invoice"
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color={isDark ? "#0b1220" : "#ffffff"} />
                ) : (
                  <>
                    <Printer size={16} color={isDark ? "#0b1220" : "#ffffff"} style={{ marginRight: 4 }} />
                    <Text style={[styles.actionBtnPrimaryText, { color: isDark ? "#0b1220" : "#ffffff" }]}>Print</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                disabled={isPrinting || isSharing}
                style={styles.actionBtnClay}
                accessibilityRole="button"
                accessibilityLabel="Share Invoice PDF"
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Share2 size={16} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.actionBtnPrimaryText}>Share PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Done / Close button */}
            <Button
              title="Done / Close"
              variant="secondary"
              size="md"
              onPress={onClose}
              style={{ width: "100%", marginTop: Spacing.sm }}
            />
          </View>
        </View>
      </Modal>

      {/* Full-Screen A4 Preview Modal */}
      <InvoicePreviewModal
        visible={isPreviewOpen}
        doc={currentDoc}
        isOrder={isOrder}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.base
  },
  card: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    alignItems: "center",
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10
  },
  headerIconWrap: {
    marginBottom: 4
  },
  successTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink,
    textAlign: "center"
  },
  successSub: {
    fontSize: Typography.xs - 1,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
    marginBottom: Spacing.sm,
    lineHeight: 14
  },
  refBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginBottom: Spacing.sm
  },
  refLabel: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.5
  },
  refValue: {
    fontSize: Typography.sm,
    fontWeight: "900",
    color: Colors.leaf
  },
  receiptScroll: {
    width: "100%",
    maxHeight: 220
  },
  metaBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  metaKey: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  metaVal: {
    fontSize: Typography.xs,
    color: Colors.ink,
    fontWeight: "700"
  },
  tableHeader: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4
  },
  itemsTable: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  itemName: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  itemSub: {
    fontSize: Typography.xs - 1,
    color: Colors.textSecondary,
    marginTop: 1
  },
  itemTotal: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  totalsBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3
  },
  totalKey: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  totalVal: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  actionRow: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
    marginTop: Spacing.sm
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.leaf,
    paddingVertical: 9,
    borderRadius: BorderRadius.md
  },
  actionBtnSecondaryText: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.leaf
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.leaf,
    paddingVertical: 9,
    borderRadius: BorderRadius.md
  },
  actionBtnPrimaryText: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: "#ffffff"
  },
  actionBtnClay: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.clay,
    paddingVertical: 9,
    borderRadius: BorderRadius.md
  }
});
