import { create } from "zustand";
import { CartItem, Customer, FifoAllocation, PaymentMethod, Product, ReturnItem } from "../types";
import { OfflineOrderDraft } from "../types/offlineOrder";
import { calculateFifoAllocation } from "../utils/fifo";

export type TransactionMode = "sale" | "order";

interface CartState {
  items: CartItem[];
  returns: ReturnItem[];
  selectedCustomer: Customer | null;
  transactionMode: TransactionMode;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  discount: number;
  discountPercent: number;
  editingDraftId: string | null;
  editingDraftIdempotencyKey: string | null;

  // Actions
  addItem: (product: Product, quantity?: number, allocations?: FifoAllocation[]) => boolean;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementQuantity: (productId: string) => boolean;
  decrementQuantity: (productId: string) => void;
  removeItem: (productId: string) => void;
  addReturnItem: (returnItem: ReturnItem) => void;
  updateReturnItem: (index: number, updatedItem: ReturnItem) => void;
  removeReturnItem: (index: number) => void;
  clearReturns: () => void;
  clearCart: () => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  setTransactionMode: (mode: TransactionMode) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaidAmount: (amount: number) => void;
  setDiscount: (discount: number) => void;
  setDiscountPercent: (percent: number) => void;
  syncProductStock: (products: Product[]) => void;
  loadDraftIntoCart: (draft: OfflineOrderDraft, customer?: Customer) => void;

  // Computed Helpers
  getTotalItems: () => number;
  getTotalQuantity: () => number;
  getSubtotal: () => number;
  getReturnTotal: () => number;
  getBaseTotal: () => number;
  getDiscountAmount: () => number;
  getNetTotal: () => number;
  getDueAmount: () => number;
  getBalance: () => number;
  hasStockWarning: () => boolean;
  hasPricingWarning: () => boolean;
  getItemWarning: (productId: string) => string | null;
  validateCheckout: () => {
    valid: boolean;
    invalidItems: { itemCode: string; name: string; quantity: number; totalStock: number }[];
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  returns: [],
  selectedCustomer: null,
  transactionMode: "sale",
  paymentMethod: "cash",
  paidAmount: 0,
  discount: 0,
  discountPercent: 0,
  editingDraftId: null,
  editingDraftIdempotencyKey: null,

  addItem: (product: Product, quantity = 1, customAllocations?: FifoAllocation[]) => {
    const stockAvailable = Number(product.totalStock || 0);

    // Rule 1: Cannot add a product with 0 or negative available stock
    if (stockAvailable <= 0) {
      return false;
    }

    // Rule 2: Validate authoritative Customer Billing Price (missing/invalid blocks adding)
    const rawBillingPrice =
      product.currentBillingPrice !== undefined
        ? product.currentBillingPrice
        : (product as any).customerBillingPrice !== undefined
        ? (product as any).customerBillingPrice
        : (product as any).billingPrice;

    if (
      rawBillingPrice === undefined ||
      rawBillingPrice === null ||
      isNaN(Number(rawBillingPrice)) ||
      Number(rawBillingPrice) <= 0
    ) {
      return false;
    }

    const fallbackBilling = Number(rawBillingPrice);
    const fallbackSelling = Number(product.currentSellingPrice || (product as any).sellingPrice || 0);
    const reqQty = Math.max(1, Math.floor(quantity));
    let success = false;

    set((state) => {
      const existingIndex = state.items.findIndex((item) => item.productId === product._id);

      if (existingIndex > -1) {
        const existingItem = state.items[existingIndex];
        const currentQty = existingItem.quantity;
        const availableToAdd = stockAvailable - currentQty;

        if (availableToAdd <= 0) {
          // Already at maximum available stock
          return state;
        }

        const addQty = Math.min(reqQty, availableToAdd);
        const newQty = currentQty + addQty;
        const mergedBatches = existingItem.batches || product.batches;

        const fifo = calculateFifoAllocation(
          mergedBatches,
          newQty,
          fallbackBilling,
          fallbackSelling
        );

        const updated = [...state.items];
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          billingPrice: fifo.effectiveUnitPrice,
          lineTotal: fifo.lineTotal,
          allocations: fifo.allocations,
          batches: mergedBatches,
          totalStock: stockAvailable,
          isPricingUnavailable: fifo.isPricingUnavailable
        };
        success = true;
        return { items: updated };
      }

      // First time adding to cart: Clamp between 1 and available stock
      const initialQty = Math.min(reqQty, stockAvailable);
      const fifo =
        customAllocations && customAllocations.length > 0 && initialQty === reqQty
          ? {
              allocations: customAllocations,
              lineTotal:
                Math.round(
                  customAllocations.reduce((sum, a) => sum + a.lineTotal, 0) * 100
                ) / 100,
              effectiveUnitPrice:
                initialQty > 0
                  ? Math.round(
                      (customAllocations.reduce((sum, a) => sum + a.lineTotal, 0) / initialQty) * 100
                    ) / 100
                  : fallbackBilling,
              isPricingUnavailable: false
            }
          : calculateFifoAllocation(
              product.batches,
              initialQty,
              fallbackBilling,
              fallbackSelling
            );

      const newItem: CartItem = {
        productId: product._id,
        itemCode: product.itemCode,
        productName: product.productName,
        displayName: product.displayName || product.productName,
        variant: product.variant,
        quantity: initialQty,
        billingPrice: fifo.effectiveUnitPrice,
        sellingPrice: fallbackSelling,
        lineTotal: fifo.lineTotal,
        totalStock: stockAvailable,
        supplier: product.supplier || "Ruhunu Foods",
        batches: product.batches,
        allocations: fifo.allocations,
        isPricingUnavailable: fifo.isPricingUnavailable
      };

      success = true;
      return { items: [...state.items, newItem] };
    });

    return success;
  },

