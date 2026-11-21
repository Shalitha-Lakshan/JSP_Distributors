import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { CheckCircle2, Eye, FileText, Printer, Receipt, Share2 } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Order, Product, Sale, StockBatch } from "../../types";
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

/**
 * Resolves human-readable warehouse batch number.
 * Ensures NO technical prefixes (e.g. F1 · ), synthetic labels ("Batch Standard"), or raw IDs.
 */
export const resolveCleanBatchNumber = (
  b: any,
  item: any,
  index: number,
  allBatches: StockBatch[] = []
): string => {
  let rawNo: string | undefined =
    b?.batchNo ||
    (typeof b?.batchId === "object" && b?.batchId?.batchNo ? b.batchId.batchNo : undefined);

  if (!rawNo && b?.batchId) {
    const bIdStr = typeof b.batchId === "object" ? String(b.batchId._id || b.batchId.id || "") : String(b.batchId);
    const found = allBatches.find((ab) => String(ab._id || (ab as any).id) === bIdStr);
    if (found?.batchNo) {
      rawNo = found.batchNo;
    }
  }

  if (!rawNo && Array.isArray(item?.batches) && item.batches[index]?.batchNo) {
    rawNo = item.batches[index].batchNo;
  }

  if (rawNo) {
    let clean = String(rawNo).replace(/^F\d+\s*[-·•:]\s*/i, "").trim();
    clean = clean.replace(/^Batch\s+/i, "").trim();

    const lower = clean.toLowerCase();
    if (
      clean &&
      !lower.includes("standard") &&
      clean !== "undefined" &&
      clean !== "null" &&
      clean !== "[object Object]"
    ) {
      return `Batch ${clean}`;
    }
  }

  const safeIdx = typeof index === "number" && !isNaN(index) ? index + 1 : 1;
  return `Batch #${safeIdx}`;
};

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  visible,
  sale,
  order,
  onClose
}) => {
  const { theme, isDark } = useAppTheme();
  const { modalMaxWidth, height: screenHeight } = useResponsive();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const queryClient = useQueryClient();
  const cachedProducts = queryClient.getQueryData<Product[]>(["products"]) || [];
  const availableBatches = useMemo(() => {
    const list: StockBatch[] = [];
    cachedProducts.forEach((p) => {
      if (Array.isArray(p.batches)) {
        list.push(...p.batches);
      }
    });
    return list;
  }, [cachedProducts]);

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
  const paymentMethod = sale ? sale.paymentMethod : order?.paymentMethod || "";
  const orderStatus = isOrder ? order?.orderStatus : "completed";

  const items = (sale ? sale.items : order?.items) || [];
  const totalUnits = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const distinctProductsCount = items.length;

  // Proposed Market Returns calculation
  const returnsList = (order as any)?.returns || (order as any)?.proposedReturns || (sale as any)?.returns || [];
  const returnsTotal =
    typeof (order as any)?.returnTotal === "number" && (order as any)?.returnTotal > 0
      ? (order as any).returnTotal
      : typeof (sale as any)?.returnTotal === "number" && (sale as any)?.returnTotal > 0
      ? (sale as any).returnTotal
      : returnsList.reduce(
          (sum: number, r: any) =>
            sum + (Number(r.returnTotal) || (Number(r.quantity || 0) * Number(r.returnPrice || 0))),
          0
        );

  // Friendly status labels
  const getOrderStatusBadge = () => {
    if (!isOrder) {
      return { label: "Completed & Invoiced", variant: "success" as const };
    }
    switch (orderStatus) {
      case "delivered":
        return { label: "Delivered", variant: "success" as const };
      case "cancelled":
        return { label: "Cancelled", variant: "danger" as const };
      case "pending_delivery":
      default:
        return { label: "Pending Packing", variant: "warning" as const };
    }
  };

  const getPaymentStatusBadge = () => {
    switch (paymentStatus) {
      case "paid":
        return { label: "Paid", variant: "success" as const };
      case "credit":
        return { label: "Credit", variant: "danger" as const };
      case "partial":
        return { label: "Partial", variant: "warning" as const };
      case "not_collected":
      default:
        return { label: "Not Collected", variant: "warning" as const };
    }
  };

  const formatPaymentMethod = (method?: string) => {
    if (!method || method === "not_collected") return "";
    return method
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const showPaymentMethod =
    paymentStatus !== "not_collected" &&
    Boolean(paymentMethod) &&
    paymentMethod !== "not_collected";

  const orderStatusBadge = getOrderStatusBadge();
  const paymentStatusBadge = getPaymentStatusBadge();

  // Responsive max height for scroll list
  const scrollMaxHeight = Math.max(220, Math.min(Math.round(screenHeight * 0.48), 380));

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printInvoice(currentDoc, { isOrder, batches: availableBatches });
    } catch (err: any) {
      Alert.alert("Print Error", err?.message || "Failed to trigger print dialog.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsSharing(true);
      await shareInvoicePdf(currentDoc, { isOrder, batches: availableBatches });
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
                ? "Your van order has been recorded and stock reserved."
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
                <Text style={[styles.refLabel, { color: theme.textSecondary }]}>
                  {isOrder ? "ORDER NO:" : "INVOICE NO:"}
                </Text>
              </View>
              <Text style={[styles.refValue, { color: theme.primary }]}>{refNo}</Text>
            </View>

            {/* Receipt Content Scroll */}
            <ScrollView
              style={[styles.receiptScroll, { maxHeight: scrollMaxHeight }]}
              showsVerticalScrollIndicator
            >
              {/* Order Metadata Box */}
              <View style={[styles.metaBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>Customer</Text>
                  <Text style={[styles.metaVal, { color: theme.textPrimary }]}>
                    {customerName || "Walk-in Customer"}
                  </Text>
                </View>
                <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>Booking Date & Time</Text>
                  <Text style={[styles.metaVal, { color: theme.textPrimary }]}>
                    {formatDate(order?.createdAt || sale?.createdAt)}
                  </Text>
                </View>
                <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>
                    {isOrder ? "Order Status" : "Status"}
                  </Text>
                  <Badge
                    label={orderStatusBadge.label}
                    variant={orderStatusBadge.variant}
                    size="sm"
                  />
                </View>
                {showPaymentMethod && (
                  <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.metaKey, { color: theme.textMuted }]}>Payment Method</Text>
                    <Text style={[styles.metaVal, { color: theme.textPrimary }]}>
                      {formatPaymentMethod(paymentMethod)}
                    </Text>
                  </View>
                )}
                <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.metaKey, { color: theme.textMuted }]}>Payment Status</Text>
                  <Badge
                    label={paymentStatusBadge.label}
                    variant={paymentStatusBadge.variant}
                    size="sm"
                  />
                </View>
              </View>

              {/* Items Section Header */}
              <View style={styles.sectionHeaderWrap}>
                <Text style={[styles.tableHeader, { color: theme.textPrimary }]}>
                  {isOrder ? "ITEMS TO PACK" : "INVOICED ITEMS"}
                </Text>
                <Text style={[styles.tableSubHeader, { color: theme.textSecondary }]}>
                  {isOrder
                    ? "Warehouse batch allocation & packing reference"
                    : "Batch allocation & billing breakdown"}
                </Text>
              </View>

              {/* Product Packing Cards */}
              <View style={styles.itemsContainer}>
                {items.map((item, idx) => {
                  const name =
                    (item as any).itemName ||
                    (item as any).displayName ||
                    (item as any).product?.name ||
                    "Product";
                  const itemCode =
                    (item as any).itemCode ||
                    (item as any).product?.itemCode ||
                    "";
                  const itemTotalQty = Number(item.quantity) || 0;
                  const itemBillingRate = Number(
                    (item as any).billingPrice !== undefined && (item as any).billingPrice !== null
                      ? (item as any).billingPrice
                      : (item as any).unitPrice || 0
                  );
                  const itemLineTotal = Number(
                    (item as any).lineTotal !== undefined && (item as any).lineTotal !== null
                      ? (item as any).lineTotal
                      : itemTotalQty * itemBillingRate
                  );

                  // Extract allocated batches
                  const rawBatches =
                    (item as any).usedBatches && (item as any).usedBatches.length > 0
                      ? (item as any).usedBatches
                      : (item as any).allocations && (item as any).allocations.length > 0
                      ? (item as any).allocations
                      : [];

                  const itemBatches =
                    rawBatches.length > 0
                      ? rawBatches.map((b: any, bIdx: number) => {
                          const batchNo = resolveCleanBatchNumber(b, item, bIdx, availableBatches);
                          const bQty = Number(b.qty ?? b.quantity ?? 0);
                          const bBilling = Number(
                            b.billingPrice !== undefined && b.billingPrice !== null
                              ? b.billingPrice
                              : itemBillingRate
                          );
                          const bTotal = Number(
                            b.lineTotal !== undefined && b.lineTotal !== null
                              ? b.lineTotal
                              : bQty * bBilling
                          );
                          return { batchNo, qty: bQty, billingPrice: bBilling, lineTotal: bTotal };
                        })
                      : [
                          {
                            batchNo: resolveCleanBatchNumber(item, item, 0, availableBatches),
                            qty: itemTotalQty,
                            billingPrice: itemBillingRate,
                            lineTotal: itemLineTotal
                          }
                        ];

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.productCard,
                        {
                          backgroundColor: isDark ? theme.surfaceSubtle : "#ffffff",
                          borderColor: theme.border
                        }
                      ]}
                    >
                      {/* Product Header */}
                      <View style={styles.productHeaderRow}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text
                            style={[styles.productName, { color: theme.textPrimary }]}
                            numberOfLines={1}
                          >
                            {name}
                          </Text>
                          {itemCode ? (
                            <View style={styles.itemCodeBadge}>
                              <Text style={[styles.itemCodeText, { color: theme.textSecondary }]}>
                                Item Code:{" "}
                                <Text style={{ fontWeight: "700", color: theme.primary }}>
                                  {itemCode}
                                </Text>
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.qtyBadge,
                            { backgroundColor: isDark ? theme.surface : theme.slatewash }
                          ]}
                        >
                          <Text style={[styles.qtyBadgeText, { color: theme.textPrimary }]}>
                            {itemTotalQty} {itemTotalQty === 1 ? "unit" : "units"}
                          </Text>
                        </View>
                      </View>

                      {/* Batches Sub-list */}
                      <View style={[styles.batchesContainer, { borderTopColor: theme.border }]}>
                        {itemBatches.map((b: { batchNo: string; qty: number; billingPrice: number; lineTotal: number }, bIdx: number) => (
                          <View
                            key={`batch-${bIdx}`}
                            style={[
                              styles.batchRow,
                              bIdx > 0 && {
                                borderTopWidth: 1,
                                borderTopColor: isDark ? theme.border : theme.borderSubtle
                              }
                            ]}
                          >
                            <View style={styles.batchLeftCol}>
                              <View
                                style={[
                                  styles.batchNoPill,
                                  {
                                    backgroundColor: isDark ? "rgba(15, 118, 110, 0.25)" : theme.primaryLight,
                                    borderColor: isDark ? theme.primary : "transparent"
                                  }
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.batchNoText,
                                    { color: isDark ? "#5eead4" : theme.primaryDark }
                                  ]}
                                  numberOfLines={1}
                                >
                                  {b.batchNo}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.batchRightCol}>
                              <Text style={[styles.batchQtyRate, { color: theme.textSecondary }]}>
                                {b.qty} units × {formatLKR(b.billingPrice)}
                              </Text>
                              <Text style={[styles.batchLineTotal, { color: theme.textPrimary }]}>
                                = {formatLKR(b.lineTotal)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Product Total Footer */}
                      <View style={[styles.productTotalRow, { borderTopColor: theme.border }]}>
                        <Text style={[styles.productTotalLabel, { color: theme.textSecondary }]}>
                          Product Total
                        </Text>
                        <Text style={[styles.productTotalValue, { color: theme.textPrimary }]}>
                          {formatLKR(itemLineTotal)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Order Summary Section */}
              <View
                style={[
                  styles.summaryBox,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }
                ]}
              >
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: theme.textSecondary }]}>
                    Distinct Products
                  </Text>
                  <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
                    {distinctProductsCount}{" "}
                    {distinctProductsCount === 1 ? "Product" : "Products"}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: theme.textSecondary }]}>
                    Total Units to Pack
                  </Text>
                  <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
                    {totalUnits} {totalUnits === 1 ? "unit" : "units"}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: theme.textSecondary }]}>
                    Product Subtotal
                  </Text>
                  <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
                    {formatLKR(subtotal)}
                  </Text>
                </View>

                {returnsTotal > 0 && (
                  <View style={styles.summaryRow}>
                    <View style={{ flex: 1, marginRight: Spacing.sm }}>
                      <Text
                        style={[
                          styles.summaryKey,
                          { color: theme.clay, fontWeight: "600", fontSize: Typography.xs - 0.5 }
                        ]}
                      >
                        Proposed Market Returns
                      </Text>
                      <Text
                        style={{
                          color: theme.textMuted,
                          fontSize: 10,
                          marginTop: 1
                        }}
                      >
                        (Pending Warehouse Audit)
                      </Text>
                    </View>
                    <Text style={[styles.summaryVal, { color: theme.clay }]}>
                      -{formatLKR(returnsTotal)}
                    </Text>
                  </View>
                )}

                {discountVal > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryKey, { color: theme.danger }]}>
                      Discount{discountPercentVal > 0 ? ` (${discountPercentVal}%)` : ""}
                    </Text>
                    <Text style={[styles.summaryVal, { color: theme.danger }]}>
                      -{formatLKR(discountVal)}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.summaryRow,
                    styles.netTotalRow,
                    { borderTopColor: theme.border }
                  ]}
                >
                  <Text style={[styles.netTotalKey, { color: theme.textPrimary }]}>
                    {isOrder ? "Net Order Total" : "Net Payable Total"}
                  </Text>
                  <Text style={[styles.netTotalVal, { color: theme.primary }]}>
                    {formatLKR(netTotal)}
                  </Text>
                </View>

                {!isOrder && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryKey, { color: theme.textSecondary }]}>
                        Amount Paid
                      </Text>
                      <Text style={[styles.summaryVal, { color: theme.success }]}>
                        {formatLKR(paidAmount)}
                      </Text>
                    </View>
                    {dueAmount > 0 && (
                      <View
                        style={[
                          styles.summaryRow,
                          { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 4 }
                        ]}
                      >
                        <Text style={[styles.summaryKey, { color: theme.danger, fontWeight: "700" }]}>
                          Due Balance
                        </Text>
                        <Text style={[styles.summaryVal, { color: theme.danger }]}>
                          {formatLKR(dueAmount)}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </ScrollView>

            {/* Print & Share Action Row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setIsPreviewOpen(true)}
                style={[
                  styles.actionBtnSecondary,
                  { borderColor: theme.primary, backgroundColor: theme.surface }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Preview Invoice"
              >
                <Eye size={16} color={theme.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.actionBtnSecondaryText, { color: theme.primary }]}>
                  Preview
                </Text>
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
                    <Printer
                      size={16}
                      color={isDark ? "#0b1220" : "#ffffff"}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.actionBtnPrimaryText,
                        { color: isDark ? "#0b1220" : "#ffffff" }
                      ]}
                    >
                      Print
                    </Text>
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
        batches={availableBatches}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.sm
  },
  card: {
    width: "100%",
    maxHeight: "92%",
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
    width: "100%"
  },
  metaBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
    borderWidth: 1
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
  sectionHeaderWrap: {
    marginBottom: 6,
    marginTop: 2
  },
  tableHeader: {
    fontSize: Typography.xs,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  tableSubHeader: {
    fontSize: 10,
    marginTop: 1
  },
  itemsContainer: {
    width: "100%",
    marginBottom: Spacing.sm
  },
  productCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.sm
  },
  productHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs
  },
  productName: {
    fontSize: Typography.xs + 1,
    fontWeight: "800"
  },
  itemCodeBadge: {
    marginTop: 2
  },
  itemCodeText: {
    fontSize: 10,
    fontWeight: "500"
  },
  qtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm
  },
  qtyBadgeText: {
    fontSize: 11,
    fontWeight: "700"
  },
  batchesContainer: {
    borderTopWidth: 1,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs
  },
  batchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4
  },
  batchLeftCol: {
    flex: 1
  },
  batchNoPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1
  },
  batchNoText: {
    fontSize: 10,
    fontWeight: "700"
  },
  batchRightCol: {
    alignItems: "flex-end"
  },
  batchQtyRate: {
    fontSize: 10,
    fontWeight: "500"
  },
  batchLineTotal: {
    fontSize: 11,
    fontWeight: "700"
  },
  productTotalRow: {
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
    marginTop: 4
  },
  productTotalLabel: {
    fontSize: 10,
    fontWeight: "600"
  },
  productTotalValue: {
    fontSize: Typography.xs,
    fontWeight: "800"
  },
  summaryBox: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3
  },
  summaryKey: {
    fontSize: Typography.xs,
    fontWeight: "600"
  },
  summaryVal: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  netTotalRow: {
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: 4
  },
  netTotalKey: {
    fontSize: Typography.sm,
    fontWeight: "800"
  },
  netTotalVal: {
    fontSize: Typography.sm + 1,
    fontWeight: "900"
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
    paddingVertical: 9,
    borderRadius: BorderRadius.md
  },
  actionBtnSecondaryText: {
    fontSize: Typography.xs,
    fontWeight: "800"
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
