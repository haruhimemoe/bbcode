/**
 * @file tests/markdown-roundtrip.test.ts
 * @desc Round trips, real samples and hostile input for ./markdown.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lint } from "../src/index.js";
import { fromMarkdown, toMarkdown } from "../src/markdown/index.js";

const dir = new URL("./fixtures/markdown/", import.meta.url);
const read = (f: string) => readFileSync(new URL(f, dir), "utf8");

describe("round trips", () => {
  it.each([
    "[b]a[/b] [i]b[/i] [s]c[/s] [c]d[/c]",
    "[heading]T[/heading]",
    "[code]\nx\n[/code]",
    "[quote]q[/quote]",
    "[list]\n[*]a\n[*]b\n[/list]",
    "[url=https://x.y]t[/url]",
    "[img]https://i/a.png[/img]",
  ])("bbcode -> md -> bbcode keeps %s", (src) => {
    expect(fromMarkdown(toMarkdown(src).output).output).toBe(src);
  });
});

describe("real samples", () => {
  it.each(readdirSync(dir).filter((f) => f.endsWith(".bb")))("template %s converts", (f) => {
    const r = toMarkdown(read(f));
    expect(r.output.length).toBeGreaterThan(0);
    expect(lint(fromMarkdown(r.output).output).filter((d) => d.severity === "error")).toEqual([]);
  });
  it.each(["readme.md", "discord.md"])("%s converts without lint errors", (f) => {
    expect(lint(fromMarkdown(read(f)).output).filter((d) => d.severity === "error")).toEqual([]);
  });
});

describe("hostile input", () => {
  it("survives deep nesting fast", () => {
    for (const s of [
      ">".repeat(10_000) + " x",
      Array.from({ length: 10_000 }, (_, i) => `${" ".repeat(i * 2)}- x`).join("\n"),
      "[".repeat(10_000),
      "*".repeat(10_000) + "a",
    ]) {
      const t = performance.now();
      fromMarkdown(s);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
  it("survives deep bbcode", () => {
    const s = "[b]".repeat(5_000) + "x" + "[/b]".repeat(5_000);
    const t = performance.now();
    toMarkdown(s);
    expect(performance.now() - t).toBeLessThan(200);
  });
  it("random ascii never throws and never lints with errors", () => {
    let seed = 1;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const alphabet = "ab *_~`[]()<>#>-1.|\\\n !:/h";
    for (let n = 0; n < 500; n++) {
      const s = Array.from(
        { length: 80 },
        () => alphabet[Math.floor(rand() * alphabet.length)],
      ).join("");
      const out = fromMarkdown(s).output;
      expect(lint(out).filter((d) => d.severity === "error")).toEqual([]);
      expect(() => toMarkdown(s)).not.toThrow();
    }
  });
  it("treats CRLF like LF", () => {
    expect(fromMarkdown("# a\r\n\r\n**b**").output).toBe(fromMarkdown("# a\n\n**b**").output);
  });
});
