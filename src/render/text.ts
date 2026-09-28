/**
 * @file src/render/text.ts
 * @desc Text to HTML: escaping, line breaks, and osu!'s automatic links for bare URLs, `www.`
 *       addresses and emails. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { escapeHtml, isEmail } from "../safety.js";

/** A bare link candidate: after the start or whitespace, optionally behind `<.:([`. */
const CANDIDATE = /(^|\s)([<.:([]*)((?:https?|ftp):\/\/\S+|www\.\S+|[A-Za-z0-9._%+-]+@\S+)/g;
/** Characters osu! leaves out of the end of a bare link. */
const TRAILING = /[.:)\]>]+$/;

/** Escapes text and turns newlines into `<br>`. */
export function textHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

/** The href for a bare link, or `null` when it isn't one. */
function bareHref(link: string): string | null {
  if (/^(?:https?|ftp):\/\/./.test(link)) return link;
  if (/^www\../.test(link)) return `http://${link}`;
  return isEmail(link) ? `mailto:${link}` : null;
}

/**
 * Renders a text node: escaped, with `<br>` for newlines and, unless `autolink` is off, links
 * for bare URLs and emails.
 */
export function renderText(text: string, autolink: boolean): string {
  if (!autolink) return textHtml(text);
  let out = "";
  let last = 0;
  for (const m of text.matchAll(CANDIDATE)) {
    const lead = (m[1] as string) + (m[2] as string);
    const body = m[3] as string;
    const link = body.replace(TRAILING, "");
    const href = bareHref(link);
    if (href === null) continue;
    const at = (m.index as number) + lead.length;
    out += textHtml(text.slice(last, at));
    out += `<a class="bb-link" href="${escapeHtml(href)}" rel="nofollow noopener">${escapeHtml(link)}</a>`;
    last = at + link.length;
  }
  return out + textHtml(text.slice(last));
}
