import { describe, expect, it } from "vitest";
import { parse } from "../src/index.js";
import { escapeMarkdown } from "../src/markdown/escape.js";
import { LOSS_CODES, toMarkdown } from "../src/markdown/index.js";

describe("markdown basics", () => {
  it("freezes the loss codes", () => {
    expect(Object.isFrozen(LOSS_CODES)).toBe(true);
    expect(LOSS_CODES).toEqual([
      "no-equivalent",
      "table",
      "html",
      "heading-level",
      "footnote",
      "reference-link-unresolved",
    ]);
  });
  it("escapes inline markers anywhere", () => {
    expect(escapeMarkdown("a*b_c`d[e]f~g", false)).toBe("a\\*b\\_c\\`d\\[e\\]f\\~g");
  });
  it("escapes line-start markers only at line start", () => {
    expect(escapeMarkdown("# x", true)).toBe("\\# x");
    expect(escapeMarkdown("> x", true)).toBe("\\> x");
    expect(escapeMarkdown("- x", true)).toBe("\\- x");
    expect(escapeMarkdown("1. x", true)).toBe("1\\. x");
    expect(escapeMarkdown("a # b", false)).toBe("a # b");
  });
});

const md = (s: string) => toMarkdown(s).output;
const codes = (s: string) => toMarkdown(s).lost.map((l) => l.code);

describe("toMarkdown", () => {
  it("handles empty input", () => {
    expect(toMarkdown("")).toEqual({ output: "", lost: [] });
  });
  it("handles whitespace-only input like empty input", () => {
    expect(toMarkdown("  \n")).toEqual({ output: "", lost: [] });
    expect(toMarkdown("\n\n \t\n")).toEqual({ output: "", lost: [] });
  });
  it("maps inline styles", () => {
    expect(md("[b]a[/b] [i]b[/i] [s]c[/s] [strike]d[/strike]")).toBe("**a** *b* ~~c~~ ~~d~~");
    expect(md("[c]x*y[/c]")).toBe("`x*y`");
  });
  it("maps blocks", () => {
    expect(md("[heading]Rules[/heading]")).toBe("## Rules");
    expect(md("[code]a\n*b[/code]")).toBe("```\na\n*b\n```");
    expect(md('[quote="peppy"]hi[/quote]')).toBe("> **peppy** wrote:\n> hi");
    expect(md("[list][*]a[*]b[/list]")).toBe("- a\n- b");
    expect(md("[list=1][*]a[*]b[/list]")).toBe("1. a\n2. b");
  });
  it("maps links and media", () => {
    expect(md("[url=https://x.y]t[/url]")).toBe("[t](https://x.y)");
    expect(md("[url]https://x.y[/url]")).toBe("<https://x.y>");
    expect(md("[email]a@b.c[/email]")).toBe("<mailto:a@b.c>");
    expect(md("[img]https://i.y/a.png[/img]")).toBe("![](https://i.y/a.png)");
    expect(md("[profile]peppy[/profile]")).toBe("[peppy](https://osu.ppy.sh/users/peppy)");
    expect(md("[youtube]abc[/youtube]")).toBe("<https://www.youtube.com/watch?v=abc>");
  });
  it("keeps children and reports tags with no markdown form", () => {
    const r = toMarkdown("[color=red]x[/color][u]y[/u]");
    expect(r.output).toBe("xy");
    expect(r.lost).toEqual([
      expect.objectContaining({ code: "no-equivalent", start: 0, end: 20 }),
      expect.objectContaining({ code: "no-equivalent", start: 20, end: 28 }),
    ]);
    expect(codes("[size=150]a[/size][spoiler]b[/spoiler][centre]c[/centre]")).toEqual([
      "no-equivalent",
      "no-equivalent",
      "no-equivalent",
    ]);
  });
  it("renders boxes by option", () => {
    expect(md("[box=T]x[/box]")).toBe("**T**\n\nx");
    expect(toMarkdown("[box=T]x[/box]", { boxStyle: "quote" }).output).toBe("> **T**\n> x");
    expect(codes("[box=T]x[/box]")).toEqual(["no-equivalent"]);
  });
  it("escapes text so it stays text", () => {
    expect(md("a*b")).toBe("a\\*b");
    expect(md("# not heading")).toBe("\\# not heading");
  });
  it("accepts a parsed document", () => {
    expect(toMarkdown(parse("[b]a[/b]")).output).toBe("**a**");
  });
  it("renders notice as a quote, with a loss", () => {
    expect(md("[notice]hi[/notice]")).toBe("> hi");
    expect(codes("[notice]hi[/notice]")).toEqual(["no-equivalent"]);
  });
  it("renders [c] as a backtick span over plain text, flattening nested tags", () => {
    const r = toMarkdown("[c]a[i]b[/i]c[/c]");
    expect(r.output).toBe("`abc`");
    expect(r.lost).toEqual([expect.objectContaining({ code: "no-equivalent" })]);
    expect(md("[c]a`b[/c]")).toBe("``a`b``");
  });
  it("renders spoilerbox like box, with a loss", () => {
    expect(md("[spoilerbox]x[/spoilerbox]")).toBe("**Spoiler**\n\nx");
    expect(codes("[spoilerbox]x[/spoilerbox]")).toEqual(["no-equivalent"]);
  });
  it("renders spoilerbox as a quote under boxStyle: quote", () => {
    expect(toMarkdown("[spoilerbox]x[/spoilerbox]", { boxStyle: "quote" }).output).toBe(
      "> **Spoiler**\n> x",
    );
  });
  it("renders audio as an autolink", () => {
    expect(md("[audio]https://a.b/c.mp3[/audio]")).toBe("<https://a.b/c.mp3>");
  });
  it("renders an imagemap as an image plus a link list, with a loss", () => {
    const r = toMarkdown("[imagemap]\nhttps://a.b/i.png\n0 0 50 50 https://a.b/ x\n[/imagemap]");
    expect(r.output).toBe("![](https://a.b/i.png)\n- [x](https://a.b/)");
    expect(r.lost).toEqual([expect.objectContaining({ code: "no-equivalent" })]);
  });
  it("reads a youtube id out of a full link instead of injecting it raw", () => {
    expect(md("[youtube]https://youtu.be/abc[/youtube]")).toBe(
      "<https://www.youtube.com/watch?v=abc>",
    );
  });
  it("escapes youtube content with no recognizable id instead of injecting it raw", () => {
    const r = toMarkdown("[youtube]a b [x](javascript:1)[/youtube]");
    expect(r.output).not.toMatch(/(?<!\\)\]\(/);
    expect(r.lost).toEqual([expect.objectContaining({ code: "no-equivalent" })]);
  });
  it("percent-encodes ) in a url destination", () => {
    expect(md("[url=http://a.com/)x]y[/url]")).toBe("[y](http://a.com/%29x)");
  });
  it("percent-encodes a space in a url destination", () => {
    expect(md("[url=http://a.com/ x]y[/url]")).toBe("[y](http://a.com/%20x)");
  });
  it("percent-encodes > in a bare url autolink", () => {
    expect(md("[url]http://a.com/>x[/url]")).toBe("<http://a.com/%3Ex>");
  });
  it("percent-encodes a space in an img destination", () => {
    expect(md("[img]http://a.com/a b.png[/img]")).toBe("![](http://a.com/a%20b.png)");
  });
  it("keeps link text with a ] escaped", () => {
    expect(md("[url=http://a.com]a]b[/url]")).toBe("[a\\]b](http://a.com)");
  });
});
