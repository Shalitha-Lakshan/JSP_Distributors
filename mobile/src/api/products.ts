import { apiClient } from "./client";
import { Category, Product, StockBatch } from "../types";

/**
 * Maps raw batch objects into clean, sanitized StockBatch models.
 */
export const mapRawBatch = (b: any, defaultProductId: string = ""): StockBatch => ({
  _id: String(b._id || b.batchNo),
  batchNo: String(b.batchNo),
  productId: String(b.productId?._id || b.productId || defaultProductId),
  billingPrice: Number(b.billingPrice || 0),
  sellingPrice: Number(b.sellingPrice || 0),
  quantity: Number(b.quantity || 0),
  remainingQty: Number(b.remainingQty !== undefined ? b.remainingQty : b.quantity || 0),
  expiryDate: b.expiryDate,
  receivedDate: b.receivedDate || b.createdAt || new Date().toISOString(),
  createdAt: b.createdAt
});

/**
 * Defensive normalizer for product pricing.
 * Ensures currentBillingPrice and customerBillingPrice are parsed as positive numbers.
 * Resolves across currentBillingPrice, customerBillingPrice, and billingPrice.
 * Preserves active FIFO batches and price range indicators.
 */
export const normalizeProductPrice = (p: any): Product => {
  const rawBilling =
    p.currentBillingPrice !== undefined
      ? p.currentBillingPrice
      : p.customerBillingPrice !== undefined
      ? p.customerBillingPrice
      : p.billingPrice;
  const numBilling = Number(rawBilling);
  const safeBillingPrice = !isNaN(numBilling) && numBilling >= 0 ? numBilling : 0;

  const rawSelling =
    p.currentSellingPrice !== undefined ? p.currentSellingPrice : p.sellingPrice;
  const numSelling = Number(rawSelling);
  const safeSellingPrice = !isNaN(numSelling) && numSelling >= 0 ? numSelling : 0;

  const batches: StockBatch[] = Array.isArray(p.batches)
    ? p.batches.map((b: any) => mapRawBatch(b, p._id))
    : [];

  const activeBatches = batches.filter((b) => Number(b.remainingQty || 0) > 0);
  const batchPrices = activeBatches.map((b) => Number(b.billingPrice));
  const minBillingPrice = batchPrices.length > 0 ? Math.min(...batchPrices) : safeBillingPrice;
  const maxBillingPrice = batchPrices.length > 0 ? Math.max(...batchPrices) : safeBillingPrice;
  const hasMultiplePrices = activeBatches.length > 1 && minBillingPrice !== maxBillingPrice;

  return {
    ...p,
    currentBillingPrice: safeBillingPrice,
    customerBillingPrice: safeBillingPrice,
    currentSellingPrice: safeSellingPrice,
    batches,
    minBillingPrice,
    maxBillingPrice,
    hasMultiplePrices
  };
};

/**
 * Fetch all products available for sales representatives.
 * Attaches real active warehouse FIFO batches so the mobile app always has
 * authoritative batch data regardless of whether backend is local or Render.
 */
export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const [prodRes, batchesRes] = await Promise.all([
      apiClient.get<Product[]>("/api/products"),
      apiClient.get<any[]>("/api/stock/batches").catch(() => ({ data: [] }))
    ]);

    const rawProducts = Array.isArray(prodRes.data) ? prodRes.data : [];
    const rawBatches = Array.isArray(batchesRes.data) ? batchesRes.data : [];

    // Group batches by productId
    const batchMap = new Map<string, StockBatch[]>();
    rawBatches.forEach((b: any) => {
      const pId = String(b.productId?._id || b.productId || "");
      if (!pId) return;
      if (!batchMap.has(pId)) batchMap.set(pId, []);
      batchMap.get(pId)!.push(mapRawBatch(b, pId));
    });

    return rawProducts.map((p) => {
      const pBatches =
        Array.isArray(p.batches) && p.batches.length > 0
          ? p.batches.map((b: any) => mapRawBatch(b, p._id))
          : batchMap.get(String(p._id)) || [];

      return normalizeProductPrice({ ...p, batches: pBatches });
    });
  } catch (err) {
    console.error("[Mobile API] Failed to fetch products:", err);
    return [];
  }
};

/**
 * Fetch stock batches for a single product from authoritative backend endpoint.
 * Parity with Web POS: GET /api/stock/product/:productId
 */
export const fetchBatchesForProduct = async (productId: string): Promise<StockBatch[]> => {
  try {
    const response = await apiClient.get<any[]>(`/api/stock/product/${productId}`);
    return Array.isArray(response.data)
      ? response.data.map((b) => mapRawBatch(b, productId))
      : [];
  } catch (err) {
    console.warn(`[Mobile API] Failed to fetch batches for product ${productId}:`, err);
    return [];
  }
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
 * Search products via backend endpoint with batch attachment.
 */
export const searchProducts = async (query: string): Promise<Product[]> => {
  if (!query.trim()) return [];
  try {
    const [prodRes, batchesRes] = await Promise.all([
      apiClient.get<Product[]>("/api/products/search", { params: { q: query.trim() } }),
      apiClient.get<any[]>("/api/stock/batches").catch(() => ({ data: [] }))
    ]);

    const rawProducts = Array.isArray(prodRes.data) ? prodRes.data : [];
    const rawBatches = Array.isArray(batchesRes.data) ? batchesRes.data : [];

    const batchMap = new Map<string, StockBatch[]>();
    rawBatches.forEach((b: any) => {
      const pId = String(b.productId?._id || b.productId || "");
      if (!pId) return;
      if (!batchMap.has(pId)) batchMap.set(pId, []);
      batchMap.get(pId)!.push(mapRawBatch(b, pId));
    });

    return rawProducts.map((p) => {
      const pBatches =
        Array.isArray(p.batches) && p.batches.length > 0
          ? p.batches.map((b: any) => mapRawBatch(b, p._id))
          : batchMap.get(String(p._id)) || [];

      return normalizeProductPrice({ ...p, batches: pBatches });
    });
  } catch (err) {
    console.error("[Mobile API] Failed to search products:", err);
    return [];
  }
};

/**
 * Fetch single product details by MongoDB ID with batch attachment.
 */
export const fetchProductById = async (id: string): Promise<Product> => {
  const [prodRes, batchesRes] = await Promise.all([
    apiClient.get<Product>(`/api/products/${id}`),
    fetchBatchesForProduct(id)
  ]);
  const prod = prodRes.data;
  const pBatches =
    Array.isArray(prod.batches) && prod.batches.length > 0
      ? prod.batches.map((b: any) => mapRawBatch(b, id))
      : batchesRes;

  return normalizeProductPrice({ ...prod, batches: pBatches });
};

