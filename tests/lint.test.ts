/**
 * @file tests/lint.test.ts
 * @desc One case per lint code, the fixes, and the rules that keep one problem to one
 *       diagnostic.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { applyFix, type Diagnostic, LINT_CODES, lint } from "../src/index.js";

/** Diagnostics as `code severity "source slice"`, with the fixed text when there's a fix. */
function brief(text: string): string[] {
  return lint(text).map((d: Diagnostic) => {
    const base = `${d.code} ${d.severity} ${JSON.stringify(text.slice(d.start, d.end))}`;
    return d.fix ? `${base} -> ${JSON.stringify(applyFix(text, d.fix))}` : base;
  });
}

describe("each code", () => {
  it.each([
    ["[b]x", ['unclosed-tag error "[b]"']],
    ["[b][i]x[/b][/i]", ['unclosed-tag error "[i]"']],
    ["[c]a\nb[/c]", ['unclosed-tag error "[c]"']],
    ["[code][/code]", ['unclosed-tag error "[code]"']],
    ["[profile]a\nb[/profile]", ['unclosed-tag error "[profile]"']],
    ["[img]x", ['unclosed-tag error "[img]"']],
    ["x[/b]", ['stray-close warning "[/b]" -> "x"']],
    ["[/*]", ['stray-close warning "[/*]" -> ""']],
    [
      "[center]x[/center]",
      [
        'unknown-tag warning "[center]" -> "[centre]x[/center]"',
        'unknown-tag warning "[/center]" -> "[center]x[/centre]"',
      ],
    ],
    ["[B]x", ['unknown-tag warning "[B]" -> "[b]x"']],
    ["[font=Arial]", ['unknown-tag warning "[font=Arial]"']],
    ["[*]", ['unknown-tag warning "[*]"']],
    ["[quote=bob]x[/quote]", ['unknown-tag warning "[quote=bob]" -> "[quote=\\"bob\\"]x[/quote]"']],
    ["[b=1]", ['unknown-tag warning "[b=1]" -> "[b]"']],
    ["[/b=1]", ['unknown-tag warning "[/b=1]" -> "[/b]"']],
    ["[box]x[/box]", ['unknown-tag warning "[box]"']],
    ["[profile=me]x[/profile]", ['unknown-tag warning "[profile=me]"']],
    ["[list=]", ['unknown-tag warning "[list=]"']],
    ["[size=300]x[/size]", ['bad-size error "300" -> "[size=200]x[/size]"']],
    ["[size=10]x[/size]", ['bad-size error "10" -> "[size=30]x[/size]"']],
    ["[size=120]x[/size]", ['bad-size warning "120"']],
    ["[size=100]x[/size]", []],
    ["[size=big]x[/size]", ['bad-size error "[size=big]"']],
    ["[color=#fff]x[/color]", ['bad-color error "[color=#fff]" -> "[color=#ffffff]x[/color]"']],
    ["[color=ff66aa]x[/color]", ['bad-color error "[color=ff66aa]" -> "[color=#ff66aa]x[/color]"']],
    ["[color]x[/color]", ['bad-color error "[color]"']],
    ["[color=blah]x[/color]", ['bad-color warning "blah"']],
    ["[color=Red]x[/color]", []],
    ["[url]www.a.b[/url]", ['bad-url error "[url]" -> "[url]https://www.a.b[/url]"']],
    ["[url]mailto:a[/url]", ['bad-url error "[url]"']],
    ["[url=www.a.b]x[/url]", ['bad-url error "[url=www.a.b]" -> "[url=https://www.a.b]x[/url]"']],
    ["[url=https://a b]x[/url]", ['bad-url error "[url=https://a b]x[/url]"']],
    ["[url]https://a b[/url]", ['bad-url error "[url]https://a b[/url]"']],
    ["[email]nope[/email]", ['bad-url error "[email]"']],
    ["[email=nope]x[/email]", ['bad-url error "[email=nope]"']],
    ["[img]ftp://a.b/c.png[/img]", ['bad-url error "[img]ftp://a.b/c.png[/img]"']],
    ["[audio]a[b[/audio]", ['bad-url error "[audio]"']],
    ["[img][/img]", ['bad-url error "[img]"']],
    ["[youtube]a b[/youtube]", ['bad-url error "[youtube]a b[/youtube]"']],
    ["[b]a[b]b[/b]", ['self-nested warning "[b]"']],
    ["[img]https://a.b/[x].png[/img]", ['img-bracket error "[img]"']],
    ["[imagemap]\nhttps://a.b/i.png\n1 2 3 x #\n[/imagemap]", ['imagemap-line error "1 2 3 x #"']],
    ["[list]x[/list]", ['list-no-items warning "[list]"']],
  ])("%j", (text, expected) => {
    expect(brief(text)).toEqual(expected);
  });

  it("covers every code", () => {
    const text = [
      "[b]x",
      "[/i]",
      "[center]",
      "[size=300]a[/size]",
      "[color=#fff]",
      "[url]www.a[/url]",
      "[u]a[u]b[/u]",
      "[img]a[b[/img]",
      "[imagemap]\nx\n[/imagemap]",
      "[list]x[/list]",
    ].join("\n");
    const codes = new Set(lint(text, { limit: 10 }).map((d) => d.code));
    expect([...codes].sort()).toEqual([...LINT_CODES].sort());
  });
});

describe("over-limit", () => {
  it("counts code points and points at the first one over", () => {
    const text = `${"😀".repeat(5)}abc`;
    const [d] = lint(text, { limit: 6 });
    expect(d?.code).toBe("over-limit");
    expect(text.slice(d?.start, d?.end)).toBe("bc");
    expect(d?.message).toBe("8 characters; osu! allows 6. Cut 2.");
  });
  it("defaults to 60,000", () => {
    expect(lint("a".repeat(60_000))).toEqual([]);
    expect(lint("a".repeat(60_001)).map((d) => d.code)).toEqual(["over-limit"]);
  });
});

describe("one problem, one diagnostic", () => {
  it("doesn't also report the close of a refused open", () => {
    expect(brief("[c]a\nb[/c]")).toHaveLength(1);
    expect(brief("[size=x]a[/size]")).toHaveLength(1);
    expect(brief("[img]a[b[/img]")).toHaveLength(1);
  });
  it("still reports a later stray close", () => {
    expect(brief("[size=x]a[/size] b[/size]")).toEqual([
      'bad-size error "[size=x]"',
      'stray-close warning "[/size]" -> "[size=x]a[/size] b"',
    ]);
  });
  it("skips raw content and returns results in order", () => {
    expect(lint("[code][center][/code]")).toEqual([]);
    const starts = lint("[/b] [b]x [center]").map((d) => d.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});
