import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PackageOpen, X } from "lucide-react-native";
import { cancelOrder } from "../../api/orders";
import { Order } from "../../types";
import { Button } from "../common/Button";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography, useAppTheme } from "../../theme/colors";

interface OrderCancellationModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess?: (cancelledOrder: Order) => void;
}

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export const OrderCancellationModal: React.FC<OrderCancellationModalProps> = ({
  visible,
  order,
  onClose,
  onSuccess
}) => {
  const { theme, isDark } = useAppTheme();
  const { modalMaxWidth } = useResponsive();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const customerName =
    typeof order?.customer === "object"
      ? order.customer?.name
      : "Walk-in Order";

  const totalUnits = (order?.items || []).reduce(
    (sum, it) => sum + (Number(it.quantity) || 0),
    0
  );

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!order?._id) throw new Error("Order ID is missing.");
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        throw new Error("Please provide a reason for cancelling this order.");
      }
      return await cancelOrder(order._id, { reason: trimmedReason });
    },
    onSuccess: (cancelledOrder) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["active-trip"] });

      setReason("");
      setErrorMsg(null);
      onClose();

      if (onSuccess) {
        onSuccess(cancelledOrder);
      }

      Alert.alert(
        "Order Cancelled Successfully",
        `Order ${cancelledOrder.orderNo || order?.orderNo} has been cancelled and its reserved stock has been released back to warehouse batches.`,
        [{ text: "OK" }]
      );
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to cancel order. Please check network and try again.";
      setErrorMsg(msg);
      Alert.alert("Cancellation Failed", msg);
    }
  });

  const handleClose = () => {
    if (cancelMutation.isPending) return;
    setReason("");
    setErrorMsg(null);
    onClose();
  };

  const handleConfirmCancellation = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErrorMsg("Cancellation reason is required.");
      return;
    }
    setErrorMsg(null);
    cancelMutation.mutate();
  };

  if (!visible || !order) return null;

  const isSubmitting = cancelMutation.isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxWidth: modalMaxWidth, backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.dangerLight }]}>
                <AlertTriangle size={24} color={theme.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Cancel Van Order</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Release reserved stock back to warehouse
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              hitSlop={8}
              style={[styles.closeBtn, isSubmitting && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Order Details Summary Box */}
          <View style={[styles.detailsBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.detailKey, { color: theme.textSecondary }]}>Order Number</Text>
              <Text style={[styles.detailVal, { color: theme.primary, fontWeight: "800" }]}>
                {order.orderNo}
              </Text>
            </View>

            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.detailKey, { color: theme.textSecondary }]}>Customer</Text>
              <Text style={[styles.detailVal, { color: theme.textPrimary }]} numberOfLines={1}>
                {customerName}
              </Text>
            </View>

            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.detailKey, { color: theme.textSecondary }]}>Total Units</Text>
              <Text style={[styles.detailVal, { color: theme.textPrimary }]}>
                {totalUnits} {totalUnits === 1 ? "unit" : "units"} ({order.items.length} lines)
              </Text>
            </View>

            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.detailKey, { color: theme.textSecondary }]}>Order Value</Text>
              <Text style={[styles.detailVal, { color: theme.textPrimary, fontWeight: "800" }]}>
                {formatLKR(order.netTotal)}
              </Text>
            </View>
          </View>

          {/* Informational Stock Release Notice */}
          <View style={[styles.noticeBox, { backgroundColor: isDark ? "rgba(15, 118, 110, 0.15)" : theme.primaryLight, borderColor: theme.primary }]}>
            <PackageOpen size={18} color={theme.primary} style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: isDark ? "#5eead4" : theme.primaryDark }]}>
              Reserved quantities will be returned directly to their original FIFO stock batches. No financial transaction or invoice will be generated.
            </Text>
          </View>

          {/* Reason Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
              Reason for Cancellation <Text style={{ color: theme.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  backgroundColor: isDark ? theme.surfaceSubtle : "#ffffff",
                  borderColor: errorMsg ? theme.danger : theme.border,
                  color: theme.textPrimary
                }
              ]}
              placeholder="e.g., Customer cancelled, store was closed, delivery rescheduled..."
              placeholderTextColor={theme.textMuted}
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (errorMsg) setErrorMsg(null);
              }}
              multiline
              numberOfLines={3}
              editable={!isSubmitting}
              maxLength={200}
            />
            {errorMsg ? (
              <Text style={[styles.errorText, { color: theme.danger }]}>{errorMsg}</Text>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Button
              title="Keep Order"
              variant="secondary"
              size="md"
              onPress={handleClose}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            />

            <Button
              title="Confirm Cancellation"
              variant="danger"
              size="md"
              loading={isSubmitting}
              disabled={isSubmitting || !reason.trim()}
              onPress={handleConfirmCancellation}
              style={{ flex: 1 }}
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
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.base
  },
  card: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm
  },
  title: {
    fontSize: Typography.base,
    fontWeight: "800"
  },
  subtitle: {
    fontSize: Typography.xs,
    marginTop: 1
  },
  closeBtn: {
    padding: Spacing.xs
  },
  detailsBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1
  },
  detailKey: {
    fontSize: Typography.xs,
    fontWeight: "600"
  },
  detailVal: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md
  },
  noticeText: {
    flex: 1,
    fontSize: Typography.xs - 0.5,
    lineHeight: 16,
    fontWeight: "500"
  },
  inputGroup: {
    marginBottom: Spacing.md
  },
  inputLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    marginBottom: Spacing.xs
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: Typography.xs,
    minHeight: 68,
    textAlignVertical: "top"
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600"
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm
  }
});

