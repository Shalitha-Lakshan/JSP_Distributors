import { apiClient } from "./client";
import {
  CustomerReturn,
  CreateCustomerReturnPayload,
  EligibleInvoice,
  ReturnSummaryMetrics,
  MonthlySupplierSummary
} from "../types";

export interface ReturnFilters {
  customerId?: string;
  condition?: string;
  status?: string;
  invoiceNo?: string;
  startDate?: string;
  endDate?: string;
  tripId?: string;
  handoverStatus?: string;
  inspectionStatus?: string;
  search?: string;
  allReps?: boolean;
}

export interface ReturnSummaryParams {
  period?: "today" | "trip" | "month" | "custom";
  tripId?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
}

export const returnsApi = {
  /**
   * Fetch customer returns with optional filters
   */
  getReturns: async (filters?: ReturnFilters): Promise<CustomerReturn[]> => {
    const params = new URLSearchParams();
    if (filters?.customerId) params.append("customerId", filters.customerId);
    if (filters?.condition && filters.condition !== "all") params.append("condition", filters.condition);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.handoverStatus && filters.handoverStatus !== "all") params.append("handoverStatus", filters.handoverStatus);
    if (filters?.inspectionStatus && filters.inspectionStatus !== "all") params.append("inspectionStatus", filters.inspectionStatus);
    if (filters?.invoiceNo) params.append("invoiceNo", filters.invoiceNo);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.tripId) params.append("tripId", filters.tripId);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.allReps) params.append("allReps", "true");

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const response = await apiClient.get<CustomerReturn[]>(`/api/returns${queryStr}`);
    return response.data || [];
  },

  /**
   * Fetch aggregate return summary metrics
   */
  getReturnsSummary: async (params?: ReturnSummaryParams): Promise<ReturnSummaryMetrics> => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.append("period", params.period);
    if (params?.tripId) searchParams.append("tripId", params.tripId);
    if (params?.startDate) searchParams.append("startDate", params.startDate);
    if (params?.endDate) searchParams.append("endDate", params.endDate);
    if (params?.month) searchParams.append("month", params.month);

    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const response = await apiClient.get<ReturnSummaryMetrics>(`/api/returns/summary${queryStr}`);
    return response.data || {
      collectedUnits: 0,
      totalReturnValue: 0,
      pendingInspectionUnits: 0,
      pendingDispatchUnits: 0,
      dispatchedUnits: 0
    };
  },

  /**
   * Fetch monthly supplier return aggregated summary
   */
  getMonthlySupplierSummary: async (month?: string): Promise<MonthlySupplierSummary> => {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const response = await apiClient.get<MonthlySupplierSummary>(`/api/returns/monthly-supplier-summary${queryStr}`);
    return response.data;
  },

  /**
   * Acknowledge warehouse physical handover
   */
  receiveReturnsAtWarehouse: async (
    id: string,
    payload?: { items?: Array<{ itemCode: string; quantityReceived?: number; handoverNotes?: string }>; handoverNotes?: string }
  ): Promise<{ message: string; returnRecord: CustomerReturn }> => {
    const response = await apiClient.post<{ message: string; returnRecord: CustomerReturn }>(
      `/api/returns/${id}/receive`,
      payload || {}
    );
    return response.data;
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

