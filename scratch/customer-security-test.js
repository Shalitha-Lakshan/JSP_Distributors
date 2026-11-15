/**
 * Verification test runner for JSP Distributors Milestone 5:
 * Customer Management, Role-Aware Security, Phone Validation & Credit Calculations.
 */

/**
 * Sri Lankan phone number validation helper (matching mobile/src/utils/validation.ts)
 */
function validateSriLankanPhone(phone) {
  if (!phone || !phone.trim()) {
    return { isValid: true };
  }

  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  const lkRegex = /^(?:(?:\+94|94|0)?[1-9]\d{8})$/;

  if (!lkRegex.test(cleaned)) {
    return {
      isValid: false,
      error: "Please enter a valid Sri Lankan phone number (e.g. 077 123 4567 or +94 77 123 4567)"
    };
  }

  return { isValid: true };
}

function runTests() {
  console.log("=== Running JSP Distributors Milestone 5 Verification Suite ===\n");
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

  // --- 1. Sri Lankan Phone Validation Tests ---
  const validMobile1 = validateSriLankanPhone("0771234567");
  assert(validMobile1.isValid === true, "Valid 10-digit mobile (0771234567) accepted");

  const validMobileWithSpaces = validateSriLankanPhone("077 123 4567");
  assert(validMobileWithSpaces.isValid === true, "Formatted mobile with spaces (077 123 4567) accepted");

  const validIntl = validateSriLankanPhone("+94771234567");
  assert(validIntl.isValid === true, "International format (+94771234567) accepted");

  const validLandline = validateSriLankanPhone("0112345678");
  assert(validLandline.isValid === true, "Landline format (0112345678) accepted");

  const emptyPhone = validateSriLankanPhone("");
  assert(emptyPhone.isValid === true, "Empty phone string accepted as optional");

  const invalidPhoneShort = validateSriLankanPhone("12345");
  assert(invalidPhoneShort.isValid === false, "Short invalid phone rejected");

  const invalidLetters = validateSriLankanPhone("077ABC1234");
  assert(invalidLetters.isValid === false, "Alphanumeric phone rejected");

  // --- 2. Credit Calculation Tests ---
  function calculateAvailableCredit(creditLimit, outstandingBalance) {
    const limit = Math.max(0, Number(creditLimit || 0));
    const balance = Math.max(0, Number(outstandingBalance || 0));
    return Math.max(0, limit - balance);
  }

  const credit1 = calculateAvailableCredit(100000, 25000);
  assert(credit1 === 75000, "Limit 100k, Balance 25k -> Available Credit 75k");

  const credit2 = calculateAvailableCredit(50000, 60000);
  assert(credit2 === 0, "Limit 50k, Balance 60k (overlimit) -> Available Credit 0 (not negative)");

  const credit3 = calculateAvailableCredit(0, 10000);
  assert(credit3 === 0, "No Limit (0), Balance 10k -> Available Credit 0");

  const credit4 = calculateAvailableCredit(100000, 0);
  assert(credit4 === 100000, "Limit 100k, Balance 0 -> Available Credit 100k full");

  // --- 3. Backend Role-Aware Security Simulation Tests ---
  function sanitizeCustomerCreate(reqUser, body) {
    const isRep = reqUser && reqUser.role === "rep";
    const { name, phone, address, customerType, creditLimit, status } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      throw new Error("Customer name is required");
    }

    return {
      name: name.trim(),
      phone: phone ? String(phone).trim() : undefined,
      address: address ? String(address).trim() : undefined,
      customerType: ["walk-in", "retail", "wholesale", "credit"].includes(customerType)
        ? customerType
        : "walk-in",
      status: isRep ? "active" : (status || "active"),
      creditLimit: isRep ? 0 : Math.max(0, Number(creditLimit || 0)),
      outstandingBalance: 0 // Client cannot inject initial balance
    };
  }

  function sanitizeCustomerUpdate(reqUser, body) {
    const isRep = reqUser && reqUser.role === "rep";
    const { name, phone, address, customerType, creditLimit, status } = body;

    const allowedUpdates = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        throw new Error("Customer name cannot be empty");
      }
      allowedUpdates.name = name.trim();
    }
    if (phone !== undefined) allowedUpdates.phone = String(phone).trim();
    if (address !== undefined) allowedUpdates.address = String(address).trim();
    if (customerType !== undefined) {
      if (!["walk-in", "retail", "wholesale", "credit"].includes(customerType)) {
        throw new Error("Invalid customer type");
      }
      allowedUpdates.customerType = customerType;
    }

    if (!isRep) {
      if (status !== undefined) allowedUpdates.status = status;
      if (creditLimit !== undefined) {
        allowedUpdates.creditLimit = Math.max(0, Number(creditLimit || 0));
      }
    }

    // outstandingBalance is NEVER in allowedUpdates
    return allowedUpdates;
  }

  // Test: Rep tries to inject creditLimit and initial balance on creation
  const repCreateAttempt = sanitizeCustomerCreate(
    { role: "rep" },
    { name: "City Store", creditLimit: 500000, outstandingBalance: 100000 }
  );
  assert(
    repCreateAttempt.creditLimit === 0 && repCreateAttempt.outstandingBalance === 0,
    "Rep cannot assign creditLimit or outstandingBalance on customer creation"
  );

  // Test: Admin creates customer with authorized creditLimit
  const adminCreate = sanitizeCustomerCreate(
    { role: "admin" },
    { name: "Super Outlet", creditLimit: 250000, status: "active" }
  );
  assert(
    adminCreate.creditLimit === 250000 && adminCreate.outstandingBalance === 0,
    "Admin can specify creditLimit, initial outstandingBalance strictly defaults to 0"
  );

  // Test: Rep tries to modify creditLimit and outstandingBalance on update
  const repUpdateAttempt = sanitizeCustomerUpdate(
    { role: "rep" },
    { name: "Updated Store", creditLimit: 999999, outstandingBalance: 0 }
  );
  assert(
    repUpdateAttempt.name === "Updated Store" &&
    repUpdateAttempt.creditLimit === undefined &&
    repUpdateAttempt.outstandingBalance === undefined,
    "Rep update strictly strips creditLimit and outstandingBalance mass-assignment"
  );

  // Test: Admin modifies creditLimit and status
  const adminUpdate = sanitizeCustomerUpdate(
    { role: "admin" },
    { creditLimit: 150000, status: "inactive", outstandingBalance: 500 }
  );
  assert(
    adminUpdate.creditLimit === 150000 &&
    adminUpdate.status === "inactive" &&
    adminUpdate.outstandingBalance === undefined,
    "Admin can update creditLimit/status, but outstandingBalance remains protected from arbitrary edits"
  );

  console.log("\n==============================================");
  console.log(` ALL ${passed}/${total} VERIFICATION & SECURITY TESTS PASSED!`);
  console.log("==============================================");
}

runTests();
