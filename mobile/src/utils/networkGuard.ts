import { Alert } from "react-native";
import { networkService } from "../services/networkService";

/**
 * Network Guard for Financial Integrity.
 *
 * POLICY:
 * In accordance with Milestone 9 business specifications, offline mutation of financial
 * transactions (sales, orders, delivery, payments, returns, expenses, daily closing)
 * is STRICTLY FORBIDDEN.
 *
 * All financial mutations require real-time central backend validation to prevent:
 * - Negative inventory race conditions
 * - Duplicate invoice sequence collisions
 * - Ledger & credit balance desynchronization
 * - Unverified cash/cheque claims
 */

export const OFFLINE_BLOCKED_MESSAGE =
  "A live server connection is required to complete this action. Financial transactions and record modifications cannot be finalized offline to protect inventory and ledger integrity.";

export function isOnline(): boolean {
  return networkService.getStatus().isOnline;
}

export function canPerformOnlineAction(): { allowed: boolean; reason?: string } {
  const status = networkService.getStatus();
  if (status.isOnline) {
    return { allowed: true };
  }

  if (status.isOffline) {
    return {
      allowed: false,
      reason: "You are currently offline. Live connection required."
    };
  }

  return {
    allowed: false,
    reason: "Central server is currently unreachable. Live connection required."
  };
}

/**
 * Verifies live connection before executing a mutation.
 * If offline or server is unreachable, prompts an alert and blocks execution.
 *
 * @param actionName Friendly name of action being attempted (e.g. "Completing Sale", "Collecting Payment")
 * @returns boolean `true` if online and safe to proceed, `false` if blocked.
 */
export function assertOnline(actionName: string): boolean {
  const { allowed, reason } = canPerformOnlineAction();
  if (!allowed) {
    Alert.alert(
      "Live Connection Required",
      `${actionName} cannot be completed right now.\n\n${reason || OFFLINE_BLOCKED_MESSAGE}`,
      [{ text: "OK", style: "default" }]
    );
    return false;
  }
  return true;
}

