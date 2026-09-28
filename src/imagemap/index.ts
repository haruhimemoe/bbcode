/**
 * @file src/imagemap/index.ts
 * @desc @haruhimemoe/bbcode/imagemap: read, check and write osu! `[imagemap]` blocks.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export { parseImagemap } from "./parse.js";
export { formatPercent, serializeImagemap, validateImagemap } from "./serialize.js";
export type {
  Imagemap,
  ImagemapIssue,
  ImagemapProblem,
  ImagemapRegion,
  ImagemapResult,
} from "./types.js";
