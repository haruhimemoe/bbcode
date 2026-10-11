/**
 * @file tests/markdown-inlines.test.ts
 * @desc Tests for src/markdown/inlines.ts: the inline pass of fromMarkdown.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { describe, expect, it } from "vitest";
import { parseInlines } from "../src/markdown/inlines.js";

const none = new Map<string, string>();
const p = (s: string) => parseInlines(s, 0, none);

describe("parseInlines", () => {
  it("reads emphasis with both markers", () => {
    expect(p("**a** __b__ *c* _d_ ~~e~~").map((n) => n.kind)).toEqual([
      "strong",
      "text",
      "strong",
      "text",
      "em",
      "text",
      "em",
      "text",
      "strike",
    ]);
  });
  it("nests emphasis", () => {
    const [s] = p("**a *b* c**");
    expect(s).toMatchObject({ kind: "strong" });
    expect((s as { children: { kind: string }[] }).children.map((c) => c.kind)).toEqual([
      "text",
      "em",
      "text",
    ]);
  });
  it("leaves unclosed markers as text", () => {
    expect(p("**bold")).toEqual([{ kind: "text", value: "**bold", start: 0, end: 6 }]);
    expect(p("a_b_c")).toEqual([{ kind: "text", value: "a_b_c", start: 0, end: 5 }]);
  });
  it("reads code spans before anything else", () => {
    expect(p("`**x**`")).toEqual([{ kind: "code", value: "**x**", start: 0, end: 7 }]);
    expect(p("``a`b``")[0]).toMatchObject({ kind: "code", value: "a`b" });
  });
  it("reads links, autolinks, bare urls and images", () => {
    expect(p("[t](https://x.y)")[0]).toMatchObject({ kind: "link", href: "https://x.y" });
    expect(p("<https://x.y>")[0]).toMatchObject({ kind: "link", href: "https://x.y" });
    expect(p("go https://x.y/a.")[1]).toMatchObject({ kind: "link", href: "https://x.y/a" });
    expect(p("![alt](https://i/a.png)")[0]).toMatchObject({
      kind: "image",
      src: "https://i/a.png",
      alt: "alt",
    });
  });
  it("keeps the link label's text as children", () => {
    expect(p("[a](u)")[0]).toMatchObject({
      kind: "link",
      children: [{ kind: "text", value: "a", start: 1, end: 2 }],
    });
    expect(
      (p("[plain text](u)")[0] as { children: { value: string }[] }).children[0],
    ).toMatchObject({
      value: "plain text",
    });
    const [bolded] = p("[ a **bold** b](u)");
    expect(bolded).toMatchObject({ kind: "link" });
    const children = (bolded as { children: { kind: string; value?: string }[] }).children;
    expect(children.map((c) => c.kind)).toEqual(["text", "strong", "text"]);
    expect(children[0]?.value).toBe(" a ");
  });
  it("leaves an unresolved bracket as a single literal text node", () => {
    expect(p("[a b")).toEqual([{ kind: "text", value: "[a b", start: 0, end: 4 }]);
  });
  it("keeps an image alt's text intact even with inline markers", () => {
    expect(p("![a*b*](s)")[0]).toMatchObject({ kind: "image", src: "s", alt: "a*b*" });
  });
  it("resolves reference links", () => {
    const refs = new Map([["x", "https://x.y"]]);
    expect(parseInlines("[t][x]", 0, refs)[0]).toMatchObject({ kind: "link", href: "https://x.y" });
    expect(parseInlines("[t][missing]", 0, refs)[0]).toMatchObject({ kind: "text" });
  });
  it("demotes an outer bracket to text when an inner one resolves to a link (no nested links)", () => {
    expect(p("[[a](u)]")).toEqual([
      { kind: "text", value: "[", start: 0, end: 1 },
      {
        kind: "link",
        href: "u",
        children: [{ kind: "text", value: "a", start: 2, end: 3 }],
        start: 1,
        end: 7,
      },
      { kind: "text", value: "]", start: 7, end: 8 },
    ]);
  });
  it("honors backslash escapes and hard breaks", () => {
    expect(p("\\*a\\*")).toEqual([{ kind: "text", value: "*a*", start: 0, end: 5 }]);
    expect(p("a  \nb").map((n) => n.kind)).toEqual(["text", "break", "text"]);
  });
  it("keeps inline html as html", () => {
    expect(p("a <b>x</b>").map((n) => n.kind)).toEqual(["text", "html", "text", "html"]);
  });
  it("adds the offset", () => {
    expect(parseInlines("*a*", 10, none)[0]).toMatchObject({ start: 10, end: 13 });
  });

  it("never throws on arbitrary input", () => {
    const inputs = [
      "",
      "*",
      "**",
      "***",
      "~~~",
      "[",
      "](",
      "[]()",
      "`",
      "``",
      "\\",
      "<",
      ">",
      "<<<>>>",
      "[a](b",
      "![a](b)c)",
      "[a][b][c]",
      "a**b__c~~d",
      "\n\n\n",
      "   ",
      "*_*_*_",
    ];
    for (const s of inputs) expect(() => p(s)).not.toThrow();
  });

  it("merges adjacent text nodes", () => {
    const out = p("a*b*c");
    // text "a", em, text "c" — no two adjacent text nodes
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1];
      const b = out[i];
      if (a?.kind === "text" && b?.kind === "text") {
        throw new Error("adjacent text nodes were not merged");
      }
    }
  });

  it("stays linear time on pathological emphasis runs", () => {
    const t0 = Date.now();
    p(`${"*".repeat(10_000)}a`);
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it("stays linear time on pathological unclosed brackets", () => {
    const t0 = Date.now();
    p("[".repeat(10_000));
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it("stays linear time on repeated strong-open patterns", () => {
    const t0 = Date.now();
    p("**a ".repeat(5_000));
    expect(Date.now() - t0).toBeLessThan(200);
  });
});
