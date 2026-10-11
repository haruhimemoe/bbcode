/**
 * @file src/markdown/types.ts
 * @desc Types for ./markdown: what a conversion returns, what it reports as lost, its options,
 *       and the small markdown tree fromMarkdown builds.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

/** Why something didn't survive a conversion. Frozen. */
export const LOSS_CODES = Object.freeze([
  "no-equivalent",
  "table",
  "html",
  "heading-level",
  "footnote",
  "reference-link-unresolved",
] as const);

export type LossCode = (typeof LOSS_CODES)[number];

/** One thing the other format can't say, with offsets into the input (UTF-16 code units). */
export interface Loss {
  code: LossCode;
  message: string;
  start: number;
  end: number;
}

/** What toMarkdown and fromMarkdown return. */
export interface Conversion {
  output: string;
  lost: Loss[];
}

export interface ToMarkdownOptions {
  /** How a `[box=title]` comes out. Defaults to `"bold-title"`. */
  boxStyle?: "bold-title" | "quote";
}

export interface FromMarkdownOptions {
  /** `##` and deeper as `[heading]` (default) or as bold lines. */
  headingStyle?: "heading" | "bold";
  /** Tables as an aligned `[code]` block (default) or as plain text rows. */
  tableStyle?: "code" | "text";
}

/** Inline markdown, after parsing. */
export type MdInline =
  | { kind: "text"; value: string; start: number; end: number }
  | { kind: "strong" | "em" | "strike"; children: MdInline[]; start: number; end: number }
  | { kind: "code"; value: string; start: number; end: number }
  | { kind: "link"; href: string; children: MdInline[]; start: number; end: number }
  | { kind: "image"; src: string; alt: string; start: number; end: number }
  | { kind: "html"; value: string; start: number; end: number }
  | { kind: "break"; start: number; end: number };

/** Block markdown, after parsing. Inline content stays raw text until the inline pass. */
export type MdBlock =
  | { kind: "heading"; level: number; text: string; textStart: number; start: number; end: number }
  | {
      kind: "paragraph";
      text: string;
      textStart: number;
      start: number;
      end: number;
      /** Set when a container (quote/list) hit `maxDepth` and fell back to text here. */
      capped?: boolean;
    }
  | { kind: "quote"; children: MdBlock[]; start: number; end: number }
  | { kind: "list"; ordered: boolean; items: MdBlock[][]; start: number; end: number }
  | { kind: "code"; lang: string; value: string; start: number; end: number }
  | { kind: "rule"; start: number; end: number }
  | { kind: "table"; rows: string[][]; start: number; end: number }
  | { kind: "html"; value: string; start: number; end: number };
