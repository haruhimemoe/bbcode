/**
 * @file tests/styles.test.ts
 * @desc styles.css matches osu!'s layout: images inline, so a row of collab images written side
 *       by side stays on one line even under a CSS reset that makes every img a block (Tailwind's preflight), and
 *       box bodies indented as osu! indents them.
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

  it("indents a box's body 20px under a 10px gap, as osu! does", () => {
    const body = rule(".bb-box__body");
    expect(body).toContain("margin: 10px 0 0;");
    expect(body).toContain("padding: 0 0 0 20px;");
    expect(body).not.toContain("border");
  });

  it("lines a box's title text up with its body", () => {
    const title = rule(".bb-box__title");
    expect(title).toContain("gap: 0;");
    expect(rule(".bb-box__title::before")).toContain("margin-inline-end: calc(20px - 0.45em);");
  });

  it("keeps the imagemap's image a block under its link regions", () => {
    expect(rule(".bb-imagemap__image")).toContain("display: block;");
  });
});
