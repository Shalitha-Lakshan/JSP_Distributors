const Return = require("../models/Return");
const SupplierReturn = require("../models/SupplierReturn");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Sale = require("../models/Sale");
const Customer = require("../models/Customer");
const TripSession = require("../models/TripSession");

/**
 * Fetch all customer returns that have NOT been dispatched yet, flattened as pending items.
 * GET /api/returns/pending
 */
exports.getPendingReturns = async (req, res) => {
  try {
    // Find returns that contain at least one item that is not dispatched
    const returns = await Return.find({
      $or: [
        { "items.status": { $ne: "dispatched" } },
        { status: "pending" } // Fallback for old documents
      ]
    })
      .sort({ createdAt: -1 })
      .populate("customer", "name code phone")
      .populate("cashier", "name")
      .populate({
        path: "items.productId",
        select: "supplier displayName itemCode"
      });

    const pendingItems = [];
    returns.forEach((ret) => {
      ret.items.forEach((item) => {
        // We consider an item pending if its status is not 'dispatched'
        if (item.status !== "dispatched") {
          pendingItems.push({
            returnId: ret._id,
            invoiceNo: ret.invoiceNo,
            customer: ret.customer,
            createdAt: ret.createdAt,
            productId: item.productId?._id || item.productId,
            // Extract supplier from populated product or default to "Ruhunu Foods"
            supplier: item.productId?.supplier || "Ruhunu Foods",
            itemCode: item.itemCode,
            itemName: item.itemName,
            quantity: item.quantity,
            returnPrice: item.returnPrice,
            returnTotal: item.returnTotal || (item.quantity * item.returnPrice),
            condition: item.condition,
            reason: item.reason,
            originalInvoiceNo: item.originalInvoiceNo || ret.invoiceNo,
            // Unique key for tracking selection in frontend
            key: `${ret._id}-${item.itemCode}-${item.condition}`
          });
        }
      });
    });

    res.json(pendingItems);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch pending returns" });
  }
};

/**
 * Fetch history of dispatches to supplier.
 * GET /api/returns/dispatched
 */
exports.getDispatchHistory = async (req, res) => {
  try {
    const dispatches = await SupplierReturn.find()
      .sort({ dispatchedAt: -1 })
      .populate("dispatchedBy", "name");

    res.json(dispatches);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch dispatch history" });
  }
};

/**
 * Dispatch specific customer return items back to a designated supplier.
 * POST /api/returns/dispatch
 * Payload: { supplierName: string, dispatchItems: [{ returnId, itemCode, condition }] }
 */
