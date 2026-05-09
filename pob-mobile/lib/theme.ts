import { Platform } from "react-native";

export const C = {
  // Backgrounds
  bg:        "#06060E",
  bgCard:    "#0C0C1A",
  bgAccent:  "#0F0F1E",

  // Borders
  border:    "#1A1A3E",
  borderMid: "#2A2A5A",

  // Solana brand
  purple: "#9945FF",
  green:  "#14F195",
  teal:   "#00C2FF",

  // Per-robot
  robotA: "#9945FF",
  robotB: "#14F195",

  // Text
  textPrimary:   "#E0E0F0",
  textSecondary: "#8888AA",
  textDim:       "#2E2E50",

  // Status
  live:     "#14F195",
  waiting:  "#FFD600",
  finished: "#555577",
  danger:   "#FF3355",
} as const;

// Monospace font — terminal / things.inc aesthetic
export const MONO = Platform.select({
  ios:     "Menlo",
  android: "monospace",
  default: "monospace",
}) as string;

// Reusable text style blocks
export const T = {
  mono:    { fontFamily: MONO } as const,
  display: { fontWeight: "900", letterSpacing: -1 } as const,
  label:   { fontWeight: "800", letterSpacing: 3, textTransform: "uppercase" } as const,
  prompt:  { fontFamily: MONO, color: C.green, fontSize: 12 } as const,
} as const;
