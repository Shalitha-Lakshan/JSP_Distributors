import { create } from "zustand";
import { apiClient, onUnauthorized } from "../api/client";
import { secureStorage } from "../services/secureStore";
import { cacheManager } from "../database/cacheManager";
import { AuthResponse, User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitializing: boolean;
  isOfflineReadOnly: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setOfflineReadOnly: (isOffline: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for 401s from the API client to auto-logout
  onUnauthorized(() => {
    set({
      user: null,
      token: null,
      isOfflineReadOnly: false,
      error: "Your session has expired. Please log in again."
    });
  });

  return {
    user: null,
    token: null,
    isLoading: false,
    isInitializing: true,
    isOfflineReadOnly: false,
    error: null,

    login: async (email: string, password: string): Promise<boolean> => {
      set({ isLoading: true, error: null });

      try {
        const response = await apiClient.post<AuthResponse>("/api/auth/login", {
          email: email.trim().toLowerCase(),
          password
        });

        const { token, user } = response.data;

        // Security requirement: Sales Rep mobile app only permits approved, active reps!
        if (user.role !== "rep") {
          const roleName = user.role.toUpperCase();
          const errMessage = `Access restricted. Your account has the "${roleName}" role. Please use the JSP Distributors Web Management Portal.`;
          set({ isLoading: false, error: errMessage });
          return false;
        }

        if (user.approvalStatus !== "approved") {
          const errMessage = "Your account is pending administrator approval. Please contact management.";
          set({ isLoading: false, error: errMessage });
          return false;
        }

        if (user.status !== "active") {
          const errMessage = "Your account is inactive. Please contact administration.";
          set({ isLoading: false, error: errMessage });
          return false;
        }

        // Store credentials securely
        await secureStorage.setToken(token);
        await secureStorage.setUser(user);

        set({
          user,
          token,
          isLoading: false,
          isOfflineReadOnly: false,
          error: null
        });

        return true;
      } catch (err: any) {
        const message = err.message || "Failed to log in. Please check your credentials.";
        set({ isLoading: false, error: message });
        return false;
      }
    },

    restoreSession: async (): Promise<boolean> => {
      set({ isInitializing: true });

      try {
        const token = await secureStorage.getToken();
        if (!token) {
          set({ user: null, token: null, isInitializing: false, isOfflineReadOnly: false });
          return false;
        }

        // Try to verify token against /api/auth/me
        try {
          const response = await apiClient.get<{ user: any }>("/api/auth/me");
          const rawUser = response.data.user;

          if (!rawUser) {
            await secureStorage.clearAll();
            set({ user: null, token: null, isInitializing: false, isOfflineReadOnly: false });
            return false;
          }

          const normalizedUser: User = {
            id: rawUser._id || rawUser.id,
            name: rawUser.name,
            email: rawUser.email,
            phone: rawUser.phone,
            role: rawUser.role,
            approvalStatus: rawUser.approvalStatus || "approved",
            status: rawUser.status || "active"
          };

          // Guard: ensure user is still an active approved rep
          if (
            normalizedUser.role !== "rep" ||
            normalizedUser.approvalStatus !== "approved" ||
            normalizedUser.status !== "active"
          ) {
            await secureStorage.clearAll();
            set({
              user: null,
              token: null,
              isInitializing: false,
              isOfflineReadOnly: false,
              error: "Your account is no longer authorized for field sales access."
            });
            return false;
          }

          await secureStorage.setUser(normalizedUser);
          set({ user: normalizedUser, token, isInitializing: false, isOfflineReadOnly: false });
          return true;
        } catch (apiErr: any) {
          // If status is 401 Unauthorized, token is definitely expired/invalid
          if (apiErr.status === 401) {
            await secureStorage.clearAll();
            set({
              user: null,
              token: null,
              isInitializing: false,
              isOfflineReadOnly: false,
              error: "Your session has expired. Please log in again."
            });
            return false;
          }

          // Network or server unreachable: allow offline read-only restoration if user profile is cached!
          const cachedUser = await secureStorage.getUser<User>();
          if (cachedUser && cachedUser.id) {
            set({
              user: cachedUser,
              token,
              isInitializing: false,
              isOfflineReadOnly: true,
              error: null
            });
            return true;
          }

          // No cached user profile available
          await secureStorage.clearAll();
          set({ user: null, token: null, isInitializing: false, isOfflineReadOnly: false });
          return false;
        }
      } catch {
        set({ user: null, token: null, isInitializing: false, isOfflineReadOnly: false });
        return false;
      }
    },

    logout: async () => {
      const currentUser = get().user;
      if (currentUser?.id) {
        // Enforce account isolation by clearing this user's SQLite cached records
        try {
          await cacheManager.clearUserCache(currentUser.id);
        } catch (err) {
          console.warn("Error clearing user offline cache during logout:", err);
        }
      }

      await secureStorage.clearAll();
      set({ user: null, token: null, error: null, isOfflineReadOnly: false });
    },

    clearError: () => set({ error: null }),
    setOfflineReadOnly: (isOffline: boolean) => set({ isOfflineReadOnly: isOffline })
  };
});
