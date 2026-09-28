/**
 * @file tests/nesting.test.ts
 * @desc Deep nesting: 60,000 characters of nested tags render, lint and round-trip without
 *       overflowing the stack, and tags past LIMITS.nesting stay text with a too-deep warning.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { LIMITS, lint, parse, render, serialize } from "../src/index.js";

const nested = (open: string, close: string, levels: number): string =>
  `${open.repeat(levels)}x${close.repeat(levels)}`;

describe("deep nesting", () => {
  it("handles a post's worth of nested tags", () => {
    for (const [open, close] of [
      ["[quote]", "[/quote]"],
      ["[box=a]", "[/box]"],
      ["[spoilerbox]", "[/spoilerbox]"],
      ["[list][*]", "[/list]"],
    ] as const) {
      const src = nested(open, close, Math.floor(LIMITS.forumPost / (open.length + close.length)));
      expect(() => render(src)).not.toThrow();
      expect(() => lint(src)).not.toThrow();
      expect(serialize(parse(src))).toBe(src);
    }
  });

  it("keeps tags past the nesting limit as text and says so once", () => {
    const src = nested("[quote]", "[/quote]", LIMITS.nesting + 2);
    const html = render(src, { wrap: false });
    expect(html.match(/<blockquote/g)).toHaveLength(LIMITS.nesting);
    expect(html).toContain("[quote][quote]x");
    const deep = lint(src).filter((d) => d.code === "too-deep");
    expect(deep).toHaveLength(1);
    expect(deep[0]).toMatchObject({ severity: "warning", start: LIMITS.nesting * 7 });
  });

  it("counts boxes inside box titles toward the limit", () => {
    let src = "a";
    for (let i = 0; i < 4000; i++) src = `[box=${src}]x[/box]`;
    const html = render(src, { wrap: false });
    expect(html.match(/<details/g)).toHaveLength(LIMITS.nesting);
    expect(html).toContain("[box=[box=");
  });

  it("allows nesting up to the limit", () => {
    const src = nested("[quote]", "[/quote]", LIMITS.nesting);
    expect(render(src, { wrap: false })).not.toContain("[quote]");
    expect(lint(src)).toEqual([]);
  });
});
