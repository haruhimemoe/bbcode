/**
 * @file src/lint/tree.ts
 * @desc Checks on tags osu! does render: sizes, color names, URLs our renderer refuses,
 *       YouTube ids, lists without items and imagemap lines. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Node, TagNode } from "../ast.js";
import { parseImagemap } from "../imagemap/parse.js";
import { LIMITS } from "../limits.js";
import { serialize } from "../parse.js";
import { clampSize, isLinkUrl, isMediaUrl, youtubeId } from "../safety.js";
import { CSS_COLOR_NAMES } from "./colors.js";
import type { Diagnostic } from "./types.js";

const RAW = new Set(["code", "imagemap", "img", "audio", "youtube", "profile", "email"]);

/** Whether a tag's content is unparsed text. */
export function isRaw(node: TagNode): boolean {
  return RAW.has(node.name) || (node.name === "url" && node.arg === null);
}

function argRange(node: TagNode): { start: number; end: number } {
  const start = node.start + node.open.indexOf("=") + 1;
  return { start, end: start + (node.arg ?? "").length };
}

function size(node: TagNode, out: Diagnostic[]): void {
  const n = Number(node.arg);
  const at = argRange(node);
  if (n < LIMITS.sizeMin || n > LIMITS.sizeMax) {
    const clamped = clampSize(node.arg ?? "");
    const message = `osu! clamps sizes to ${LIMITS.sizeMin}..${LIMITS.sizeMax}, so this renders at ${clamped}%.`;
    out.push({
      code: "bad-size",
      severity: "error",
      message,
      ...at,
      fix: { ...at, text: `${clamped}` },
    });
  } else if (!(LIMITS.sizePresets as readonly number[]).includes(n)) {
    const message = "osu!'s editor offers 50, 85, 100 and 150; other sizes work but are unusual.";
    out.push({ code: "bad-size", severity: "warning", message, ...at });
  }
}

function media(node: TagNode, content: string, contentStart: number, out: Diagnostic[]): void {
  const at = { start: node.start, end: node.end };
  const bad = (message: string): void => {
    out.push({ code: "bad-url", severity: "error", message, ...at });
  };
  if (node.name === "img" || node.name === "audio") {
    if (!isMediaUrl(content)) bad(`[${node.tag}] needs an http:// or https:// URL without spaces.`);
  } else if (node.name === "youtube") {
    if (youtubeId(content) === null) bad("[youtube] needs a video id or a YouTube link.");
  } else if (node.name === "url") {
    const target = node.arg ?? content;
    if (!isLinkUrl(target)) bad("Link URLs can't contain spaces.");
  } else if (node.name === "imagemap") {
    const result = parseImagemap(content);
    for (const issue of result.issues) {
      const start = contentStart + issue.start;
      const message = `Imagemap line ${issue.line}: ${issue.message}`;
      out.push({
        code: "imagemap-line",
        severity: "error",
        message,
        start,
        end: contentStart + issue.end,
      });
    }
  }
}

/**
 * Walks the tree and reports problems with tags osu! renders.
 * @param nodes - Nodes to check.
 * @param out - Diagnostics are pushed here.
 * @param rawRanges - Content ranges of raw tags are pushed here (lint's text scan skips them).
 */
export function checkTree(
  nodes: readonly Node[],
  out: Diagnostic[],
  rawRanges: [number, number][],
): void {
  for (const node of nodes) {
    if (node.type === "text") continue;
    const contentStart = node.start + node.open.length;
    if (isRaw(node)) {
      const content = serialize(node.children);
      rawRanges.push([contentStart, contentStart + content.length]);
      media(node, content, contentStart, out);
      continue;
    }
    if (node.name === "size") size(node, out);
    if (node.name === "color" && node.arg && /^[A-Za-z]+$/.test(node.arg)) {
      if (!CSS_COLOR_NAMES.has(node.arg.toLowerCase())) {
        const message = `Browsers don't know the color "${node.arg}", so the text keeps its color.`;
        out.push({ code: "bad-color", severity: "warning", message, ...argRange(node) });
      }
    }
    if (node.name === "url") media(node, "", contentStart, out);
    if (node.name === "list" && !node.children.some((c) => c.type === "tag" && c.name === "*")) {
      const message = "This list has no [*] items.";
      out.push({
        code: "list-no-items",
        severity: "warning",
        message,
        start: node.start,
        end: contentStart,
      });
    }
    checkTree(node.children, out, rawRanges);
  }
}
