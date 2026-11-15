import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertCircle, Calendar, Hash, Landmark, ShieldAlert } from "lucide-react-native";
import { Input } from "../common/Input";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

const COMMON_BANKS = [
  "Commercial Bank",
  "Bank of Ceylon",
  "People's Bank",
  "Sampath Bank",
  "HNB",
  "Seylan Bank",
  "NSB",
  "NDB"
];

interface ChequeDetailsFormProps {
  chequeNo: string;
  onChangeChequeNo: (val: string) => void;
  bankName: string;
  onChangeBankName: (val: string) => void;
  chequeDate: string;
  onChangeChequeDate: (val: string) => void;
  chequeNoError?: string | null;
  bankNameError?: string | null;
  chequeDateError?: string | null;
  disabled?: boolean;
}

export const ChequeDetailsForm: React.FC<ChequeDetailsFormProps> = ({
  chequeNo,
  onChangeChequeNo,
  bankName,
  onChangeBankName,
  chequeDate,
  onChangeChequeDate,
  chequeNoError,
  bankNameError,
  chequeDateError,
  disabled = false
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>CHEQUE PARTICULARS</Text>

      {/* Cheque Number */}
      <Input
        label="Cheque Number"
        placeholder="e.g. 642819"
        value={chequeNo}
        onChangeText={onChangeChequeNo}
        error={chequeNoError}
        keyboardType="number-pad"
        required
        disabled={disabled}
        leftIcon={<Hash size={16} color={Colors.textMuted} />}
        style={{ marginBottom: 0 }}
      />

      {/* Bank Name */}
      <Input
        label="Bank & Branch Name"
        placeholder="e.g. Commercial Bank - Matara"
        value={bankName}
        onChangeText={onChangeBankName}
        error={bankNameError}
        required
        disabled={disabled}
        leftIcon={<Landmark size={16} color={Colors.textMuted} />}
        style={{ marginBottom: 0 }}
      />

      {/* Quick Bank Suggestion Pills */}
      <View style={styles.bankPillsWrapper}>
        <Text style={styles.pillsLabel}>Quick Select:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsScroll}
        >
          {COMMON_BANKS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[
                styles.bankPill,
                bankName.startsWith(b) && styles.bankPillSelected
              ]}
              onPress={() => onChangeBankName(b)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.bankPillText,
                  bankName.startsWith(b) && styles.bankPillTextSelected
                ]}
              >
                {b}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Cheque Date */}
      <Input
        label="Cheque Due Date (YYYY-MM-DD)"
        placeholder="YYYY-MM-DD"
        value={chequeDate}
        onChangeText={onChangeChequeDate}
        error={chequeDateError}
        keyboardType="numbers-and-punctuation"
        required
        disabled={disabled}
        leftIcon={<Calendar size={16} color={Colors.textMuted} />}
        style={{ marginBottom: 0 }}
      />

      {/* Clearing Policy Notice */}
      <View style={styles.policyNotice}>
        <ShieldAlert size={16} color={Colors.warning} style={{ marginRight: 6 }} />
        <Text style={styles.policyNoticeText}>
          Cheques are initially marked as <Text style={{ fontWeight: "700" }}>PENDING</Text>.
          Funds clear after Head Office bank deposit reconciliation.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: Spacing.sm
  },
  bankPillsWrapper: {
    marginBottom: Spacing.base,
    marginTop: -Spacing.xs
  },
  pillsLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 4
  },
  pillsScroll: {
    gap: 6
  },
  bankPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border
  },
  bankPillSelected: {
    backgroundColor: Colors.leafLight,
    borderColor: Colors.leaf
  },
  bankPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  bankPillTextSelected: {
    color: Colors.leafDark,
    fontWeight: "700"
  },
  policyNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs
  },
  policyNoticeText: {
    flex: 1,
    fontSize: Typography.xs,
    color: "#92400e",
    lineHeight: 16
  }
});