exports.dispatchToSupplier = async (req, res) => {
  try {
    const { supplierName, dispatchItems } = req.body;

    if (!supplierName) {
      return res.status(400).json({ message: "Supplier Name is required" });
    }

    if (!dispatchItems || !Array.isArray(dispatchItems) || dispatchItems.length === 0) {
      return res.status(400).json({ message: "Invalid or empty dispatchItems list" });
    }

    // Generate unique supplier invoice number
    const supplierInvoiceNo = `SRI-${Date.now()}`;
    const userId = req.user?._id || req.user?.id; // from requireAuth middleware

    const aggregatedItemsMap = new Map();
    let totalAmount = 0;

    // Process each item to dispatch
    for (const dItem of dispatchItems) {
      const { returnId, itemCode, condition } = dItem;

      // Find the parent customer return document
      const retDoc = await Return.findById(returnId);
      if (!retDoc) continue;

      // Find the specific item in the items array
      const itemToUpdate = retDoc.items.find(
        (item) => item.itemCode === itemCode && item.condition === condition
      );

      if (!itemToUpdate || itemToUpdate.status === "dispatched") {
        continue; // Skip if not found or already dispatched
      }

      // Mark item as dispatched
      itemToUpdate.status = "dispatched";
      itemToUpdate.supplierInvoiceNo = supplierInvoiceNo;
      itemToUpdate.dispatchedAt = new Date();

      // Aggregate item details for the SupplierReturn invoice
      const itemTotal = itemToUpdate.returnTotal || (itemToUpdate.quantity * itemToUpdate.returnPrice);
      totalAmount += itemTotal;

      const mapKey = `${itemCode}-${condition}`;
      if (aggregatedItemsMap.has(mapKey)) {
        const existing = aggregatedItemsMap.get(mapKey);
        existing.quantity += itemToUpdate.quantity;
        existing.returnTotal += itemTotal;
      } else {
        aggregatedItemsMap.set(mapKey, {
          productId: itemToUpdate.productId,
          itemCode: itemToUpdate.itemCode,
          itemName: itemToUpdate.itemName,
          quantity: itemToUpdate.quantity,
          returnPrice: itemToUpdate.returnPrice,
          returnTotal: itemTotal,
          condition: itemToUpdate.condition,
          originalInvoiceNo: itemToUpdate.originalInvoiceNo || retDoc.invoiceNo,
          reason: itemToUpdate.reason
        });
      }

      // Check if all items in this parent return document are now dispatched
      const allDispatched = retDoc.items.every((item) => item.status === "dispatched");
      if (allDispatched) {
        retDoc.status = "dispatched";
        retDoc.supplierInvoiceNo = supplierInvoiceNo;
        retDoc.dispatchedAt = new Date();
      }

      // Save the updated return document
      await retDoc.save();
    }

    const itemsToSave = Array.from(aggregatedItemsMap.values());

    if (itemsToSave.length === 0) {
      return res.status(400).json({ message: "No items were eligible for dispatch" });
    }

    // Create Supplier Return Record
    const supplierReturnRecord = await SupplierReturn.create({
      supplierInvoiceNo,
      supplierName,
      dispatchedBy: userId,
      items: itemsToSave,
      totalAmount,
      dispatchedAt: new Date()
    });

    // Populate the cashier/user info for the response
    const populated = await SupplierReturn.findById(supplierReturnRecord._id)
      .populate("dispatchedBy", "name");

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to dispatch returns to supplier" });
  }
};

/**
 * Create an independent customer return against an existing invoice.
 * POST /api/returns
 * Body: { customerId, invoiceNo, items: [{ productId, itemCode, itemName, quantity, returnPrice, condition, reason }] }
 */
