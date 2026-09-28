/**
 * @file src/render/context.ts
 * @desc Render options and the context passed down while rendering. Internal apart from
 *       `RenderOptions`, which the package exports.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Node } from "../ast.js";
import { isClean, isMediaUrl } from "../safety.js";
import type { Eat } from "./eat.js";

/** What kind of media a URL is for, as passed to `RenderOptions.proxy`. */
export type MediaKind = "img" | "audio" | "imagemap";

/** Options for `render`. */
export interface RenderOptions {
  /**
   * Rewrites image, audio and imagemap URLs, for example through your own image proxy (osu!
   * uses its own). Only called for http(s) URLs. The result must be an http(s) URL or a path
   * starting with `/`, or the tag renders as text.
   */
  proxy?: (url: string, kind: MediaKind) => string;
  /** Extra classes for the root `<div class="bb">`. */
  className?: string;
  /** Wrap the output in `<div class="bb">`. Default `true`. */
  wrap?: boolean;
}

/** State while rendering. */
export interface Ctx {
  readonly options: RenderOptions;
  /** Inside a link: no nested links, no automatic links. */
  readonly inLink: boolean;
  /** Tags rendered around this point, box titles included; past LIMITS.nesting tags are text. */
  readonly depth: number;
  /** Renders child nodes, eating newlines at the start and end as given. */
  readonly inner: (nodes: readonly Node[], ctx: Ctx, lead?: Eat, trail?: Eat) => string;
}

/** A media URL after the proxy, or `null` when it isn't allowed. */
export function mediaUrl(url: string, kind: MediaKind, ctx: Ctx): string | null {
  if (!isMediaUrl(url)) return null;
  const out = ctx.options.proxy ? ctx.options.proxy(url, kind) : url;
  if (typeof out !== "string") return null;
  return isMediaUrl(out) || (/^\/(?!\/)/.test(out) && isClean(out)) ? out : null;
}
