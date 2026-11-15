import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react-native";
import { createCustomer } from "../../src/api/customers";
import { CustomerFormData, CustomerForm } from "../../src/components/customers";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { assertOnline } from "../../src/utils/networkGuard";

export default function AddCustomerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (newCustomer) => {
      setIsSubmitting(false);
      // Invalidate customer directory and POS customer selectors
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      Alert.alert(
        "Customer Registered",
        `Successfully created profile for "${newCustomer.name}". The customer is now active and ready for POS sales and order booking.`,
        [
          {
            text: "View Profile",
            onPress: () => {
              router.replace({
                pathname: "/customers/[id]",
                params: { id: newCustomer._id }
              });
            }
          }
        ]
      );
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      Alert.alert(
        "Creation Failed",
        err?.message || "Failed to register customer. Please check your network and try again."
      );
    }
  });

  const handleCreateCustomer = (formData: CustomerFormData) => {
    if (!assertOnline("Customer Registration")) {
      return;
    }

    setIsSubmitting(true);
    createMutation.mutate({
      name: formData.name,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      customerType: formData.customerType
    });
  };

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

        <Text style={styles.headerTitle}>Add New Customer</Text>
        <View style={{ width: 28 }} />
      </View>

      <CustomerForm
        onSubmit={handleCreateCustomer}
        isSubmitting={isSubmitting}
        submitButtonText="Register Customer"
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
  }
});

