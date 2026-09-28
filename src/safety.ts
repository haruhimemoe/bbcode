/**
 * @file src/safety.ts
 * @desc The checks that make rendered HTML safe: escaping, URL schemes, colors, sizes and
 *       YouTube ids. Shared by the renderer, the linter and the helpers. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for HTML content and double- or single-quoted attributes. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] as string);
}

/** Non-empty, with no whitespace or control characters: nothing a browser would strip. */
export function isClean(url: string): boolean {
  if (url === "" || /\s/.test(url)) return false;
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/** An http or https URL (images, audio, imagemaps). */
export function isMediaUrl(url: string): boolean {
  return /^https?:\/\/./.test(url) && isClean(url);
}

/** An http, https or ftp URL (links). */
export function isLinkUrl(url: string): boolean {
  return /^(?:https?|ftp):\/\/./.test(url) && isClean(url);
}

/** A `mailto:` target osu! accepts, without the scheme. */
export function isEmail(address: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z-]+$/.test(address);
}

/** A color osu! accepts in `[color=]`: `#rrggbb` or letters only. */
export function isColor(color: string): boolean {
  return /^(?:#[0-9A-Fa-f]{6}|[A-Za-z]+)$/.test(color);
}

/** The smallest and largest `[size=]` osu! renders, in percent. */
export const SIZE_MIN = 30;
/** See `SIZE_MIN`. */
export const SIZE_MAX = 200;

/** Clamps a `[size=]` argument (digits) to 30..200, like osu!. */
export function clampSize(arg: string): number {
  const n = Number.parseInt(arg, 10);
  if (!Number.isFinite(n)) return SIZE_MAX;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, n));
}

const YOUTUBE_PREFIX =
  /^(?:https?:\/\/(?:youtu\.be\/|(?:m\.|www\.)?youtube\.com\/(?:embed\/|shorts\/|watch\?v=)))?/;

/**
 * Reads a video id from `[youtube]` content: a bare id or a youtube.com / youtu.be / shorts
 * link. Anything after `?` is dropped, as osu! does.
 * @returns The id, or `null` when it has characters outside `[A-Za-z0-9_-]`.
 */
export function youtubeId(content: string): string | null {
  const id = content.replace(YOUTUBE_PREFIX, "").replace(/\?.*$/s, "");
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}
