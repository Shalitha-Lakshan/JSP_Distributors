export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  mode: "light" | "dark";
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  border: string;
  borderSubtle: string;
  borderDark: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // JSP Brand constants
  ink: string;
  leaf: string;
  leafDark: string;
  leafLight: string;
  sand: string;
  clay: string;
  clayLight: string;
  slatewash: string;

  // Status indicators
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
}

export const lightTheme: ThemeColors = {
  mode: "light",
  // Primary & accents
  primary: "#0f766e",        // Forest teal
  primaryDark: "#115e59",
  primaryLight: "#ccfbf1",
  background: "#f8f4e8",     // Warm sand/cream app background
  surface: "#ffffff",        // Card & modal background
  surfaceElevated: "#ffffff",
  surfaceSubtle: "#f1f5f9",
  border: "#cbd5e1",         // Standard crisp border
  borderSubtle: "#e2e8f0",
  borderDark: "#94a3b8",
  textPrimary: "#0f172a",    // Deep slate navy
  textSecondary: "#475569",  // Mid-slate
  textMuted: "#94a3b8",      // Placeholder and subtle hints
  textInverse: "#ffffff",    // Text on dark/primary backgrounds

  // Brand constants
  ink: "#0f172a",
  leaf: "#0f766e",
  leafDark: "#115e59",
  leafLight: "#ccfbf1",
  sand: "#f8f4e8",
  clay: "#f97316",
  clayLight: "#ffedd5",
  slatewash: "#e2e8f0",

  // Status & Feedback
  success: "#10b981",
  successLight: "#d1fae5",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  danger: "#ef4444",
  dangerLight: "#fee2e2",
  info: "#3b82f6",
  infoLight: "#dbeafe"
};

export const darkTheme: ThemeColors = {
  mode: "dark",
  // Primary & accents (high contrast on dark)
  primary: "#2dd4bf",        // Lighter teal for vibrant contrast
  primaryDark: "#14b8a6",
  primaryLight: "#134e4a",
  background: "#0b1220",     // Deep midnight navy
  surface: "#172033",        // Elevated dark slate
  surfaceElevated: "#1e293b",// Higher elevation cards & modals
  surfaceSubtle: "#1e293b",
  border: "#475569",         // Subtle dark border
  borderSubtle: "#334155",
  borderDark: "#64748b",
  textPrimary: "#f8fafc",    // Near white for high legibility
  textSecondary: "#cbd5e1",  // Light slate for descriptions
  textMuted: "#94a3b8",      // Accessible placeholder text
  textInverse: "#0f172a",    // Dark text on bright accents

  // Brand constants adapted for dark mode
  ink: "#f8fafc",            // Light text for headers
  leaf: "#2dd4bf",           // High-contrast teal
  leafDark: "#14b8a6",
  leafLight: "#134e4a",
  sand: "#0b1220",           // Dark background equivalent
  clay: "#fb923c",
  clayLight: "#431407",
  slatewash: "#334155",

  // Status & Feedback (vibrant high contrast)
  success: "#5eead4",
  successLight: "#042f2e",
  warning: "#fbbf24",
  warningLight: "#451a03",
  danger: "#fca5a5",
  dangerLight: "#450a0a",
  info: "#60a5fa",
  infoLight: "#172554"
};

