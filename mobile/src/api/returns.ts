import { apiClient } from "./client";
import {
  CustomerReturn,
  CreateCustomerReturnPayload,
  EligibleInvoice
} from "../types";

export interface ReturnFilters {
  customerId?: string;
  condition?: string;
  status?: string;
  invoiceNo?: string;
  startDate?: string;
  endDate?: string;
}

export const returnsApi = {
  /**
   * Fetch customer returns with optional filters
   */
  getReturns: async (filters?: ReturnFilters): Promise<CustomerReturn[]> => {
    const params = new URLSearchParams();
    if (filters?.customerId) params.append("customerId", filters.customerId);
    if (filters?.condition && filters.condition !== "all") params.append("condition", filters.condition);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.invoiceNo) params.append("invoiceNo", filters.invoiceNo);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const response = await apiClient.get<CustomerReturn[]>(`/api/returns${queryStr}`);
    return response.data || [];
  },

  /**
   * Fetch eligible invoices with returnable quantities for a specific customer
   */
  getEligibleInvoices: async (customerId: string): Promise<EligibleInvoice[]> => {
    const response = await apiClient.get<EligibleInvoice[]>(
      `/api/returns/eligible-invoices/${customerId}`
    );
    return response.data || [];
  },

  /**
   * Record an independent customer return
   */
  createCustomerReturn: async (
    payload: CreateCustomerReturnPayload
  ): Promise<CustomerReturn> => {
    const response = await apiClient.post<CustomerReturn>("/api/returns", payload);
    return response.data;
  }
};

