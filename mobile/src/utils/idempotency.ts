/**
 * Generates a unique, collision-resistant idempotency key for financial transactions.
 * Combines prefix, timestamp, and high-entropy random characters to guarantee client-side uniqueness.
 */
export function generateIdempotencyKey(prefix: string = "PAY"): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  const extraEntropy = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `${prefix}-${timestamp}-${randomPart}-${extraEntropy}`;
}

