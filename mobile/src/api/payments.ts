import { apiClient } from "./client";
import { Payment, ReceivePaymentInput } from "../types";

/**
 * Record a payment collection from a customer (cash or cheque),
 * optionally allocated across one or more unpaid invoices.
 */
export const receivePayment = async (
  input: ReceivePaymentInput
): Promise<Payment> => {
  const response = await apiClient.post<Payment>("/api/payments/receive", input);
  return response.data;
};

/**
 * Fetch payments collected.
 * By default for sales reps, returns payments collected during the current active trip session.
 * Passing scope="all" retrieves the rep's entire collection history across trips.
 */
export const fetchPayments = async (
  scope: "trip" | "all" = "trip"
): Promise<Payment[]> => {
  const params: Record<string, string> = {};
  if (scope === "all") {
    params.scope = "all";
  }
  const response = await apiClient.get<Payment[]>("/api/payments", { params });
  return response.data;
};

/**
 * Fetch payment history for a specific customer.
 */
export const fetchPaymentsByCustomer = async (
  customerId: string
): Promise<Payment[]> => {
  const response = await apiClient.get<Payment[]>(
    `/api/payments/customer/${customerId}`
  );
  return response.data;
};

/**
 * Fetch a single payment record by ID with allocations and customer details.
 */
export const fetchPaymentById = async (id: string): Promise<Payment> => {
  const response = await apiClient.get<Payment>(`/api/payments/${id}`);
  return response.data;
};

