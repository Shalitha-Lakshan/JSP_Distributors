import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Building2, MapPin, Phone, ShieldCheck, User } from "lucide-react-native";
import { CustomerType } from "../../types";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { validateSriLankanPhone } from "../../utils/validation";
import { useResponsive } from "../../hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

export interface CustomerFormData {
  name: string;
  phone: string;
  address: string;
  customerType: CustomerType;
}

interface CustomerFormProps {
  initialValues?: Partial<CustomerFormData>;
  onSubmit: (data: CustomerFormData) => Promise<void> | void;
  isSubmitting: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
  title?: string;
}

const CUSTOMER_TYPES: { type: CustomerType; label: string; desc: string }[] = [
  { type: "retail", label: "Retail Shop", desc: "Standard neighbourhood grocery or supermarket" },
  { type: "wholesale", label: "Wholesale", desc: "Bulk distributor outlet or sub-dealer" },
  { type: "credit", label: "Credit Customer", desc: "Pre-approved merchant with ledger credit facility" },
  { type: "walk-in", label: "Walk-in Counter", desc: "Direct cash counter customer" }
];

export const CustomerForm: React.FC<CustomerFormProps> = ({
  initialValues,
  onSubmit,
  isSubmitting,
  submitButtonText = "Save Customer",
  onCancel,
  title
}) => {
  const { isTablet, contentMaxWidth } = useResponsive();

  const [name, setName] = useState(initialValues?.name || "");
  const [phone, setPhone] = useState(initialValues?.phone || "");
  const [address, setAddress] = useState(initialValues?.address || "");
  const [customerType, setCustomerType] = useState<CustomerType>(
    initialValues?.customerType || "retail"
  );

  // Field validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const validate = (): boolean => {
    let valid = true;

    // Validate Name
    if (!name.trim()) {
      setNameError("Customer name is required.");
      valid = false;
    } else {
      setNameError(null);
    }

    // Validate Phone (optional, but if provided must match Sri Lanka format)
    const phoneCheck = validateSriLankanPhone(phone);
    if (!phoneCheck.isValid) {
      setPhoneError(phoneCheck.error || "Invalid phone number format.");
      valid = false;
    } else {
      setPhoneError(null);
    }

    return valid;
  };

  const handleFormSubmit = () => {
    if (!validate() || isSubmitting) {
      return;
    }

    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      customerType
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: contentMaxWidth ?? 680, alignSelf: "center", width: "100%" }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {title ? <Text style={styles.formTitle}>{title}</Text> : null}

        {/* Basic Info Card */}
        <View style={styles.formCard}>
          <Text style={styles.sectionHeading}>STORE & CONTACT DETAILS</Text>

          <Input
            label="Customer / Store Name"
            placeholder="e.g. Ruwan Grocery & Stores"
            value={name}
            onChangeText={(val) => {
              setName(val);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            required
            leftIcon={<Building2 size={18} color={Colors.textMuted} />}
          />

          <Input
            label="Phone Number"
            placeholder="e.g. 077 123 4567 or 011 234 5678"
            value={phone}
            onChangeText={(val) => {
              setPhone(val);
              if (phoneError) setPhoneError(null);
            }}
            error={phoneError}
            keyboardType="phone-pad"
            leftIcon={<Phone size={18} color={Colors.textMuted} />}
          />

          <Input
            label="Physical Address / Town"
            placeholder="e.g. No. 45, Main Street, Matara"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            leftIcon={<MapPin size={18} color={Colors.textMuted} />}
            style={styles.addressInput}
          />
        </View>

        {/* Customer Type Selection */}
        <View style={styles.formCard}>
          <Text style={styles.sectionHeading}>CUSTOMER CLASSIFICATION</Text>
          <Text style={styles.sectionSub}>
            Determines default pricing rules, payment terms and credit eligibility.
          </Text>

          <View style={styles.typesGrid}>
            {CUSTOMER_TYPES.map((item) => {
              const isSelected = customerType === item.type;

              return (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.typeOptionCard,
                    isSelected && styles.typeOptionSelected
                  ]}
                  onPress={() => setCustomerType(item.type)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.typeOptionHeader}>
                    <Text
                      style={[
                        styles.typeOptionLabel,
                        isSelected && styles.typeOptionLabelSelected
                      ]}
                    >
                      {item.label}
                    </Text>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected
                      ]}
                    >
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </View>
                  <Text style={styles.typeOptionDesc}>{item.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Rep Security Notice */}
        <View style={styles.securityNotice}>
          <ShieldCheck size={16} color={Colors.leaf} style={{ marginRight: 6 }} />
          <Text style={styles.securityNoticeText}>
            Credit limit allocation and financial ledger records are securely managed by Head Office.
          </Text>
        </View>

        {/* Form Action Buttons */}
        <View style={styles.buttonGroup}>
          {onCancel && (
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={isSubmitting}
              style={{ flex: 1, marginRight: Spacing.sm }}
            />
          )}

          <Button
            title={isSubmitting ? "Saving Customer..." : submitButtonText}
            variant="primary"
            onPress={handleFormSubmit}
            disabled={isSubmitting}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  formTitle: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.ink,
    marginBottom: Spacing.base
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4
  },
  sectionSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.md
  },
  addressInput: {
    minHeight: 70,
    textAlignVertical: "top"
  },
  typesGrid: {
    gap: Spacing.sm
  },
  typeOptionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle
  },
  typeOptionSelected: {
    borderColor: Colors.leaf,
    backgroundColor: Colors.leafLight
  },
  typeOptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  typeOptionLabel: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  typeOptionLabelSelected: {
    color: Colors.leafDark
  },
  typeOptionDesc: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 16
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  radioOuterSelected: {
    borderColor: Colors.leaf
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.leaf
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 118, 110, 0.08)",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.base
  },
  securityNoticeText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.leafDark,
    lineHeight: 16
  },
  buttonGroup: {
    flexDirection: "row",
    marginTop: Spacing.xs
  }
});
