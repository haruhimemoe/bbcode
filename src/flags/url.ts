/**
 * @file src/flags/url.ts
 * @desc Flag image URLs on osu!'s servers: the current SVGs and the old PNGs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** `"modern"`: osu!'s current SVG flags. `"legacy"`: the old PNG flags. */
export type FlagStyle = "modern" | "legacy";

/** Code point of the regional indicator symbol for `A`. */
const REGIONAL_A = 0x1f1e6;

/**
 * Checks and uppercases a two-letter country code.
 * @function normalizeCountryCode
 * @param {string} code - `"us"`, `"US"`...
 * @returns {string} The code in uppercase.
 * @throws {TypeError} When `code` isn't two ASCII letters.
 */
export function normalizeCountryCode(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) {
    throw new TypeError(`Expected a two-letter country code, got ${JSON.stringify(code)}`);
  }
  return code.toUpperCase();
}

/**
 * The URL of a country's flag on osu!. Modern flags are named after the flag emoji's code points
 * (US is `1f1fa-1f1f8.svg`); legacy flags after the code (`US.png`).
 * @function flagUrl
 * @param {string} code - Two-letter country code, any case.
 * @param {FlagStyle} [style] - `"modern"` (default) or `"legacy"`.
 * @returns {string} An https URL.
 * @throws {TypeError} When `code` isn't two ASCII letters.
 */
export function flagUrl(code: string, style: FlagStyle = "modern"): string {
  const cc = normalizeCountryCode(code);
  if (style === "legacy") return `https://assets.ppy.sh/old-flags/${cc}.png`;
  const points = [...cc].map((ch) => (REGIONAL_A + ch.charCodeAt(0) - 65).toString(16));
  return `https://osu.ppy.sh/assets/images/flags/${points.join("-")}.svg`;
}
