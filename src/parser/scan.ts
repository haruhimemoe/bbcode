/**
 * @file src/parser/scan.ts
 * @desc Reads one tag token at a `[`: an opening tag with a valid argument, a closing tag, or a
 *       list item marker. Anything else is text. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { nextNewline, type Scanner, scanner } from "./find.js";
import { RULES, type Rule } from "./rules.js";

/** A tag token found in the source. */
export interface Token {
  readonly kind: "open" | "close";
  /** The name as written, or `"*"`. */
  readonly tag: string;
  /** The argument, or `null`. Quotes are removed for `[quote="..."]`. */
  readonly arg: string | null;
  readonly start: number;
  readonly end: number;
}

const NAME = /[a-z]/;

/** Reads a lowercase tag name starting at `i`; returns the index after it. */
function readName(src: string, i: number): number {
  let j = i;
  while (j < src.length && NAME.test(src.charAt(j))) j++;
  return j;
}

/** Reads `=argument]` for `rule` at `i` (the `=`). Returns `[arg, end]` or `null`. */
function readArg(src: string, i: number, rule: Rule, scan: Scanner): [string, number] | null {
  const from = i + 1;
  if (rule.argForm === "balanced") {
    const close = scan.titleEnd(from);
    return close < 0 ? null : [src.slice(from, close), close + 1];
  }
  const quoted = rule.argForm === "quoted";
  if (quoted && src.charAt(from) !== '"') return null;
  const start = quoted ? from + 1 : from;
  const close = scan.find(quoted ? '"]' : "]", start);
  if (close < 0 || nextNewline(scan.find, start) < close) return null;
  const arg = src.slice(start, close);
  return rule.checkArg(arg) ? [arg, close + (quoted ? 2 : 1)] : null;
}

/**
 * Reads the tag token starting at `i`, where `src[i]` is `[`.
 * @param src - The whole source.
 * @param i - Offset of a `[`.
 * @param scan - Searches over `src`; pass one scanner to every call on the same text.
 * @returns The token, or `null` when the text there is not a tag osu! recognizes.
 */
export function scanToken(src: string, i: number, scan: Scanner = scanner(src)): Token | null {
  const closing = src.charAt(i + 1) === "/";
  const nameStart = i + (closing ? 2 : 1);
  if (src.charAt(nameStart) === "*") {
    if (src.charAt(nameStart + 1) !== "]") return null;
    return { kind: closing ? "close" : "open", tag: "*", arg: null, start: i, end: nameStart + 2 };
  }
  const nameEnd = readName(src, nameStart);
  const tag = src.slice(nameStart, nameEnd);
  const rule = RULES.get(tag);
  if (!rule) return null;
  const after = src.charAt(nameEnd);
  if (closing) {
    return after === "]" ? { kind: "close", tag, arg: null, start: i, end: nameEnd + 1 } : null;
  }
  if (after === "]") {
    if (rule.arg === "required") return null;
    return { kind: "open", tag, arg: null, start: i, end: nameEnd + 1 };
  }
  if (after !== "=" || rule.arg === "none") return null;
  const read = readArg(src, nameEnd, rule, scan);
  return read ? { kind: "open", tag, arg: read[0], start: i, end: read[1] } : null;
}
