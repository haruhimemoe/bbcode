/**
 * @file src/render/index.ts
 * @desc `render`: BBCode or a parsed tree to safe HTML, shaped like osu!'s output and styled by
 *       styles.css (class prefix `bb-`).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Document, Node, TagNode } from "../ast.js";
import { parse } from "../parse.js";
import { escapeHtml } from "../safety.js";
import { box, code, imagemap, list, quote, wrapper } from "./block.js";
import type { Ctx, RenderOptions } from "./context.js";
import { type Eat, eatEnd, eatRule, eatStart } from "./eat.js";
import { asText, link, media, simple, styled } from "./inline.js";
import { renderText } from "./text.js";

type TagRenderer = (node: TagNode, ctx: Ctx) => string;

const RENDERERS: Record<string, TagRenderer> = {
  color: styled,
  size: styled,
  centre: wrapper,
  left: wrapper,
  right: wrapper,
  heading: wrapper,
  notice: wrapper,
  code,
  box,
  spoilerbox: box,
  quote,
  list,
  url: link,
  email: link,
  profile: link,
  img: media,
  audio: media,
  youtube: media,
  imagemap,
};

function renderTag(node: TagNode, ctx: Ctx): string {
  const renderer = RENDERERS[node.name];
  if (renderer) return renderer(node, ctx);
  return simple(node, ctx) ?? asText(node);
}

function inner(nodes: readonly Node[], ctx: Ctx, lead: Eat = 0, trail: Eat = 0): string {
  let out = "";
  let carry = lead;
  nodes.forEach((node, i) => {
    if (node.type === "tag") {
      out += renderTag(node, ctx);
      carry = eatRule(node.name).afterClose;
      return;
    }
    let value = eatStart(node.value, carry);
    if (i === nodes.length - 1) value = eatEnd(value, trail);
    out += renderText(value, !ctx.inLink);
    carry = 0;
  });
  return out;
}

/**
 * Renders osu! BBCode as HTML. Every text node is escaped and every URL, color and size is
 * checked, so the output needs no further sanitizing. Tags osu! would show as text, and tags
 * with a URL we refuse (a `javascript:` image, say), render as escaped text.
 * @function render
 * @param {string | Document} input - BBCode, or a tree from `parse`.
 * @param {RenderOptions} [options] - Image proxy, root classes, wrapping.
 * @returns {string} HTML, wrapped in `<div class="bb">` unless `wrap` is `false`.
 */
export function render(input: string | Document, options: RenderOptions = {}): string {
  const doc = typeof input === "string" ? parse(input.replace(/\r\n?/g, "\n")) : input;
  const ctx: Ctx = { options, inLink: false, inner };
  const html = inner(doc.children, ctx);
  if (options.wrap === false) return html;
  const extra = options.className ? ` ${escapeHtml(options.className)}` : "";
  return `<div class="bb${extra}">${html}</div>`;
}

export type { MediaKind, RenderOptions } from "./context.js";
