/**
 * Huno logo as compact ASCII art for terminal display.
 * "HUNO" in 3D block letters with neon glow — the brand identity.
 */

import chalk from "chalk";

// Neon palette — bright, glowing, energetic
const NEON_BLUE = "#00D4FF";  // Electric cyan-blue for █ blocks
const NEON_PINK = "#FF00FF";   // Hot pink for ░ shadow lines
const NEON_GLOW = "#39FF14";   // Lime green for ░ accent lines

// HUNO 3D block letters
const LOGO_LINES = [
  " █████   █████ █████  █████ ██████   █████    ███████   ",
  " ░░███   ░░███ ░░███  ░░███ ░░██████ ░░███   ███░░░░░███ ",
  "  ░███    ░███  ░███   ░███  ░███░███ ░███  ███     ░░███",
  "  ░███████████  ░███   ░███  ░███░░███░███ ░███      ░███",
  "  ░███░░░░░███  ░███   ░███  ░███ ░░██████ ░███      ░███",
  "  ░███    ░███  ░███   ░███  ░███  ░░█████ ░░███     ███ ",
  "  █████   █████ ░░████████   █████  ░░█████ ░░░███████░  ",
  " ░░░░░   ░░░░░   ░░░░░░░░   ░░░░░    ░░░░░    ░░░░░░░    ",
];

/**
 * Render the Huno logo with neon colors.
 * Electric cyan for █ blocks, hot pink for ░ shadow lines.
 * Returns an array of colored strings, one per line.
 */
export function renderLogo(): string[] {
  return LOGO_LINES.map((line) => {
    let out = "";
    for (const ch of line) {
      if (ch === "█") {
        out += chalk.hex(NEON_BLUE).bold("█");
      } else if (ch === "░") {
        // Alternate between pink and green for a neon glow effect
        out += chalk.hex(NEON_PINK)("░");
      } else {
        out += ch;
      }
    }
    return out;
  });
}

/**
 * Compact single-line icon for inline use (spinner header, etc.)
 */
export function hunoIcon(): string {
  return chalk.hex(NEON_BLUE).bold("◈");
}