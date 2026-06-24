/**
 * Huno terminal UI color theme.
 *
 * Centralised colour constants so every component shares the same
 * palette and remains easy to retune.
 */

// ── Brand ────────────────────────────────────────────────────────────
export const brand = {
  primary: "#6C5CE7" as const,    // Huno purple
  secondary: "#00CEC9" as const,  // Teal accent
  accent: "#FDCB6E" as const,     // Warm yellow
};

// ── Semantic ─────────────────────────────────────────────────────────
export const semantic = {
  success: "#00B894" as const,    // Green
  warning: "#E17055" as const,    // Orange-red
  error: "#D63031" as const,      // Red
  info: "#74B9FF" as const,       // Light blue
};

// ── Neutral ──────────────────────────────────────────────────────────
export const neutral = {
  heading: "#FFFFFF" as const,    // White
  body: "#DFE6E9" as const,       // Light grey
  muted: "#636E72" as const,      // Medium grey
  dim: "#B2BEC3" as const,        // Dim grey
  border: "#2D3436" as const,     // Dark grey
};

// ── Risk levels ──────────────────────────────────────────────────────
export const risk = {
  low: "#00B894" as const,
  medium: "#FDCB6E" as const,
  high: "#D63031" as const,
} as const;

// ── Progress states ──────────────────────────────────────────────────
export const progress = {
  done: "#00B894" as const,
  active: "#6C5CE7" as const,
  pending: "#636E72" as const,
} as const;
