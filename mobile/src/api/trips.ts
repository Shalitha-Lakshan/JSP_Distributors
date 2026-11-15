import { apiClient } from "./client";
import { TripSession } from "../types";

export const tripsApi = {
  /**
   * Fetch currently active route trip session for the authenticated sales rep
   */
  getActiveTrip: async (): Promise<TripSession | null> => {
    try {
      const response = await apiClient.get<TripSession | null>("/api/trips/active");
      return response.data || null;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  /**
   * Fetch specific trip session details by ID
   */
  getTripDetails: async (tripId: string): Promise<TripSession> => {
    const response = await apiClient.get<TripSession>(`/api/trips/${tripId}`);
    return response.data;
  },

  /**
   * Add a field road/van expense to the active trip session
   */
  addExpense: async (reason: string, amount: number): Promise<TripSession> => {
    const response = await apiClient.post<TripSession>("/api/trips/active/expenses", {
      reason,
      amount
    });
    return response.data;
  },

  /**
   * Delete an expense by index from the active trip session
   */
  deleteExpense: async (index: number): Promise<TripSession> => {
    const response = await apiClient.delete<TripSession>(`/api/trips/active/expenses/${index}`);
    return response.data;
  },

  /**
   * Submit the active trip session for manager audit with physical counts and optional/mandatory remarks
   */
  submitAudit: async (payload: {
    cash: number;
    cheque: number;
    remarks?: string;
  }): Promise<TripSession> => {
    const response = await apiClient.post<TripSession>("/api/trips/submit-audit", {
      actualCollections: {
        cash: payload.cash,
        cheque: payload.cheque
      },
      remarks: payload.remarks
    });
    return response.data;
  },

  /**
   * Fetch trip sessions history for the authenticated sales rep
   */
  listTrips: async (status?: string): Promise<TripSession[]> => {
    const query = status ? `?status=${status}` : "";
    const response = await apiClient.get<TripSession[]>(`/api/trips${query}`);
    return response.data || [];
  },

  /**
   * Fetch daily closing and reconciliation summary
   */
  getDailyClosing: async (tripId?: string): Promise<any> => {
    const query = tripId ? `?tripId=${tripId}` : "";
    const response = await apiClient.get(`/api/reports/daily-closing${query}`);
    return response.data;
  }
};

