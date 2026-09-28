/**
 * @file src/render/inline.ts
 * @desc HTML for inline tags: text styles, color, size, links, email, profiles and media.
 *       Every URL and value is checked before it reaches an attribute. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { TagNode } from "../ast.js";
import { serialize } from "../parse.js";
import { clampSize, escapeHtml, isColor, isEmail, isLinkUrl, youtubeId } from "../safety.js";
import { type Ctx, mediaUrl } from "./context.js";
import { textHtml } from "./text.js";

/** The source of a tag as escaped text, for tags whose content we refuse to render. */
export function asText(node: TagNode): string {
  return textHtml(serialize([node]));
}

/** The unparsed content of a raw tag. */
export function rawContent(node: TagNode): string {
  return serialize(node.children);
}

const SIMPLE: Record<string, [string, string]> = {
  b: ["<strong>", "</strong>"],
  i: ["<em>", "</em>"],
  u: ["<u>", "</u>"],
  s: ["<del>", "</del>"],
  spoiler: ['<span class="bb-spoiler">', "</span>"],
  c: ['<code class="bb-c">', "</code>"],
};

/** Tags that wrap their children in fixed markup. */
export function simple(node: TagNode, ctx: Ctx): string | null {
  const pair = SIMPLE[node.name];
  if (!pair) return null;
  return pair[0] + ctx.inner(node.children, ctx) + pair[1];
}

/** `[color]` and `[size]`: a span with a checked style. */
export function styled(node: TagNode, ctx: Ctx): string {
  const arg = node.arg ?? "";
  const inner = ctx.inner(node.children, ctx);
  if (node.name === "color") {
    if (!isColor(arg)) return inner;
    return `<span class="bb-color" style="color:${arg}">${inner}</span>`;
  }
  if (!/^\d+$/.test(arg)) return inner;
  return `<span class="bb-size" style="font-size:${clampSize(arg)}%">${inner}</span>`;
}

const LINK_ATTRS = 'rel="nofollow noopener"';

/** `[url]`, `[email]` and `[profile]`. */
export function link(node: TagNode, ctx: Ctx): string {
  const content = node.name === "url" && node.arg !== null ? null : rawContent(node);
  let href: string | null = null;
  let cls = "bb-link";
  if (node.name === "url") {
    const target = node.arg ?? (content as string);
    href = isLinkUrl(target) ? target : null;
  } else if (node.name === "email") {
    const address = node.arg ?? (content as string);
    href = isEmail(address) ? `mailto:${address}` : null;
  } else {
    cls = "bb-profile";
    const name = content as string;
    const id = node.arg;
    if (name !== "" && (id === null || /^\d+$/.test(id))) {
      href = `https://osu.ppy.sh/users/${id ?? `@${encodeURIComponent(name)}`}`;
    }
  }
  if (href === null) return asText(node);
  const label =
    content === null ? ctx.inner(node.children, { ...ctx, inLink: true }) : textHtml(content);
  if (ctx.inLink) return `<span class="${cls}">${label}</span>`;
  return `<a class="${cls}" href="${escapeHtml(href)}" ${LINK_ATTRS}>${label}</a>`;
}

/** `[img]`, `[audio]` and `[youtube]`. */
export function media(node: TagNode, ctx: Ctx): string {
  const content = rawContent(node);
  if (node.name === "youtube") {
    const id = youtubeId(content);
    if (id === null) return asText(node);
    const src = `https://www.youtube.com/embed/${id}?rel=0`;
    return `<iframe class="bb-youtube" src="${src}" title="YouTube video" loading="lazy" allowfullscreen></iframe>`;
  }
  const kind = node.name === "audio" ? "audio" : "img";
  const src = mediaUrl(content, kind, ctx);
  if (src === null) return asText(node);
  if (kind === "audio") {
    return `<audio class="bb-audio" controls preload="none" src="${escapeHtml(src)}"></audio>`;
  }
  return `<img class="bb-img" src="${escapeHtml(src)}" alt="" loading="lazy">`;
}
