import { create } from "zustand";
import { CartItem, Customer, PaymentMethod, Product, ReturnItem } from "../types";
import { OfflineOrderDraft } from "../types/offlineOrder";

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
  addItem: (product: Product, quantity?: number) => boolean;
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

  addItem: (product: Product, quantity = 1) => {
    const stockAvailable = Number(product.totalStock || 0);

    // Rule 1: Cannot add a product with 0 or negative available stock
    if (stockAvailable <= 0) {
      return false;
    }

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

        const updated = [...state.items];
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          lineTotal: newQty * existingItem.sellingPrice,
          totalStock: stockAvailable
        };
        success = true;
        return { items: updated };
      }

      // First time adding to cart: Clamp between 1 and available stock
      const initialQty = Math.min(reqQty, stockAvailable);
      const newItem: CartItem = {
        productId: product._id,
        itemCode: product.itemCode,
        productName: product.productName,
        displayName: product.displayName || product.productName,
        variant: product.variant,
        quantity: initialQty,
        sellingPrice: Number(product.currentSellingPrice || 0),
        lineTotal: initialQty * Number(product.currentSellingPrice || 0),
        totalStock: stockAvailable,
        supplier: product.supplier || "Ruhunu Foods"
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
          return {
            ...item,
            quantity: clampedQty,
            lineTotal: clampedQty * item.sellingPrice
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
        return {
          ...item,
          quantity: newQty,
          lineTotal: newQty * item.sellingPrice
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

      return {
        items: state.items.map((i) =>
          i.productId === productId
            ? {
                ...i,
                quantity: i.quantity - 1,
                lineTotal: (i.quantity - 1) * i.sellingPrice
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
      const productMap = new Map(products.map((p) => [p._id, Number(p.totalStock || 0)]));
      return {
        items: state.items.map((item) => {
          const latestStock = productMap.get(item.productId);
          if (latestStock !== undefined) {
            return {
              ...item,
              totalStock: latestStock
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
      lineTotal: item.estimatedLineTotal,
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

