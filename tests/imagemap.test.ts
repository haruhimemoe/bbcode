/**
 * @file tests/imagemap.test.ts
 * @desc parseImagemap against osu!'s line rules, validateImagemap, and serialize/parse
 *       round trips.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  formatPercent,
  type Imagemap,
  parseImagemap,
  serializeImagemap,
  validateImagemap,
} from "../src/imagemap/index.js";

const MAP: Imagemap = {
  image: "https://a.b/i.png",
  regions: [
    { x: 0, y: 0, w: 50, h: 100, href: "https://osu.ppy.sh/users/2", title: "peppy" },
    { x: 50, y: 12.5, w: 33.3333, h: 0.0001, href: "#", title: "" },
    { x: 1, y: 2, w: 3, h: 4, href: "mailto:a@b.co", title: "mail me" },
  ],
};

describe("parseImagemap", () => {
  it("reads a block and its content alike", () => {
    const block = serializeImagemap(MAP);
    expect(parseImagemap(block)).toEqual({ ok: true, imagemap: MAP, issues: [] });
    const content = block.slice("[imagemap]".length, -"[/imagemap]".length);
    expect(parseImagemap(content)).toEqual({ ok: true, imagemap: MAP, issues: [] });
  });

  it("allows indentation, blank lines and CRLF", () => {
    const r = parseImagemap("\r\n  https://a.b/i.png\r\n\r\n  .5 1. 2 3 # a  b\r\n  \r\n");
    expect(r.ok && r.imagemap.regions[0]).toEqual({
      x: 0.5,
      y: 1,
      w: 2,
      h: 3,
      href: "#",
      title: "a  b",
    });
  });

  it.each([
    ["https://a.b/i.png\n0 0 1 1 #\n", 1, "Start the image URL"],
    ["", 1, "The first line must be the image URL."],
    ["\n", 1, "The first line must be the image URL."],
    ["\nftp://a.b/i.png\n0 0 1 1 #\n", 2, "must start with http"],
    ["\nhttps://a.b/i.png\n", 2, "Add at least one region line."],
    ["\nhttps://a.b/i.png\n0 0 1 1 #", 3, "Put [/imagemap] on its own line."],
    ["\nhttps://a.b/i.png\n0 0 1 #\n", 3, "A region line needs"],
    ["\nhttps://a.b/i.png\n0 0 1 1.2.3 #\n", 3, '"1.2.3" isn\'t a number'],
    ["\nhttps://a.b/i.png\n0  0 1 1 #\n", 3, '"" isn\'t a number'],
    ["\nhttps://a.b/i.png\n0 0 1 1 javascript:x\n", 3, "isn't a link osu! allows"],
  ])("refuses %j", (content, line, message) => {
    const r = parseImagemap(content);
    expect(r.ok).toBe(false);
    expect(r.imagemap).toBeNull();
    expect(r.issues[0]?.line).toBe(line);
    expect(r.issues[0]?.message).toContain(message);
  });

  it("reports every bad line with offsets into the input", () => {
    const text = "[imagemap]\nhttps://a.b/i.png\nbad\n0 0 1 1 #\nworse\n[/imagemap]";
    const r = parseImagemap(text);
    expect(r.issues.map((i) => text.slice(i.start, i.end))).toEqual(["bad", "worse"]);
  });
});

describe("validateImagemap and serializeImagemap", () => {
  it("writes one line per region", () => {
    expect(serializeImagemap(MAP)).toBe(
      "[imagemap]\nhttps://a.b/i.png\n0 0 50 100 https://osu.ppy.sh/users/2 peppy\n" +
        "50 12.5 33.3333 0.0001 #\n1 2 3 4 mailto:a@b.co mail me\n[/imagemap]",
    );
  });
  it("finds every problem", () => {
    const bad: Imagemap = {
      image: "https://a.b/i i.png",
      regions: [{ x: -1, y: 101, w: Number.NaN, h: 1, href: "javascript:x", title: "a\nb" }],
    };
    expect(validateImagemap(bad).map((p) => p.field)).toEqual([
      "image",
      "regions.0.x",
      "regions.0.y",
      "regions.0.w",
      "regions.0.href",
      "regions.0.title",
    ]);
    expect(validateImagemap({ image: "https://a.b/i.png", regions: [] })).toEqual([
      { field: "regions", message: "Add at least one region." },
    ]);
    expect(() => serializeImagemap(bad)).toThrow(/Invalid imagemap: image: /);
  });
  it("formats percentages without exponents", () => {
    expect([formatPercent(1e-7), formatPercent(12.34567), formatPercent(100)]).toEqual([
      "0",
      "12.3457",
      "100",
    ]);
  });
});
