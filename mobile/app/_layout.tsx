import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/authStore";
import { Colors, ThemeProvider, useAppTheme } from "../src/theme/colors";
import { NetworkStatusBanner } from "../src/components/common/NetworkStatusBanner";
import { networkService } from "../src/services/networkService";

// Create TanStack Query client with safe defaults (no retries on mutations, 5-minute cache)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: false // Avoid automatic retries on transactional mutations
    }
  }
});

function ThemedAppContent() {
  const { theme, isDark } = useAppTheme();
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Hook into network reconnection to refresh queries safely
  useEffect(() => {
    const unsubscribe = networkService.onReconnect(() => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["trip"] });
    });

    return unsubscribe;
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={["top"]} style={[styles.bannerContainer, { backgroundColor: theme.surface }]}>
          <NetworkStatusBanner />
        </SafeAreaView>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.surface
            },
            headerTintColor: theme.textPrimary,
            headerTitleStyle: {
              fontWeight: "700",
              color: theme.textPrimary
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: theme.background
            }
          }}
        >
            {/* Gatekeeper Route */}
            <Stack.Screen name="index" options={{ headerShown: false }} />

            {/* Authentication Group */}
            <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />

            {/* Bottom Tabs Group */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            {/* Modal / Push Routes */}
            <Stack.Screen
              name="trips/start"
              options={{
                title: "Start Route Trip",
                presentation: "modal",
                headerBackTitle: "Cancel"
              }}
            />

            {/* POS Cart & Checkout */}
            <Stack.Screen
              name="pos/cart"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />

            {/* Offline Van Orders (Milestone 9.1) */}
            <Stack.Screen
              name="orders/offline"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />

            {/* Customer Management Screens (Milestone 5) */}
            <Stack.Screen
              name="customers/[id]"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            <Stack.Screen
              name="customers/new"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            <Stack.Screen
              name="customers/[id]/edit"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            <Stack.Screen
              name="customers/[id]/ledger"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            <Stack.Screen
              name="customers/[id]/unpaid"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            {/* Payment Collections & Settlement Screens (Milestone 6) */}
            <Stack.Screen
              name="payments/collect"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            <Stack.Screen
              name="payments/index"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            {/* Customer Returns & Trip Expenses (Milestone 7) */}
            <Stack.Screen
              name="returns/index"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            <Stack.Screen
              name="expenses/index"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            {/* Daily Shift Closing & Trip History (Milestone 8) */}
            <Stack.Screen
              name="daily-closing/index"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
            <Stack.Screen
              name="trips/history"
              options={{
                headerShown: false,
                presentation: "card"
              }}
            />
          </Stack>
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedAppContent />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  bannerContainer: {
    backgroundColor: Colors.surface,
    zIndex: 999
  }
});
