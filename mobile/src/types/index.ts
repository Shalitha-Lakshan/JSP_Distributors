export type UserRole = "admin" | "manager" | "rep";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type AccountStatus = "active" | "inactive";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  status: AccountStatus;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TripExpense {
  _id?: string;
  reason: string;
  amount: number;
}

export interface TripCollections {
  cash: number;
  cheque: number;
}

export type TripStatus = "active" | "pending_audit" | "approved";

export interface TripSession {
  _id: string;
  tripNo: string;
  rep: string | User;
  route: string;
  status: TripStatus;
  startTime: string;
  endTime?: string;
  expectedCollections: TripCollections;
  actualCollections?: TripCollections;
  varianceCollections?: TripCollections;
  ordersBooked: string[];
  paymentsCollected: string[];
  expenses: TripExpense[];
  repRemarks?: string;
  excessHandling?: {
    status: "none" | "unreconciled" | "reviewed";
    reviewedBy?: string | User;
    reviewedAt?: string;
    reviewNotes?: string;
  };
  auditedBy?: string | User;
  auditedAt?: string;
  auditNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  status: "active" | "inactive";
}

export interface Product {
  _id: string;
  barcode?: string;
  itemCode: string;
  productName: string;
  variant: string;
  displayName: string;
  category: string | Category;
  searchKeywords?: string[];
  currentSellingPrice: number;
  currentBillingPrice?: number; // Only for managers/admin
  totalStock: number;
  reorderLevel: number;
  isFastMoving: boolean;
  status: "active" | "inactive";
  supplier: "Ruhunu Foods" | "Gajamuthu Foods";
}

export type CustomerType = "walk-in" | "retail" | "wholesale" | "credit";

export interface Customer {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  customerType: CustomerType;
  creditLimit: number;
  outstandingBalance: number;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  address?: string;
  customerType: CustomerType;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  address?: string;
  customerType?: CustomerType;
}

export interface LedgerEntry {
  date: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  type: "sale" | "payment" | "return";
  paymentStatus?: string;
  paymentMethod?: string;
  note?: string;
  balance: number;
}

export interface CustomerLedgerResponse {
  customer: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    customerType: CustomerType;
    outstandingBalance: number;
  };
  ledger: LedgerEntry[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
  };
}

export interface UnpaidInvoice {
  _id: string;
  invoiceNo: string;
  orderId?: {
    _id: string;
    orderNo: string;
  };
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus?: "credit" | "partial" | "paid";
  createdAt: string;
}

export interface ChequeDetail {
  paymentNo: string;
  customerName: string;
  chequeNo: string;
  bankName: string;
  chequeDate?: string;
  amount: number;
}

export interface CollectionCategoryBreakdown {
  cash: number;
  cheque: number;
  total: number;
}

export interface DailyClosingSummary {
  tripId?: string;
  tripNo: string;
  route: string;
  status?: TripStatus | "none";
  date?: string;
  startTime?: string;
  endTime?: string;
  repName?: string;
  totalInvoices?: number;
  totalOrders?: number;
  grossSales: number;
  returns: number;
  expenses: number;
  netSales: number;
  discounts: number;
  netCashCollection: number;
  expensesList?: TripExpense[];
  expectedCollections?: {
    cash: number;
    cashGross?: number;
    cheque: number;
    total: number;
  };
  collectionsBreakdown?: {
    posSales: CollectionCategoryBreakdown;
    orderDeliveries: CollectionCategoryBreakdown;
    creditPayments: CollectionCategoryBreakdown;
    totalCash: number;
    totalCheque: number;
  };
  chequesList?: ChequeDetail[];
  actualCollections?: TripCollections;
  varianceCollections?: TripCollections;
  repRemarks?: string;
  excessHandling?: {
    status: "none" | "unreconciled" | "reviewed";
    reviewedBy?: User | string;
    reviewedAt?: string;
    reviewNotes?: string;
  };
  auditedBy?: User | string;
  auditedAt?: string;
  auditNotes?: string;
}

// -------------------------------------------------------------
// POS, Cart, Sales & Orders Definitions (Milestone 4)
// -------------------------------------------------------------

export type PaymentMethod = "cash" | "credit" | "cheque";
export type PaymentStatus = "paid" | "partial" | "credit" | "cancelled" | "not_collected";
export type SaleType = "walk-in" | "credit";
export type OrderStatus = "pending_delivery" | "delivered" | "cancelled";

export interface CartItem {
  productId: string;
  itemCode: string;
  productName: string;
  displayName: string;
  variant: string;
  quantity: number;
  sellingPrice: number;
  lineTotal: number;
  totalStock: number;
  supplier: "Ruhunu Foods" | "Gajamuthu Foods";
}

export interface SaleItem {
  product: string | Product;
  itemCode: string;
  itemName: string;
  quantity: number;
  sellingPrice: number;
  billingPrice?: number;
  lineTotal: number;
}

export interface ReturnItem {
  productId?: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  returnPrice: number;
  returnTotal: number;
  condition?: "resellable" | "damaged" | "expired";
  reason?: string;
  inspectionStatus?: "pending_inspection" | "approved" | "rejected";
  approvedResellableQty?: number;
  rejectedQty?: number;
  rejectionReason?: string;
}

