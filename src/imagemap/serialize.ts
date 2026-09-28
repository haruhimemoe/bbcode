/**
 * @file src/imagemap/serialize.ts
 * @desc validateImagemap and serializeImagemap: check an imagemap object, then write the
 *       `[imagemap]` block osu! accepts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { isMediaUrl } from "../safety.js";
import { HREF } from "./parse.js";
import type { Imagemap, ImagemapProblem } from "./types.js";

const NUMBERS = ["x", "y", "w", "h"] as const;

/**
 * Formats a percentage with at most 4 decimals and no exponent (`12.5`, `0.0001`).
 * @function formatPercent
 * @param {number} n - A finite number from 0 to 100.
 * @returns {string} The number as osu! wants it.
 */
export function formatPercent(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

/**
 * Checks an imagemap object before it's written: an http(s) image URL without spaces, at least
 * one region, each number from 0 to 100, each link `#`, http(s) or mailto without spaces, and
 * titles on one line.
 * @function validateImagemap
 * @param {Imagemap} map - The imagemap to check.
 * @returns {ImagemapProblem[]} Every problem found; empty when the imagemap is fine.
 */
export function validateImagemap(map: Imagemap): ImagemapProblem[] {
  const problems: ImagemapProblem[] = [];
  if (!isMediaUrl(map.image)) {
    problems.push({ field: "image", message: "Use an http(s) image URL without spaces." });
  }
  if (map.regions.length === 0) {
    problems.push({ field: "regions", message: "Add at least one region." });
  }
  map.regions.forEach((region, i) => {
    for (const key of NUMBERS) {
      const n = region[key];
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        problems.push({ field: `regions.${i}.${key}`, message: "Use a percentage from 0 to 100." });
      }
    }
    if (!HREF.test(region.href)) {
      problems.push({ field: `regions.${i}.href`, message: "Use #, an http(s) URL or mailto:." });
    }
    if (/[\r\n]/.test(region.title)) {
      problems.push({ field: `regions.${i}.title`, message: "Keep the title on one line." });
    }
  });
  return problems;
}

/**
 * Writes an imagemap as a `[imagemap]` block. `parseImagemap` reads the result back unchanged
 * (numbers rounded to 4 decimals, title trimmed).
 * @function serializeImagemap
 * @param {Imagemap} map - The imagemap.
 * @returns {string} The BBCode block, from `[imagemap]` to `[/imagemap]`.
 * @throws {TypeError} When `validateImagemap` finds a problem; the message lists them.
 */
export function serializeImagemap(map: Imagemap): string {
  const problems = validateImagemap(map);
  if (problems.length > 0) {
    const list = problems.map((p) => `${p.field}: ${p.message}`).join("; ");
    throw new TypeError(`Invalid imagemap: ${list}`);
  }
  const lines = map.regions.map((r) => {
    const numbers = NUMBERS.map((key) => formatPercent(r[key])).join(" ");
    const title = r.title.trim();
    return `${numbers} ${r.href}${title ? ` ${title}` : ""}`;
  });
  return `[imagemap]\n${map.image}\n${lines.join("\n")}\n[/imagemap]`;
}
