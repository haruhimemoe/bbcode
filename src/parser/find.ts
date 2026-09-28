/**
 * @file src/parser/find.ts
 * @desc Searches the parser repeats for every tag token, made linear over a whole document:
 *       the next occurrence of a string (remembered per string, since tokens are read left to
 *       right) and the `]` that ends a box title (a table built once). Without them, 60,000
 *       characters of `[c]` or `[box=` took seconds. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** Finds `needle` at or after `from`, like `indexOf`. */
export type Find = (needle: string, from: number) => number;

/**
 * A remembering `indexOf` over `src`. The first match at or after `from` is also the first at
 * or after any later offset up to it, so reading tokens left to right scans each stretch once.
 * @param src - The document.
 * @returns The search function.
 */
export function finder(src: string): Find {
  const memo = new Map<string, { from: number; at: number }>();
  return (needle, from) => {
    const hit = memo.get(needle);
    if (hit && from >= hit.from && (hit.at < 0 || hit.at >= from)) return hit.at;
    const at = src.indexOf(needle, from);
    memo.set(needle, { from, at });
    return at;
  };
}

/** The first `\r` or `\n` at or after `from`, or `Infinity`. */
export function nextNewline(find: Find, from: number): number {
  const at = [find("\n", from), find("\r", from)].filter((i) => i >= 0);
  return at.length > 0 ? Math.min(...at) : Number.POSITIVE_INFINITY;
}

const isBracket = (ch: string): boolean => ch === "[" || ch === "]";

/**
 * For every offset, where a box title starting there ends: the first `]` not inside balanced
 * brackets, skipping `\[` and `\]`; -1 when there is none. Built right to left in one pass.
 * @param src - The document.
 * @returns The table, one entry per offset plus two past the end.
 */
export function titleEnds(src: string): Int32Array {
  const ends = new Int32Array(src.length + 2).fill(-1);
  for (let i = src.length - 1; i >= 0; i--) {
    const ch = src.charAt(i);
    if (ch === "\\" && isBracket(src.charAt(i + 1))) ends[i] = ends[i + 2] as number;
    else if (ch === "]") ends[i] = i;
    else if (ch === "[") {
      const inner = ends[i + 1] as number;
      ends[i] = inner < 0 ? -1 : (ends[inner + 1] as number);
    } else ends[i] = ends[i + 1] as number;
  }
  return ends;
}

/** The searches `scanToken` needs over one document. */
export interface Scanner {
  readonly find: Find;
  /** Where a box title starting at `from` ends, or -1. */
  readonly titleEnd: (from: number) => number;
}

/**
 * The searches over `src`, the title table built on first use.
 * @param src - The document.
 * @returns A scanner to pass to every `scanToken` call on `src`.
 */
export function scanner(src: string): Scanner {
  let ends: Int32Array | null = null;
  return {
    find: finder(src),
    titleEnd: (from) => {
      ends ??= titleEnds(src);
      return ends[from] ?? -1;
    },
  };
}
