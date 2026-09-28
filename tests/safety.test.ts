/**
 * @file tests/safety.test.ts
 * @desc The renderer's safety promise: no script, no javascript: URL and no attribute breakout
 *       survives, from BBCode or from a hand-built tree.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { type Document, type Node, render, type TagNode } from "../src/index.js";

const html = (bb: string): string => render(bb, { wrap: false });

/** No raw `<script`, no `javascript:` in an attribute, no event handler attributes. */
function assertSafe(out: string): void {
  expect(out).not.toMatch(/<script/i);
  expect(out).not.toMatch(/(?:href|src)="\s*javascript:/i);
  expect(out).not.toMatch(/<[^>]+\son\w+=/i);
  expect(out).not.toMatch(/<(?:iframe|img|audio)[^>]+src="(?!https?:|\/)/i);
}

const ATTACKS = [
  "<script>alert(1)</script>",
  "[b]<script>alert(1)</script>[/b]",
  "[code]<script>alert(1)</script>[/code]",
  "[c]<img src=x onerror=alert(1)>[/c]",
  "[url=javascript:alert(1)]x[/url]",
  "[url]javascript:alert(1)[/url]",
  '[url=https://a.b" onmouseover="alert(1)]x[/url]',
  "[url=https://a.b'onmouseover='alert(1)]x[/url]",
  "[img]javascript:alert(1)[/img]",
  '[img]https://a.b/x.png" onerror="alert(1)[/img]',
  "[img]data:image/svg+xml,<svg onload=alert(1)>[/img]",
  "[audio]javascript:alert(1)[/audio]",
  "[color=red;background:url(javascript:alert(1))]x[/color]",
  '[color=#ff0000" onmouseover="alert(1)]x[/color]',
  "[size=100;position:fixed]x[/size]",
  '[email=a@b.co" onclick="x]y[/email]',
  "[email]javascript:alert(1)@a.b[/email]",
  '[quote="<script>x</script>"]q[/quote]',
  "[box=<img src=x onerror=alert(1)>]x[/box]",
  '[profile=1" onclick="x]n[/profile]',
  '[profile]"><script>x</script>[/profile]',
  '[youtube]x" onload="alert(1)[/youtube]',
  "[youtube]javascript:alert(1)[/youtube]",
  "[imagemap]\njavascript:alert(1)\n0 0 1 1 #\n[/imagemap]",
  '[imagemap]\nhttps://a.b/i.png"onload="x\n0 0 1 1 # t\n[/imagemap]',
  "[imagemap]\nhttps://a.b/i.png\n0 0 1 1 javascript:alert(1) t\n[/imagemap]",
  '[imagemap]\nhttps://a.b/i.png\n0 0 1 1 https://a.b/"onmouseover="x t"><script>x</script>\n[/imagemap]',
  'http://a.b/"onmouseover="alert(1)',
  'www.a.b/"><script>x</script>',
  '[list="><script>x</script>][*]a[/list]',
];

describe("BBCode attacks", () => {
  it.each(ATTACKS)("%s", (bb) => {
    assertSafe(html(bb));
  });
  it("escapes script tags as text", () => {
    expect(html("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
  it("keeps quotes inside attributes escaped", () => {
    expect(html('[url=https://a.b"x]y[/url]')).toContain('href="https://a.b&quot;x"');
  });
  it.each([
    ["99999999999999999999999999", 200],
    ["0", 30],
    ["00150", 150],
    ["1e5", null],
  ])("clamps [size=%s]", (size, expected) => {
    const out = html(`[size=${size}]x[/size]`);
    if (expected === null) expect(out).toBe(`[size=${size}]x[/size]`);
    else expect(out).toBe(`<span class="bb-size" style="font-size:${expected}%">x</span>`);
  });
});

const tag = (name: string, arg: string | null, children: Node[] = []): TagNode => ({
  type: "tag",
  name,
  tag: name,
  arg,
  open: `[${name}]`,
  close: `[/${name}]`,
  children,
  start: 0,
  end: 0,
});
const text = (value: string): Node => ({ type: "text", value, start: 0, end: 0 });
const doc = (...children: Node[]): Document => ({ type: "document", source: "", children });

describe("hand-built trees are checked too", () => {
  it.each([
    tag("color", '" onclick="x', [text("a")]),
    tag("size", "1;x:y", [text("a")]),
    tag("url", "javascript:x", [text("a")]),
    tag("email", "nope", [text("a")]),
    tag("profile", "1 onclick", [text("a")]),
    tag("profile", null, []),
    tag("img", null, [text("javascript:x")]),
    tag("script", null, [text("<script>")]),
  ])("%j", (node) => {
    const out = render(doc(node), { wrap: false });
    assertSafe(out);
    expect(out).not.toContain('"x"');
  });
});