export interface Sale {
  _id: string;
  invoiceNo: string;
  orderId?: string;
  customer?: Customer | string | null;
  cashier: User | string;
  tripId?: string;
  items: SaleItem[];
  returns: ReturnItem[];
  orderTotal: number;
  returnTotal: number;
  subtotal: number;
  discount: number;
  discountPercent?: number;
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
  balance: number;
  paymentMethod: PaymentMethod;
  chequeBank?: string;
  chequeNo?: string;
  chequeDate?: string;
  paymentStatus: PaymentStatus;
  saleType: SaleType;
  status: "active" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string | Product;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  _id: string;
  orderNo: string;
  customer?: Customer | null;
  cashier: User | string;
  items: OrderItem[];
  returns: ReturnItem[];
  orderTotal: number;
  returnTotal: number;
  discount: number;
  discountPercent?: number;
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | "not_collected";
  chequeBank?: string;
  chequeNo?: string;
  chequeDate?: string;
  stockReserved: boolean;
  deliveryDate?: string;
  saleId?: string | Sale;
  tripId?: string | TripSession;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalePayload {
  items: {
    productId: string;
    quantity: number;
    itemCode?: string;
    itemName?: string;
  }[];
  returns?: ReturnItem[];
  discount?: number;
  discountPercent?: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  chequeBank?: string;
  chequeNo?: string;
  chequeDate?: string;
  customer?: string;
  saleType?: SaleType;
}

export interface CreateOrderPayload {
  customer?: string | null;
  items: {
    productId: string;
    quantity: number;
  }[];
  returns?: ReturnItem[];
  discount?: number;
  discountPercent?: number;
  idempotencyKey?: string;
}

export interface DeliverOrderPayload {
  items?: {
    productId: string;
    quantity: number;
    itemCode?: string;
    itemName?: string;
  }[];
  returns?: ReturnItem[];
  discount?: number;
  discountPercent?: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  chequeBank?: string;
  chequeNo?: string;
  chequeDate?: string;
}

// -------------------------------------------------------------
// Payment Collections & Credit Settlement Definitions (Milestone 6)
// -------------------------------------------------------------

export type ChequeStatus = "pending" | "cleared" | "returned";

export interface PaymentAllocation {
  invoice: string;
  invoiceNo: string;
  allocatedAmount: number;
}

export interface ReceivePaymentInput {
  customer: string;
  amount: number;
  paymentMethod: "cash" | "cheque";
  chequeNo?: string;
  bankName?: string;
  chequeDate?: string;
  chequeStatus?: ChequeStatus;
  note?: string;
  allocations?: PaymentAllocation[];
  idempotencyKey?: string;
}

export interface Payment {
  _id: string;
  paymentNo: string;
  customer: Customer | { _id: string; name: string; phone?: string; address?: string; customerType?: CustomerType };
  amount: number;
  paymentMethod: "cash" | "cheque";
  chequeNo?: string;
  bankName?: string;
  chequeDate?: string;
  chequeStatus?: ChequeStatus;
  receivedBy: User | { _id: string; name: string };
  note?: string;
  allocations: PaymentAllocation[];
  tripId?: TripSession | { _id: string; tripNo: string; route?: string };
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Customer Returns & Field Returns Definitions (Milestone 7)
// -------------------------------------------------------------

export type ReturnCondition = "resellable" | "damaged" | "expired";

export interface CustomerReturnItem {
  productId?: string | Product;
  itemCode: string;
  itemName: string;
  quantity: number;
  returnPrice: number;
  returnTotal: number;
  condition: ReturnCondition;
  originalInvoiceNo?: string;
  reason?: string;
  status?: "pending" | "dispatched";
}

export interface CustomerReturn {
  _id: string;
  saleId?: string | Sale;
  invoiceNo: string;
  customer: Customer | { _id: string; name: string; phone?: string; address?: string; customerType?: CustomerType };
  cashier: User | { _id: string; name: string };
  tripId?: TripSession | { _id: string; tripNo: string; route?: string };
  items: CustomerReturnItem[];
  returnTotal: number;
  status: "pending" | "dispatched";
  createdAt: string;
  updatedAt: string;
}

export interface EligibleInvoiceItem {
  productId: string;
  itemCode: string;
  itemName: string;
  soldQty: number;
  alreadyReturnedQty: number;
  eligibleQty: number;
  returnPrice: number;
}

export interface EligibleInvoice {
  _id: string;
  invoiceNo: string;
  createdAt: string;
  netTotal: number;
  paymentStatus: string;
  dueAmount: number;
  items: EligibleInvoiceItem[];
}

export interface CreateCustomerReturnItemInput {
  productId?: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  returnPrice?: number;
  condition: ReturnCondition;
  reason?: string;
}

export interface CreateCustomerReturnPayload {
  customerId: string;
  invoiceNo: string;
  items: CreateCustomerReturnItemInput[];
}

export type ExpenseCategory = "Fuel" | "Food" | "Toll" | "Vehicle Repairs" | "Other";




