/**
 * Huno terminal UI color theme.
 *
 * Centralised colour constants so every component shares the same
 * palette and remains easy to retune.
 */

// ── Brand ────────────────────────────────────────────────────────────
export const brand = {
    primary: "#0100BB" as const,
    secondary: "#00CEC9" as const,
    accent:   "#4745CD" as const,
    dark:      "#010149" as const,
    muted:     "#64676E" as const,
    text:      "#E0DCDB" as const,
    border:    "#A0A4A8" as const,
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

// ── Backward compatibility aliases ───────────────────────────────────
/** @deprecated Use `brand.primary` instead */
export const Primary = "#0100BB";
/** @deprecated Use `brand.accent` instead */
export const Accent = "#4745CD";
/** @deprecated Use `brand.dark` instead */
export const Dark = "#010149";
/** @deprecated Use `brand.muted` instead */
export const Muted = "#64676E";
/** @deprecated Use `brand.text` instead */
export const Text = "#E0DCDB";
/** @deprecated Use `brand.border` instead */
export const Border = "#A0A4A8";