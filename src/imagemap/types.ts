/**
 * @file src/imagemap/types.ts
 * @desc Types for `[imagemap]`: the image, its link regions and the problems parsing can find.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** One link region. Positions and sizes are percentages of the image. */
export interface ImagemapRegion {
  /** Left edge, percent of the image width. */
  x: number;
  /** Top edge, percent of the image height. */
  y: number;
  /** Width, percent of the image width. */
  w: number;
  /** Height, percent of the image height. */
  h: number;
  /** `"#"` for no link, an `http(s)://` URL, or `mailto:...`. */
  href: string;
  /** Hover text. `""` for none. */
  title: string;
}

/** A whole imagemap: an image URL and its regions, in order. */
export interface Imagemap {
  /** The `http(s)://` image URL. */
  image: string;
  /** The link regions, first line first. */
  regions: ImagemapRegion[];
}

/** A line osu! would refuse, which makes it show the whole block as text. */
export interface ImagemapIssue {
  /** 1-based line number in the text passed to `parseImagemap`. */
  line: number;
  /** Offset of the problem in that text. */
  start: number;
  /** Offset just past it. */
  end: number;
  /** What's wrong, in plain words. */
  message: string;
}

/** The result of `parseImagemap`. */
export type ImagemapResult =
  | { ok: true; imagemap: Imagemap; issues: [] }
  | { ok: false; imagemap: null; issues: ImagemapIssue[] };

/** A field of an `Imagemap` object that `validateImagemap` refuses. */
export interface ImagemapProblem {
  /** Which field: `"image"`, `"regions"` or `"regions.2.href"`. */
  field: string;
  /** What's wrong. */
  message: string;
}
