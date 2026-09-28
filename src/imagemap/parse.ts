/**
 * @file src/imagemap/parse.ts
 * @desc parseImagemap: reads `[imagemap]` content line by line with osu!'s rules, and reports
 *       every line osu! would refuse.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { isMediaUrl } from "../safety.js";
import type { ImagemapIssue, ImagemapRegion, ImagemapResult } from "./types.js";

/** A decimal osu! would accept and CSS can read: `12`, `12.5`, `.5`. */
export const DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
/** A region target: none (`#`), a web link, or an email link. */
export const HREF = /^(?:#|https?:\/\/\S+|mailto:\S+)$/;

interface Line {
  text: string;
  start: number;
  number: number;
}

function splitLines(text: string, base: number): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (const [index, raw] of text.split("\n").entries()) {
    lines.push({ text: raw.replace(/\r$/, ""), start: base + start, number: index + 1 });
    start += raw.length + 1;
  }
  return lines;
}

/** Parses one region line (leading whitespace already allowed). Returns a region or a message. */
function regionLine(text: string): ImagemapRegion | string {
  const trimmed = text.trim();
  const parts = trimmed.split(" ");
  if (parts.length < 5) return "A region line needs x y width height link, then an optional title.";
  const [x, y, w, h, href] = parts as [string, string, string, string, string];
  const bad = [x, y, w, h].find((n) => !DECIMAL.test(n));
  if (bad !== undefined) return `"${bad}" isn't a number. Use plain decimals like 12.5.`;
  if (!HREF.test(href)) return `"${href}" isn't a link osu! allows: use #, http(s):// or mailto:.`;
  const title = parts.slice(5).join(" ");
  return { x: Number(x), y: Number(y), w: Number(w), h: Number(h), href, title };
}

/**
 * Parses an imagemap: either the whole `[imagemap]...[/imagemap]` block or only the text
 * between the tags. osu! wants a newline after `[imagemap]`, an `http(s)` image URL on the first
 * line, then one or more lines of `x y width height link title?`, each ending in a newline.
 * @function parseImagemap
 * @param {string} text - The block or its content.
 * @returns {ImagemapResult} The imagemap, or every issue found (offsets into `text`).
 */
export function parseImagemap(text: string): ImagemapResult {
  const block = /^\[imagemap\]([\s\S]*)\[\/imagemap\]$/.exec(text);
  const content = block ? (block[1] as string) : text;
  const base = block ? "[imagemap]".length : 0;
  const lines = splitLines(content, base);
  const issues: ImagemapIssue[] = [];
  const issue = (line: Line, message: string): void => {
    const end = line.start + Math.max(line.text.length, 1);
    issues.push({ line: line.number, start: line.start, end, message });
  };
  const first = lines[0] as Line;
  if (first.text !== "") issue(first, "Start the image URL on the line after [imagemap].");
  const last = lines[lines.length - 1] as Line;
  const body = lines.slice(1, lines.length > 1 ? -1 : undefined).filter((l) => l.text.trim());
  if (lines.length > 1 && last.text.trim() !== "") {
    issue(last, "Put [/imagemap] on its own line.");
    body.push(last);
  }
  const [imageLine, ...regionLines] = body;
  let image = "";
  if (!imageLine) issue(first, "The first line must be the image URL.");
  else {
    image = imageLine.text.trim();
    if (!isMediaUrl(image)) issue(imageLine, "The image URL must start with http:// or https://.");
  }
  if (imageLine && regionLines.length === 0) issue(imageLine, "Add at least one region line.");
  const regions: ImagemapRegion[] = [];
  for (const line of regionLines) {
    const region = regionLine(line.text);
    if (typeof region === "string") issue(line, region);
    else regions.push(region);
  }
  if (issues.length > 0) return { ok: false, imagemap: null, issues };
  return { ok: true, imagemap: { image, regions }, issues: [] };
}
