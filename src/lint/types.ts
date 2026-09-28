/**
 * @file src/lint/types.ts
 * @desc Diagnostic types and the list of lint codes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** Every code `lint` can report. Frozen. */
export const LINT_CODES = Object.freeze([
  "unclosed-tag",
  "stray-close",
  "unknown-tag",
  "bad-size",
  "bad-color",
  "bad-url",
  "self-nested",
  "img-bracket",
  "imagemap-line",
  "list-no-items",
  "over-limit",
  "too-deep",
] as const);

/** One of `LINT_CODES`. */
export type LintCode = (typeof LINT_CODES)[number];

/** How bad it is. `error`: osu! shows it wrong or as text. `warning`: works, likely unintended. */
export type Severity = "error" | "warning" | "info";

/** A replacement that fixes a diagnostic: put `text` in place of `start..end`. */
export interface Fix {
  start: number;
  end: number;
  text: string;
}

/** One problem found by `lint`. Offsets are UTF-16 indices into the linted text. */
export interface Diagnostic {
  code: LintCode;
  severity: Severity;
  message: string;
  start: number;
  end: number;
  /** Present when the fix is obvious. */
  fix?: Fix;
}

/** Options for `lint`. */
export interface LintOptions {
  /** Character limit for `over-limit`. Defaults to `LIMITS.forumPost` (60,000). */
  limit?: number;
}
