/**
 * @file src/ast.ts
 * @desc The tree `parse` returns. Every node keeps the exact source it came from, so `serialize`
 *       gives back the input byte for byte.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** Literal text, including tags osu! would show as text (unclosed, unknown, malformed). */
export interface TextNode {
  readonly type: "text";
  /** The source text, unchanged. */
  value: string;
  /** Offset of the first character in the source (UTF-16 code units). */
  start: number;
  /** Offset just past the last character. */
  end: number;
}

/** A tag osu! turns into markup, with its children. */
export interface TagNode {
  readonly type: "tag";
  /** Canonical tag name from `TAGS` (`"s"` for `[strike]`), or `"*"` for a list item. */
  name: string;
  /** The name as written (`"strike"`, `"s"`). Pairs with a close of the same spelling. */
  tag: string;
  /** The argument after `=`, without quotes for `[quote="name"]`. `null` when there is none. */
  arg: string | null;
  /** The opening tag exactly as written, e.g. `[color=#ff66aa]`. */
  open: string;
  /** The closing tag as written, or `null` for a list item closed by the next `[*]`. */
  close: string | null;
  /** Child nodes. Tags whose content osu! does not parse (`code`, `img`...) hold one text node. */
  children: Node[];
  /** Offset of the `[` that opens the tag. */
  start: number;
  /** Offset just past the closing tag (or the item's last child). */
  end: number;
}

/** Any node in a parsed document. */
export type Node = TextNode | TagNode;

/** The result of `parse`: the source and its top-level nodes. */
export interface Document {
  readonly type: "document";
  /** The text that was parsed. */
  source: string;
  /** Top-level nodes, covering the whole source in order. */
  children: Node[];
}
