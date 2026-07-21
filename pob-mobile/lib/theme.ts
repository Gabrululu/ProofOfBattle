// Key names are historical (kept so every screen's `C.xxx` reference stays
// valid) but the values now match the web landing/dashboard's red/blue system.
export const C = {
  // Backgrounds
  bg:        "#05060D",
  bgCard:    "#0B1124",
  bgAccent:  "#101A33",

  // Borders
  border:    "#15203A",
  borderMid: "#233457",

  // Brand accents (was Solana purple/green/teal)
  purple: "#FF2D4A", // primary red — brand accent, CTAs
  green:  "#22C55E", // kept as semantic success/live green
  teal:   "#6EA8FF", // secondary-family accent (was cyan)

  // Per-robot
  robotA: "#2D7BFF", // secondary blue
  robotB: "#FF2D4A", // primary red

  // Text
  textPrimary:   "#F2F2F2",
  textSecondary: "#6B7A99",
  textDim:       "#38445E",

  // Status
  live:     "#22C55E",
  waiting:  "#FBBF24",
  finished: "#5B6B8C",
  danger:   "#FF2D4A",
} as const;

// These are only ever read by screens that are lazily required by
// expo-router, and the root layout (app/_layout.tsx) blocks rendering the
// Stack — and therefore blocks any screen module from being evaluated —
// until useFonts() resolves. So it's safe to hardcode the final custom font
// names here rather than juggle a loading fallback.
export const MONO      = "JetBrainsMono_600SemiBold";
export const MONO_BOLD = "JetBrainsMono_700Bold";
export const SANS_700  = "Inter_700Bold";
export const SANS_900  = "Inter_900Black";

// Reusable text style blocks
export const T = {
  mono:    { fontFamily: MONO } as const,
  display: { fontFamily: SANS_900, letterSpacing: -1 } as const,
  label:   { fontFamily: MONO_BOLD, letterSpacing: 3, textTransform: "uppercase" } as const,
  prompt:  { fontFamily: MONO, color: C.green, fontSize: 12 } as const,
} as const;
