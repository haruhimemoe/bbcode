/**
 * @file src/helpers/color.ts
 * @desc Color helpers: `normalizeColor`, `color` and `gradient` (per-character colors with the
 *       characters it adds to the post).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { count } from "../limits.js";

/**
 * Checks a color for `[color=]` and normalizes it: `#abc` becomes `#aabbcc`, hex is lowercased,
 * names (letters only) are kept as written.
 * @function normalizeColor
 * @param {string} value - `#rgb`, `#rrggbb` or a color name.
 * @returns {string} A value osu! accepts.
 * @throws {TypeError} For anything else.
 */
export function normalizeColor(value: string): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
    return `#${[...value.slice(1)].map((c) => c + c).join("")}`.toLowerCase();
  }
  if (/^[A-Za-z]+$/.test(value)) return value;
  throw new TypeError(`Expected #rgb, #rrggbb or a color name, got ${JSON.stringify(value)}`);
}

/**
 * Wraps text in `[color]`.
 * @function color
 * @param {string} text - BBCode to color.
 * @param {string} value - `#rgb`, `#rrggbb` or a color name.
 * @returns {string} `[color=value]text[/color]`.
 * @throws {TypeError} When the color isn't valid.
 */
export function color(text: string, value: string): string {
  return `[color=${normalizeColor(value)}]${text}[/color]`;
}

/** Options for `gradient`. */
export interface GradientOptions {
  /** Leave whitespace uncolored and don't spend a gradient step on it. Default `true`. */
  skipSpaces?: boolean;
}

/** The result of `gradient`. */
export interface Gradient {
  /** The colored BBCode. */
  bbcode: string;
  /** Characters the colors add to the post (what `count` sees beyond the plain text). */
  cost: number;
}

function hexStop(value: string): [number, number, number] {
  const hex = normalizeColor(value);
  if (!hex.startsWith("#")) throw new TypeError(`Gradient stops must be hex colors, got ${value}`);
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function colorAt(stops: readonly [number, number, number][], t: number): string {
  const pos = t * (stops.length - 1);
  const i = Math.min(Math.floor(pos), stops.length - 2);
  const a = stops[Math.max(i, 0)] as [number, number, number];
  const b = stops[Math.max(i + 1, 0)] ?? a;
  const f = stops.length === 1 ? 0 : pos - i;
  return `#${a
    .map((v, k) =>
      Math.round(v + ((b[k] as number) - v) * f)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Splits text into user-visible characters where the runtime can, else code points. */
function characters(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(text)].map((s) => s.segment);
  }
  return [...text];
}

/**
 * Colors each character along a gradient. Neighbouring characters with the same color share one
 * `[color]` tag. Newlines are never colored.
 * @function gradient
 * @param {string} text - Plain text to color.
 * @param {readonly string[]} stops - One or more hex colors (`#rgb` or `#rrggbb`), spread evenly.
 * @param {GradientOptions} [options] - `skipSpaces` (default `true`).
 * @returns {Gradient} The BBCode and its added length.
 * @throws {TypeError} When there are no stops or a stop isn't a hex color.
 */
export function gradient(
  text: string,
  stops: readonly string[],
  options: GradientOptions = {},
): Gradient {
  if (stops.length === 0) throw new TypeError("A gradient needs at least one color stop.");
  const rgb = stops.map(hexStop);
  const skipSpaces = options.skipSpaces ?? true;
  const chars = characters(text);
  const colored = (ch: string): boolean =>
    !/^[\r\n]+$/.test(ch) && !(skipSpaces && /^\s+$/.test(ch));
  const total = chars.filter(colored).length;
  let out = "";
  let run = "";
  let runColor: string | null = null;
  const flushRun = (): void => {
    if (runColor !== null) out += `[color=${runColor}]${run}[/color]`;
    run = "";
    runColor = null;
  };
  let k = 0;
  for (const ch of chars) {
    if (!colored(ch)) {
      flushRun();
      out += ch;
      continue;
    }
    const c = colorAt(rgb, total === 1 ? 0 : k / (total - 1));
    k++;
    if (c !== runColor) flushRun();
    runColor = c;
    run += ch;
  }
  flushRun();
  return { bbcode: out, cost: count(out).length - count(text).length };
}
