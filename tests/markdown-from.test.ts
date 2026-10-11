import { describe, expect, it } from "vitest";
import { lint } from "../src/index.js";
import { fromMarkdown } from "../src/markdown/index.js";

const bb = (s: string) => fromMarkdown(s).output;
const codes = (s: string) => fromMarkdown(s).lost.map((l) => l.code);

describe("fromMarkdown", () => {
  it("handles empty and blank input", () => {
    expect(fromMarkdown("")).toEqual({ output: "", lost: [] });
    expect(fromMarkdown("  \n\n ")).toEqual({ output: "", lost: [] });
  });
  it("maps inline styles", () => {
    expect(bb("**a** *b* ~~c~~ `d`")).toBe("[b]a[/b] [i]b[/i] [s]c[/s] [c]d[/c]");
  });
  it("maps headings by level and option", () => {
    expect(bb("# A")).toBe("[heading]A[/heading]");
    expect(bb("### A")).toBe("[heading]A[/heading]");
    expect(codes("### A")).toEqual(["heading-level"]);
    expect(fromMarkdown("### A", { headingStyle: "bold" }).output).toBe("[b]A[/b]");
  });
  it("maps blocks", () => {
    expect(bb("> a\n> b")).toBe("[quote]a\nb[/quote]");
    expect(bb("- a\n- b")).toBe("[list]\n[*]a\n[*]b\n[/list]");
    expect(bb("1. a\n2. b")).toBe("[list=1]\n[*]a\n[*]b\n[/list]");
    expect(bb("```\nx\n```")).toBe("[code]\nx\n[/code]");
    expect(bb("a\n\nb")).toBe("a\n\nb");
  });
  it("maps links and images", () => {
    expect(bb("[t](https://x.y)")).toBe("[url=https://x.y]t[/url]");
    expect(bb("<https://x.y>")).toBe("[url]https://x.y[/url]");
    expect(bb("<mailto:a@b.c>")).toBe("[email]a@b.c[/email]");
    expect(bb("![a](https://i/a.png)")).toBe("[img]https://i/a.png[/img]");
  });
  it("renders tables as aligned code, or text", () => {
    const t = "| a | bb |\n|---|---|\n| ccc | d |";
    expect(bb(t)).toBe("[code]\na   | bb\n----+---\nccc | d\n[/code]");
    expect(codes(t)).toEqual(["table"]);
    expect(fromMarkdown(t, { tableStyle: "text" }).output).toBe("a | bb\nccc | d");
  });
  it("reports what it can't carry", () => {
    expect(codes("<b>x</b>")).toEqual(["html"]);
    expect(codes("a\n\n---\n\nb")).toEqual(["no-equivalent"]);
    expect(codes("[t][nope]")).toEqual(["reference-link-unresolved"]);
    expect(codes("a[^1]\n\n[^1]: note")).toContain("footnote");
  });
  it("warns when typed text would turn into a tag on osu!", () => {
    const r = fromMarkdown("say [b]hi[/b]");
    expect(r.output).toBe("say [b]hi[/b]");
    expect(r.lost).toEqual([expect.objectContaining({ code: "no-equivalent", start: 4, end: 13 })]);
  });
  it("resolves reference definitions and drops them from output", () => {
    expect(bb("[t][x]\n\n[x]: https://x.y")).toBe("[url=https://x.y]t[/url]");
  });
  it("never produces lint errors", () => {
    const sample =
      "# T\n\n**b *i* b** ~~s~~\n\n> q\n\n- a\n  - b\n\n```\n[b]\n```\n\n| a |\n|---|\n| 1 |";
    expect(lint(bb(sample)).filter((d) => d.severity === "error")).toEqual([]);
  });

  // --- Fix round 1: review findings ---

  it("warns when a code span's text parses as a live tag (finding 1)", () => {
    const r = fromMarkdown("`[b]x[/b]`");
    expect(r.output).toBe("[c][b]x[/b][/c]");
    expect(r.lost).toEqual([expect.objectContaining({ code: "no-equivalent", start: 0, end: 10 })]);
  });
  it("gives fenced code (raw) no live-tag warning (finding 1)", () => {
    expect(codes("```\n[b]\n```")).toEqual([]);
    expect(bb("```\n[b]\n```")).toBe("[code]\n[b]\n[/code]");
  });
  it("percent-encodes [ ] and space in image and link URLs (finding 2)", () => {
    expect(bb("![a](https://i/a[1].png)")).toBe("[img]https://i/a%5B1%5D.png[/img]");
    expect(lint(bb("![a](https://i/a[1].png)")).filter((d) => d.severity === "error")).toEqual([]);
  });
  it("keeps the url tag intact for a ] inside an angle destination (finding 3a)", () => {
    expect(bb("[t](<https://x.y/a]b>)")).toBe("[url=https://x.y/a%5Db]t[/url]");
  });
  it("drops the backslash from an escaped ] in a link destination (finding 3b)", () => {
    expect(bb("[t](https://x.y/a\\]b)")).toBe("[url=https://x.y/a%5Db]t[/url]");
  });
  it("accepts a space inside an angle-bracket link destination (finding 3c)", () => {
    expect(bb("[t](<https://x.y/a b>)")).toBe("[url=https://x.y/a%20b]t[/url]");
  });
  it("does not resolve or blank reference definitions written inside fenced code (finding 4)", () => {
    const sample = "```\n[x]: https://evil\n```\n\n[t][x]";
    expect(bb(sample)).toBe("[code]\n[x]: https://evil\n[/code]\n\n[t][x]");
    expect(codes(sample)).toEqual(["reference-link-unresolved"]);
  });
  it("reports nesting deeper than the depth cap instead of losing it silently (finding 5)", () => {
    const deep = `${">".repeat(101)} x`;
    const r = fromMarkdown(deep);
    expect(r.lost).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "no-equivalent" })]),
    );
    const capped = r.lost.find((l) => l.message.includes("nested deeper than"));
    expect(capped).toBeDefined();
    expect(capped?.message).toContain("100");
  });
  it("reports the footnote reference and its definition exactly once each (finding 7)", () => {
    const r = fromMarkdown("x[^1]\n\n[^1]: note");
    const footnoteLosses = r.lost.filter((l) => l.code === "footnote");
    expect(footnoteLosses).toHaveLength(2);
    expect(footnoteLosses.map((l) => l.message)).toEqual([
      "osu! has no footnotes, kept the marker as text.",
      "osu! has no footnotes, dropped the note text.",
    ]);
  });
  it("reports a collapsed reference link ([abc][]) with no definition as unresolved", () => {
    expect(codes("[abc][]")).toEqual(["reference-link-unresolved"]);
    expect(bb("[abc][]")).toBe("[abc][]");
  });
  it("reports a bare footnote reference with no definition", () => {
    expect(codes("see [^1] here")).toEqual(["footnote"]);
  });
  it("scans typed-tag warnings in roughly linear time (finding 6)", () => {
    const n = 4000;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) parts.push("`[c]`", "[b]x[/b]");
    const sample = parts.join("\n\n");
    const start = performance.now();
    const r = fromMarkdown(sample);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
    expect(r.lost.filter((l) => l.code === "no-equivalent")).toHaveLength(n);
  });
});
