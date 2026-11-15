import { apiClient } from "./client";
import {
  CreateCustomerInput,
  Customer,
  CustomerLedgerResponse,
  UnpaidInvoice,
  UpdateCustomerInput
} from "../types";

/**
 * Fetch all registered customers.
 */
export const fetchCustomers = async (): Promise<Customer[]> => {
  const response = await apiClient.get<Customer[]>("/api/customers");
  return response.data;
};

/**
 * Fetch a single customer by ID.
 */
export const fetchCustomerById = async (id: string): Promise<Customer> => {
  const response = await apiClient.get<Customer>(`/api/customers/${id}`);
  return response.data;
};

/**
 * Create a new customer profile.
 */
export const createCustomer = async (
  input: CreateCustomerInput
): Promise<Customer> => {
  const response = await apiClient.post<Customer>("/api/customers", input);
  return response.data;
};

/**
 * Update an existing customer profile.
 */
export const updateCustomer = async (
  id: string,
  input: UpdateCustomerInput
): Promise<Customer> => {
  const response = await apiClient.put<Customer>(`/api/customers/${id}`, input);
  return response.data;
};

/**
 * Fetch ledger details for a customer.
 */
export const fetchCustomerLedger = async (
  id: string
): Promise<CustomerLedgerResponse> => {
  const response = await apiClient.get<CustomerLedgerResponse>(
    `/api/customers/${id}/ledger`
  );
  return response.data;
};

/**
 * Fetch unpaid invoices for a customer.
 */
export const fetchUnpaidInvoices = async (
  id: string
): Promise<UnpaidInvoice[]> => {
  const response = await apiClient.get<UnpaidInvoice[]>(
    `/api/customers/${id}/unpaid-invoices`
  );
  return response.data;
};