  updateQuantity: (productId: string, quantity: number) => {
    set((state) => {
      return {
        items: state.items.map((item) => {
          if (item.productId !== productId) return item;

          // Clamp quantity strictly between 1 and available warehouse stock (no silent deletion)
          const clampedQty = Math.max(1, Math.min(item.totalStock, Math.floor(quantity)));
          const fifo = calculateFifoAllocation(
            item.batches,
            clampedQty,
            item.billingPrice,
            item.sellingPrice
          );

          return {
            ...item,
            quantity: clampedQty,
            billingPrice: fifo.effectiveUnitPrice,
            lineTotal: fifo.lineTotal,
            allocations: fifo.allocations,
            isPricingUnavailable: fifo.isPricingUnavailable
          };
        })
      };
    });
  },

  incrementQuantity: (productId: string) => {
    let success = false;
    set((state) => ({
      items: state.items.map((item) => {
        if (item.productId !== productId) return item;

        // Block increment if quantity is already at or above available stock
        if (item.quantity >= item.totalStock) {
          return item;
        }

        success = true;
        const newQty = item.quantity + 1;
        const fifo = calculateFifoAllocation(
          item.batches,
          newQty,
          item.billingPrice,
          item.sellingPrice
        );

        return {
          ...item,
          quantity: newQty,
          billingPrice: fifo.effectiveUnitPrice,
          lineTotal: fifo.lineTotal,
          allocations: fifo.allocations,
          isPricingUnavailable: fifo.isPricingUnavailable
        };
      })
    }));
    return success;
  },