exports.createCustomerReturn = async (req, res) => {
  try {
    const { customerId, invoiceNo, items } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required." });
    }
    if (!invoiceNo) {
      return res.status(400).json({ message: "Original Invoice Number is required." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one return item is required." });
    }

    // Require active trip for reps
    let activeTrip = null;
    if (req.user?.role === "rep") {
      activeTrip = await TripSession.findOne({
        rep: req.user._id,
        status: "active"
      });
      if (!activeTrip) {
        return res.status(400).json({
          message: "An active route trip session is required to record customer returns."
        });
      }
    } else {
      activeTrip = await TripSession.findOne({
        status: "active"
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const sale = await Sale.findOne({
      invoiceNo: invoiceNo.trim(),
      status: { $ne: "cancelled" }
    });
    if (!sale) {
      return res.status(404).json({ message: `Invoice "${invoiceNo}" not found or has been cancelled.` });
    }

    if (sale.customer && sale.customer.toString() !== customer._id.toString()) {
      return res.status(400).json({ message: "The selected invoice does not belong to this customer." });
    }

    // Fetch existing returns for this invoice to calculate previously returned quantities
    const existingReturns = await Return.find({ invoiceNo: sale.invoiceNo });
    const returnQtyMap = {};
    existingReturns.forEach((ret) => {
      (ret.items || []).forEach((it) => {
        returnQtyMap[it.itemCode] = (returnQtyMap[it.itemCode] || 0) + it.quantity;
      });
    });

    const validatedItems = [];
    let totalReturnAmount = 0;

    for (const item of items) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ message: `Invalid quantity for item ${item.itemName || item.itemCode}.` });
      }

      // Check item in original sale
      const originalSaleItem = (sale.items || []).find(
        (si) =>
          si.itemCode === item.itemCode ||
          (item.productId && si.product?.toString() === item.productId.toString())
      );

      if (!originalSaleItem) {
        return res.status(400).json({
          message: `Item ${item.itemName || item.itemCode} was not part of original invoice ${invoiceNo}.`
        });
      }

      const alreadyReturnedQty = returnQtyMap[item.itemCode] || 0;
      const eligibleQty = Math.max(0, originalSaleItem.quantity - alreadyReturnedQty);

      if (qty > eligibleQty) {
        return res.status(400).json({
          message: `Return quantity (${qty}) for "${item.itemName || item.itemCode}" exceeds remaining eligible quantity (${eligibleQty}).`
        });
      }

      const price = Number(item.returnPrice) > 0 ? Number(item.returnPrice) : originalSaleItem.sellingPrice;
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ message: `Invalid return unit price for item ${item.itemName || item.itemCode}.` });
      }

      if (price > originalSaleItem.sellingPrice) {
        return res.status(400).json({
          message: `Return unit price (Rs. ${price.toFixed(2)}) for "${item.itemName || item.itemCode}" cannot exceed original invoiced selling price (Rs. ${originalSaleItem.sellingPrice.toFixed(2)}).`
        });
      }

      const lineReturnTotal = Math.round(qty * price * 100) / 100;
      totalReturnAmount += lineReturnTotal;

      const condition = ["resellable", "damaged", "expired"].includes(item.condition)
        ? item.condition
        : "resellable";

      validatedItems.push({
        productId: originalSaleItem.product || item.productId,
        itemCode: item.itemCode,
        itemName: item.itemName || originalSaleItem.itemName,
        quantity: qty,
        returnPrice: price,
        returnTotal: lineReturnTotal,
        condition,
        reason: item.reason ? String(item.reason).trim() : "",
        originalInvoiceNo: sale.invoiceNo,
        status: "pending",
        inspectionStatus: "pending_inspection",
        approvedResellableQty: 0,
        rejectedQty: 0
      });

      // Update in-memory map to prevent exceeding in same payload with duplicate items
      returnQtyMap[item.itemCode] = alreadyReturnedQty + qty;
    }

    // Warehouse Return Inspection Policy:
    // Do NOT immediately add to Product.totalStock or create a sellable StockBatch.
    // Stock will enter 'pending_inspection' and only be restored when physically
    // reviewed and approved by a Manager/Admin at the warehouse.

    // Financial adjustment:
    // 1. Adjust customer's outstandingBalance if they have one
    if (customer.outstandingBalance && customer.outstandingBalance > 0) {
      customer.outstandingBalance = Math.max(0, customer.outstandingBalance - totalReturnAmount);
      await customer.save();
    }

    // 2. Adjust original sale's dueAmount if it had an unpaid due amount
    if (sale.dueAmount && sale.dueAmount > 0) {
      const deduction = Math.min(sale.dueAmount, totalReturnAmount);
      sale.dueAmount = Math.max(0, sale.dueAmount - deduction);
      if (sale.dueAmount === 0 && sale.paidAmount > 0) {
        sale.paymentStatus = "paid";
      }
      await sale.save();
    }

    // Create Return record in pending_inspection status
    const newReturn = await Return.create({
      saleId: sale._id,
      invoiceNo: sale.invoiceNo,
      customer: customer._id,
      cashier: req.user._id,
      tripId: activeTrip?._id,
      items: validatedItems,
      returnTotal: Math.round(totalReturnAmount * 100) / 100,
      status: "pending",
      inspectionStatus: "pending_inspection"
    });

    const populated = await Return.findById(newReturn._id)
      .populate("customer", "name phone address customerType")
      .populate("cashier", "name")
      .populate("tripId", "tripNo route");

    return res.status(201).json(populated);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to record customer return" });
  }
};

/**
 * Get eligible invoices for returns for a specific customer.
 * GET /api/returns/eligible-invoices/:customerId
 */
