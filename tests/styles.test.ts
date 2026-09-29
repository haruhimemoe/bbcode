/**
 * @file tests/styles.test.ts
 * @desc styles.css keeps images inline, so a row of collab images written side by side stays on
 *       one line even under a CSS reset that makes every img a block (Tailwind's preflight).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
};

describe("styles.css", () => {
  it("keeps [img] inline at its own size, as osu! does", () => {
    const img = rule(".bb-img");
    expect(img).toContain("display: inline;");
    expect(img).toContain("max-width: 100%;");
    expect(img).toContain("vertical-align: baseline;");
  });

  it("keeps the imagemap's image a block under its link regions", () => {
    expect(rule(".bb-imagemap__image")).toContain("display: block;");
  });
});
