/**
 * WCAG 2.2 relative luminance and contrast-ratio helpers.
 * Used by the token contrast assertion (MSHWAR-24 / MSHWAR-171).
 */

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_LARGE_TEXT = 3;
export const WCAG_AA_NON_TEXT = 3;

export function parseColor(value) {
  if (typeof value !== "string") {
    throw new Error(`Not a colour value: ${value}`);
  }
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((part) => part + part)
        .join("");
    }
    if (hex.length !== 6 && hex.length !== 8) {
      throw new Error(`Unsupported hex colour: ${value}`);
    }
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) {
    throw new Error(`Unsupported colour format: ${value}`);
  }
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  const [r, g, b, a = 1] = parts;
  return { r, g, b, a };
}

export function srgbChannelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  const parsed = typeof color === "string" ? parseColor(color) : color;
  return (
    0.2126 * srgbChannelToLinear(parsed.r) +
    0.7152 * srgbChannelToLinear(parsed.g) +
    0.0722 * srgbChannelToLinear(parsed.b)
  );
}

export function contrastRatio(foreground, background) {
  const lighter = relativeLuminance(foreground);
  const darker = relativeLuminance(background);
  const [hi, lo] = lighter >= darker ? [lighter, darker] : [darker, lighter];
  return (hi + 0.05) / (lo + 0.05);
}

export function roundContrast(ratio) {
  return Math.round(ratio * 100) / 100;
}

export function usageMinimum(usage) {
  if (usage === "non-text" || usage === "large-text") {
    return WCAG_AA_NON_TEXT;
  }
  return WCAG_AA_TEXT;
}
