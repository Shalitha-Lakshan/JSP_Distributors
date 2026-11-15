import React, { ElementRef, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, Lock, Mail } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { useTripStore } from "../../src/store/tripStore";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { Card } from "../../src/components/common/Card";
import { useResponsive } from "../../src/hooks/useResponsive";
import { API_BASE_URL } from "../../src/api/client";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";

export default function LoginScreen() {
  const router = useRouter();
  const { isTablet } = useResponsive();
  
  // Specific Zustand selectors to prevent unnecessary re-renders on unrelated store updates
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const fetchActiveTrip = useTripStore((state) => state.fetchActiveTrip);

  const passwordInputRef = useRef<ElementRef<typeof TextInput>>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientError, setClientError] = useState("");
  const [slowLoading, setSlowLoading] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => {
        setSlowLoading(true);
      }, 5000);
    } else {
      setSlowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleLogin = async () => {
    Keyboard.dismiss();
    setClientError("");
    clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setClientError("Please enter your email address.");
      return;
    }

    if (!password) {
      setClientError("Please enter your password.");
      return;
    }

    const success = await login(cleanEmail, password);
    if (success) {
      // Check active trip right after login
      await fetchActiveTrip();
      router.replace("/(tabs)");
    }
  };

  const displayError = clientError || error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && { maxWidth: 480, alignSelf: "center", width: "100%" }
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>JSP Distributors</Text>
            <Text style={styles.brandSubtitle}>Sales Representative Portal</Text>
          </View>

          {/* Form Card */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Enter your credentials to access field operations
            </Text>

            {/* Error Alert Banner */}
            {displayError ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={18} color={Colors.danger} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <Input
              label="Email Address"
              required
              placeholder="rep@jspdistributors.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (displayError) {
                  setClientError("");
                  clearError();
                }
              }}
              leftIcon={<Mail size={18} color={Colors.textMuted} />}
            />

            {/* Password Input */}
            <Input
              ref={passwordInputRef}
              label="Password"
              required
              isPassword
              placeholder="Enter your password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (displayError) {
                  setClientError("");
                  clearError();
                }
              }}
              leftIcon={<Lock size={18} color={Colors.textMuted} />}
            />

            {/* Submit Button */}
            <Button
              title="Sign In to Route"
              variant="primary"
              size="lg"
              loading={isLoading}
              onPress={handleLogin}
              style={styles.loginButton}
            />

            {/* Cold Start Notice */}
            {slowLoading && (
              <View style={styles.coldStartNotice}>
                <ActivityIndicator size="small" color={Colors.leaf} style={{ marginRight: 8 }} />
                <Text style={styles.coldStartText}>
                  Connecting to server... If the server is in sleep mode, initial wake-up may take up to 45 seconds.
                </Text>
              </View>
            )}

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                Access is restricted to authorized field representatives. Manager and Admin users should log in via the web application.
              </Text>
            </View>
          </Card>

          {/* Server status indicator footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Connected to: {API_BASE_URL}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.sand
  },
  keyboardView: {
    flex: 1
  },
  // CRITICAL FIX: Removed justifyContent: "center" from scrollContent.
  // Centering on a ScrollView causes Android soft keyboard resizes to calculate
  // negative overflow offsets and shift content violently, dismissing the keyboard.
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginTop: Spacing.md
  },
  logoWrapper: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: Spacing.sm
  },
  logo: {
    width: 54,
    height: 54
  },
  brandTitle: {
    fontSize: Typography.xxl,
    fontWeight: "800",
    color: Colors.ink,
    letterSpacing: 0.2
  },
  brandSubtitle: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  card: {
    padding: Spacing.xl
  },
  cardTitle: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.textPrimary
  },
  cardSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base
  },
  errorText: {
    flex: 1,
    color: "#991b1b",
    fontSize: Typography.sm,
    lineHeight: 18,
    fontWeight: "500"
  },
  loginButton: {
    marginTop: Spacing.sm
  },
  coldStartNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    marginTop: Spacing.sm
  },
  coldStartText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.leafDark,
    lineHeight: 16
  },
  noteBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md
  },
  noteText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    textAlign: "center"
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: "center"
  },
  footerText: {
    fontSize: Typography.xs,
    color: Colors.textMuted
  }
});
