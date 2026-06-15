const Return = require("../models/Return");
const SupplierReturn = require("../models/SupplierReturn");

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
