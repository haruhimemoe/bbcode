/**
 * @file tests/roundtrip.test.ts
 * @desc Property: serialize(parse(x)) === x, and every range is right, for a corpus of real,
 *       malformed and hostile input and for seeded random input built from tag fragments.
 *       Also checks render and lint never throw on it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { lint, type Node, parse, render, serialize, TAGS } from "../src/index.js";

const CORPUS = [
  "",
  "plain text",
  "[centre][size=150][color=#ff66aa][b]My userpage[/b][/color][/size][/centre]\n",
  "[box=About me]\n[list]\n[*]osu!\n[*]mapping\n[/list]\n[/box]\n[spoilerbox]x[/spoilerbox]",
  '[quote="peppy"]\n[quote]nested[/quote]\n[/quote]\ntail',
  "[imagemap]\nhttps://a.b/i.png\n0 0 50 50 https://osu.ppy.sh t\n50 50 50 50 #\n[/imagemap]",
  "[notice][heading]Rules[/heading]\n[c]!mp[/c] [code]\n[b]raw[/b]\n[/code][/notice]",
  "[url=https://a.b]x[/url] [url]https://c.d[/url] [email]a@b.co[/email] [email=a@b.co]m[/email]",
  "[img]https://a.b/c.png[/img][audio]https://a.b/c.mp3[/audio][youtube]dQw4w9WgXcQ[/youtube]",
  "[profile=2]peppy[/profile] [profile]Toy [x][/profile]",
  "[b][i][u][s][strike][spoiler]deep[/spoiler][/strike][/s][/u][/i][/b]",
  "[b]unclosed [i]crossed[/b] tags[/i] [/stray] [/b] [*] [/*]",
  '[[[[]]]] [ ] [/] [=] [b=] [color=] [size=] [box=] [quote="] [list=]',
  "[box=[[[x]]]]y[/box] [box=unbalanced [x]z [/box]",
  "[code]never closed [b]x[/b]",
  "[imagemap]\nbroken\n[/imagemap] [img]a[b]b[/img]",
  "\r\n[b]\r\nx\r\n[/b]\r\n",
  "emoji 😀 [color=red]日本語[/color] \u0000 ​",
  "[list=1]title\n[*]a[list][*]inner[/list]\n[*]b[/list]",
  "[c]a\nb[/c] [heading]a\nb[/heading] [url=https://a]b\nc[/url]",
  "http://a.b www.c.d e@f.gh [url]www.x.y[/url]",
  "[B][/B][CENTRE][/CENTRE][center][/center][font=Arial]x[/font]",
  "<script>alert(1)</script>[url=javascript:x]y[/url]",
];

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [...TAGS.flatMap((t) => [t.name, ...t.aliases]), "center", "B", "x"];
const ARGS = [
  "",
  "=",
  "=#ff66aa",
  "=red",
  "=150",
  "=0",
  '="a"',
  "=https://a.b",
  "=a@b.co",
  "=1",
  "=[x]",
];
const BITS = [
  "x",
  " ",
  "\n",
  "\r\n",
  "[",
  "]",
  "/",
  "*",
  "https://a.b/c",
  "a@b.co",
  "<",
  '"',
  "\\]",
];

function randomInput(next: () => number): string {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T;
  let out = "";
  const length = 1 + Math.floor(next() * 30);
  for (let i = 0; i < length; i++) {
    const r = next();
    if (r < 0.35) out += `[${pick(NAMES)}${pick(ARGS)}]`;
    else if (r < 0.6) out += `[/${pick(NAMES)}]`;
    else out += pick(BITS);
  }
  return out;
}

function checkRanges(nodes: readonly Node[], src: string): void {
  let at = nodes[0]?.start ?? 0;
  for (const n of nodes) {
    expect(n.start).toBe(at);
    expect(src.slice(n.start, n.end)).toBe(serialize([n]));
    if (n.type === "tag") checkRanges(n.children, src);
    at = n.end;
  }
}

function property(src: string): void {
  const doc = parse(src);
  expect(serialize(doc)).toBe(src);
  checkRanges(doc.children, src);
  expect(typeof render(src)).toBe("string");
  expect(Array.isArray(lint(src))).toBe(true);
}

describe("serialize(parse(x)) === x", () => {
  it.each(CORPUS)("corpus %#", (src) => {
    property(src);
  });
  it("holds for 3,000 random inputs", () => {
    const next = rng(20260928);
    for (let i = 0; i < 3000; i++) property(randomInput(next));
  });
});
