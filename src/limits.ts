/**
 * @file src/limits.ts
 * @desc LIMITS and `count`: osu!'s post length limit and size bounds, and a counter against it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { SIZE_MAX, SIZE_MIN } from "./safety.js";

/** osu!'s limits. The userpage and beatmap descriptions are forum posts, so they share one. */
export const LIMITS = Object.freeze({
  /** Characters in a forum post (osu!'s `FORUM_POST_MAX_LENGTH`). */
  forumPost: 60_000,
  /** Characters on a userpage ("me!"). */
  userpage: 60_000,
  /** Characters in a beatmap description. */
  beatmapDescription: 60_000,
  /** Smallest `[size=]` osu! renders, in percent. Smaller values are raised to it. */
  sizeMin: SIZE_MIN,
  /** Largest `[size=]` osu! renders, in percent. Larger values are lowered to it. */
  sizeMax: SIZE_MAX,
  /** The sizes osu!'s own editor offers. */
  sizePresets: Object.freeze([50, 85, 100, 150] as const),
});

/** The result of `count`. */
export interface Count {
  /** Characters in the text (Unicode code points, so an emoji made of one code point is 1). */
  length: number;
  /** The limit counted against. */
  limit: number;
  /** `limit - length`; negative when over. */
  remaining: number;
  /** `true` when `length > limit`. */
  over: boolean;
}

/**
 * Counts characters against osu!'s limit. Counts Unicode code points of the BBCode as written,
 * tags included.
 * @function count
 * @param {string} text - BBCode source.
 * @param {number} [limit] - Defaults to `LIMITS.forumPost` (60,000).
 * @returns {Count} Length, limit, what's left and whether it's over.
 */
export function count(text: string, limit: number = LIMITS.forumPost): Count {
  let length = 0;
  for (const _ of text) length++;
  return { length, limit, remaining: limit - length, over: length > limit };
}