  decrementQuantity: (productId: string) => {
    set((state) => {
      const item = state.items.find((i) => i.productId === productId);
      if (!item) return state;

      if (item.quantity <= 1) {
        return { items: state.items.filter((i) => i.productId !== productId) };
      }

      const newQty = item.quantity - 1;
      const fifo = calculateFifoAllocation(
        item.batches,
        newQty,
        item.billingPrice,
        item.sellingPrice
      );

      return {
        items: state.items.map((i) =>
          i.productId === productId
            ? {
                ...i,
                quantity: newQty,
                billingPrice: fifo.effectiveUnitPrice,
                lineTotal: fifo.lineTotal,
                allocations: fifo.allocations,
                isPricingUnavailable: fifo.isPricingUnavailable
              }
            : i
        )
      };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.productId !== productId)
    }));
  },

  addReturnItem: (returnItem: ReturnItem) => {
    set((state) => {
      // Check if item with same productId (or itemCode) and condition already exists
      const existingIdx = state.returns.findIndex(
        (r) =>
          ((r.productId && returnItem.productId && r.productId === returnItem.productId) ||
            r.itemCode === returnItem.itemCode) &&
          (r.condition || "resellable") === (returnItem.condition || "resellable")
      );

      if (existingIdx > -1) {
        const updated = [...state.returns];
        const existing = updated[existingIdx];
        const newQty = existing.quantity + returnItem.quantity;
        const newTotal = newQty * (existing.returnPrice || returnItem.returnPrice);
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          returnTotal: newTotal,
          reason: returnItem.reason || existing.reason
        };
        return { returns: updated };
      }

      const calculatedTotal =
        returnItem.returnTotal || returnItem.quantity * returnItem.returnPrice;
      return {
        returns: [
          ...state.returns,
          {
            ...returnItem,
            returnTotal: calculatedTotal
          }
        ]
      };
    });
  },

  updateReturnItem: (index: number, updatedItem: ReturnItem) => {
    set((state) => {
      if (index < 0 || index >= state.returns.length) return state;
      const updated = [...state.returns];
      const calculatedTotal =
        updatedItem.returnTotal || updatedItem.quantity * updatedItem.returnPrice;
      updated[index] = {
        ...updatedItem,
        returnTotal: calculatedTotal
      };
      return { returns: updated };
    });
  },

  removeReturnItem: (index: number) => {
    set((state) => ({
      returns: state.returns.filter((_, idx) => idx !== index)
    }));
  },

  clearReturns: () => {
    set({ returns: [] });
  },

  syncProductStock: (products: Product[]) => {
    set((state) => {
      const productMap = new Map(products.map((p) => [p._id, p]));
      return {
        items: state.items.map((item) => {
          const latestProduct = productMap.get(item.productId);
          if (latestProduct) {
            const latestStock = Number(latestProduct.totalStock || 0);
            const latestBatches =
              Array.isArray(latestProduct.batches) && latestProduct.batches.length > 0
                ? latestProduct.batches
                : item.batches;
            const clampedQty = Math.max(1, Math.min(latestStock, item.quantity));
            const fifo = calculateFifoAllocation(
              latestBatches,
              clampedQty,
              latestProduct.currentBillingPrice || item.billingPrice,
              latestProduct.currentSellingPrice || item.sellingPrice
            );
            return {
              ...item,
              totalStock: latestStock,
              batches: latestBatches,
              quantity: clampedQty,
              billingPrice: fifo.effectiveUnitPrice,
              lineTotal: fifo.lineTotal,
              allocations: fifo.allocations,
              isPricingUnavailable: fifo.isPricingUnavailable
            };
          }
          return item;
        })
      };
    });
  },

  clearCart: () => {
    set({
      items: [],
      returns: [],
      selectedCustomer: null,
      transactionMode: "sale",
      paymentMethod: "cash",
      paidAmount: 0,
      discount: 0,
      discountPercent: 0,
      editingDraftId: null,
      editingDraftIdempotencyKey: null
    });
  },

  loadDraftIntoCart: (draft: OfflineOrderDraft, customer?: Customer) => {
    const cartItems: CartItem[] = draft.items.map((item) => ({
      productId: item.productId,
      itemCode: item.itemCode,
      productName: item.productName,
      displayName: item.displayName || item.productName,
      variant: item.variant || "",
      quantity: item.quantity,
      sellingPrice: item.sellingPrice,
      billingPrice:
        item.billingPrice !== undefined && item.billingPrice !== null && Number(item.billingPrice) > 0
          ? Number(item.billingPrice)
          : 0,
      lineTotal:
        item.quantity *
        (item.billingPrice !== undefined && item.billingPrice !== null && Number(item.billingPrice) > 0
          ? Number(item.billingPrice)
          : 0),
      totalStock: item.totalStockSnapshot || item.quantity,
      supplier: "Ruhunu Foods"
    }));

    const cust: Customer = customer || {
      _id: draft.customerId,
      name: draft.customerName,
      phone: draft.customerPhone,
      customerType: (draft.customerType as any) || "retail",
      creditLimit: 0,
      outstandingBalance: 0,
      status: "active"
    };

    set({
      items: cartItems,
      returns: draft.proposedReturns || [],
      selectedCustomer: cust,
      transactionMode: "order",
      paymentMethod: "cash",
      paidAmount: 0,
      discountPercent: draft.discountPercent || 0,
      discount: draft.estimatedDiscount || 0,
      editingDraftId: draft.id,
      editingDraftIdempotencyKey: draft.idempotencyKey
    });
  },

  setSelectedCustomer: (customer: Customer | null) => {
    set({ selectedCustomer: customer });
  },

  setTransactionMode: (mode: TransactionMode) => {
    set({ transactionMode: mode });
  },

  setPaymentMethod: (method: PaymentMethod) => {
    set({ paymentMethod: method });
  },

  setPaidAmount: (amount: number) => {
    set({ paidAmount: Math.max(0, Number(amount || 0)) });
  },

  setDiscount: (discount: number) => {
    const amount = Math.max(0, Number(discount || 0));
    const subtotal = get().getSubtotal();
    const percent = subtotal > 0 ? Math.round((amount / subtotal) * 10000) / 100 : 0;
    set({ discount: amount, discountPercent: percent });
  },

  setDiscountPercent: (percent: number) => {
    const clamped = Math.min(100, Math.max(0, Number(percent || 0)));
    const subtotal = get().getSubtotal();
    const amount = Math.round((subtotal * (clamped / 100)) * 100) / 100;
    set({ discountPercent: clamped, discount: amount });
  },

  // Computed Methods
  getTotalItems: () => get().items.length,

  getTotalQuantity: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  getSubtotal: () =>
    get().items.reduce((sum, item) => sum + item.lineTotal, 0),

  getReturnTotal: () =>
    get().returns.reduce(
      (sum, item) => sum + (item.returnTotal || item.quantity * item.returnPrice),
      0
    ),

  getBaseTotal: () => Math.max(0, get().getSubtotal() - get().getReturnTotal()),

  getDiscountAmount: () => {
    const baseTotal = get().getBaseTotal();
    const pct = get().discountPercent;
    if (pct > 0) {
      return Math.round(baseTotal * (pct / 100) * 100) / 100;
    }
    return Math.min(baseTotal, get().discount);
  },

  getNetTotal: () => {
    const baseTotal = get().getBaseTotal();
    const discountAmount = get().getDiscountAmount();
    return Math.max(0, Math.round((baseTotal - discountAmount) * 100) / 100);
  },

  getDueAmount: () => {
    const netTotal = get().getNetTotal();
    const paid = get().paidAmount;
    return Math.max(netTotal - paid, 0);
  },

  getBalance: () => {
    const netTotal = get().getNetTotal();
    const paid = get().paidAmount;
    return Math.max(paid - netTotal, 0);
  },

  hasStockWarning: () => {
    return get().items.some((item) => item.totalStock <= 0 || item.quantity > item.totalStock);
  },

  hasPricingWarning: () => {
    return get().items.some(
      (item) => item.isPricingUnavailable || !item.allocations || item.allocations.length === 0
    );
  },

  getItemWarning: (productId: string) => {
    const item = get().items.find((i) => i.productId === productId);
    if (!item) return null;
    if (item.totalStock <= 0) {
      return `Item is out of stock in warehouse (${item.totalStock} units available).`;
    }
    if (item.quantity > item.totalStock) {
      return `Requested quantity (${item.quantity}) exceeds available warehouse stock (${item.totalStock} units).`;
    }
    return null;
  },

  validateCheckout: () => {
    const items = get().items;
    const invalidItems = items
      .filter((i) => i.totalStock <= 0 || i.quantity > i.totalStock)
      .map((i) => ({
        itemCode: i.itemCode,
        name: i.displayName || i.productName,
        quantity: i.quantity,
        totalStock: i.totalStock
      }));

    return {
      valid: invalidItems.length === 0,
      invalidItems
    };
  }
}));

