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
    expect(fromMarkdown("`[b]x[/b]`").lost).toEqual([]);
  });
  it("resolves reference definitions and drops them from output", () => {
    expect(bb("[t][x]\n\n[x]: https://x.y")).toBe("[url=https://x.y]t[/url]");
  });
  it("never produces lint errors", () => {
    const sample =
      "# T\n\n**b *i* b** ~~s~~\n\n> q\n\n- a\n  - b\n\n```\n[b]\n```\n\n| a |\n|---|\n| 1 |";
    expect(lint(bb(sample)).filter((d) => d.severity === "error")).toEqual([]);
  });
});
