import { apiClient } from "./client";
import { Category, Product } from "../types";

/**
 * Fetch all products available for sales representatives.
 * Backend filters active products when role is "rep".
 */
export const fetchProducts = async (): Promise<Product[]> => {
  const response = await apiClient.get<Product[]>("/api/products");
  return response.data;
};

/**
 * Fetch all active categories from the database.
 */
export const fetchCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get<Category[]>("/api/categories", {
    params: { status: "active" }
  });
  return response.data;
};

/**
 * Search products via backend endpoint.
 * Note: Client-side searching across preloaded products provides instant sub-millisecond
 * responsiveness, but this endpoint is also available for backend queries.
 */
export const searchProducts = async (query: string): Promise<Product[]> => {
  if (!query.trim()) return [];
  const response = await apiClient.get<Product[]>("/api/products/search", {
    params: { q: query.trim() }
  });
  return response.data;
};

/**
 * Fetch single product details by MongoDB ID.
 */
export const fetchProductById = async (id: string): Promise<Product> => {
  const response = await apiClient.get<Product>(`/api/products/${id}`);
  return response.data;
};

