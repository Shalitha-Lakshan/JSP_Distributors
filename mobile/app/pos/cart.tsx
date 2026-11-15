import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Edit3,
  FileText,
  Lock,
  Plus,
  RotateCcw,
  ShoppingBag,
  Store,
  Trash2,
  UserCheck,
  Users
} from "lucide-react-native";
import { useCartStore } from "../../src/store/cartStore";
import { useTripStore } from "../../src/store/tripStore";
import { fetchProducts } from "../../src/api/products";
import { createSale } from "../../src/api/sales";
import { createOrder } from "../../src/api/orders";
import { Order, PaymentMethod, Product, ReturnItem, Sale } from "../../src/types";
import { CartItemRow } from "../../src/components/pos/CartItemRow";
import { CustomerSelectorModal } from "../../src/components/pos/CustomerSelectorModal";
import { PaymentMethodPicker } from "../../src/components/pos/PaymentMethodPicker";
import { InvoiceReceiptModal } from "../../src/components/pos/InvoiceReceiptModal";
import { MarketReturnModal } from "../../src/components/pos/MarketReturnModal";
import { Badge } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
import { useResponsive } from "../../src/hooks/useResponsive";
import { BorderRadius, Colors, Spacing, Typography } from "../../src/theme/colors";
import { assertOnline } from "../../src/utils/networkGuard";
import { useAuthStore } from "../../src/store/authStore";
import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";
import { offlineOrderService } from "../../src/services/offlineOrderService";

