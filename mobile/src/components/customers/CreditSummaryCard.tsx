import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AlertTriangle, CheckCircle2, ShieldCheck, Wallet } from "lucide-react-native";
import { Customer } from "../../types";
import { formatLKR } from "../../utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface CreditSummaryCardProps {
  customer: Customer;
}

export const CreditSummaryCard: React.FC<CreditSummaryCardProps> = ({ customer }) => {
  const creditLimit = Number(customer.creditLimit || 0);
  const outstandingBalance = Number(customer.outstandingBalance || 0);
  const availableCredit = Math.max(0, creditLimit - outstandingBalance);
  const isOverLimit = creditLimit > 0 && outstandingBalance > creditLimit;
  const hasDebt = outstandingBalance > 0;

  // Credit utilization percentage (0 to 100)
  const utilizationRatio = creditLimit > 0 ? Math.min(100, Math.round((outstandingBalance / creditLimit) * 100)) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Wallet size={18} color={Colors.leaf} style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Financial & Credit Summary</Text>
        </View>

        {isOverLimit ? (
          <View style={[styles.statusBadge, styles.statusBadgeDanger]}>
            <AlertTriangle size={12} color={Colors.danger} style={{ marginRight: 4 }} />
            <Text style={styles.statusTextDanger}>OVER LIMIT</Text>
          </View>
        ) : hasDebt ? (
          <View style={[styles.statusBadge, styles.statusBadgeWarning]}>
            <Text style={styles.statusTextWarning}>OUTSTANDING</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, styles.statusBadgeClean]}>
            <CheckCircle2 size={12} color={Colors.success} style={{ marginRight: 4 }} />
            <Text style={styles.statusTextClean}>SETTLED</Text>
          </View>
        )}
      </View>

      {/* Primary 3-Metric Grid */}
      <View style={styles.metricsGrid}>
        {/* Outstanding Balance */}
        <View style={[styles.metricBox, styles.metricBoxDanger]}>
          <Text style={styles.metricLabel}>OUTSTANDING BALANCE</Text>
          <Text style={[styles.metricValue, hasDebt ? styles.textDanger : styles.textClean]}>
            {formatLKR(outstandingBalance)}
          </Text>
          <Text style={styles.metricSub}>Authoritative Ledger</Text>
        </View>

        {/* Credit Limit */}
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>CREDIT LIMIT</Text>
          <Text style={styles.metricValue}>
            {creditLimit > 0 ? formatLKR(creditLimit) : "Rs. 0.00"}
          </Text>
          <Text style={styles.metricSub}>
            {creditLimit > 0 ? "Manager Authorized" : "Strict Cash/Prepaid"}
          </Text>
        </View>
      </View>

      {/* Available Credit Banner (if credit customer) */}
      {creditLimit > 0 && (
        <View style={styles.availableSection}>
          <View style={styles.availableRow}>
            <Text style={styles.availableLabel}>Available Credit Remaining</Text>
            <Text style={styles.availableValue}>{formatLKR(availableCredit)}</Text>
          </View>

          {/* Utilization progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${utilizationRatio}%`,
                  backgroundColor:
                    utilizationRatio > 90
                      ? Colors.danger
                      : utilizationRatio > 60
                      ? Colors.warning
                      : Colors.leaf
                }
              ]}
            />
          </View>

          <View style={styles.progressLabels}>
            <Text style={styles.progressSubText}>
              {utilizationRatio}% utilized
            </Text>
            <Text style={styles.progressSubText}>
              Max {formatLKR(creditLimit)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full
  },
  statusBadgeClean: {
    backgroundColor: Colors.successLight
  },
  statusTextClean: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.success
  },
  statusBadgeWarning: {
    backgroundColor: Colors.warningLight
  },
  statusTextWarning: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.warning
  },
  statusBadgeDanger: {
    backgroundColor: Colors.dangerLight
  },
  statusTextDanger: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.danger
  },
  metricsGrid: {
    flexDirection: "row",
    gap: Spacing.sm
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  metricBoxDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.04)",
    borderColor: "rgba(239, 68, 68, 0.15)"
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4
  },
  metricValue: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  textDanger: {
    color: Colors.danger
  },
  textClean: {
    color: Colors.success
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  availableSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  availableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  availableLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: "600"
  },
  availableValue: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.leaf
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceSubtle,
    overflow: "hidden"
  },
  progressBar: {
    height: "100%",
    borderRadius: 3
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },
  progressSubText: {
    fontSize: 10,
    color: Colors.textMuted
  }
});

