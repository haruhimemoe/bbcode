/**
 * @file src/helpers/index.ts
 * @desc @haruhimemoe/bbcode/helpers: builders for common BBCode (colors, gradients, flags,
 *       profiles, boxes, lists) and `escapeBBCode` for user text.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type FlagStyle, flagUrl } from "../flags/url.js";
import { scanToken } from "../parser/scan.js";

/** Zero-width space: inserted after `[` to stop osu! reading a tag. */
const BREAK = "​";

/**
 * Breaks every tag osu! would recognize in `text`, so it shows as typed. Inserts a zero-width
 * space after the `[` of each tag; nothing else changes.
 * @function escapeBBCode
 * @param {string} text - User text that should not be read as BBCode.
 * @returns {string} The text with its tags broken.
 */
export function escapeBBCode(text: string): string {
  let out = "";
  let last = 0;
  for (let i = text.indexOf("["); i >= 0; i = text.indexOf("[", i + 1)) {
    if (!scanToken(text, i)) continue;
    out += `${text.slice(last, i + 1)}${BREAK}`;
    last = i + 1;
  }
  return out + text.slice(last);
}

/** Options for `flag`. */
export interface FlagOptions {
  /**
   * `"legacy"` (default): the old PNGs, small and a fixed size. `"modern"`: osu!'s current SVG
   * flags, which have no size of their own and fill the width of wherever they're shown.
   */
  style?: FlagStyle;
}

/**
 * An `[img]` of a country's flag on osu!.
 * @function flag
 * @param {string} code - Two-letter country code, any case.
 * @param {FlagOptions} [options] - `style`.
 * @returns {string} `[img]<flag url>[/img]`.
 * @throws {TypeError} When `code` isn't two ASCII letters.
 */
export function flag(code: string, options: FlagOptions = {}): string {
  return `[img]${flagUrl(code, options.style ?? "legacy")}[/img]`;
}

/**
 * A link to an osu! user. A number is a user id; a string is a username. osu! replaces the
 * shown name with the current username when the post is saved.
 * @function profile
 * @param {number | string} idOrName - User id, or username.
 * @param {string} [name] - Name to show with an id. Defaults to the id.
 * @returns {string} `[profile=id]name[/profile]` or `[profile]name[/profile]`.
 * @throws {TypeError} For an id that isn't a positive integer, or an empty or multi-line name.
 */
export function profile(idOrName: number | string, name?: string): string {
  if (typeof idOrName === "number" && !(Number.isSafeInteger(idOrName) && idOrName > 0)) {
    throw new TypeError(`Expected a positive integer user id, got ${idOrName}`);
  }
  const shown = typeof idOrName === "number" ? (name ?? String(idOrName)) : idOrName;
  if (shown === "" || /[\r\n]/.test(shown) || shown.includes("[/profile]")) {
    throw new TypeError(`Expected a one-line name, got ${JSON.stringify(shown)}`);
  }
  return typeof idOrName === "number"
    ? `[profile=${idOrName}]${shown}[/profile]`
    : `[profile]${shown}[/profile]`;
}

/**
 * A collapsible box. With a title, `[box=title]`; with `null` or `""`, a `[spoilerbox]` labelled
 * "SPOILER". The body goes on its own lines; osu! eats those newlines.
 * @function box
 * @param {string | null} title - Box title (may hold inline BBCode), or `null`.
 * @param {string} body - BBCode inside the box.
 * @returns {string} The box.
 * @throws {TypeError} When the title has a newline or unbalanced `[` `]`.
 */
export function box(title: string | null, body: string): string {
  if (!title) return `[spoilerbox]\n${body}\n[/spoilerbox]`;
  const open = `[box=${title}]`;
  if (/[\r\n]/.test(title) || scanToken(open, 0)?.end !== open.length) {
    throw new TypeError(`Box titles need balanced [ ] on one line, got ${JSON.stringify(title)}`);
  }
  return `${open}\n${body}\n[/box]`;
}

/** Options for `list`. */
export interface ListOptions {
  /** Numbered instead of bulleted. Default `false`. */
  ordered?: boolean;
  /** Text shown above the items. */
  title?: string;
}

/**
 * A list, one `[*]` per item, each on its own line.
 * @function list
 * @param {readonly string[]} items - BBCode for each item.
 * @param {ListOptions} [options] - `ordered`, `title`.
 * @returns {string} The list, from `[list]` to `[/list]`.
 */
export function list(items: readonly string[], options: ListOptions = {}): string {
  const lines = [options.ordered ? "[list=1]" : "[list]"];
  if (options.title) lines.push(options.title);
  for (const item of items) lines.push(`[*]${item}`);
  lines.push("[/list]");
  return lines.join("\n");
}

export { color, type Gradient, type GradientOptions, gradient, normalizeColor } from "./color.js";
