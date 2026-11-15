import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Printer, Share2, X } from "lucide-react-native";
import { Order, Sale } from "../../types";
import {
  COMPANY_DETAILS,
  printInvoice,
  shareInvoicePdf,
  splitRsCts
} from "../../services/invoicePdf";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

interface InvoicePreviewModalProps {
  visible: boolean;
  doc: Sale | Order | null;
  isOrder?: boolean;
  onClose: () => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  visible,
  doc,
  isOrder: forceOrder,
  onClose
}) => {
  const { theme, isDark } = useAppTheme();
  const { isTablet } = useResponsive();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!visible || !doc) return null;

  const isOrder = forceOrder ?? (!("invoiceNo" in doc) && "orderNo" in doc);
  const docNo = "invoiceNo" in doc ? doc.invoiceNo : (doc as Order).orderNo || "";
  const documentTitle = isOrder ? "ORDER CONFIRMATION" : "REDISTRIBUTOR SALES INVOICE";

  // Customer details
  const customerObj = typeof doc.customer === "object" && doc.customer !== null ? doc.customer : null;
  const customerName = customerObj?.name || "Walk-in Customer";
  const customerAddress = customerObj?.address || "-";
  const customerPhone = customerObj?.phone || "-";

  // Trip route
  const tripRoute =
    typeof (doc as any).tripId === "object" && (doc as any).tripId?.route
      ? (doc as any).tripId.route
      : "-";

  // Cashier / Rep
  const cashierObj = typeof doc.cashier === "object" && doc.cashier !== null ? doc.cashier : null;
  const repName = cashierObj?.name || "Field Sales Rep";

  // Items
  const items = doc.items || [];

  // Payment Method & Cheque
  const paymentMethod = (doc.paymentMethod || "cash").toLowerCase();
  const chequeBank = doc.chequeBank || "-";
  const chequeNo = doc.chequeNo || "-";
  const chequeDate = doc.chequeDate ? new Date(doc.chequeDate).toLocaleDateString("en-GB") : "-";

  // Financial values strictly from backend
  const orderTotal = Number(doc.orderTotal || (doc as any).subtotal || 0);
  const discountVal = Number(doc.discount || 0);
  const grossAfterDiscount = Math.max(0, orderTotal - discountVal);
  const returnTotalVal = Number(doc.returnTotal || 0);
  const baseForDiscount = Math.max(0, orderTotal - returnTotalVal);
  const discountPercentVal =
    typeof (doc as any).discountPercent === "number" && (doc as any).discountPercent > 0
      ? (doc as any).discountPercent
      : baseForDiscount > 0 && discountVal > 0
      ? Math.round((discountVal / baseForDiscount) * 100 * 10) / 10
      : 0;
  const netTotalVal = Number(doc.netTotal || 0);
  const paidAmountVal = Number(doc.paidAmount || 0);
  const dueAmountVal = Number(doc.dueAmount || 0);

  const orderTotalRsCts = splitRsCts(orderTotal);
  const discountRsCts = splitRsCts(discountVal);
  const grossAfterDiscountRsCts = splitRsCts(grossAfterDiscount);
  const returnTotalRsCts = splitRsCts(returnTotalVal);
  const netTotalRsCts = splitRsCts(netTotalVal);
  const paidAmountRsCts = splitRsCts(paidAmountVal);
  const dueAmountRsCts = splitRsCts(dueAmountVal);

  const formattedDate = doc.createdAt
    ? new Date(doc.createdAt).toLocaleDateString("en-GB") + " " + new Date(doc.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleDateString("en-GB");

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printInvoice(doc, { isOrder });
    } catch (err: any) {
      Alert.alert("Print Error", err?.message || "Failed to initiate native printing.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsSharing(true);
      await shareInvoicePdf(doc, { isOrder });
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
      console.error("[Share PDF Failed in Preview Modal]", err);
      Alert.alert("Share Error", err?.message || "Failed to share PDF.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        {/* Top Action Bar */}
        <View style={[styles.topBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close Preview">
            <X size={22} color={theme.textPrimary} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={[styles.topBarTitle, { color: theme.textPrimary }]}>
              {isOrder ? "Order Preview (A4)" : "Sales Invoice (A4)"}
            </Text>
            <Text style={[styles.topBarSub, { color: theme.primary }]}>{docNo}</Text>
          </View>

          <View style={styles.actionGroup}>
            <TouchableOpacity
              onPress={handlePrint}
              disabled={isPrinting || isSharing}
              style={[styles.topActionBtn, styles.printBtn]}
              accessibilityLabel="Print Invoice"
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Printer size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.actionBtnText}>Print</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              disabled={isPrinting || isSharing}
              style={[styles.topActionBtn, styles.shareBtn]}
              accessibilityLabel="Share Invoice PDF"
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Share2 size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.actionBtnText}>Share</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable A4 Document Container */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && { maxWidth: 800, alignSelf: "center", width: "100%" }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* A4 Paper Sheet */}
          <View style={styles.paperSheet}>
            {/* Header Section */}
            <View style={styles.headerSec}>
              <View style={styles.brandRow}>
                <Image
                  source={require("../../../assets/logo.png")}
                  style={styles.logoImg}
                  resizeMode="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandTitle}>{documentTitle}</Text>
                  <Text style={styles.brandCompany}>{COMPANY_DETAILS.name}</Text>
                  {isOrder && (
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>
                        STOCK RESERVED ON SERVER • PENDING DELIVERY
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Meta Box */}
              <View style={styles.metaBox}>
                <View style={styles.metaHeader}>
                  <Text style={styles.metaHeaderLabel}>{isOrder ? "Order No :-" : "Invoice No :-"}</Text>
                  <Text style={styles.metaHeaderVal}>{docNo}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.metaVal}>{formattedDate}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Area</Text>
                  <Text style={styles.metaVal}>{tripRoute}</Text>
                </View>
                <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.metaLabel}>Distributor</Text>
                  <Text style={styles.metaVal}>{COMPANY_DETAILS.name}</Text>
                </View>
              </View>
            </View>

            {/* Customer Box */}
            <View style={styles.customerBox}>
              <Text style={styles.customerBoxTitle}>Name & Address of the Customer :-</Text>
              <View style={styles.custRow}>
                <Text style={styles.custLabel}>Name:</Text>
                <Text style={styles.custValue}>{customerName}</Text>
              </View>
              <View style={styles.custRow}>
                <Text style={styles.custLabel}>Address:</Text>
                <Text style={styles.custValue}>{customerAddress}</Text>
              </View>
              <View style={styles.custRow}>
                <Text style={styles.custLabel}>Phone:</Text>
                <Text style={styles.custValue}>{customerPhone}</Text>
              </View>
            </View>

            {/* Items Table */}
            <View style={styles.tableWrap}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { width: "16%" }]}>Item Code</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "left", paddingLeft: 6 }]}>Product</Text>
                <Text style={[styles.th, { width: "20%", textAlign: "right" }]}>Rate (Rs.)</Text>
                <Text style={[styles.th, { width: "12%", textAlign: "center" }]}>Qty</Text>
                <Text style={[styles.th, { width: "24%", textAlign: "right" }]}>Amount (Rs.)</Text>
              </View>

              {/* Table Rows */}
              {items.map((item: any, idx: number) => {
                const code = item.itemCode || "-";
                const name = item.itemName || item.product?.name || "Product";
                const qty = item.quantity || 0;
                const price = item.sellingPrice || item.unitPrice || 0;
                const lineTotal = item.lineTotal || qty * price;

                return (
                  <View key={idx} style={[styles.tableDataRow, idx % 2 === 1 && styles.rowAlt]}>
                    <Text style={[styles.tdCode, { width: "16%" }]}>{code}</Text>
                    <Text style={[styles.tdName, { flex: 1 }]} numberOfLines={2}>{name}</Text>
                    <Text style={[styles.tdNum, { width: "20%" }]}>
                      {Number(price).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.tdQty, { width: "12%" }]}>{qty}</Text>
                    <Text style={[styles.tdLineTotal, { width: "24%" }]}>
                      {Number(lineTotal).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                );
              })}

              {items.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No items fulfilled</Text>
                </View>
              )}
            </View>

            {/* Bottom Split Section: Mode of Payment (Left) & Totals (Right) */}
            <View style={styles.bottomSplit}>
              {/* Payment Side */}
              <View style={styles.paymentCol}>
                <Text style={styles.paymentSectionTitle}>Mode of Payment</Text>
                <View style={styles.modeRow}>
                  <View style={styles.modeCheck}>
                    <View style={styles.checkSquare}>
                      <Text style={styles.checkMark}>{paymentMethod === "cash" ? "✓" : ""}</Text>
                    </View>
                    <Text style={styles.modeText}>Cash</Text>
                  </View>
                  <View style={styles.modeCheck}>
                    <View style={styles.checkSquare}>
                      <Text style={styles.checkMark}>{paymentMethod === "credit" ? "✓" : ""}</Text>
                    </View>
                    <Text style={styles.modeText}>Credit</Text>
                  </View>
                  <View style={styles.modeCheck}>
                    <View style={styles.checkSquare}>
                      <Text style={styles.checkMark}>{paymentMethod === "cheque" ? "✓" : ""}</Text>
                    </View>
                    <Text style={styles.modeText}>Cheque</Text>
                  </View>
                </View>

                <View style={styles.chequeDetails}>
                  <View style={styles.chequeRow}>
                    <Text style={styles.chequeLabel}>Bank:</Text>
                    <Text style={styles.chequeVal}>{paymentMethod === "cheque" ? chequeBank : ""}</Text>
                  </View>
                  <View style={styles.chequeRow}>
                    <Text style={styles.chequeLabel}>Cheque No:</Text>
                    <Text style={[styles.chequeVal, { fontFamily: "monospace" }]}>
                      {paymentMethod === "cheque" ? chequeNo : ""}
                    </Text>
                  </View>
                  <View style={styles.chequeRow}>
                    <Text style={styles.chequeLabel}>Date:</Text>
                    <Text style={styles.chequeVal}>{paymentMethod === "cheque" ? chequeDate : ""}</Text>
                  </View>
                </View>
              </View>

              {/* Totals Side */}
              <View style={styles.totalsCol}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total</Text>
                  <Text style={styles.totalsVal}>{orderTotalRsCts.rs}.{orderTotalRsCts.cts}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Less Discount{discountPercentVal > 0 ? ` (${discountPercentVal}%)` : ""}</Text>
                  <Text style={[styles.totalsVal, { color: Colors.danger }]}>
                    {discountRsCts.rs}.{discountRsCts.cts}
                  </Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Gross Total</Text>
                  <Text style={styles.totalsVal}>{grossAfterDiscountRsCts.rs}.{grossAfterDiscountRsCts.cts}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Market Returns</Text>
                  <Text style={[styles.totalsVal, { color: Colors.danger }]}>
                    {returnTotalRsCts.rs}.{returnTotalRsCts.cts}
                  </Text>
                </View>
                <View style={[styles.totalsRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                  <Text style={styles.grandTotalVal}>{netTotalRsCts.rs}.{netTotalRsCts.cts}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Paid Amount</Text>
                  <Text style={[styles.totalsVal, { color: Colors.success }]}>
                    {paidAmountRsCts.rs}.{paidAmountRsCts.cts}
                  </Text>
                </View>
                <View style={[styles.totalsRow, styles.dueRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.dueLabel}>DUE BALANCE</Text>
                  <Text style={styles.dueVal}>{dueAmountRsCts.rs}.{dueAmountRsCts.cts}</Text>
                </View>
              </View>
            </View>

            {/* Signatures */}
            <View style={styles.signaturesWrap}>
              <View style={styles.sigCol}>
                <View style={styles.sigDottedLine} />
                <Text style={styles.sigTitle}>Name & Signature of Customer</Text>
              </View>
              <View style={styles.sigCol}>
                <View style={styles.sigDottedLine} />
                <Text style={styles.sigTitle}>Name & Signature of Rep ({repName})</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footerWrap}>
              <Text style={styles.footerCompany}>{COMPANY_DETAILS.name}</Text>
              <Text style={styles.footerAddress}>{COMPANY_DETAILS.address}</Text>
              <Text style={styles.footerContact}>
                Tel: {COMPANY_DETAILS.tel} | Email: {COMPANY_DETAILS.email}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e2e8f0"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    elevation: 3,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  closeBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm
  },
  titleWrap: {
    flex: 1
  },
  topBarTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  topBarSub: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf,
    fontFamily: "monospace"
  },
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  topActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.md
  },
  printBtn: {
    backgroundColor: Colors.leaf
  },
  shareBtn: {
    backgroundColor: Colors.clay
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    padding: Spacing.base
  },
  paperSheet: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#000000",
    padding: 12,
    elevation: 4,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8
  },
  headerSec: {
    flexDirection: "column",
    gap: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 10,
    marginBottom: 10
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  logoImg: {
    width: 60,
    height: 48
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.leaf,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  brandCompany: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.ink,
    marginTop: 1
  },
  orderBadge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#d97706",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 4
  },
  orderBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#92400e"
  },
  metaBox: {
    borderWidth: 1.5,
    borderColor: "#000000",
    width: "100%",
    backgroundColor: "#ffffff"
  },
  metaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000"
  },
  metaHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.ink
  },
  metaHeaderVal: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.danger,
    fontFamily: "monospace"
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000"
  },
  metaLabel: {
    width: "35%",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569",
    borderRightWidth: 1,
    borderRightColor: "#000000"
  },
  metaVal: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10.5,
    fontWeight: "700",
    color: Colors.ink
  },
  customerBox: {
    borderWidth: 1.5,
    borderColor: "#000000",
    padding: 8,
    marginBottom: 10
  },
  customerBoxTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
    color: Colors.leaf,
    marginBottom: 4
  },
  custRow: {
    flexDirection: "row",
    marginBottom: 2
  },
  custLabel: {
    width: 65,
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569"
  },
  custValue: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: "700",
    color: Colors.ink
  },
  tableWrap: {
    borderWidth: 1.5,
    borderColor: "#000000",
    marginBottom: 0
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingVertical: 5,
    paddingHorizontal: 4
  },
  th: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.ink,
    textTransform: "uppercase"
  },
  tableDataRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 5,
    paddingHorizontal: 4
  },
  rowAlt: {
    backgroundColor: "#f8fafc"
  },
  tdCode: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    color: Colors.ink
  },
  tdName: {
    fontSize: 10.5,
    fontWeight: "600",
    color: Colors.ink,
    paddingLeft: 4
  },
  tdNum: {
    fontSize: 10.5,
    fontFamily: "monospace",
    textAlign: "right",
    color: Colors.ink
  },
  tdQty: {
    fontSize: 10.5,
    fontWeight: "700",
    fontFamily: "monospace",
    textAlign: "center",
    color: Colors.ink
  },
  tdLineTotal: {
    fontSize: 10.5,
    fontWeight: "800",
    fontFamily: "monospace",
    textAlign: "right",
    color: Colors.ink
  },
  emptyRow: {
    padding: 12,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 11,
    color: "#64748b",
    fontStyle: "italic"
  },
  bottomSplit: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: "#000000",
    borderTopWidth: 0
  },
  paymentCol: {
    width: "48%",
    borderRightWidth: 1.5,
    borderRightColor: "#000000",
    padding: 6,
    justifyContent: "space-between"
  },
  paymentSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: Colors.leaf,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 2,
    marginBottom: 6
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8
  },
  modeCheck: {
    flexDirection: "row",
    alignItems: "center"
  },
  checkSquare: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4
  },
  checkMark: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000000",
    lineHeight: 12
  },
  modeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.ink
  },
  chequeDetails: {
    gap: 3
  },
  chequeRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  chequeLabel: {
    width: 65,
    fontSize: 9.5,
    fontWeight: "700",
    color: "#475569"
  },
  chequeVal: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: "700",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 1
  },
  totalsCol: {
    width: "52%"
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  totalsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569"
  },
  totalsVal: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    color: Colors.ink
  },
  grandTotalRow: {
    backgroundColor: "#f1f5f9"
  },
  grandTotalLabel: {
    fontSize: 10.5,
    fontWeight: "900",
    color: Colors.leaf
  },
  grandTotalVal: {
    fontSize: 11,
    fontWeight: "900",
    fontFamily: "monospace",
    color: Colors.leaf
  },
  dueRow: {
    backgroundColor: "#fef2f2"
  },
  dueLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: Colors.danger
  },
  dueVal: {
    fontSize: 10.5,
    fontWeight: "900",
    fontFamily: "monospace",
    color: Colors.danger
  },
  signaturesWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 35,
    paddingHorizontal: 10
  },
  sigCol: {
    width: "45%",
    alignItems: "center"
  },
  sigDottedLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    borderStyle: "dashed",
    marginBottom: 4
  },
  sigTitle: {
    fontSize: 9.5,
    fontWeight: "700",
    color: Colors.ink,
    textAlign: "center"
  },
  footerWrap: {
    marginTop: 20,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#000000"
  },
  footerCompany: {
    fontSize: 9.5,
    fontWeight: "900",
    color: Colors.ink,
    textTransform: "uppercase"
  },
  footerAddress: {
    fontSize: 8.5,
    color: "#475569"
  },
  footerContact: {
    fontSize: 8.5,
    color: "#475569"
  }
});

