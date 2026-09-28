/**
 * @file src/render/block.ts
 * @desc HTML for block tags: alignment, heading, notice, code, boxes, quotes, lists and
 *       imagemaps, with osu!'s newline eating. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Node, TagNode } from "../ast.js";
import { parseImagemap } from "../imagemap/parse.js";
import { formatPercent } from "../imagemap/serialize.js";
import { parse } from "../parse.js";
import { escapeHtml } from "../safety.js";
import { type Ctx, mediaUrl } from "./context.js";
import { eatEnd, eatRule, eatStart } from "./eat.js";
import { asText, rawContent } from "./inline.js";

/** Children with the tag's own newline eating applied at both ends. */
function body(node: TagNode, ctx: Ctx): string {
  const rule = eatRule(node.name);
  return ctx.inner(node.children, ctx, rule.afterOpen, rule.beforeClose);
}

/** `[centre]`, `[left]`, `[right]`, `[heading]` and `[notice]`. */
export function wrapper(node: TagNode, ctx: Ctx): string {
  if (node.name === "heading") return `<h2 class="bb-heading">${body(node, ctx)}</h2>`;
  if (node.name === "notice") return `<div class="bb-notice">${body(node, ctx)}</div>`;
  return `<div class="bb-align bb-align--${node.name}">${body(node, ctx)}</div>`;
}

/** `[code]`: content shown as written, leading and trailing blank lines dropped. */
export function code(node: TagNode): string {
  const content = eatEnd(eatStart(rawContent(node), Infinity), Infinity);
  return `<pre class="bb-code">${escapeHtml(content)}</pre>`;
}

/** `[box=title]` and `[spoilerbox]`: a closed `<details>`. The title can hold inline tags. */
export function box(node: TagNode, ctx: Ctx): string {
  const title =
    node.name === "box" && node.arg ? ctx.inner(parse(node.arg).children, ctx) : "SPOILER";
  return (
    `<details class="bb-box"><summary class="bb-box__title">${title}</summary>` +
    `<div class="bb-box__body">${body(node, ctx)}</div></details>`
  );
}

/** `[quote]` and `[quote="name"]`. */
export function quote(node: TagNode, ctx: Ctx): string {
  const author =
    node.arg === null ? "" : `<div class="bb-quote__author">${escapeHtml(node.arg)} wrote:</div>`;
  return `<blockquote class="bb-quote">${author}${body(node, ctx)}</blockquote>`;
}

const isItem = (n: Node): n is TagNode => n.type === "tag" && n.name === "*";

/** One `<li>`: the item's children, then any text after its `[/*]` (up to 2 newlines eaten). */
function itemHtml(item: TagNode, loose: Node[], ctx: Ctx): string {
  if (loose.length === 0) return `<li>${ctx.inner(item.children, ctx, 0, "ws")}</li>`;
  return `<li>${ctx.inner(item.children, ctx)}${ctx.inner(loose, ctx, 2, "ws")}</li>`;
}

/**
 * `[list]`: text before the first `[*]` is the title. Text after an item closed with `[/*]`
 * stays in that item, as on osu!.
 */
export function list(node: TagNode, ctx: Ctx): string {
  const firstItem = node.children.findIndex(isItem);
  const titleNodes = firstItem < 0 ? node.children : node.children.slice(0, firstItem);
  const title = ctx.inner(titleNodes, ctx, 0, "ws");
  const groups: { item: TagNode; loose: Node[] }[] = [];
  for (const child of firstItem < 0 ? [] : node.children.slice(firstItem)) {
    if (isItem(child)) groups.push({ item: child, loose: [] });
    else groups[groups.length - 1]?.loose.push(child);
  }
  const tag = node.arg === null ? "ul" : "ol";
  const titleHtml = title === "" ? "" : `<div class="bb-list__title">${title}</div>`;
  const lis = groups.map((g) => itemHtml(g.item, g.loose, ctx)).join("");
  return `${titleHtml}<${tag} class="bb-list">${lis}</${tag}>`;
}

/** `[imagemap]`: an image with positioned links, or the block as text when osu! would refuse it. */
export function imagemap(node: TagNode, ctx: Ctx): string {
  const result = parseImagemap(rawContent(node));
  if (!result.ok) return asText(node);
  const src = mediaUrl(result.imagemap.image, "imagemap", ctx);
  if (src === null) return asText(node);
  const regions = result.imagemap.regions.map((r) => {
    const style = `left:${formatPercent(r.x)}%;top:${formatPercent(r.y)}%;width:${formatPercent(r.w)}%;height:${formatPercent(r.h)}%`;
    const title = escapeHtml(r.title);
    if (r.href === "#")
      return `<span class="bb-imagemap__link" style="${style}" title="${title}"></span>`;
    const href = escapeHtml(r.href);
    return `<a class="bb-imagemap__link" href="${href}" style="${style}" title="${title}" rel="nofollow noopener"></a>`;
  });
  const img = `<img class="bb-imagemap__image" src="${escapeHtml(src)}" alt="" loading="lazy">`;
  return `<div class="bb-imagemap">${img}${regions.join("")}</div>`;
}
