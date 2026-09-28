/**
 * @file tests/performance.test.ts
 * @desc Linear time on hostile input: 60,000 characters of repeated openings, bare dots and
 *       unterminated arguments parse, render and lint quickly; the box title table agrees with
 *       a plain left-to-right scan.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { escapeBBCode } from "../src/helpers/index.js";
import { lint, render } from "../src/index.js";
import { finder, titleEnds } from "../src/parser/find.js";

/** The plain scan titleEnds replaces: the first `]` at depth 0, skipping `\[` and `\]`. */
function naiveEnd(src: string, from: number): number {
  let depth = 0;
  for (let j = from; j < src.length; j++) {
    const ch = src.charAt(j);
    if (ch === "\\" && "[]".includes(src.charAt(j + 1))) j++;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      if (depth === 0) return j;
      depth--;
    }
  }
  return -1;
}

describe("hostile input", () => {
  const fill = (unit: string, tail = ""): string =>
    unit.repeat(Math.floor(60_000 / unit.length)) + tail;
  it.each([
    ["[box= repeated", fill("[box=")],
    ["[box= then ]", fill("[box=", "]")],
    ["[c] then a close on the next line", fill("[c]", "\n[/c]")],
    ["[url] then a close", fill("[url]", "[/url]")],
    ['[quote=" repeated', fill('[quote="')],
    ["[a= then ]", fill("[a=", "]")],
    ["a space then dots", ` ${fill(".")}`],
    ["a link ending in dots", `https://a${fill(".", "x")}`],
  ])("%s stays fast", (_, src) => {
    const started = performance.now();
    render(src);
    lint(src);
    escapeBBCode(src);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("titleEnds", () => {
  it("matches a left-to-right scan from every offset", () => {
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let n = 0; n < 300; n++) {
      const src = Array.from({ length: next() % 24 }, () => "[]\\a"[next() % 4]).join("");
      const ends = titleEnds(src);
      for (let i = 0; i <= src.length; i++) expect(ends[i]).toBe(naiveEnd(src, i));
    }
  });
});

describe("finder", () => {
  it("answers like indexOf, reading forward or back", () => {
    const find = finder("ab[/c]xx[/c]");
    expect([find("[/c]", 0), find("[/c]", 3), find("[/c]", 7), find("[/c]", 1)]).toEqual([
      2, 8, 8, 2,
    ]);
    expect([find("zz", 0), find("zz", 5)]).toEqual([-1, -1]);
  });
});
