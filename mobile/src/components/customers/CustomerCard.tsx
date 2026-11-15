import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle
} from "react-native";
import { ChevronRight, MapPin, Phone, ShieldAlert, Wallet } from "lucide-react-native";
import { Customer } from "../../types";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { formatLKR } from "../../utils/formatters";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface CustomerCardProps {
  customer: Customer;
  onPress: (customer: Customer) => void;
  isOffline?: boolean;
  style?: ViewStyle;
}

const getBadgeVariant = (type: string) => {
  switch (type) {
    case "credit":
      return "warning";
    case "wholesale":
      return "info";
    case "retail":
      return "leaf";
    default:
      return "neutral";
  }
};

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onPress,
  isOffline = false,
  style
}) => {
  const hasDebt = (customer.outstandingBalance || 0) > 0;
  const isCreditOverLimit =
    customer.creditLimit > 0 && customer.outstandingBalance > customer.creditLimit;
  const availableCredit = Math.max(
    0,
    (customer.creditLimit || 0) - (customer.outstandingBalance || 0)
  );

  return (
    <Card style={[styles.card, style]}>
      <TouchableOpacity
        onPress={() => onPress(customer)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${customer.name}`}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.nameContainer}>
            <Text style={styles.customerName} numberOfLines={1}>
              {customer.name}
            </Text>
            {customer.status === "inactive" && (
              <Badge label="INACTIVE" variant="danger" size="sm" style={{ marginTop: 2 }} />
            )}
          </View>

          <View style={styles.headerBadges}>
            <Badge
              label={customer.customerType ? customer.customerType.toUpperCase() : "WALK-IN"}
              variant={getBadgeVariant(customer.customerType)}
              size="sm"
            />
            <ChevronRight size={18} color={Colors.textMuted} style={{ marginLeft: 4 }} />
          </View>
        </View>

        {/* Contact & Location Info */}
        <View style={styles.infoSection}>
          {customer.phone ? (
            <View style={styles.infoRow}>
              <Phone size={13} color={Colors.textMuted} style={styles.infoIcon} />
              <Text style={styles.infoText}>{customer.phone}</Text>
            </View>
          ) : null}

          {customer.address ? (
            <View style={styles.infoRow}>
              <MapPin size={13} color={Colors.textMuted} style={styles.infoIcon} />
              <Text style={styles.infoText} numberOfLines={1}>
                {customer.address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Financial Footer */}
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>CREDIT LIMIT</Text>
            <Text style={styles.footerLimitValue}>
              {customer.creditLimit > 0 ? formatLKR(customer.creditLimit) : "No Limit"}
            </Text>
          </View>

          <View style={[styles.footerItem, { alignItems: "flex-end" }]}>
            <Text style={styles.footerLabel}>
              {isOffline ? "BALANCE AT LAST SYNC" : "OUTSTANDING BALANCE"}
            </Text>
            <View style={styles.balanceRow}>
              {isCreditOverLimit && (
                <ShieldAlert size={14} color={Colors.danger} style={{ marginRight: 4 }} />
              )}
              <Text
                style={[
                  styles.balanceValue,
                  hasDebt ? styles.balanceDanger : styles.balanceClean
                ]}
              >
                {formatLKR(customer.outstandingBalance || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Credit Utilization Bar (if credit customer) */}
        {customer.creditLimit > 0 && (
          <View style={styles.creditStatusRow}>
            <Wallet size={12} color={Colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.availableCreditText}>
              Available Credit:{" "}
              <Text style={{ fontWeight: "700", color: Colors.ink }}>
                {formatLKR(availableCredit)}
              </Text>
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs
  },
  nameContainer: {
    flex: 1,
    marginRight: Spacing.sm
  },
  customerName: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: -0.2
  },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center"
  },
  infoSection: {
    marginVertical: 4
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3
  },
  infoIcon: {
    marginRight: 6
  },
  infoText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  footerItem: {
    flex: 1
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  footerLimitValue: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  balanceValue: {
    fontSize: Typography.sm,
    fontWeight: "800"
  },
  balanceDanger: {
    color: Colors.danger
  },
  balanceClean: {
    color: Colors.success
  },
  creditStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.slatewash
  },
  availableCreditText: {
    fontSize: 10,
    color: Colors.textSecondary
  }
});

