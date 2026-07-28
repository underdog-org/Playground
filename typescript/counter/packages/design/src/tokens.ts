export const space = {
  // 注意：不要寫 "12px"。RN 完全不吃單位
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

// Primitive (No export)
const palette = {
  indigo500: "#6366f1",
  indigo600: "#4f46e5",
  gray900: "#111827",
  red400: "#FF6467",
  white: "#ffffff",
} as const;

// Use primitive as reference, used by components
export const color = {
  bgPage: palette.white,
  bgAccent: palette.indigo500,
  bgAccentHover: palette.indigo600,
  btnAccent: palette.red400,
  textPrimary: palette.gray900,
  textOnAccent: palette.white,
} as const;
