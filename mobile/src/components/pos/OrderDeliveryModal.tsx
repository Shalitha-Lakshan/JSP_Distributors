import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Edit3,
  PackageCheck,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  X
} from "lucide-react-native";
import { deliverOrder } from "../../api/orders";
import { Order, PaymentMethod, ReturnItem, Sale } from "../../types";
import { PaymentMethodPicker } from "./PaymentMethodPicker";
import { InvoiceReceiptModal } from "./InvoiceReceiptModal";
import { MarketReturnModal } from "./MarketReturnModal";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";
import { assertOnline } from "../../utils/networkGuard";

interface OrderDeliveryModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export const OrderDeliveryModal: React.FC<OrderDeliveryModalProps> = ({
  visible,
  order,
  onClose
}) => {
  const { theme, isDark } = useAppTheme();
  const { isTablet, modalMaxWidth } = useResponsive();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidAmountStr, setPaidAmountStr] = useState<string>("0");
  const [discountPercentStr, setDiscountPercentStr] = useState<string>("0");
  const [confirmedSale, setConfirmedSale] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Market Returns State
  const [deliveryReturns, setDeliveryReturns] = useState<ReturnItem[]>([]);
  const [returnsConfirmedOnVan, setReturnsConfirmedOnVan] = useState(false);
  const [marketReturnModalVisible, setMarketReturnModalVisible] = useState(false);
  const [editingReturnIndex, setEditingReturnIndex] = useState<number | null>(null);
  const [editingReturnItem, setEditingReturnItem] = useState<ReturnItem | null>(null);

  // Subtotal and Calculations
  const hasCustomer = !!order?.customer;
  const orderSubtotal = order
    ? order.orderTotal || (order.items || []).reduce((sum, item) => sum + (item.lineTotal || 0), 0)
    : 0;

  const deliveryReturnTotal = deliveryReturns.reduce(
    (sum, item) => sum + (item.returnTotal || (item.quantity * item.returnPrice)),
    0
  );
  const baseTotal = Math.max(0, orderSubtotal - deliveryReturnTotal);

  const discountPercentNum = (() => {
    const n = parseFloat(discountPercentStr);
    if (isNaN(n) || n < 0) return 0;
    if (n > 100) return 100;
    return n;
  })();

  const calculatedDiscountAmount = Math.round((baseTotal * (discountPercentNum / 100)) * 100) / 100;
  const currentNetTotal = Math.max(0, Math.round((baseTotal - calculatedDiscountAmount) * 100) / 100);
  const paidAmount = Number(paidAmountStr || 0);
  const dueAmount = Math.max(0, currentNetTotal - paidAmount);
  const balance = Math.max(0, paidAmount - currentNetTotal);

  // Synchronize payment and state unconditionally whenever order changes or modal opens
  React.useEffect(() => {
    if (order) {
      setPaymentMethod("cash");
      const sub = order.orderTotal || (order.items || []).reduce((s, it) => s + (it.lineTotal || 0), 0);
      const rets = order.returns || [];
      setDeliveryReturns(rets);
      setReturnsConfirmedOnVan(false);

      const retTotal = rets.reduce(
        (sum, item) => sum + (item.returnTotal || (item.quantity * item.returnPrice)),
        0
      );
      const base = Math.max(0, sub - retTotal);

      const initDiscountPercent =
        typeof order.discountPercent === "number" && order.discountPercent >= 0
          ? order.discountPercent
          : order.orderTotal && order.discount
          ? Math.round(((order.discount / order.orderTotal) * 100) * 100) / 100
          : 0;
      setDiscountPercentStr(initDiscountPercent > 0 ? String(initDiscountPercent) : "0");
      const initDiscountAmount = Math.round((base * (initDiscountPercent / 100)) * 100) / 100;
      const initNet = Math.max(0, Math.round((base - initDiscountAmount) * 100) / 100);
      setPaidAmountStr(String(initNet));
      setConfirmedSale(null);
      setIsSubmitting(false);
    }
  }, [order?._id, visible]);

  const handleOpenAddReturn = () => {
    setEditingReturnIndex(null);
    setEditingReturnItem(null);
    setMarketReturnModalVisible(true);
  };

  const handleOpenEditReturn = (index: number, returnItem: ReturnItem) => {
    setEditingReturnIndex(index);
    setEditingReturnItem(returnItem);
    setMarketReturnModalVisible(true);
  };

  const handleRemoveReturn = (index: number) => {
    setDeliveryReturns((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const newRetTotal = updated.reduce(
        (sum, item) => sum + (item.returnTotal || (item.quantity * item.returnPrice)),
        0
      );
      const newBase = Math.max(0, orderSubtotal - newRetTotal);
      const newDiscount = Math.round((newBase * (discountPercentNum / 100)) * 100) / 100;
      const newNet = Math.max(0, Math.round((newBase - newDiscount) * 100) / 100);
      if (paymentMethod === "cash") {
        setPaidAmountStr(String(newNet));
      }
      return updated;
    });
  };

  const handleSaveReturn = (returnItem: ReturnItem) => {
    setDeliveryReturns((prev) => {
      let updated: ReturnItem[];
      if (editingReturnIndex !== null && editingReturnIndex >= 0) {
        updated = [...prev];
        updated[editingReturnIndex] = returnItem;
      } else {
        updated = [...prev, returnItem];
      }
      const newRetTotal = updated.reduce(
        (sum, item) => sum + (item.returnTotal || (item.quantity * item.returnPrice)),
        0
      );
      const newBase = Math.max(0, orderSubtotal - newRetTotal);
      const newDiscount = Math.round((newBase * (discountPercentNum / 100)) * 100) / 100;
      const newNet = Math.max(0, Math.round((newBase - newDiscount) * 100) / 100);
      if (paymentMethod === "cash") {
        setPaidAmountStr(String(newNet));
      }
      return updated;
    });
    setMarketReturnModalVisible(false);
    setEditingReturnIndex(null);
    setEditingReturnItem(null);
  };

  const handleDiscountPercentChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setDiscountPercentStr(normalized);

    const n = parseFloat(normalized);
    const validPercent = isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
    const newDiscount = Math.round((baseTotal * (validPercent / 100)) * 100) / 100;
    const newNet = Math.max(0, Math.round((baseTotal - newDiscount) * 100) / 100);

    if (paymentMethod === "cash") {
      setPaidAmountStr(String(newNet));
    }
  };

  const deliveryMutation = useMutation({
    mutationFn: async () => {
      if (!order) {
        throw new Error("No order selected for delivery.");
      }
      return await deliverOrder(order._id, {
        paymentMethod,
        paidAmount: Number(paidAmountStr || 0),
        discount: calculatedDiscountAmount,
        discountPercent: discountPercentNum,
        returns: deliveryReturns
      });
    },
    onSuccess: (data) => {
      setIsSubmitting(false);
      setConfirmedSale(data.sale);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["daily-closing"] });
      queryClient.invalidateQueries({ queryKey: ["active-trip"] });
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      Alert.alert("Delivery Error", err?.message || "Failed to confirm order delivery.");
    }
  });

  const handleConfirmDelivery = () => {
    if (!order) return;

    if (!assertOnline("Order Delivery")) {
      return;
    }

    if (!hasCustomer && paymentMethod === "credit") {
      Alert.alert("Credit Prohibited", "Walk-in orders cannot be billed on credit. A registered customer is required.");
      return;
    }

    if (!hasCustomer && paidAmount < currentNetTotal) {
      Alert.alert("Payment Required", "Walk-in orders must be paid in full at time of delivery.");
      return;
    }

    if (deliveryReturns.length > 0 && !returnsConfirmedOnVan) {
      Alert.alert(
        "Physical Return Confirmation Required",
        "Please confirm that you have physically received and inspected the returned items on the van before completing delivery."
      );
      return;
    }

    Alert.alert(
      "Confirm Order Delivery",
      `Are you ready to deliver order ${order.orderNo} for ${formatLKR(currentNetTotal)} via ${paymentMethod.toUpperCase()}? This will deduct reserved stock and generate an invoice.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Delivery",
          style: "default",
          onPress: () => {
            setIsSubmitting(true);
            deliveryMutation.mutate();
          }
        }
      ]
    );
  };

  // Crucial: Early return occurs AFTER all hooks have executed unconditionally
  if (!order) {
    return null;
  }

  return (
    <>
      <Modal
        visible={visible && !confirmedSale}
        transparent
        animationType={isTablet ? "fade" : "slide"}
        onRequestClose={onClose}
      >
        <View style={[styles.backdrop, isTablet && styles.backdropTablet]}>
          <Pressable style={styles.backdropDismiss} onPress={onClose} />

          <View
            style={[
              styles.sheetContainer,
              { backgroundColor: theme.surface },
              isTablet && {
                width: modalMaxWidth,
                borderRadius: BorderRadius.xl + 4,
                alignSelf: "center",
                marginBottom: Spacing.xl
              }
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Deliver Order</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{order.orderNo} • Reserved Stock Fulfillment</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: theme.surfaceSubtle },
                  pressed && styles.closeBtnPressed
                ]}
              >
                <X size={18} color={theme.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Customer Box */}
              <View style={[styles.customerBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Text style={[styles.boxLabel, { color: theme.textMuted }]}>DELIVERY RECIPIENT</Text>
                <Text style={[styles.customerName, { color: theme.textPrimary }]}>{order.customer?.name || "Walk-in Customer"}</Text>
                {order.customer?.phone ? (
                  <Text style={[styles.customerPhone, { color: theme.textSecondary }]}>{order.customer.phone}</Text>
                ) : null}
              </View>

              {/* Items List */}
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>RESERVED ITEMS</Text>
              <View style={[styles.itemsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {order.items.map((item, idx) => (
                  <View key={idx} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: theme.textPrimary }]}>{item.itemName}</Text>
                      <Text style={[styles.itemCode, { color: theme.textSecondary }]}>{item.itemCode} • Qty: {item.quantity}</Text>
                    </View>
                    <Text style={[styles.itemTotal, { color: theme.textPrimary }]}>{formatLKR(item.lineTotal)}</Text>
                  </View>
                ))}
              </View>

              {/* Confirmed Market Returns Section */}
              <View style={styles.returnsSectionCard}>
                <View style={styles.returnsHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <RotateCcw size={15} color={Colors.clay} style={{ marginRight: 6 }} />
                    <Text style={styles.returnsSectionTitle}>
                      CONFIRMED MARKET RETURNS ({deliveryReturns.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addReturnHeaderBtn}
                    onPress={handleOpenAddReturn}
                    hitSlop={6}
                  >
                    <Plus size={13} color={Colors.clay} style={{ marginRight: 2 }} />
                    <Text style={styles.addReturnHeaderBtnText}>Add Return</Text>
                  </TouchableOpacity>
                </View>

                {deliveryReturns.length === 0 ? (
                  <View style={styles.emptyReturnsBox}>
                    <Text style={styles.emptyReturnsText}>
                      No market returns recorded for this delivery. Tap "+ Add Return" if receiving stock.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.returnsList}>
                    {deliveryReturns.map((ret, idx) => (
                      <View key={`deliv-ret-${idx}`} style={styles.returnItemRow}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <View style={styles.returnMetaRow}>
                            <View style={styles.returnCodeBadge}>
                              <Text style={styles.returnCodeText}>{ret.itemCode}</Text>
                            </View>
                            <Badge
                              label={(ret.condition || "resellable").toUpperCase()}
                              variant={
                                ret.condition === "resellable"
                                  ? "leaf"
                                  : ret.condition === "damaged"
                                  ? "warning"
                                  : "danger"
                              }
                              size="sm"
                            />
                          </View>
                          <Text style={styles.returnItemName} numberOfLines={1}>
                            {ret.itemName}
                          </Text>
                          <Text style={styles.returnQtyText}>
                            {ret.quantity} units @ {formatLKR(ret.returnPrice)}
                          </Text>
                          {ret.reason ? (
                            <Text style={styles.returnReasonText} numberOfLines={1}>
                              Note: {ret.reason}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.returnRightCol}>
                          <Text style={styles.returnLineTotal}>-{formatLKR(ret.returnTotal)}</Text>
                          <View style={styles.returnActionsRow}>
                            <TouchableOpacity
                              onPress={() => handleOpenEditReturn(idx, ret)}
                              hitSlop={6}
                              style={styles.returnActionBtn}
                              accessibilityLabel="Edit return item"
                            >
                              <Edit3 size={14} color={Colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveReturn(idx)}
                              hitSlop={6}
                              style={[styles.returnActionBtn, { backgroundColor: Colors.dangerLight }]}
                              accessibilityLabel="Remove return item"
                            >
                              <Trash2 size={14} color={Colors.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}

                    <View style={styles.returnsTotalRow}>
                      <Text style={styles.returnsTotalLabel}>Returns Value Deducted</Text>
                      <Text style={styles.returnsTotalVal}>-{formatLKR(deliveryReturnTotal)}</Text>
                    </View>

                    {/* Physical Receipt Confirmation Checkbox */}
                    <Pressable
                      style={styles.checkboxRow}
                      onPress={() => setReturnsConfirmedOnVan((prev) => !prev)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: returnsConfirmedOnVan }}
                    >
                      {returnsConfirmedOnVan ? (
                        <CheckSquare size={20} color={Colors.leaf} style={{ marginRight: 8 }} />
                      ) : (
                        <Square size={20} color={Colors.textMuted} style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.checkboxText}>
                        I confirm that these returned items have been physically received and inspected on the van.
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Financial Summary & Percentage Discount */}
              <Text style={styles.sectionHeading}>FINANCIAL SUMMARY</Text>
              <View style={styles.calcCard}>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Order Subtotal</Text>
                  <Text style={styles.calcVal}>{formatLKR(orderSubtotal)}</Text>
                </View>

                {deliveryReturnTotal > 0 && (
                  <>
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { color: Colors.clay, fontWeight: "600" }]}>
                        Market Returns Deduction
                      </Text>
                      <Text style={[styles.calcVal, { color: Colors.clay, fontWeight: "700" }]}>
                        -{formatLKR(deliveryReturnTotal)}
                      </Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { fontWeight: "600", color: Colors.ink }]}>
                        Adjusted Base Total
                      </Text>
                      <Text style={[styles.calcVal, { fontWeight: "700", color: Colors.ink }]}>
                        {formatLKR(baseTotal)}
                      </Text>
                    </View>
                  </>
                )}

                {/* Editable Percentage Discount Input */}
                <View style={[styles.calcRow, { alignItems: "center" }]}>
                  <View style={{ flex: 1, marginRight: Spacing.xs }}>
                    <Text style={styles.calcLabel}>Discount (%)</Text>
                    <Text style={styles.calcSubText}>
                      {calculatedDiscountAmount > 0
                        ? `Amount: -${formatLKR(calculatedDiscountAmount)}`
                        : "0% - 100%"}
                    </Text>
                  </View>
                  <View style={styles.discountPercentInputWrap}>
                    <TextInput
                      style={styles.discountInput}
                      keyboardType="decimal-pad"
                      value={discountPercentStr}
                      placeholder="0"
                      placeholderTextColor={Colors.textMuted}
                      onChangeText={handleDiscountPercentChange}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                </View>

                {calculatedDiscountAmount > 0 && (
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: Colors.danger }]}>Calculated Discount</Text>
                    <Text style={[styles.calcVal, { color: Colors.danger, fontWeight: "700" }]}>
                      -{formatLKR(calculatedDiscountAmount)}
                    </Text>
                  </View>
                )}

                <View style={[styles.calcRow, styles.netRow]}>
                  <Text style={styles.netLabel}>FINAL NET TOTAL</Text>
                  <Text style={styles.netVal}>{formatLKR(currentNetTotal)}</Text>
                </View>
              </View>

              {/* Payment Section */}
              <Text style={styles.sectionHeading}>COLLECTION & PAYMENT METHOD</Text>
              <PaymentMethodPicker
                selected={paymentMethod}
                onSelect={(m) => {
                  setPaymentMethod(m);
                  if (m === "credit") {
                    setPaidAmountStr("0");
                  } else {
                    setPaidAmountStr(String(currentNetTotal));
                  }
                }}
                allowCredit={hasCustomer}
                style={{ marginBottom: Spacing.md }}
              />

              {/* Paid Amount Input */}
              <View style={styles.paidInputCard}>
                <View style={styles.paidInputRow}>
                  <Text style={styles.paidInputLabel}>Amount Collected (LKR)</Text>
                  <TextInput
                    style={styles.paidInput}
                    keyboardType="numeric"
                    value={paidAmountStr}
                    onChangeText={setPaidAmountStr}
                    placeholder="0.00"
                  />
                </View>

                {dueAmount > 0 && (
                  <View style={styles.dueAlert}>
                    <AlertTriangle size={14} color="#b45309" style={{ marginRight: 6 }} />
                    <Text style={styles.dueText}>
                      Due Balance: {formatLKR(dueAmount)} will be billed to customer's account.
                    </Text>
                  </View>
                )}

                {balance > 0 && (
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Change to Return:</Text>
                    <Text style={styles.balanceValue}>{formatLKR(balance)}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Button
                title={isSubmitting ? "Delivering Order..." : `Confirm & Bill ${formatLKR(currentNetTotal)}`}
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                onPress={handleConfirmDelivery}
                style={{ width: "100%" }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Invoice Receipt Confirmation Modal */}
      <InvoiceReceiptModal
        visible={!!confirmedSale}
        sale={confirmedSale}
        onClose={() => {
          setConfirmedSale(null);
          onClose();
        }}
      />

      {/* Market Return Modal for Delivery */}
      <MarketReturnModal
        visible={marketReturnModalVisible}
        initialReturn={editingReturnItem}
        onClose={() => {
          setMarketReturnModalVisible(false);
          setEditingReturnIndex(null);
          setEditingReturnItem(null);
        }}
        onSave={handleSaveReturn}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end"
  },
  backdropTablet: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg
  },
  backdropDismiss: {
    flex: 1
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl + 4,
    borderTopRightRadius: BorderRadius.xl + 4,
    maxHeight: "88%",
    paddingBottom: Spacing.xl
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink
  },
  subtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center"
  },
  closeBtnPressed: {
    backgroundColor: Colors.slatewash
  },
  scrollContent: {
    padding: Spacing.base
  },
  customerBox: {
    backgroundColor: Colors.surfaceSubtle,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  boxLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  customerName: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.ink
  },
  customerPhone: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  sectionHeading: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs + 2
  },
  calcCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3
  },
  calcLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  calcVal: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  discountPercentInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xs,
    width: 90,
    height: 34
  },
  discountInput: {
    flex: 1,
    height: "100%",
    textAlign: "right",
    fontSize: Typography.xs,
    color: Colors.ink,
    paddingVertical: 0,
    paddingHorizontal: 2
  },
  percentSymbol: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textMuted,
    marginLeft: 4
  },
  calcSubText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1
  },
  netRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    paddingTop: Spacing.xs + 2,
    marginTop: Spacing.xs
  },
  netLabel: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  netVal: {
    fontSize: Typography.base,
    fontWeight: "900",
    color: Colors.leaf
  },
  itemsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  itemName: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  itemCode: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  itemTotal: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.leaf
  },
  paidInputCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  paidInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  paidInputLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.ink
  },
  paidInput: {
    width: 120,
    height: 38,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink,
    textAlign: "right"
  },
  dueAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm
  },
  dueText: {
    fontSize: Typography.xs,
    color: "#92400e",
    fontWeight: "600",
    flex: 1
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  balanceLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  balanceValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.success
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  returnsSectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  returnsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm
  },
  returnsSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.clay,
    letterSpacing: 0.5
  },
  addReturnHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: Colors.clay
  },
  addReturnHeaderBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.clay
  },
  emptyReturnsBox: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs
  },
  emptyReturnsText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontStyle: "italic",
    lineHeight: 18
  },
  returnsList: {
    gap: Spacing.sm
  },
  returnItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  returnMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2
  },
  returnCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border
  },
  returnCodeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.ink
  },
  returnItemName: {
    fontSize: Typography.xs + 1,
    fontWeight: "600",
    color: Colors.ink
  },
  returnQtyText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1
  },
  returnReasonText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: "italic",
    marginTop: 1
  },
  returnRightCol: {
    alignItems: "flex-end"
  },
  returnLineTotal: {
    fontSize: Typography.xs + 1,
    fontWeight: "700",
    color: Colors.danger
  },
  returnActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4
  },
  returnActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center"
  },
  returnsTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  returnsTotalLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.clay
  },
  returnsTotalVal: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.danger
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  checkboxText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.ink,
    flex: 1,
    lineHeight: 16
  }
});