const formatLKR = (val?: number) =>
  `Rs. ${Number(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export default function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeTrip } = useTripStore();
  const { isTablet, isLargeTablet, isLandscape, contentMaxWidth } = useResponsive();
  const isSplitLayout = isTablet && (isLandscape || isLargeTablet);
  const user = useAuthStore((state) => state.user);
  const { isOffline, isServerUnavailable } = useNetworkStatus();
  const isOfflineMode = isOffline || isServerUnavailable;

  // Cart Store State
  const {
    items,
    returns,
    selectedCustomer,
    transactionMode,
    paymentMethod,
    paidAmount,
    discount,
    discountPercent,
    editingDraftId,
    editingDraftIdempotencyKey,
    incrementQuantity,
    decrementQuantity,
    updateQuantity,
    removeItem,
    addReturnItem,
    updateReturnItem,
    removeReturnItem,
    clearReturns,
    clearCart,
    setSelectedCustomer,
    setTransactionMode,
    setPaymentMethod,
    setPaidAmount,
    setDiscount,
    setDiscountPercent,
    getTotalQuantity,
    getSubtotal,
    getReturnTotal,
    getBaseTotal,
    getDiscountAmount,
    getNetTotal,
    getDueAmount,
    getBalance,
    hasStockWarning,
    validateCheckout,
    syncProductStock
  } = useCartStore();

  // If offline, lock to Van Order mode
  useEffect(() => {
    if (isOfflineMode && transactionMode === "sale") {
      setTransactionMode("order");
    }
  }, [isOfflineMode, transactionMode, setTransactionMode]);

  // Sync latest product stock from backend to catch real-time stock changes
  const { data: latestProducts = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: fetchProducts,
    staleTime: 30 * 1000
  });

  useEffect(() => {
    if (latestProducts.length > 0) {
      syncProductStock(latestProducts);
    }
  }, [latestProducts, syncProductStock]);

  // Local UI State
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [paidInputStr, setPaidInputStr] = useState(String(paidAmount || ""));
  const [discountPercentStr, setDiscountPercentStr] = useState(
    discountPercent > 0 ? String(discountPercent) : ""
  );
  const [confirmedSale, setConfirmedSale] = useState<Sale | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Market Returns Modal State
  const [marketReturnModalVisible, setMarketReturnModalVisible] = useState(false);
  const [editingReturnIndex, setEditingReturnIndex] = useState<number | null>(null);
  const [editingReturnItem, setEditingReturnItem] = useState<ReturnItem | null>(null);

  const handleAddProducts = () => {
    router.push({ pathname: "/(tabs)/products", params: { from: "cart" } } as any);
  };

  const handleOpenAddReturn = () => {
    setEditingReturnIndex(null);
    setEditingReturnItem(null);
    setMarketReturnModalVisible(true);
  };

  const handleOpenEditReturn = (index: number, returnItem: ReturnItem) => {
    setEditingReturnIndex(index);
    setEditingReturnItem(returnItem);
    setMarketReturnModalVisible(true);
  };

  const handleSaveReturn = (returnItem: ReturnItem) => {
    if (editingReturnIndex !== null && editingReturnIndex >= 0) {
      updateReturnItem(editingReturnIndex, returnItem);
    } else {
      addReturnItem(returnItem);
    }
    setMarketReturnModalVisible(false);
    setEditingReturnIndex(null);
    setEditingReturnItem(null);
  };

  const totalQty = getTotalQuantity();
  const subtotal = getSubtotal();
  const returnTotal = getReturnTotal();
  const baseTotal = getBaseTotal();
  const discountAmount = getDiscountAmount();
  const netTotal = getNetTotal();
  const dueAmount = getDueAmount();
  const balance = getBalance();

  const handleDiscountPercentChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;

    setDiscountPercentStr(normalized);
    if (normalized === "" || normalized === ".") {
      setDiscountPercent(0);
      return;
    }
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      if (num > 100) {
        setDiscountPercent(100);
        setDiscountPercentStr("100");
      } else if (num < 0) {
        setDiscountPercent(0);
        setDiscountPercentStr("0");
      } else {
        setDiscountPercent(num);
      }
    }
  };

  const renderMarketReturnsSection = () => (
    <View style={styles.returnsSectionCard}>
      <View style={styles.returnsHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <RotateCcw size={15} color={Colors.clay} style={{ marginRight: 6 }} />
          <Text style={styles.returnsSectionTitle}>
            PROPOSED MARKET RETURNS ({returns.length})
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addReturnHeaderBtn}
          onPress={handleOpenAddReturn}
          hitSlop={6}
        >
          <Plus size={13} color={Colors.clay} style={{ marginRight: 2 }} />
          <Text style={styles.addReturnHeaderBtnText}>Add Return</Text>
        </TouchableOpacity>
      </View>

      {returns.length === 0 ? (
        <View style={styles.emptyReturnsBox}>
          <Text style={styles.emptyReturnsText}>
            No market returns added for this visit. Tap "+ Add Return" to record returned stock.
          </Text>
        </View>
      ) : (
        <View style={styles.returnsList}>
          {returns.map((ret, idx) => (
            <View key={`return-${idx}`} style={styles.returnItemRow}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <View style={styles.returnMetaRow}>
                  <View style={styles.returnCodeBadge}>
                    <Text style={styles.returnCodeText}>{ret.itemCode}</Text>
                  </View>
                  <Badge
                    label={(ret.condition || "resellable").toUpperCase()}
                    variant={
                      ret.condition === "resellable"
                        ? "leaf"
                        : ret.condition === "damaged"
                        ? "warning"
                        : "danger"
                    }
                    size="sm"
                  />
                </View>
                <Text style={styles.returnItemName} numberOfLines={1}>
                  {ret.itemName}
                </Text>
                <Text style={styles.returnQtyText}>
                  {ret.quantity} units @ {formatLKR(ret.returnPrice)}
                </Text>
                {ret.reason ? (
                  <Text style={styles.returnReasonText} numberOfLines={1}>
                    Note: {ret.reason}
                  </Text>
                ) : null}
              </View>

              <View style={styles.returnRightCol}>
                <Text style={styles.returnLineTotal}>-{formatLKR(ret.returnTotal)}</Text>
                <View style={styles.returnActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleOpenEditReturn(idx, ret)}
                    hitSlop={6}
                    style={styles.returnActionBtn}
                    accessibilityLabel="Edit return item"
                  >
                    <Edit3 size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeReturnItem(idx)}
                    hitSlop={6}
                    style={[styles.returnActionBtn, { backgroundColor: Colors.dangerLight }]}
                    accessibilityLabel="Remove return item"
                  >
                    <Trash2 size={14} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          <View style={styles.returnsTotalRow}>
            <Text style={styles.returnsTotalLabel}>Proposed Returns Total</Text>
            <Text style={styles.returnsTotalVal}>-{formatLKR(returnTotal)}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const isSaleMode = transactionMode === "sale";
  const hasCustomer = !!selectedCustomer;
  const availableCredit = hasCustomer
    ? Math.max(0, (selectedCustomer.creditLimit || 0) - (selectedCustomer.outstandingBalance || 0))
    : 0;
  const isCreditOverLimit = hasCustomer && paymentMethod === "credit" && dueAmount > availableCredit;

  // Sale Mutation
  const saleMutation = useMutation({
    mutationFn: async () => {
      return await createSale({
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          itemCode: i.itemCode,
          itemName: i.displayName
        })),
        returns: returns.map((r) => ({
          productId: r.productId,
          itemCode: r.itemCode,
          itemName: r.itemName,
          quantity: r.quantity,
          returnPrice: r.returnPrice,
          returnTotal: r.returnTotal,
          condition: r.condition,
          reason: r.reason
        })),
        discount: discountAmount,
        discountPercent: Number(discountPercentStr || 0),
        paidAmount: Number(paidInputStr || 0),
        paymentMethod: paymentMethod,
        customer: selectedCustomer?._id,
        saleType: selectedCustomer && dueAmount > 0 ? "credit" : "walk-in"
      });
    },
    onSuccess: (sale) => {
      setIsSubmitting(false);
      setConfirmedSale(sale);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["daily-closing"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["active-trip"] });
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      const isTimeout = err?.message?.includes("timed out") || err?.message?.includes("timeout");
      if (isTimeout) {
        Alert.alert(
          "Request Timed Out",
          "The server took too long to respond. The sale may or may not have been created. Check Sales History before retrying to prevent duplicate invoices.",
          [
            { text: "Check Sales History", onPress: () => router.push("/(tabs)/sales" as any) },
            { text: "Stay Here", style: "cancel" }
          ]
        );
      } else if (err?.status === 409 || err?.message?.includes("Insufficient stock") || err?.message?.includes("Stock conflict")) {
        Alert.alert(
          "Stock Conflict (409)",
          err?.message || "Available warehouse stock has changed. Catalogue updated.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Transaction Error", err?.message || "Failed to complete transaction.");
      }
    }
  });

  // Order Booking Mutation
  const orderMutation = useMutation({
    mutationFn: async () => {
      return await createOrder({
        customer: selectedCustomer?._id || null,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity
        })),
        returns: returns.map((r) => ({
          productId: r.productId,
          itemCode: r.itemCode,
          itemName: r.itemName,
          quantity: r.quantity,
          returnPrice: r.returnPrice,
          returnTotal: r.returnTotal,
          condition: r.condition,
          reason: r.reason
        })),
        discount: discountAmount,
        discountPercent: Number(discountPercentStr || 0)
      });
    },
    onSuccess: (order) => {
      setIsSubmitting(false);
      setConfirmedOrder(order);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["active-trip"] });
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (err?.status === 409 || err?.message?.includes("Insufficient stock") || err?.message?.includes("Stock conflict")) {
        Alert.alert(
          "Stock Conflict (409)",
          err?.message || "Available warehouse stock has changed. Catalogue updated.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Order Booking Error", err?.message || "Failed to book van order.");
      }
    }
  });

  const handleClearCart = () => {
    Alert.alert("Clear Cart", "Are you sure you want to remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: clearCart }
    ]);
  };

  const handleCheckout = async () => {
    // Milestone 9.1: If offline, handle Save Offline Van Order Draft!
    if (isOfflineMode) {
      if (isSaleMode) {
        Alert.alert(
          "Online Only",
          "Direct POS sales require a live server connection for stock reservation and tax invoice issuance. Please switch to Van Order Draft mode to save offline."
        );
        return;
      }

      if (!activeTrip) {
        Alert.alert(
          "Active Trip Required",
          "An active route trip session is required to save a Van Order draft."
        );
        return;
      }

      if (items.length === 0) {
        Alert.alert("Empty Cart", "Please add at least one item to save an order draft.");
        return;
      }

      if (!selectedCustomer) {
        Alert.alert(
          "Customer Required",
          "Van Order drafts require an authorized customer to be selected."
        );
        return;
      }

      try {
        setIsSubmitting(true);
        const draft = await offlineOrderService.saveDraftFromCart({
          items,
          returns,
          customer: selectedCustomer,
          activeTrip,
          discountPercent,
          user: user!,
          existingDraftId: editingDraftId || undefined,
          existingIdempotencyKey: editingDraftIdempotencyKey || undefined
        });

        clearCart();
        setIsSubmitting(false);

        Alert.alert(
          "Van Order Draft Saved",
          `Order draft ${draft.draftNo} for "${selectedCustomer.name}" has been saved locally on this device (${items.length} lines, estimated ${formatLKR(draft.estimatedTotal)}).\n\nWhen internet connectivity returns, you can review and sync this order with the central server.`,
          [
            { text: "Continue Browsing", style: "cancel", onPress: () => router.push("/products") },
            {
              text: "View Offline Orders",
              style: "default",
              onPress: () => router.push("/orders/offline" as any)
            }
          ]
        );
      } catch (err: any) {
        setIsSubmitting(false);
        Alert.alert("Save Draft Failed", err.message || "Failed to save offline order draft.");
      }
      return;
    }

    // 0. Verify Live Network Connection (Milestone 9)
    if (!assertOnline(isSaleMode ? "POS Checkout" : "Order Booking")) {
      return;
    }

    // 1. Verify Active Trip
    if (!activeTrip) {
      Alert.alert(
        "Active Trip Required",
        "You must start an active route trip before booking orders or processing sales transactions.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Trip", onPress: () => router.push("/trips/start" as any) }
        ]
      );
      return;
    }

    // 2. Validate Items
    if (items.length === 0) {
      Alert.alert("Empty Cart", "Please add at least one product to proceed.");
      return;
    }

    // 3. Strict Pre-checkout Stock Validation
    const stockCheck = validateCheckout();
    if (!stockCheck.valid) {
      const details = stockCheck.invalidItems
        .map((i) =>
          i.totalStock <= 0
            ? `• ${i.itemCode} (${i.name}): OUT OF STOCK (0 available)`
            : `• ${i.itemCode} (${i.name}): requested ${i.quantity}, but only ${i.totalStock} available in warehouse`
        )
        .join("\n");

      Alert.alert(
        "Stock Validation Failed",
        `Cannot proceed with ${isSaleMode ? "sale" : "order booking"}. One or more items exceed current warehouse stock:\n\n${details}\n\nPlease adjust item quantities or remove unavailable items.`,
        [{ text: "OK" }]
      );
      return;
    }

    // 4. Mode-specific Validations
    if (isSaleMode) {
      if (!hasCustomer && paymentMethod === "credit") {
        Alert.alert(
          "Credit Prohibited",
          "Credit sales are not allowed for Walk-in customers. Please select a registered customer."
        );
        return;
      }

      if (!hasCustomer && dueAmount > 0) {
        Alert.alert(
          "Full Payment Required",
          "Walk-in sales must be paid in full. Please enter the full net amount."
        );
        return;
      }

      if (isCreditOverLimit) {
        Alert.alert(
          "Credit Limit Exceeded",
          `Customer available credit is ${formatLKR(availableCredit)}, but this sale has a due balance of ${formatLKR(dueAmount)}. Do you still want to request authorization?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Proceed Anyway",
              style: "destructive",
              onPress: () => {
                setIsSubmitting(true);
                saleMutation.mutate();
              }
            }
          ]
        );
        return;
      }

      // Confirmation Prompt
      Alert.alert(
        "Confirm Sale",
        `Issue POS invoice for ${formatLKR(netTotal)} via ${paymentMethod.toUpperCase()}? Server will verify stock and issue invoice.`,
        [
          { text: "Review", style: "cancel" },
          {
            text: "Confirm Sale",
            style: "default",
            onPress: () => {
              setIsSubmitting(true);
              saleMutation.mutate();
            }
          }
        ]
      );
    } else {
      // Order Booking Confirmation
      Alert.alert(
        "Confirm Order Booking",
        `Book van order for ${selectedCustomer?.name || "Walk-in Customer"} (${items.length} items)? This will reserve warehouse stock without issuing an invoice.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Book Order",
            style: "default",
            onPress: () => {
              setIsSubmitting(true);
              orderMutation.mutate();
            }
          }
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.backBtn}
              accessibilityLabel="Back to products"
            >
              <ArrowLeft size={20} color={Colors.ink} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>POS & Cart</Text>
              <Text style={styles.headerSubtitle}>
                {items.length} lines • {totalQty} units
              </Text>
            </View>
          </View>

          {items.length > 0 && (
            <TouchableOpacity
              onPress={handleClearCart}
              hitSlop={8}
              style={styles.clearBtn}
            >
              <Trash2 size={16} color={Colors.danger} />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mode Selector (Sale vs Order) */}
        <View style={styles.modeSection}>
          <Pressable
            onPress={() => {
              if (isOfflineMode) {
                Alert.alert(
                  "Online Only",
                  "Direct POS sales require a live server connection for stock reservation and tax invoice issuance. Van Order Drafts are supported offline."
                );
                return;
              }
              setTransactionMode("sale");
              if (paymentMethod === "cash") {
                setPaidInputStr(String(netTotal));
                setPaidAmount(netTotal);
              }
            }}
            style={[
              styles.modeTab,
              isSaleMode && styles.modeTabActive,
              isOfflineMode && { opacity: 0.5 }
            ]}
          >
            <Store size={16} color={isSaleMode ? Colors.leaf : Colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.modeTabText, isSaleMode && styles.modeTabTextActive]}>
              Direct POS Sale
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTransactionMode("order")}
            style={[styles.modeTab, !isSaleMode && styles.modeTabActive]}
          >
            <FileText size={16} color={!isSaleMode ? Colors.clay : Colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.modeTabText, !isSaleMode && styles.modeTabTextActiveClay]}>
              {isOfflineMode ? "Van Order Draft" : "Book Van Order"}
            </Text>
          </Pressable>
        </View>

        {/* Active Trip Notice */}
        {!activeTrip && (
          <View style={styles.tripAlert}>
            <Lock size={16} color={Colors.clay} style={{ marginRight: 8 }} />
            <Text style={styles.tripAlertText}>
              No active shift trip found. You can prepare items, but an active trip is required to complete transactions.
            </Text>
          </View>
        )}

        {/* Editing Draft Notice */}
        {editingDraftId && (
          <View style={[styles.tripAlert, { backgroundColor: "#fef3c7", borderColor: Colors.clay }]}>
            <FileText size={16} color={Colors.clay} style={{ marginRight: 8 }} />
            <Text style={[styles.tripAlertText, { color: Colors.ink, flex: 1 }]}>
              Editing Saved Offline Draft. Changes will update the local draft upon saving.
            </Text>
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <ShoppingBag size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySub}>
              Browse the product catalogue and add items using their item code or name.
            </Text>
            <Button
              title="+ Add Products"
              variant="primary"
              size="md"
              onPress={handleAddProducts}
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        ) : isSplitLayout ? (
          <View style={styles.splitContainer}>
            {/* Left Column: Customer & Cart Items */}
            <ScrollView
              style={styles.splitLeft}
              contentContainerStyle={styles.splitLeftContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Customer Section */}
              <Text style={styles.sectionHeading}>CUSTOMER SELECTION</Text>
              <Pressable
                onPress={() => setCustomerModalVisible(true)}
                style={({ pressed }) => [
                  styles.customerCard,
                  pressed && styles.customerCardPressed
                ]}
              >
                <View style={styles.customerCardContent}>
                  <View style={styles.customerIconWrap}>
                    {hasCustomer ? (
                      <UserCheck size={20} color={Colors.leaf} />
                    ) : (
                      <Users size={20} color={Colors.textMuted} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerCardName}>
                      {selectedCustomer?.name || "Walk-in Customer (General Cash)"}
                    </Text>
                    <Text style={styles.customerCardSub}>
                      {hasCustomer
                        ? `Outstanding: ${formatLKR(selectedCustomer.outstandingBalance)} • Credit Limit: ${formatLKR(selectedCustomer.creditLimit)}`
                        : "Tap to select a registered customer for credit / wholesale"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.changeCustomerText}>Change</Text>
              </Pressable>

              {/* Cart Items List */}
              <View style={styles.itemsHeaderRow}>
                <Text style={styles.sectionHeading}>CART ITEMS ({items.length})</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {hasStockWarning() && (
                    <View style={styles.stockNotice}>
                      <AlertTriangle size={12} color={Colors.danger} style={{ marginRight: 4 }} />
                      <Text style={[styles.stockNoticeText, { color: Colors.danger }]}>Stock Warning</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.addProductsHeaderBtn}
                    onPress={handleAddProducts}
                    hitSlop={6}
                    accessibilityLabel="Add more products to cart"
                  >
                    <Plus size={13} color={Colors.leaf} style={{ marginRight: 2 }} />
                    <Text style={styles.addProductsHeaderBtnText}>Add Products</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {hasStockWarning() && (
                <View style={styles.stockWarningBanner}>
                  <AlertCircle size={16} color={Colors.danger} style={{ marginRight: 6 }} />
                  <Text style={styles.stockWarningBannerText}>
                    One or more products exceed warehouse stock or are out of stock. Please adjust quantities or remove unavailable items to enable checkout.
                  </Text>
                </View>
              )}

              {items.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  onIncrement={incrementQuantity}
                  onDecrement={decrementQuantity}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}

              {/* Add More Products Button */}
              <TouchableOpacity
                style={styles.addMoreProductsBtn}
                onPress={handleAddProducts}
                activeOpacity={0.7}
              >
                <Plus size={15} color={Colors.leaf} style={{ marginRight: 6 }} />
                <Text style={styles.addMoreProductsBtnText}>+ Add More Products</Text>
              </TouchableOpacity>

              {/* Market Returns Section */}
              {renderMarketReturnsSection()}
            </ScrollView>

            {/* Right Column: Payment, Calculation & Checkout */}
            <View style={styles.splitRight}>
              <ScrollView
                style={styles.splitRightScroll}
                contentContainerStyle={styles.splitRightContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Payment & Calculations Section (Sale Mode) */}
                {isSaleMode && (
                  <>
                    <Text style={styles.sectionHeading}>PAYMENT METHOD</Text>
                    <PaymentMethodPicker
                      selected={paymentMethod}
                      onSelect={(m) => {
                        setPaymentMethod(m);
                        if (m === "credit") {
                          setPaidInputStr("0");
                          setPaidAmount(0);
                        } else if (m === "cash") {
                          setPaidInputStr(String(netTotal));
                          setPaidAmount(netTotal);
                        }
                      }}
                      allowCredit={hasCustomer}
                      style={{ marginBottom: Spacing.md }}
                    />

                    {/* Amount Paid Input */}
                    <View style={styles.calculationCard}>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Subtotal</Text>
                        <Text style={styles.calcVal}>{formatLKR(subtotal)}</Text>
                      </View>

                      {returnTotal > 0 && (
                        <>
                          <View style={styles.calcRow}>
                            <Text style={[styles.calcLabel, { color: Colors.clay, fontWeight: "600" }]}>
                              Market Returns Deduction
                            </Text>
                            <Text style={[styles.calcVal, { color: Colors.clay, fontWeight: "700" }]}>
                              -{formatLKR(returnTotal)}
                            </Text>
                          </View>
                          <View style={styles.calcRow}>
                            <Text style={[styles.calcLabel, { fontWeight: "600", color: Colors.ink }]}>
                              Adjusted Base Total
                            </Text>
                            <Text style={[styles.calcVal, { fontWeight: "700", color: Colors.ink }]}>
                              {formatLKR(baseTotal)}
                            </Text>
                          </View>
                        </>
                      )}

                      {/* Percentage Discount Input */}
                      <View style={[styles.calcRow, { alignItems: "center" }]}>
                        <View style={{ flex: 1, marginRight: Spacing.xs }}>
                          <Text style={styles.calcLabel}>Discount (%)</Text>
                          <Text style={styles.calcSubText}>
                            {discountAmount > 0 ? `Amount: -${formatLKR(discountAmount)}` : "0% - 100%"}
                          </Text>
                        </View>
                        <View style={styles.discountPercentInputWrap}>
                          <TextInput
                            style={styles.discountInput}
                            keyboardType="decimal-pad"
                            value={discountPercentStr}
                            placeholder="0"
                            placeholderTextColor={Colors.textMuted}
                            onChangeText={handleDiscountPercentChange}
                          />
                          <Text style={styles.percentSymbol}>%</Text>
                        </View>
                      </View>

                      {discountAmount > 0 && (
                        <View style={styles.calcRow}>
                          <Text style={[styles.calcLabel, { color: Colors.danger }]}>Calculated Discount</Text>
                          <Text style={[styles.calcVal, { color: Colors.danger, fontWeight: "700" }]}>
                            -{formatLKR(discountAmount)}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.calcRow, styles.netRow]}>
                        <Text style={styles.netLabel}>NET BILLING TOTAL</Text>
                        <Text style={styles.netVal}>{formatLKR(netTotal)}</Text>
                      </View>

                      {/* Cash Handed / Paid Amount */}
                      <View style={[styles.calcRow, { marginTop: Spacing.sm }]}>
                        <Text style={[styles.calcLabel, { fontWeight: "700" }]}>
                          Amount Collected (LKR)
                        </Text>
                        <TextInput
                          style={styles.paidInput}
                          keyboardType="numeric"
                          value={paidInputStr}
                          placeholder="0.00"
                          onChangeText={(val) => {
                            setPaidInputStr(val);
                            setPaidAmount(Number(val || 0));
                          }}
                        />
                      </View>

                      {/* Due amount or change balance */}
                      {dueAmount > 0 && (
                        <View style={styles.dueRow}>
                          <Text style={styles.dueLabel}>Due (Added to Credit)</Text>
                          <Text style={styles.dueVal}>{formatLKR(dueAmount)}</Text>
                        </View>
                      )}

                      {balance > 0 && (
                        <View style={styles.balanceRow}>
                          <Text style={styles.balanceLabel}>Change to Return</Text>
                          <Text style={styles.balanceVal}>{formatLKR(balance)}</Text>
                        </View>
                      )}
                    </View>

                    {/* Credit Limit Exceeded Warning */}
                    {isCreditOverLimit && (
                      <View style={styles.limitAlert}>
                        <AlertCircle size={16} color={Colors.danger} style={{ marginRight: 6 }} />
                        <Text style={styles.limitAlertText}>
                          Warning: Due balance ({formatLKR(dueAmount)}) exceeds customer's available credit limit ({formatLKR(availableCredit)}).
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {/* Order Mode Calculation Card */}
                {!isSaleMode && (
                  <View style={styles.calculationCard}>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Order Subtotal</Text>
                      <Text style={styles.calcVal}>{formatLKR(subtotal)}</Text>
                    </View>

                    {returnTotal > 0 && (
                      <>
                        <View style={styles.calcRow}>
                          <Text style={[styles.calcLabel, { color: Colors.clay, fontWeight: "600" }]}>
                            Proposed Market Returns
                          </Text>
                          <Text style={[styles.calcVal, { color: Colors.clay, fontWeight: "700" }]}>
                            -{formatLKR(returnTotal)}
                          </Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={[styles.calcLabel, { fontWeight: "600", color: Colors.ink }]}>
                            Adjusted Base Total
                          </Text>
                          <Text style={[styles.calcVal, { fontWeight: "700", color: Colors.ink }]}>
                            {formatLKR(baseTotal)}
                          </Text>
                        </View>
                      </>
                    )}

                    {/* Percentage Discount Input */}
                    <View style={[styles.calcRow, { alignItems: "center" }]}>
                      <View style={{ flex: 1, marginRight: Spacing.xs }}>
                        <Text style={styles.calcLabel}>Order Discount (%)</Text>
                        <Text style={styles.calcSubText}>
                          {discountAmount > 0 ? `Amount: -${formatLKR(discountAmount)}` : "0% - 100%"}
                        </Text>
                      </View>
                      <View style={styles.discountPercentInputWrap}>
                        <TextInput
                          style={styles.discountInput}
                          keyboardType="decimal-pad"
                          value={discountPercentStr}
                          placeholder="0"
                          placeholderTextColor={Colors.textMuted}
                          onChangeText={handleDiscountPercentChange}
                        />
                        <Text style={styles.percentSymbol}>%</Text>
                      </View>
                    </View>

                    {discountAmount > 0 && (
                      <View style={styles.calcRow}>
                        <Text style={[styles.calcLabel, { color: Colors.danger }]}>Calculated Discount</Text>
                        <Text style={[styles.calcVal, { color: Colors.danger, fontWeight: "700" }]}>
                          -{formatLKR(discountAmount)}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.calcRow, styles.netRow]}>
                      <Text style={styles.netLabel}>ESTIMATED NET TOTAL</Text>
                      <Text style={styles.netVal}>{formatLKR(netTotal)}</Text>
                    </View>

                    <Text style={styles.orderNoticeText}>
                      Booking this order will reserve warehouse inventory under trip shift without issuing an invoice. Delivery & payment collection will be finalized when delivered.
                    </Text>
                  </View>
                )}

                {/* Tablet Split Checkout Action Button */}
                <View style={styles.splitCheckoutBox}>
                  <View style={styles.footerSummary}>
                    <Text style={styles.footerTotalLabel}>
                      {isOfflineMode
                        ? "ESTIMATED TOTAL"
                        : isSaleMode
                        ? "NET TO PAY"
                        : "ORDER VALUE"}
                    </Text>
                    <Text style={styles.footerTotalAmount}>{formatLKR(netTotal)}</Text>
                  </View>
                  <Button
                    title={
                      isSubmitting
                        ? "Processing..."
                        : isOfflineMode
                        ? editingDraftId
                          ? `Update Offline Draft (${formatLKR(netTotal)})`
                          : `Save Offline Draft (${formatLKR(netTotal)})`
                        : hasStockWarning()
                        ? "Stock Unavailable - Adjust Cart"
                        : isSaleMode
                        ? `Confirm Sale (${formatLKR(netTotal)})`
                        : `Book Order (${items.length} items)`
                    }
                    variant="primary"
                    size="lg"
                    disabled={isSubmitting || !activeTrip || (!isOfflineMode && hasStockWarning())}
                    onPress={handleCheckout}
                    style={[styles.checkoutBtn, !isOfflineMode && hasStockWarning() && { opacity: 0.6 }]}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[
              styles.scrollContent,
              isTablet && { maxWidth: 680, alignSelf: "center", width: "100%" }
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Customer Section */}
            <Text style={styles.sectionHeading}>CUSTOMER SELECTION</Text>
            <Pressable
              onPress={() => setCustomerModalVisible(true)}
              style={({ pressed }) => [
                styles.customerCard,
                pressed && styles.customerCardPressed
              ]}
            >
              <View style={styles.customerCardContent}>
                <View style={styles.customerIconWrap}>
                  {hasCustomer ? (
                    <UserCheck size={20} color={Colors.leaf} />
                  ) : (
                    <Users size={20} color={Colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerCardName}>
                    {selectedCustomer?.name || "Walk-in Customer (General Cash)"}
                  </Text>
                  <Text style={styles.customerCardSub}>
                    {hasCustomer
                      ? `Outstanding: ${formatLKR(selectedCustomer.outstandingBalance)} • Credit Limit: ${formatLKR(selectedCustomer.creditLimit)}`
                      : "Tap to select a registered customer for credit / wholesale"}
                  </Text>
                </View>
              </View>
              <Text style={styles.changeCustomerText}>Change</Text>
            </Pressable>

            {/* Cart Items List */}
            <View style={styles.itemsHeaderRow}>
              <Text style={styles.sectionHeading}>CART ITEMS ({items.length})</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {hasStockWarning() && (
                  <View style={styles.stockNotice}>
                    <AlertTriangle size={12} color={Colors.danger} style={{ marginRight: 4 }} />
                    <Text style={[styles.stockNoticeText, { color: Colors.danger }]}>Stock Warning</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.addProductsHeaderBtn}
                  onPress={handleAddProducts}
                  hitSlop={6}
                  accessibilityLabel="Add more products to cart"
                >
                  <Plus size={13} color={Colors.leaf} style={{ marginRight: 2 }} />
                  <Text style={styles.addProductsHeaderBtnText}>Add Products</Text>
                </TouchableOpacity>
              </View>
            </View>

            {hasStockWarning() && (
              <View style={styles.stockWarningBanner}>
                <AlertCircle size={16} color={Colors.danger} style={{ marginRight: 6 }} />
                <Text style={styles.stockWarningBannerText}>
                  One or more products exceed warehouse stock or are out of stock. Please adjust quantities or remove unavailable items to enable checkout.
                </Text>
              </View>
            )}

            {items.map((item) => (
              <CartItemRow
                key={item.productId}
                item={item}
                onIncrement={incrementQuantity}
                onDecrement={decrementQuantity}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}

            {/* Add More Products Button */}
            <TouchableOpacity
              style={styles.addMoreProductsBtn}
              onPress={handleAddProducts}
              activeOpacity={0.7}
            >
              <Plus size={15} color={Colors.leaf} style={{ marginRight: 6 }} />
              <Text style={styles.addMoreProductsBtnText}>+ Add More Products</Text>
            </TouchableOpacity>

            {/* Market Returns Section */}
            {renderMarketReturnsSection()}

            {/* Payment & Calculations Section (Sale Mode) */}
            {isSaleMode && (
              <>
                <Text style={styles.sectionHeading}>PAYMENT METHOD</Text>
                <PaymentMethodPicker
                  selected={paymentMethod}
                  onSelect={(m) => {
                    setPaymentMethod(m);
                    if (m === "credit") {
                      setPaidInputStr("0");
                      setPaidAmount(0);
                    } else if (m === "cash") {
                      setPaidInputStr(String(netTotal));
                      setPaidAmount(netTotal);
                    }
                  }}
                  allowCredit={hasCustomer}
                  style={{ marginBottom: Spacing.md }}
                />

                {/* Amount Paid Input */}
                <View style={styles.calculationCard}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Subtotal</Text>
                    <Text style={styles.calcVal}>{formatLKR(subtotal)}</Text>
                  </View>

                  {returnTotal > 0 && (
                    <>
                      <View style={styles.calcRow}>
                        <Text style={[styles.calcLabel, { color: Colors.clay, fontWeight: "600" }]}>
                          Market Returns Deduction
                        </Text>
                        <Text style={[styles.calcVal, { color: Colors.clay, fontWeight: "700" }]}>
                          -{formatLKR(returnTotal)}
                        </Text>
                      </View>
                      <View style={styles.calcRow}>
                        <Text style={[styles.calcLabel, { fontWeight: "600", color: Colors.ink }]}>
                          Adjusted Base Total
                        </Text>
                        <Text style={[styles.calcVal, { fontWeight: "700", color: Colors.ink }]}>
                          {formatLKR(baseTotal)}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Percentage Discount Input */}
                  <View style={[styles.calcRow, { alignItems: "center" }]}>
                    <View style={{ flex: 1, marginRight: Spacing.xs }}>
                      <Text style={styles.calcLabel}>Discount (%)</Text>
                      <Text style={styles.calcSubText}>
                        {discountAmount > 0 ? `Amount: -${formatLKR(discountAmount)}` : "0% - 100%"}
                      </Text>
                    </View>
                    <View style={styles.discountPercentInputWrap}>
                      <TextInput
                        style={styles.discountInput}
                        keyboardType="decimal-pad"
                        value={discountPercentStr}
                        placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                        onChangeText={handleDiscountPercentChange}
                      />
                      <Text style={styles.percentSymbol}>%</Text>
                    </View>
                  </View>

                  {discountAmount > 0 && (
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { color: Colors.danger }]}>Calculated Discount</Text>
                      <Text style={[styles.calcVal, { color: Colors.danger, fontWeight: "700" }]}>
                        -{formatLKR(discountAmount)}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.calcRow, styles.netRow]}>
                    <Text style={styles.netLabel}>NET BILLING TOTAL</Text>
                    <Text style={styles.netVal}>{formatLKR(netTotal)}</Text>
                  </View>

                  {/* Cash Handed / Paid Amount */}
                  <View style={[styles.calcRow, { marginTop: Spacing.sm }]}>
                    <Text style={[styles.calcLabel, { fontWeight: "700" }]}>
                      Amount Collected (LKR)
                    </Text>
                    <TextInput
                      style={styles.paidInput}
                      keyboardType="numeric"
                      value={paidInputStr}
                      placeholder="0.00"
                      onChangeText={(val) => {
                        setPaidInputStr(val);
                        setPaidAmount(Number(val || 0));
                      }}
                    />
                  </View>

                  {/* Due amount or change balance */}
                  {dueAmount > 0 && (
                    <View style={styles.dueRow}>
                      <Text style={styles.dueLabel}>Due (Added to Credit)</Text>
                      <Text style={styles.dueVal}>{formatLKR(dueAmount)}</Text>
                    </View>
                  )}

                  {balance > 0 && (
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabel}>Change to Return</Text>
                      <Text style={styles.balanceVal}>{formatLKR(balance)}</Text>
                    </View>
                  )}
                </View>

                {/* Credit Limit Exceeded Warning */}
                {isCreditOverLimit && (
                  <View style={styles.limitAlert}>
                    <AlertCircle size={16} color={Colors.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.limitAlertText}>
                      Warning: Due balance ({formatLKR(dueAmount)}) exceeds customer's available credit limit ({formatLKR(availableCredit)}).
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Order Mode Calculation Card */}
            {!isSaleMode && (
              <View style={styles.calculationCard}>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Order Subtotal</Text>
                  <Text style={styles.calcVal}>{formatLKR(subtotal)}</Text>
                </View>

                {returnTotal > 0 && (
                  <>
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { color: Colors.clay, fontWeight: "600" }]}>
                        Proposed Market Returns
                      </Text>
                      <Text style={[styles.calcVal, { color: Colors.clay, fontWeight: "700" }]}>
                        -{formatLKR(returnTotal)}
                      </Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { fontWeight: "600", color: Colors.ink }]}>
                        Adjusted Base Total
                      </Text>
                      <Text style={[styles.calcVal, { fontWeight: "700", color: Colors.ink }]}>
                        {formatLKR(baseTotal)}
                      </Text>
                    </View>
                  </>
                )}

                {/* Percentage Discount Input */}
                <View style={[styles.calcRow, { alignItems: "center" }]}>
                  <View style={{ flex: 1, marginRight: Spacing.xs }}>
                    <Text style={styles.calcLabel}>Order Discount (%)</Text>
                    <Text style={styles.calcSubText}>
                      {discountAmount > 0 ? `Amount: -${formatLKR(discountAmount)}` : "0% - 100%"}
                    </Text>
                  </View>
                  <View style={styles.discountPercentInputWrap}>
                    <TextInput
                      style={styles.discountInput}
                      keyboardType="decimal-pad"
                      value={discountPercentStr}
                      placeholder="0"
                      placeholderTextColor={Colors.textMuted}
                      onChangeText={handleDiscountPercentChange}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                </View>

                {discountAmount > 0 && (
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: Colors.danger }]}>Calculated Discount</Text>
                    <Text style={[styles.calcVal, { color: Colors.danger, fontWeight: "700" }]}>
                      -{formatLKR(discountAmount)}
                    </Text>
                  </View>
                )}

                <View style={[styles.calcRow, styles.netRow]}>
                  <Text style={styles.netLabel}>ESTIMATED NET TOTAL</Text>
                  <Text style={styles.netVal}>{formatLKR(netTotal)}</Text>
                </View>

                <Text style={styles.orderNoticeText}>
                  Booking this order will reserve warehouse inventory under trip shift without issuing an invoice. Delivery & payment collection will be finalized when delivered.
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Bottom Checkout Action (Phones and Stacked Tablet Mode) */}
        {items.length > 0 && !isSplitLayout && (
          <View style={styles.footer}>
            <View style={styles.footerSummary}>
              <Text style={styles.footerTotalLabel}>
                {isOfflineMode
                  ? "ESTIMATED TOTAL"
                  : isSaleMode
                  ? "NET TO PAY"
                  : "ORDER VALUE"}
              </Text>
              <Text style={styles.footerTotalAmount}>{formatLKR(netTotal)}</Text>
            </View>

            <Button
              title={
                isSubmitting
                  ? "Processing..."
                  : isOfflineMode
                  ? editingDraftId
                    ? `Update Offline Draft (${formatLKR(netTotal)})`
                    : `Save Offline Draft (${formatLKR(netTotal)})`
                  : hasStockWarning()
                  ? "Stock Unavailable - Adjust Cart"
                  : isSaleMode
                  ? `Confirm Sale (${formatLKR(netTotal)})`
                  : `Book Order (${items.length} items)`
              }
              variant="primary"
              size="lg"
              disabled={isSubmitting || !activeTrip || (!isOfflineMode && hasStockWarning())}
              onPress={handleCheckout}
              style={[styles.checkoutBtn, !isOfflineMode && hasStockWarning() && { opacity: 0.6 }]}
            />
          </View>
        )}

        {/* Customer Selector Modal */}
        <CustomerSelectorModal
          visible={customerModalVisible}
          selectedCustomer={selectedCustomer}
          onSelect={(c) => {
            setSelectedCustomer(c);
            if (!c && paymentMethod === "credit") {
              setPaymentMethod("cash");
              setPaidInputStr(String(netTotal));
              setPaidAmount(netTotal);
            }
          }}
          onClose={() => setCustomerModalVisible(false)}
          allowWalkIn={true}
        />

        {/* Market Return Modal */}
        <MarketReturnModal
          visible={marketReturnModalVisible}
          initialReturn={editingReturnItem}
          onClose={() => {
            setMarketReturnModalVisible(false);
            setEditingReturnIndex(null);
            setEditingReturnItem(null);
          }}
          onSave={handleSaveReturn}
        />

        {/* Sale Confirmation / Invoice Receipt Modal */}
        <InvoiceReceiptModal
          visible={!!confirmedSale || !!confirmedOrder}
          sale={confirmedSale}
          order={confirmedOrder}
          onClose={() => {
            setConfirmedSale(null);
            setConfirmedOrder(null);
            router.replace("/(tabs)/sales" as any);
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 1
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dangerLight
  },
  clearText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.danger
  },
  modeSection: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash,
    gap: Spacing.sm
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: Colors.border
  },
  modeTabActive: {
    backgroundColor: "#f0fdf4",
    borderColor: Colors.leaf
  },
  modeTabText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textMuted
  },
  modeTabTextActive: {
    color: Colors.leaf
  },
  modeTabTextActiveClay: {
    color: Colors.clay
  },
  tripAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a"
  },
  tripAlertText: {
    flex: 1,
    fontSize: Typography.xs,
    color: "#92400e",
    fontWeight: "500"
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  sectionHeading: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs + 2
  },
  customerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  customerCardPressed: {
    backgroundColor: Colors.surfaceSubtle
  },
  customerCardContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm
  },
  customerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm
  },
  customerCardName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  customerCardSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2
  },
  changeCustomerText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.leaf
  },
  itemsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs + 2
  },
  stockNotice: {
    flexDirection: "row",
    alignItems: "center"
  },
  stockNoticeText: {
    fontSize: 10,
    color: "#b45309",
    fontWeight: "700"
  },
  stockWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: "#fca5a5",
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md
  },
  stockWarningBannerText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.danger,
    fontWeight: "600",
    lineHeight: 16
  },
  calculationCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3
  },
  calcLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary
  },
  calcVal: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.ink
  },
  discountPercentInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xs,
    width: 90,
    height: 34
  },
  discountInput: {
    flex: 1,
    height: "100%",
    textAlign: "right",
    fontSize: Typography.xs,
    color: Colors.ink,
    paddingVertical: 0,
    paddingHorizontal: 2
  },
  percentSymbol: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.textMuted,
    marginLeft: 4
  },
  calcSubText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1
  },
  netRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    paddingTop: Spacing.xs + 2,
    marginTop: Spacing.xs
  },
  netLabel: {
    fontSize: Typography.xs,
    fontWeight: "800",
    color: Colors.ink
  },
  netVal: {
    fontSize: Typography.base,
    fontWeight: "900",
    color: Colors.leaf
  },
  paidInput: {
    width: 120,
    height: 38,
    borderWidth: 1.5,
    borderColor: Colors.leaf,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    textAlign: "right",
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.ink,
    backgroundColor: "#f0fdf4"
  },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs + 2,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash
  },
  dueLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.danger
  },
  dueVal: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.danger
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs
  },
  balanceLabel: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: Colors.textSecondary
  },
  balanceVal: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.success
  },
  limitAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md
  },
  limitAlertText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.danger,
    fontWeight: "600",
    lineHeight: 16
  },
  orderInfoCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  orderNoticeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: Spacing.xs + 2,
    lineHeight: 16
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xxl
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: "800",
    color: Colors.ink
  },
  emptySub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: Colors.slatewash,
    gap: Spacing.md
  },
  footerSummary: {
    minWidth: 100
  },
  footerTotalLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5
  },
  footerTotalAmount: {
    fontSize: Typography.base,
    fontWeight: "900",
    color: Colors.ink
  },
  checkoutBtn: {
    flex: 1
  },
  splitContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.background
  },
  splitLeft: {
    flex: 1.1,
    borderRightWidth: 1,
    borderRightColor: Colors.border
  },
  splitLeftContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl
  },
  splitRight: {
    flex: 0.9,
    backgroundColor: Colors.surface
  },
  splitRightScroll: {
    flex: 1
  },
  splitRightContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xl
  },
  splitCheckoutBox: {
    marginTop: Spacing.base,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md
  },
  addProductsHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: Colors.leaf
  },
  addProductsHeaderBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.leaf
  },
  addMoreProductsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: Colors.leaf,
    borderStyle: "dashed"
  },
  addMoreProductsBtnText: {
    fontSize: Typography.xs + 1,
    fontWeight: "700",
    color: Colors.leaf
  },
  returnsSectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md
  },
  returnsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm
  },
  returnsSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.clay,
    letterSpacing: 0.5
  },
  addReturnHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: Colors.clay
  },
  addReturnHeaderBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.clay
  },
  emptyReturnsBox: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs
  },
  emptyReturnsText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontStyle: "italic",
    lineHeight: 18
  },
  returnsList: {
    gap: Spacing.sm
  },
  returnItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slatewash
  },
  returnMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2
  },
  returnCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border
  },
  returnCodeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.ink
  },
  returnItemName: {
    fontSize: Typography.xs + 1,
    fontWeight: "600",
    color: Colors.ink
  },
  returnQtyText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1
  },
  returnReasonText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: "italic",
    marginTop: 1
  },
  returnRightCol: {
    alignItems: "flex-end"
  },
  returnLineTotal: {
    fontSize: Typography.xs + 1,
    fontWeight: "700",
    color: Colors.danger
  },
  returnActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4
  },
  returnActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center"
  },
  returnsTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border
  },
  returnsTotalLabel: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.clay
  },
  returnsTotalVal: {
    fontSize: Typography.sm,
    fontWeight: "800",
    color: Colors.danger
  }
});

