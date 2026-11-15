import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { LoadingScreen } from "../src/components/common/LoadingScreen";

export default function IndexGatekeeper() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isInitializing = useAuthStore((state) => state.isInitializing);

  useEffect(() => {
    if (!isInitializing) {
      if (token && user) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isInitializing, token, user, router]);

  return <LoadingScreen message="Connecting to JSP Distributors..." />;
}
