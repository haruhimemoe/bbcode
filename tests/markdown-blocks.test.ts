import { describe, expect, it } from "vitest";
import { parseBlocks } from "../src/markdown/blocks.js";

const kinds = (s: string) => parseBlocks(s, 32).map((b) => b.kind);

describe("parseBlocks", () => {
  it("splits paragraphs on blank lines", () => {
    expect(kinds("a\nb\n\nc")).toEqual(["paragraph", "paragraph"]);
    expect(parseBlocks("a\nb", 32)[0]).toMatchObject({ text: "a\nb", start: 0, end: 3 });
  });
  it("reads ATX and setext headings", () => {
    expect(parseBlocks("### Hi ###", 32)[0]).toMatchObject({
      kind: "heading",
      level: 3,
      text: "Hi",
    });
    expect(parseBlocks("Hi\n==", 32)[0]).toMatchObject({ kind: "heading", level: 1, text: "Hi" });
    expect(parseBlocks("Hi\n--", 32)[0]).toMatchObject({ kind: "heading", level: 2 });
  });
  it("reads fenced and indented code", () => {
    expect(parseBlocks("```ts\na\n```", 32)[0]).toMatchObject({
      kind: "code",
      lang: "ts",
      value: "a",
    });
    expect(parseBlocks("    a\n    b", 32)[0]).toMatchObject({ kind: "code", value: "a\nb" });
    expect(parseBlocks("```\nunclosed", 32)[0]).toMatchObject({ kind: "code", value: "unclosed" });
  });
  it("reads nested quotes", () => {
    const [q] = parseBlocks("> a\n> > b", 32);
    expect(q).toMatchObject({ kind: "quote" });
    expect((q as { children: { kind: string }[] }).children.map((c) => c.kind)).toEqual([
      "paragraph",
      "quote",
    ]);
  });
  it("reads lists with nesting", () => {
    const [l] = parseBlocks("- a\n- b\n  - c\n1. x", 32);
    expect(l).toMatchObject({ kind: "list", ordered: false });
    expect((l as { items: unknown[][] }).items).toHaveLength(2);
    expect(kinds("- a\n\n1. x")).toEqual(["list", "list"]);
  });
  it("reads rules, tables and html", () => {
    expect(kinds("---")).toEqual(["rule"]);
    expect(parseBlocks("| a | b |\n|---|:-:|\n| 1 | 2 |", 32)[0]).toMatchObject({
      kind: "table",
      rows: [
        ["a", "b"],
        ["1", "2"],
      ],
    });
    expect(kinds("<div>\nx\n</div>")).toEqual(["html"]);
  });
  it("treats CRLF like LF and keeps offsets", () => {
    const [p, h] = parseBlocks("a\r\n\r\n# b", 32);
    expect(p).toMatchObject({ kind: "paragraph", text: "a", start: 0, end: 1 });
    expect(h).toMatchObject({ kind: "heading", start: 5 });
  });
  it("stops nesting at maxDepth", () => {
    const deep = `${">".repeat(40)} x`;
    let node = parseBlocks(deep, 3)[0] as { kind: string; children?: unknown[] };
    let depth = 0;
    while (node.kind === "quote") {
      depth += 1;
      node = (node.children as (typeof node)[])[0] as typeof node;
    }
    expect(depth).toBe(3);
    expect(node.kind).toBe("paragraph");
  });
  it("handles 10,000 nested quotes within maxDepth in linear time without throwing", () => {
    const deep = `${">".repeat(10_000)} x`;
    const start = performance.now();
    expect(() => parseBlocks(deep, 32)).not.toThrow();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
