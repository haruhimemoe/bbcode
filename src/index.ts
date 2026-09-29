/**
 * @file src/index.ts
 * @desc @haruhimemoe/bbcode: parse, render, lint and count osu! BBCode.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export type { Document, Node, TagNode, TextNode } from "./ast.js";
export { OSU_FONT_SIZES, OSU_WIDTHS } from "./layout.js";
export { type Count, count, LIMITS } from "./limits.js";
export {
  applyFix,
  type Diagnostic,
  type Fix,
  LINT_CODES,
  type LintCode,
  type LintOptions,
  lint,
  type Severity,
} from "./lint/index.js";
export { parse, serialize } from "./parse.js";
export { type MediaKind, type RenderOptions, render } from "./render/index.js";
export { findTag, TAGS, type TagArg, type TagArgKind, type TagSpec } from "./tags.js";
