/**
 * @file tests/layout.test.ts
 * @desc OSU_WIDTHS and OSU_FONT_SIZES: the content widths and font sizes osu! lays BBCode out at
 *       on desktop, which a preview needs to wrap lines and image rows where osu! does.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { OSU_FONT_SIZES, OSU_WIDTHS } from "../src/index.js";

describe("OSU_WIDTHS", () => {
  it("gives each place a post shows its desktop content width", () => {
    expect(OSU_WIDTHS).toEqual({ userpage: 890, forum: 750, beatmap: 430 });
  });

  it("fits a row of six 136px collab tiles on a userpage", () => {
    expect(6 * 136).toBeLessThanOrEqual(OSU_WIDTHS.userpage);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(OSU_WIDTHS)).toBe(true);
    expect(Object.isFrozen(OSU_FONT_SIZES)).toBe(true);
  });
});

describe("OSU_FONT_SIZES", () => {
  it("gives each place its desktop font size in px", () => {
    expect(OSU_FONT_SIZES).toEqual({ userpage: 14, forum: 14, beatmap: 12 });
  });
});
