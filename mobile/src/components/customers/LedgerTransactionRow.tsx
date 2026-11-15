import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, FileText, Receipt } from "lucide-react-native";
import { LedgerEntry } from "../../types";
import { formatDateTimeLK, formatLKR } from "../../utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface LedgerTransactionRowProps {
  entry: LedgerEntry;
}

export const LedgerTransactionRow: React.FC<LedgerTransactionRowProps> = ({ entry }) => {
  const isSale = entry.type === "sale";
  const isDebit = (entry.debit || 0) > 0;
  const isCredit = (entry.credit || 0) > 0;

  return (
    <View style={styles.container}>
      <View style={styles.leftColumn}>
        <View
          style={[
            styles.iconWrapper,
            isSale ? styles.iconWrapperDebit : styles.iconWrapperCredit
          ]}
        >
          {isSale ? (
            <ArrowUpRight size={16} color={Colors.clay} />
          ) : (
            <ArrowDownLeft size={16} color={Colors.success} />
          )}
        </View>

        <View style={styles.metaColumn}>
          <View style={styles.refRow}>
            <Text style={styles.refText}>{entry.ref}</Text>
            <View
              style={[
                styles.typeBadge,
                isSale ? styles.typeBadgeDebit : styles.typeBadgeCredit
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  isSale ? styles.typeBadgeTextDebit : styles.typeBadgeTextCredit
                ]}
              >
                {isSale ? "INVOICE / DEBIT" : "PAYMENT / CREDIT"}
              </Text>
            </View>
          </View>

          <Text style={styles.descText} numberOfLines={1}>
            {entry.description}
            {entry.paymentMethod ? ` • ${entry.paymentMethod.toUpperCase()}` : ""}
          </Text>

          <Text style={styles.dateText}>{formatDateTimeLK(entry.date)}</Text>
        </View>
      </View>

      <View style={styles.amountColumn}>
        {isDebit && (
          <Text style={styles.debitAmount}>
            +{formatLKR(entry.debit)}
          </Text>
        )}

        {isCredit && (
          <Text style={styles.creditAmount}>
            -{formatLKR(entry.credit)}
          </Text>
        )}

        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>BAL: </Text>
          <Text
            style={[
              styles.balanceValue,
              entry.balance > 0 ? styles.balanceDebt : styles.balanceZero
            ]}
          >
            {formatLKR(entry.balance)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  leftColumn: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.md
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm
  },
  iconWrapperDebit: {
    backgroundColor: Colors.clayLight
  },
  iconWrapperCredit: {
    backgroundColor: Colors.successLight
  },
  metaColumn: {
    flex: 1
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4
  },
  refText: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "800"
  },
  typeBadgeDebit: {
    backgroundColor: Colors.clayLight
  },
  typeBadgeTextDebit: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.clay
  },
  typeBadgeCredit: {
    backgroundColor: Colors.successLight
  },
  typeBadgeTextCredit: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.success
  },
  descText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2
  },
  dateText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  amountColumn: {
    alignItems: "flex-end",
    minWidth: 100
  },
  debitAmount: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.clay
  },
  creditAmount: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.success
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted
  },
  balanceValue: {
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  balanceDebt: {
    color: Colors.danger
  },
  balanceZero: {
    color: Colors.textSecondary
  }
});
