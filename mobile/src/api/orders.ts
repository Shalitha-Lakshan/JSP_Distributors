import { apiClient } from "./client";
import { CreateOrderPayload, DeliverOrderPayload, Order, Sale } from "../types";

/**
 * Fetch orders for the current sales rep during their active shift.
 */
export const fetchOrders = async (): Promise<Order[]> => {
  const response = await apiClient.get<Order[]>("/api/orders?mine=true");
  return response.data;
};

/**
 * Book a new van/field order. Stock is reserved on the server without generating an invoice.
 */
export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  const response = await apiClient.post<Order>("/api/orders", payload);
  return response.data;
};

/**
 * Fetch a single order by ID.
 */
export const fetchOrderById = async (id: string): Promise<Order> => {
  const response = await apiClient.get<Order>(`/api/orders/${id}`);
  return response.data;
};

/**
 * Deliver a pending order.
 * Server creates a sale, releases reservation, updates collections, and issues the invoice.
 */
export const deliverOrder = async (
  orderId: string,
  payload: DeliverOrderPayload
): Promise<{ order: Order; sale: Sale }> => {
  const response = await apiClient.post<{ order: Order; sale: Sale }>(
    `/api/orders/${orderId}/deliver`,
    payload
  );
  return response.data;
};

/**
 * Cancel a pending order and release reserved stock.
 */
export const cancelOrder = async (orderId: string): Promise<Order> => {
  const response = await apiClient.patch<Order>(`/api/orders/${orderId}/cancel`);
  return response.data;
};

/**
 * Query an order by its unique client idempotency key (useful for ambiguous network timeout resolution).
 */
export const fetchOrderByIdempotencyKey = async (key: string): Promise<Order | null> => {
  try {
    const response = await apiClient.get<Order>(
      `/api/orders/by-idempotency/${encodeURIComponent(key)}`
    );
    return response.data;
  } catch (err: any) {
    if (err.status === 404) return null;
    throw err;
  }
};

