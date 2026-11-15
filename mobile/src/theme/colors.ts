export const Colors = {
  // JSP Brand Palette
  ink: "#0f172a",          // Deep slate navy (Primary text, dark headers)
  leaf: "#0f766e",         // Forest teal/green (Primary brand color, buttons, active tabs)
  leafDark: "#115e59",     // Darker teal for pressed states
  leafLight: "#ccfbf1",    // Pale teal for badges and accents
  sand: "#f8f4e8",         // Warm sand/cream (App background)
  clay: "#f97316",         // Vibrant orange (Accents, warnings, expenses)
  clayLight: "#ffedd5",    // Light orange tint
  slatewash: "#e2e8f0",    // Soft border and divider slate

  // Neutral UI
  background: "#f8fafc",   // Main screen background
  surface: "#ffffff",      // Card and container background
  surfaceSubtle: "#f1f5f9",// Sub-card background
  border: "#e2e8f0",       // Standard borders
  borderDark: "#cbd5e1",

  // Text Hierarchy
  textPrimary: "#0f172a",  // High-emphasis text
  textSecondary: "#475569",// Medium-emphasis subtitles and labels
  textMuted: "#94a3b8",    // Placeholder and disabled text
  textInverse: "#ffffff",  // Text on dark/leaf backgrounds

  // Status & Feedback
  success: "#10b981",      // Emerald green (Collections, paid, approved)
  successLight: "#d1fae5",
  warning: "#f59e0b",      // Amber (Pending audit, partial payment)
  warningLight: "#fef3c7",
  danger: "#ef4444",       // Rose red (Cancelled, rejected, variances)
  dangerLight: "#fee2e2",
  info: "#3b82f6",         // Blue (Orders, info tags)
  infoLight: "#dbeafe",
};

export const Typography = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

export * from "./themes";
export * from "./ThemeContext";


