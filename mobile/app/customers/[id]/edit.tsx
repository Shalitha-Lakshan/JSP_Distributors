import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft } from "lucide-react-native";
import { fetchCustomerById, updateCustomer } from "../../../src/api/customers";
import { Customer } from "../../../src/types";
import { CustomerFormData, CustomerForm } from "../../../src/components/customers";
import { BorderRadius, Colors, Spacing, Typography } from "../../../src/theme/colors";
import { assertOnline } from "../../../src/utils/networkGuard";

export default function EditCustomerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customerId = Array.isArray(id) ? id[0] : id;

  const {
    data: customer,
    isLoading,
    isError,
    error
  } = useQuery<Customer>({
    queryKey: ["customer", customerId],
    queryFn: () => fetchCustomerById(customerId!),
    enabled: !!customerId
  });

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormData) =>
      updateCustomer(customerId!, {
        name: data.name,
        phone: data.phone || undefined,
        address: data.address || undefined,
        customerType: data.customerType
      }),
    onSuccess: (updated) => {
      setIsSubmitting(false);
      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });

      Alert.alert(
        "Profile Updated",
        `Successfully updated details for "${updated.name}".`,
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      Alert.alert(
        "Update Failed",
        err?.message || "Failed to update customer details. Please try again."
      );
    }
  });

  const handleUpdate = (formData: CustomerFormData) => {
    if (!assertOnline("Updating Customer")) {
      return;
    }

    setIsSubmitting(true);
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.loadingText}>Loading customer data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !customer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorBox}>
          <AlertCircle size={36} color={Colors.danger} style={{ marginBottom: 8 }} />
          <Text style={styles.errorTitle}>Customer Not Found</Text>
          <Text style={styles.errorMsg}>
            {(error as any)?.message || "Failed to load customer profile for editing."}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color={Colors.textInverse} style={{ marginRight: 6 }} />
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          hitSlop={8}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={Colors.ink} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Edit Customer</Text>
        <View style={{ width: 28 }} />
      </View>

      <CustomerForm
        initialValues={{
          name: customer.name,
          phone: customer.phone || "",
          address: customer.address || "",
          customerType: customer.customerType || "retail"
        }}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
        submitButtonText="Update Customer Profile"
        onCancel={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  headerIconButton: {
    padding: Spacing.xs
  },
  headerTitle: {
    fontSize: Typography.base,
    fontWeight: "800",
    color: Colors.ink
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl
  },
  loadingText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm
  },
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl
  },
  errorTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.danger
  },
  errorMsg: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: Spacing.md
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.leaf,
    borderRadius: BorderRadius.md
  },
  backBtnText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textInverse
  }
});

