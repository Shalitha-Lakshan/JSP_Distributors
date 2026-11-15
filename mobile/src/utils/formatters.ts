/**
 * Formats a numeric value into Sri Lankan Rupee currency string: "Rs. X,XXX.XX"
 */
export function formatLKR(amount?: number | null): string {
  return `Rs. ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Formats an ISO date string into readable Sri Lankan date: "DD/MM/YYYY" or "DD MMM YYYY"
 */
export function formatDateLK(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "-";
  }
}

/**
 * Formats an ISO date string into date + time: "DD MMM YYYY, hh:mm A"
 */
export function formatDateTimeLK(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return "-";
  }
}