exports.getEligibleInvoices = async (req, res) => {
  try {
    const { customerId } = req.params;
    const sales = await Sale.find({
      customer: customerId,
      status: { $ne: "cancelled" }
    })
      .sort({ createdAt: -1 })
      .limit(30);

    const eligibleInvoices = [];

    for (const sale of sales) {
      const returnsForSale = await Return.find({ invoiceNo: sale.invoiceNo });
      const returnQtyMap = {};
      returnsForSale.forEach((ret) => {
        (ret.items || []).forEach((it) => {
          returnQtyMap[it.itemCode] = (returnQtyMap[it.itemCode] || 0) + it.quantity;
        });
      });

      const eligibleItems = [];
      (sale.items || []).forEach((item) => {
        const returnedQty = returnQtyMap[item.itemCode] || 0;
        const availableQty = Math.max(0, item.quantity - returnedQty);
        if (availableQty > 0) {
          eligibleItems.push({
            productId: item.product,
            itemCode: item.itemCode,
            itemName: item.itemName,
            soldQty: item.quantity,
            alreadyReturnedQty: returnedQty,
            eligibleQty: availableQty,
            returnPrice: item.sellingPrice
          });
        }
      });

      if (eligibleItems.length > 0) {
        eligibleInvoices.push({
          _id: sale._id,
          invoiceNo: sale.invoiceNo,
          createdAt: sale.createdAt,
          netTotal: sale.netTotal,
          paymentStatus: sale.paymentStatus,
          dueAmount: sale.dueAmount,
          items: eligibleItems
        });
      }
    }

    return res.json(eligibleInvoices);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch eligible invoices" });
  }
};

/**
 * List returns with filters (for rep history or manager view)
 * GET /api/returns
 */
