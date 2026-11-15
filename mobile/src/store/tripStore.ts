import { create } from "zustand";
import { apiClient } from "../api/client";
import { TripSession } from "../types";
import { useAuthStore } from "./authStore";
import { offlineOrdersRepository } from "../database/repositories/offlineOrdersRepository";

interface TripState {
  activeTrip: TripSession | null;
  isLoading: boolean;
  error: string | null;

  fetchActiveTrip: () => Promise<TripSession | null>;
  startTrip: (route: string) => Promise<boolean>;
  resetTrip: () => void;
  clearError: () => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  activeTrip: null,
  isLoading: false,
  error: null,

  fetchActiveTrip: async (): Promise<TripSession | null> => {
    set({ isLoading: true, error: null });
    const user = useAuthStore.getState().user;

    try {
      const response = await apiClient.get<TripSession | null>("/api/trips/active");
      const trip = response.data || null;

      if (trip && user?.id) {
        // Cache verified active trip snapshot for offline draft creation
        await offlineOrdersRepository.saveCachedActiveTrip(user.id, trip);
      } else if (!trip && user?.id) {
        await offlineOrdersRepository.clearCachedActiveTrip(user.id);
      }

      set({ activeTrip: trip, isLoading: false, error: null });
      return trip;
    } catch (err: any) {
      // 404 means server explicitly confirms no active trip exists
      if (err.status === 404) {
        if (user?.id) {
          await offlineOrdersRepository.clearCachedActiveTrip(user.id);
        }
        set({ activeTrip: null, isLoading: false });
        return null;
      }

      // Network error or offline: recover verified active trip snapshot from SQLite!
      if (user?.id) {
        const cachedTrip = await offlineOrdersRepository.getCachedActiveTrip(user.id);
        if (cachedTrip) {
          set({ activeTrip: cachedTrip, isLoading: false, error: null });
          return cachedTrip;
        }
      }

      set({
        activeTrip: null,
        isLoading: false,
        error: err.message || "Failed to check active trip status."
      });
      return null;
    }
  },

  startTrip: async (route: string): Promise<boolean> => {
    const trimmed = route.trim();
    if (!trimmed) {
      set({ error: "Please select or enter a valid route name." });
      return false;
    }

    set({ isLoading: true, error: null });
    const user = useAuthStore.getState().user;

    try {
      const response = await apiClient.post<TripSession>("/api/trips/start", {
        route: trimmed
      });

      const newTrip = response.data;
      if (user?.id) {
        await offlineOrdersRepository.saveCachedActiveTrip(user.id, newTrip);
      }

      set({ activeTrip: newTrip, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      const message = err.message || "Failed to start trip session.";
      set({ isLoading: false, error: message });
      return false;
    }
  },

  resetTrip: () => {
    const user = useAuthStore.getState().user;
    if (user?.id) {
      offlineOrdersRepository.clearCachedActiveTrip(user.id).catch(() => {});
    }
    set({ activeTrip: null, error: null, isLoading: false });
  },

  clearError: () => set({ error: null })
}));
