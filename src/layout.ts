/**
 * @file src/layout.ts
 * @desc OSU_WIDTHS and OSU_FONT_SIZES: where osu! lays BBCode out on desktop. A preview drawn at
 *       these sizes (then scaled to fit) wraps text and image rows where osu! does.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/**
 * The width in px of the column BBCode renders in on osu!'s desktop layout (its pages are 1000px
 * wide at most). Measured from osu-web's stylesheets, September 2026; osu! may change them.
 */
export const OSU_WIDTHS = Object.freeze({
  /** A userpage ("me!"): 1000, less the 10px margin each side, 40px left and 50px right padding. */
  userpage: 890,
  /** A forum post: 1000, less the 180px poster column, 20px left and 50px right padding. */
  forum: 750,
  /**
   * A beatmap description: 1000, less 40px padding each side, the 175px and 275px info columns
   * and two 20px gaps.
   */
  beatmap: 430,
});

/** The font size in px osu! renders BBCode at, per place, on desktop. */
export const OSU_FONT_SIZES = Object.freeze({
  /** A userpage. */
  userpage: 14,
  /** A forum post. */
  forum: 14,
  /** A beatmap description. */
  beatmap: 12,
});