exports.getCustomerReturns = async (req, res) => {
  try {
    const { customerId, condition, status, startDate, endDate, invoiceNo } = req.query;
    const filter = {};

    if (customerId) {
      filter.customer = customerId;
    }
    if (invoiceNo) {
      filter.invoiceNo = new RegExp(invoiceNo, "i");
    }
    if (status) {
      filter.status = status;
    }
    if (condition && condition !== "all") {
      filter["items.condition"] = condition;
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (req.user?.role === "rep") {
      filter.cashier = req.user._id;
    }

    const returns = await Return.find(filter)
      .sort({ createdAt: -1 })
      .populate("customer", "name phone address customerType")
      .populate("cashier", "name")
      .populate("tripId", "tripNo route");

    return res.json(returns);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch customer returns" });
  }
};

/**
 * Get all customer returns pending warehouse inspection.
 * GET /api/returns/pending-inspection
 */
exports.getPendingInspectionReturns = async (req, res) => {
  try {
    const filter = {
      $or: [
        { inspectionStatus: "pending_inspection" },
        { inspectionStatus: { $exists: false } },
        { "items.inspectionStatus": "pending_inspection" }
      ]
    };

    if (req.query.tripId) {
      filter.tripId = req.query.tripId;
    }

    const returns = await Return.find(filter)
      .sort({ createdAt: -1 })
      .populate("customer", "name code phone")
      .populate("cashier", "name")
      .populate("tripId", "tripNo route")
      .populate("items.productId", "displayName itemCode supplier totalStock");

    return res.json(returns);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch pending inspections" });
  }
};

/**
 * Warehouse Inspection of Customer Returns.
 * POST /api/returns/:id/inspect
 * Restricted to Manager / Admin.
 * Body: {
 *   inspections: [
 *     { itemCode: string, approvedResellableQty: number, rejectedQty: number, rejectionReason?: string }
 *   ],
 *   inspectionNotes?: string
 * }
 */
exports.inspectReturn = async (req, res) => {
  try {
    if (!["manager", "admin"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Only managers or admins can perform warehouse return inspections." });
    }

    const { id } = req.params;
    const { inspections, inspectionNotes } = req.body;

    if (!inspections || !Array.isArray(inspections) || inspections.length === 0) {
      return res.status(400).json({ message: "Inspections list is required." });
    }

    const returnDoc = await Return.findById(id);
    if (!returnDoc) {
      return res.status(404).json({ message: "Return record not found." });
    }

    if (returnDoc.inspectionStatus === "approved" || returnDoc.inspectionStatus === "rejected") {
      return res.status(400).json({ message: "This return document has already been fully inspected and finalized." });
    }

    let newlyApprovedTotalQty = 0;
    const stockBatchesCreated = [];

    for (const insp of inspections) {
      const { itemCode, approvedResellableQty = 0, rejectedQty = 0, rejectionReason } = insp;
      const targetItem = returnDoc.items.find((it) => it.itemCode === itemCode);

      if (!targetItem) {
        return res.status(400).json({ message: `Item with code "${itemCode}" not found in return ${returnDoc.invoiceNo}.` });
      }

      // Safeguard against double approval
      if (targetItem.inspectionStatus !== "pending_inspection" && targetItem.inspectionStatus !== undefined) {
        return res.status(400).json({
          message: `Item "${itemCode}" has already been inspected (status: ${targetItem.inspectionStatus}).`
        });
      }

      const approvedQty = Number(approvedResellableQty);
      const rejQty = Number(rejectedQty);

      if (isNaN(approvedQty) || approvedQty < 0 || isNaN(rejQty) || rejQty < 0) {
        return res.status(400).json({ message: `Approved and rejected quantities must be non-negative numbers for item ${itemCode}.` });
      }

      if (approvedQty + rejQty > targetItem.quantity) {
        return res.status(400).json({
          message: `Total inspected quantity (${approvedQty + rejQty}) cannot exceed returned quantity (${targetItem.quantity}) for item ${itemCode}.`
        });
      }

      targetItem.approvedResellableQty = approvedQty;
      targetItem.rejectedQty = rejQty;
      targetItem.rejectionReason = rejectionReason ? String(rejectionReason).trim() : "";
      targetItem.inspectedAt = new Date();
      targetItem.inspectedBy = req.user._id;

      if (approvedQty > 0) {
        targetItem.inspectionStatus = "approved";
        newlyApprovedTotalQty += approvedQty;

        // Restore sellable inventory ONLY for the confirmed approved resellable quantity
        const product = await Product.findById(targetItem.productId);
        if (product) {
          product.totalStock += approvedQty;
          await product.save();

          const batch = await StockBatch.create({
            productId: product._id,
            batchNo: `R-INSP-${Date.now()}-${targetItem.itemCode}`,
            billingPrice: targetItem.returnPrice,
            sellingPrice: product.currentSellingPrice,
            quantity: approvedQty,
            remainingQty: approvedQty,
            receivedDate: new Date(),
            createdBy: req.user._id
          });

          targetItem.stockBatchId = batch._id;
          stockBatchesCreated.push(batch);
        }
      } else {
        targetItem.inspectionStatus = "rejected";
      }
    }

    // Evaluate overall return document inspection status
    const allInspected = returnDoc.items.every((it) => it.inspectionStatus && it.inspectionStatus !== "pending_inspection");
    const anyApproved = returnDoc.items.some((it) => (it.approvedResellableQty || 0) > 0);
    const anyRejected = returnDoc.items.some((it) => (it.rejectedQty || 0) > 0 || it.inspectionStatus === "rejected");

    if (allInspected) {
      if (anyApproved && anyRejected) {
        returnDoc.inspectionStatus = "partially_approved";
      } else if (anyApproved) {
        returnDoc.inspectionStatus = "approved";
      } else {
        returnDoc.inspectionStatus = "rejected";
      }
    } else {
      returnDoc.inspectionStatus = anyApproved ? "partially_approved" : "pending_inspection";
    }

    returnDoc.inspectedBy = req.user._id;
    returnDoc.inspectedAt = new Date();
    returnDoc.inspectionNotes = inspectionNotes ? String(inspectionNotes).trim() : "";

    await returnDoc.save();

    const populated = await Return.findById(returnDoc._id)
      .populate("customer", "name code phone")
      .populate("cashier", "name")
      .populate("inspectedBy", "name")
      .populate("items.productId", "displayName itemCode supplier totalStock")
      .populate("tripId", "tripNo route");

    return res.json({
      message: "Warehouse return inspection successfully recorded.",
      returnRecord: populated,
      newlyApprovedTotalQty,
      batchesCreatedCount: stockBatchesCreated.length
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to record return inspection" });
  }
};

/**
 * Get history of inspected returns.
 * GET /api/returns/inspections
 */
exports.getInspectionHistory = async (req, res) => {
  try {
    const filter = {
      inspectionStatus: { $in: ["approved", "partially_approved", "rejected"] }
    };

    const returns = await Return.find(filter)
      .sort({ inspectedAt: -1, updatedAt: -1 })
      .populate("customer", "name code phone")
      .populate("cashier", "name")
      .populate("inspectedBy", "name")
      .populate("tripId", "tripNo route")
      .populate("items.productId", "displayName itemCode supplier");

    return res.json(returns);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch inspection history" });
  }
};
