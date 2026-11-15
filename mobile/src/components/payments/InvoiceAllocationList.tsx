import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckSquare,
  FileText,
  Square,
  Wand2,
  XCircle
} from "lucide-react-native";
import { UnpaidInvoice } from "../../types";
import { Badge } from "../common/Badge";
import { formatDateLK, formatLKR } from "../../utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

export interface InvoiceAllocationMap {
  [invoiceId: string]: {
    allocatedAmount: number;
    invoiceNo: string;
    dueAmount: number;
    isSelected: boolean;
  };
}

interface InvoiceAllocationListProps {
  invoices: UnpaidInvoice[];
  allocations: InvoiceAllocationMap;
  onChangeAllocation: (invoiceId: string, amount: number) => void;
  onToggleSelect: (invoiceId: string) => void;
  onAutoAllocateFIFO: () => void;
  onClearAllocations: () => void;
  totalPaymentAmount: number;
  totalAllocated: number;
  disabled?: boolean;
}

export const InvoiceAllocationList: React.FC<InvoiceAllocationListProps> = ({
  invoices,
  allocations,
  onChangeAllocation,
  onToggleSelect,
  onAutoAllocateFIFO,
  onClearAllocations,
  totalPaymentAmount,
  totalAllocated,
  disabled = false
}) => {
  const remainingToAllocate = Math.max(0, totalPaymentAmount - totalAllocated);
  const isOverAllocated = totalAllocated > totalPaymentAmount;

  if (invoices.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Check size={28} color={Colors.success} style={{ marginBottom: 6 }} />
        <Text style={styles.emptyTitle}>Zero Pending Invoices</Text>
        <Text style={styles.emptySub}>
          This customer has no unpaid invoices. Payment can be recorded as general credit settlement.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Row & FIFO Button */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>UNPAID INVOICES ALLOCATION</Text>
          <Text style={styles.sectionSubtitle}>
            Allocate payment to specific credit/partial invoices
          </Text>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.fifoBtn]}
            onPress={onAutoAllocateFIFO}
            disabled={disabled || totalPaymentAmount <= 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Auto allocate FIFO"
          >
            <Wand2 size={13} color={Colors.leafDark} style={{ marginRight: 4 }} />
            <Text style={styles.fifoBtnText}>Auto FIFO</Text>
          </TouchableOpacity>

          {totalAllocated > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.clearBtn]}
              onPress={onClearAllocations}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Allocation Balance Progress Card */}
      <View
        style={[
          styles.allocationStatusCard,
          isOverAllocated && styles.allocationStatusCardDanger
        ]}
      >
        <View style={styles.statusCol}>
          <Text style={styles.statusLabel}>PAYMENT AMOUNT</Text>
          <Text style={styles.statusValue}>{formatLKR(totalPaymentAmount)}</Text>
        </View>

        <View style={styles.statusDivider} />

        <View style={styles.statusCol}>
          <Text style={styles.statusLabel}>ALLOCATED</Text>
          <Text
            style={[
              styles.statusValue,
              isOverAllocated ? styles.textDanger : styles.textClean
            ]}
          >
            {formatLKR(totalAllocated)}
          </Text>
        </View>

        <View style={styles.statusDivider} />

        <View style={styles.statusCol}>
          <Text style={styles.statusLabel}>UNALLOCATED</Text>
          <Text style={styles.statusValue}>{formatLKR(remainingToAllocate)}</Text>
        </View>
      </View>

      {isOverAllocated && (
        <View style={styles.errorAlert}>
          <AlertCircle size={14} color={Colors.danger} style={{ marginRight: 6 }} />
          <Text style={styles.errorAlertText}>
            Allocated total exceeds the payment amount by{" "}
            <Text style={{ fontWeight: "800" }}>
              {formatLKR(totalAllocated - totalPaymentAmount)}
            </Text>
          </Text>
        </View>
      )}

      {/* Invoice Items List */}
      <View style={styles.invoiceList}>
        {invoices.map((inv) => {
          const alloc = allocations[inv._id];
          const isSelected = !!alloc?.isSelected;
          const allocatedAmt = alloc?.allocatedAmount || 0;
          const isOverDue = allocatedAmt > inv.dueAmount;

          return (
            <View
              key={inv._id}
              style={[
                styles.invoiceCard,
                isSelected && styles.invoiceCardSelected,
                isOverDue && styles.invoiceCardError
              ]}
            >
              {/* Card Header */}
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => onToggleSelect(inv._id)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <View style={styles.checkboxWrap}>
                  {isSelected ? (
                    <CheckSquare size={20} color={Colors.leaf} />
                  ) : (
                    <Square size={20} color={Colors.textMuted} />
                  )}
                </View>

                <View style={styles.invoiceMeta}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <FileText size={14} color={Colors.leaf} style={{ marginRight: 4 }} />
                    <Text style={styles.invoiceNoText}>{inv.invoiceNo}</Text>
                  </View>
                  <View style={styles.dateRow}>
                    <Calendar size={11} color={Colors.textMuted} style={{ marginRight: 3 }} />
                    <Text style={styles.dateText}>{formatDateLK(inv.createdAt)}</Text>
                  </View>
                </View>

                <View style={styles.dueGroup}>
                  <Text style={styles.dueLabel}>REMAINING DUE</Text>
                  <Text style={styles.dueValue}>{formatLKR(inv.dueAmount)}</Text>
                </View>
              </TouchableOpacity>

              {/* Allocation Input Row (active when selected) */}
              {isSelected && (
                <View style={styles.allocationRow}>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputPrefix}>Rs.</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={allocatedAmt > 0 ? String(allocatedAmt) : ""}
                      onChangeText={(val) => {
                        const num = Number(val.replace(/[^0-9.]/g, ""));
                        onChangeAllocation(inv._id, isNaN(num) ? 0 : num);
                      }}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                      editable={!disabled}
                      selectTextOnFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.payFullBtn}
                    onPress={() => onChangeAllocation(inv._id, inv.dueAmount)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.payFullText}>Pay Full</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isOverDue && (
                <Text style={styles.itemErrorText}>
                  Cannot allocate more than remaining balance ({formatLKR(inv.dueAmount)})
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6
  },
  sectionSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  actionBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.md
  },
  fifoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.leafLight
  },
  fifoBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.leafDark
  },
  clearBtn: {
    backgroundColor: Colors.surfaceSubtle
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  allocationStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm
  },
  allocationStatusCardDanger: {
    borderColor: Colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.04)"
  },
  statusCol: {
    flex: 1,
    alignItems: "center"
  },
  statusDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border
  },
  statusLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  statusValue: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  textClean: {
    color: Colors.success
  },
  textDanger: {
    color: Colors.danger
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm
  },
  errorAlertText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.danger,
    fontWeight: "600"
  },
  invoiceList: {
    gap: Spacing.xs
  },
  invoiceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  invoiceCardSelected: {
    borderColor: Colors.leaf,
    backgroundColor: "rgba(15, 118, 110, 0.02)"
  },
  invoiceCardError: {
    borderColor: Colors.danger
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center"
  },
  checkboxWrap: {
    marginRight: Spacing.sm
  },
  invoiceMeta: {
    flex: 1
  },
  invoiceNoText: {
    fontSize: Typography.sm,
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
  dueGroup: {
    alignItems: "flex-end"
  },
  dueLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  dueValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.danger,
    marginTop: 1
  },
  allocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    gap: Spacing.sm
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    height: 38
  },
  inputPrefix: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginRight: 4
  },
  amountInput: {
    flex: 1,
    height: "100%",
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  payFullBtn: {
    backgroundColor: Colors.leafLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.md
  },
  payFullText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.leafDark
  },
  itemErrorText: {
    fontSize: 10,
    color: Colors.danger,
    marginTop: 4,
    fontWeight: "600"
  },
  emptyContainer: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    marginBottom: Spacing.base
  },
  emptyTitle: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  emptySub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280
  }
});

