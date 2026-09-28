/**
 * @file src/lint/index.ts
 * @desc `lint`: every problem osu! would show differently than intended, with a fix when it's
 *       obvious, and `applyFix`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { count, LIMITS } from "../limits.js";
import { build } from "../parser/build.js";
import { eventDiagnostics } from "./events.js";
import { scanText } from "./scan.js";
import { checkTree } from "./tree.js";
import type { Diagnostic, Fix, LintOptions } from "./types.js";

/** Offset of the code point at index `n` (the first one past the limit). */
function codePointOffset(text: string, n: number): number {
  let i = 0;
  let offset = 0;
  for (const ch of text) {
    if (i === n) return offset;
    offset += ch.length;
    i++;
  }
  return offset;
}

/**
 * Drops a stray close when an earlier opening tag of the same name failed: one problem, one
 * diagnostic.
 */
function dropEchoes(
  diagnostics: Diagnostic[],
  text: string,
  failed: [string, number][],
): Diagnostic[] {
  const pending = [...failed].sort((a, b) => a[1] - b[1]);
  return diagnostics.filter((d) => {
    if (d.code !== "stray-close") return true;
    const tag = text.slice(d.start + 2, d.end - 1);
    // Sorted by start, so stop at the first one not before this close.
    let i = 0;
    while (i < pending.length && (pending[i] as [string, number])[1] < d.start) {
      if ((pending[i] as [string, number])[0] === tag) break;
      i++;
    }
    if (i >= pending.length || (pending[i] as [string, number])[1] >= d.start) return true;
    pending.splice(i, 1);
    return false;
  });
}

/**
 * Checks BBCode for everything osu! would show differently than intended: unclosed and stray
 * tags, tags osu! doesn't know, bad sizes, colors and URLs, self-nested tags, image URLs with
 * `[`, broken imagemap lines, lists without items and posts over the length limit.
 * @function lint
 * @param {string} text - BBCode source.
 * @param {LintOptions} [options] - `limit` for `over-limit` (default 60,000).
 * @returns {Diagnostic[]} Diagnostics sorted by position.
 */
export function lint(text: string, options: LintOptions = {}): Diagnostic[] {
  const { doc, events, tokenStarts } = build(text);
  const failed: [string, number][] = [];
  for (const e of events) if (e.kind === "unclosed") failed.push([e.tag, e.start]);
  const rawRanges: [number, number][] = [];
  const found = eventDiagnostics(events, text);
  checkTree(doc.children, found, rawRanges);
  found.push(...scanText(text, tokenStarts, rawRanges, failed));
  found.sort((a, b) => a.start - b.start || a.end - b.end);
  const out = dropEchoes(found, text, failed);
  const counted = count(text, options.limit ?? LIMITS.forumPost);
  if (counted.over) {
    out.push({
      code: "over-limit",
      severity: "error",
      message: `${counted.length} characters; osu! allows ${counted.limit}. Cut ${-counted.remaining}.`,
      start: codePointOffset(text, counted.limit),
      end: text.length,
    });
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Applies one fix from a diagnostic.
 * @function applyFix
 * @param {string} text - The text that was linted.
 * @param {Fix} fix - A diagnostic's `fix`.
 * @returns {string} The text with `fix.start..fix.end` replaced by `fix.text`.
 */
export function applyFix(text: string, fix: Fix): string {
  return text.slice(0, fix.start) + fix.text + text.slice(fix.end);
}

export {
  type Diagnostic,
  type Fix,
  LINT_CODES,
  type LintCode,
  type LintOptions,
  type Severity,
} from "./types.js";
