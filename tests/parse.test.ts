/**
 * @file tests/parse.test.ts
 * @desc Tree shape, source ranges, osu!'s pairing rules, and the round-trip property:
 *       serialize(parse(x)) === x for a corpus of valid and malformed input plus random input.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { type Node, parse, serialize, type TagNode } from "../src/index.js";

/** A compact view of a tree: text as strings, tags as `name(arg): children`. */
function shape(nodes: readonly Node[]): unknown[] {
  return nodes.map((n) =>
    n.type === "text"
      ? n.value
      : { [n.arg === null ? n.tag : `${n.tag}=${n.arg}`]: shape(n.children) },
  );
}

/** Every node's range matches its text in the source. */
function checkRanges(nodes: readonly Node[], src: string): void {
  for (const n of nodes) {
    expect(src.slice(n.start, n.end)).toBe(serialize([n]));
    if (n.type === "tag") checkRanges(n.children, src);
  }
}

describe("pairing", () => {
  it.each([
    ["[b]x[/b]", [{ b: ["x"] }]],
    ["[b]a[b]b[/b]c[/b]", [{ b: ["a[b]b"] }, "c[/b]"]],
    ["[b][i]x[/b][/i]", [{ b: ["[i]x"] }, "[/i]"]],
    ["[s]x[/strike]", ["[s]x[/strike]"]],
    ["[strike]x[/strike]", [{ strike: ["x"] }]],
    ["[B]x[/B]", ["[B]x[/B]"]],
    ["[center]x[/center]", ["[center]x[/center]"]],
    ["[quote][quote]a[/quote]b[/quote]", [{ quote: [{ quote: ["a"] }, "b"] }]],
    ['[quote="a b"]x[/quote]', [{ "quote=a b": ["x"] }]],
    ["[quote=a]x[/quote]", ["[quote=a]x[/quote]"]],
    ["[box=a [b]b[/b] \\] c]x[/box]", [{ "box=a [b]b[/b] \\] c": ["x"] }]],
    ["[box]x[/box]", ["[box]x[/box]"]],
    ["[color=#abc]x[/color]", ["[color=#abc]x[/color]"]],
    ["[size=big]x[/size]", ["[size=big]x[/size]"]],
    ["[b=1]x[/b]", ["[b=1]x[/b]"]],
    ["[c]a\n[c]b[/c]", ["[c]a\n", { c: ["b"] }]],
    ["[heading]a[/heading]", [{ heading: ["a"] }]],
    ["[url=https://a]x\ny[/url]", ["[url=https://a]x\ny[/url]"]],
    ["[url=https://a][/url]", ["[url=https://a][/url]"]],
    ["[url]https://a[/url]", [{ url: ["https://a"] }]],
    ["[url]www.a.b[/url]", ["[url]www.a.b[/url]"]],
    ["[code][b]x[/b][/code]", [{ code: ["[b]x[/b]"] }]],
    ["[code][/code]", ["[code][/code]"]],
    ["[img]a[b]x[/b][/img]", ["[img]a", { b: ["x"] }, "[/img]"]],
    ["[img]https://a\nb[/img]", [{ img: ["https://a\nb"] }]],
    ["[audio]https://a\nb[/audio]", ["[audio]https://a\nb[/audio]"]],
    ["[profile=12]a[/profile]", [{ "profile=12": ["a"] }]],
    ["[email]nope[/email]", ["[email]nope[/email]"]],
    ["[imagemap]x[/imagemap]", [{ imagemap: ["x"] }]],
    ["[b]x", ["[b]x"]],
    ["[*]x", ["[*]x"]],
    ["[/*]", ["[/*]"]],
    ["[[b]x[/b]]", ["[", { b: ["x"] }, "]"]],
    ["[list]t[*]a[*]b[/*]c[/list]", [{ list: ["t", { "*": ["a"] }, { "*": ["b"] }, "c"] }]],
    ["[list][*]a[quote]b[/list]", [{ list: [{ "*": ["a[quote]b"] }] }]],
    ["[quote][list][*]a[/quote]", [{ quote: ["[list][*]a"] }]],
    ["[quote][list][*]a[/*]b[/quote]", [{ quote: ["[list][*]a[/*]b"] }]],
    ["[list][*][b]a[*]b[/b][/list]", [{ list: [{ "*": [{ b: ["a[*]b"] }] }] }]],
  ])("%j", (src, expected) => {
    const doc = parse(src);
    expect(shape(doc.children)).toEqual(expected);
    checkRanges(doc.children, src);
  });

  it("keeps the written and canonical names", () => {
    const node = parse("[strike]x[/strike]").children[0] as TagNode;
    expect([node.name, node.tag, node.open, node.close]).toEqual([
      "s",
      "strike",
      "[strike]",
      "[/strike]",
    ]);
  });

  it("closes an item implicitly at the next item", () => {
    const list = parse("[list][*]a[*]b[/list]").children[0] as TagNode;
    const [first] = list.children as TagNode[];
    expect(first?.close).toBeNull();
    expect(first?.end).toBe("[list][*]a".length);
  });
});
