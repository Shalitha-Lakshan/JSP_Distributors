import { useWindowDimensions } from "react-native";

export interface ResponsiveLayout {
  width: number;
  height: number;
  isLandscape: boolean;
  isPortrait: boolean;
  isPhone: boolean;
  isSmallPhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  contentMaxWidth?: number;
  modalMaxWidth: number;
  columns: number;
  spacingMultiplier: number;
}

/**
 * JSP Distributors Unified Responsive Hook
 * Provides reactive layout measurements, device classification,
 * dynamic grid column calculations, and maximum container widths.
 * Automatically updates on screen rotation or window resizing.
 */
export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isPortrait = !isLandscape;
  const isSmallPhone = width < 360;
  const isTablet = width >= 600;
  const isLargeTablet = width >= 900;
  const isPhone = width < 600;

  // Adaptive content max-width to prevent UI stretching on tablets/desktops
  let contentMaxWidth: number | undefined;
  if (width >= 1200) {
    contentMaxWidth = 1120;
  } else if (width >= 900) {
    contentMaxWidth = 880;
  } else if (width >= 600) {
    contentMaxWidth = 680;
  } else {
    contentMaxWidth = undefined; // Full width on phones
  }

  // Modals should never stretch beyond 580dp on large screens
  const modalMaxWidth = Math.min(580, Math.round(width * 0.92));

  // Dynamic grid columns for card lists
  let columns = 1;
  if (width >= 1024) {
    columns = 3;
  } else if (width >= 600) {
    columns = 2;
  } else {
    columns = 1;
  }

  const spacingMultiplier = isTablet ? 1.25 : 1.0;

  return {
    width,
    height,
    isLandscape,
    isPortrait,
    isPhone,
    isSmallPhone,
    isTablet,
    isLargeTablet,
    contentMaxWidth,
    modalMaxWidth,
    columns,
    spacingMultiplier
  };
}

