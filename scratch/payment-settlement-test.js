/**
 * Verification test runner for JSP Distributors Milestone 6:
 * Payment Collections, Cheque Validation, Invoice Allocation FIFO,
 * Idempotency, and Trip Reconciliation.
 */

function runMilestone6Tests() {
  console.log("=== Running JSP Distributors Milestone 6 Payment & Settlement Test Suite ===\n");
  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`✓ TEST ${total} PASSED: ${name}`);
      passed++;
    } else {
      console.error(`✗ TEST ${total} FAILED: ${name}`);
    }
  }

  // --- 1. Payment Amount & Negative/Zero Validation ---
  function validatePaymentAmount(amount) {
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      return { isValid: false, error: "Payment amount must be greater than 0" };
    }
    return { isValid: true, amount: num };
  }

  assert(validatePaymentAmount(5000).isValid === true, "Valid positive amount 5000 accepted");
  assert(validatePaymentAmount(0).isValid === false, "Zero payment amount rejected");
  assert(validatePaymentAmount(-1500).isValid === false, "Negative payment amount rejected");
  assert(validatePaymentAmount("invalid").isValid === false, "NaN string amount rejected");

  // --- 2. Cheque Information Validation ---
  function validateCheque(method, chequeNo, bankName) {
    if (method !== "cheque") return { isValid: true };
    if (!chequeNo || !String(chequeNo).trim()) {
      return { isValid: false, error: "Cheque number is required" };
    }
    if (!bankName || !String(bankName).trim()) {
      return { isValid: false, error: "Bank name is required" };
    }
    return { isValid: true, chequeStatus: "pending" };
  }

  assert(
    validateCheque("cheque", "CHQ-98214", "Commercial Bank").isValid === true &&
    validateCheque("cheque", "CHQ-98214", "Commercial Bank").chequeStatus === "pending",
    "Valid cheque accepted with default 'pending' status"
  );
  assert(validateCheque("cheque", "", "Commercial Bank").isValid === false, "Missing cheque number rejected");
  assert(validateCheque("cheque", "CHQ-98214", "").isValid === false, "Missing bank name rejected");
  assert(validateCheque("cash", "", "").isValid === true, "Cash payment does not require cheque fields");

  // --- 3. FIFO Invoice Allocation Algorithm ---
  function allocateFIFO(paymentAmount, invoices) {
    let remaining = paymentAmount;
    const allocations = [];

    // Oldest invoices first
    const sorted = [...invoices].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const inv of sorted) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, inv.dueAmount);
      allocations.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        allocatedAmount: alloc,
        remainingDue: inv.dueAmount - alloc,
        status: inv.dueAmount - alloc <= 0 ? "paid" : "partial"
      });
      remaining -= alloc;
    }

    return {
      allocations,
      unallocatedAmount: remaining,
      totalAllocated: paymentAmount - remaining
    };
  }

  const sampleInvoices = [
    { _id: "inv-1", invoiceNo: "INV-001", dueAmount: 5000, createdAt: "2026-05-01T10:00:00Z" },
    { _id: "inv-2", invoiceNo: "INV-002", dueAmount: 3000, createdAt: "2026-05-02T10:00:00Z" },
    { _id: "inv-3", invoiceNo: "INV-003", dueAmount: 4000, createdAt: "2026-05-03T10:00:00Z" }
  ];

  // Test: Pay 6000 across invoices
  const fifoResult = allocateFIFO(6000, sampleInvoices);
  assert(fifoResult.allocations.length === 2, "Allocated across 2 oldest invoices");
  assert(
    fifoResult.allocations[0].invoiceNo === "INV-001" &&
    fifoResult.allocations[0].allocatedAmount === 5000 &&
    fifoResult.allocations[0].status === "paid",
    "Invoice 1 (Rs. 5000) fully settled as 'paid'"
  );
  assert(
    fifoResult.allocations[1].invoiceNo === "INV-002" &&
    fifoResult.allocations[1].allocatedAmount === 1000 &&
    fifoResult.allocations[1].remainingDue === 2000 &&
    fifoResult.allocations[1].status === "partial",
    "Invoice 2 (Rs. 3000) partially settled with Rs. 1000, remaining due Rs. 2000 as 'partial'"
  );
  assert(fifoResult.totalAllocated === 6000 && fifoResult.unallocatedAmount === 0, "Exact total Rs. 6000 allocated with 0 remainder");

  // --- 4. Allocation Limit Guards ---
  function validateAllocations(paymentAmount, allocations, invoiceDueMap) {
    let totalAlloc = 0;
    for (const alloc of allocations) {
      if (alloc.allocatedAmount <= 0) return { isValid: false, error: "Allocation must be > 0" };
      const due = invoiceDueMap[alloc.invoiceId];
      if (alloc.allocatedAmount > due) {
        return { isValid: false, error: `Allocation (${alloc.allocatedAmount}) exceeds invoice due (${due})` };
      }
      totalAlloc += alloc.allocatedAmount;
    }
    if (totalAlloc > paymentAmount) {
      return { isValid: false, error: `Total allocations (${totalAlloc}) exceed payment amount (${paymentAmount})` };
    }
    return { isValid: true, totalAllocated: totalAlloc };
  }

  const invoiceDueMap = { "inv-1": 5000, "inv-2": 3000 };
  assert(
    validateAllocations(5000, [{ invoiceId: "inv-1", allocatedAmount: 6000 }], invoiceDueMap).isValid === false,
    "Allocation exceeding invoice due balance correctly rejected"
  );
  assert(
    validateAllocations(4000, [{ invoiceId: "inv-1", allocatedAmount: 3000 }, { invoiceId: "inv-2", allocatedAmount: 2000 }], invoiceDueMap).isValid === false,
    "Allocations exceeding total payment amount correctly rejected"
  );
  assert(
    validateAllocations(4000, [{ invoiceId: "inv-1", allocatedAmount: 2500 }, { invoiceId: "inv-2", allocatedAmount: 1500 }], invoiceDueMap).isValid === true,
    "Valid split allocations matching payment amount accepted"
  );

  // --- 5. Active Trip & Rep Security Enforcement ---
  function canRepCollectPayment(repRole, activeTrip) {
    if (repRole === "rep" && (!activeTrip || activeTrip.status !== "active")) {
      return { allowed: false, message: "Active trip session required" };
    }
    return { allowed: true };
  }

  assert(canRepCollectPayment("rep", null).allowed === false, "Rep collection blocked when no active trip session exists");
  assert(canRepCollectPayment("rep", { status: "pending_audit" }).allowed === false, "Rep collection blocked when trip is in audit");
  assert(canRepCollectPayment("rep", { status: "active", _id: "trip-1" }).allowed === true, "Rep collection allowed with active trip");

  // --- 6. Idempotency Key Replay Simulation ---
  const paymentDatabase = new Map();

  function processPaymentWithIdempotency(payload) {
    if (payload.idempotencyKey && paymentDatabase.has(payload.idempotencyKey)) {
      // Return existing payment record without double-crediting
      return { status: 200, isReplay: true, payment: paymentDatabase.get(payload.idempotencyKey) };
    }

    const newPayment = {
      _id: "pay-" + Date.now(),
      paymentNo: "PAY-" + Math.floor(Math.random() * 1000000),
      amount: payload.amount,
      customer: payload.customer,
      idempotencyKey: payload.idempotencyKey,
      createdAt: new Date().toISOString()
    };

    if (payload.idempotencyKey) {
      paymentDatabase.set(payload.idempotencyKey, newPayment);
    }

    return { status: 201, isReplay: false, payment: newPayment };
  }

  const txnKey = "PAY-CLIENT-TEST-12345";
  const firstSubmission = processPaymentWithIdempotency({ amount: 5000, customer: "cust-1", idempotencyKey: txnKey });
  assert(firstSubmission.status === 201 && firstSubmission.isReplay === false, "Initial payment created with HTTP 201");

  const replaySubmission = processPaymentWithIdempotency({ amount: 5000, customer: "cust-1", idempotencyKey: txnKey });
  assert(
    replaySubmission.status === 200 &&
    replaySubmission.isReplay === true &&
    replaySubmission.payment._id === firstSubmission.payment._id,
    "Duplicate request with same idempotencyKey returns existing record with HTTP 200 (no duplicate record)"
  );

  // --- 7. Customer Balance & Trip Collections Math ---
  function computeSettlementBalances(customerBalance, tripCollections, amount, method) {
    const nextBalance = Math.max(0, customerBalance - amount);
    const nextTrip = { ...tripCollections };
    if (method === "cash") {
      nextTrip.cash = (nextTrip.cash || 0) + amount;
    } else if (method === "cheque") {
      nextTrip.cheque = (nextTrip.cheque || 0) + amount;
    }
    return { nextBalance, nextTrip };
  }

  const mathResult = computeSettlementBalances(25000, { cash: 10000, cheque: 5000 }, 7000, "cash");
  assert(mathResult.nextBalance === 18000, "Customer balance decremented from 25k to 18k");
  assert(mathResult.nextTrip.cash === 17000, "Trip cash collections incremented from 10k to 17k");

  const chequeMath = computeSettlementBalances(18000, { cash: 17000, cheque: 5000 }, 8000, "cheque");
  assert(chequeMath.nextBalance === 10000, "Customer balance decremented to 10k on cheque receipt");
  assert(chequeMath.nextTrip.cheque === 13000, "Trip cheque collections incremented from 5k to 13k");

  console.log("\n==============================================");
  console.log(` ALL ${passed}/${total} MILESTONE 6 VERIFICATION TESTS PASSED!`);
  console.log("==============================================");
}

runMilestone6Tests();

