/**
 * @file tests/render.test.ts
 * @desc Golden HTML for every tag, newline eating, automatic links and render options.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { parse, render } from "../src/index.js";

const html = (bb: string): string => render(bb, { wrap: false });

describe("golden HTML per tag", () => {
  it.each([
    ["[b]x[/b]", "<strong>x</strong>"],
    ["[i]x[/i]", "<em>x</em>"],
    ["[u]x[/u]", "<u>x</u>"],
    ["[s]x[/s]", "<del>x</del>"],
    ["[strike]x[/strike]", "<del>x</del>"],
    ["[spoiler]x[/spoiler]", '<span class="bb-spoiler">x</span>'],
    ["[color=#FF66aa]x[/color]", '<span class="bb-color" style="color:#FF66aa">x</span>'],
    ["[color=red]x[/color]", '<span class="bb-color" style="color:red">x</span>'],
    ["[size=150]x[/size]", '<span class="bb-size" style="font-size:150%">x</span>'],
    ["[centre]x[/centre]", '<div class="bb-align bb-align--centre">x</div>'],
    ["[left]x[/left]", '<div class="bb-align bb-align--left">x</div>'],
    ["[right]x[/right]", '<div class="bb-align bb-align--right">x</div>'],
    ["[heading]x[/heading]", '<h2 class="bb-heading">x</h2>'],
    ["[c]x[/c]", '<code class="bb-c">x</code>'],
    ["[code]\na < b\n  c\n[/code]", '<pre class="bb-code">a &lt; b\n  c</pre>'],
    ["[notice]x[/notice]", '<div class="bb-notice">x</div>'],
    [
      "[box=Title]x[/box]",
      '<details class="bb-box"><summary class="bb-box__title">Title</summary><div class="bb-box__body">x</div></details>',
    ],
    [
      "[spoilerbox]x[/spoilerbox]",
      '<details class="bb-box"><summary class="bb-box__title">SPOILER</summary><div class="bb-box__body">x</div></details>',
    ],
    ["[quote]x[/quote]", '<blockquote class="bb-quote">x</blockquote>'],
    [
      '[quote="peppy"]x[/quote]',
      '<blockquote class="bb-quote"><div class="bb-quote__author">peppy wrote:</div>x</blockquote>',
    ],
    ["[list][*]a[*]b[/list]", '<ul class="bb-list"><li>a</li><li>b</li></ul>'],
    ["[list=1][*]a[/list]", '<ol class="bb-list"><li>a</li></ol>'],
    [
      "[list]Title[*]a[/list]",
      '<div class="bb-list__title">Title</div><ul class="bb-list"><li>a</li></ul>',
    ],
    [
      "[url]https://osu.ppy.sh[/url]",
      '<a class="bb-link" href="https://osu.ppy.sh" rel="nofollow noopener">https://osu.ppy.sh</a>',
    ],
    [
      "[url=ftp://a.b/c]x [b]y[/b][/url]",
      '<a class="bb-link" href="ftp://a.b/c" rel="nofollow noopener">x <strong>y</strong></a>',
    ],
    [
      "[email]a@b.co[/email]",
      '<a class="bb-link" href="mailto:a@b.co" rel="nofollow noopener">a@b.co</a>',
    ],
    [
      "[email=a@b.co]mail [b]me[/b][/email]",
      '<a class="bb-link" href="mailto:a@b.co" rel="nofollow noopener">mail [b]me[/b]</a>',
    ],
    [
      "[img]https://a.b/c.png[/img]",
      '<img class="bb-img" src="https://a.b/c.png" alt="" loading="lazy">',
    ],
    [
      "[audio]https://a.b/c.mp3[/audio]",
      '<audio class="bb-audio" controls preload="none" src="https://a.b/c.mp3"></audio>',
    ],
    [
      "[profile=2]peppy[/profile]",
      '<a class="bb-profile" href="https://osu.ppy.sh/users/2" rel="nofollow noopener">peppy</a>',
    ],
    [
      "[profile]Toy [x][/profile]",
      '<a class="bb-profile" href="https://osu.ppy.sh/users/@Toy%20%5Bx%5D" rel="nofollow noopener">Toy [x]</a>',
    ],
  ])("%s", (bb, expected) => {
    expect(html(bb)).toBe(expected);
  });
});

describe("youtube", () => {
  const embed = (id: string): string =>
    `<iframe class="bb-youtube" src="https://www.youtube.com/embed/${id}?rel=0" title="YouTube video" loading="lazy" allowfullscreen></iframe>`;
  it.each([
    "dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/embed/dQw4w9WgXcQ",
    "http://youtube.com/shorts/dQw4w9WgXcQ?feature=share",
  ])("%s", (content) => {
    expect(html(`[youtube]${content}[/youtube]`)).toBe(embed("dQw4w9WgXcQ"));
  });
  it("refuses an id with other characters", () => {
    expect(html('[youtube]a"b[/youtube]')).toBe("[youtube]a&quot;b[/youtube]");
  });
});

describe("imagemap", () => {
  it("renders regions, # as a span", () => {
    const bb =
      '[imagemap]\nhttps://a.b/i.png\n0 0 50 100 https://x.y/ left "half"\n50 0 50.5 100 #\n[/imagemap]\nnext';
    expect(html(bb)).toBe(
      '<div class="bb-imagemap"><img class="bb-imagemap__image" src="https://a.b/i.png" alt="" loading="lazy">' +
        '<a class="bb-imagemap__link" href="https://x.y/" style="left:0%;top:0%;width:50%;height:100%" title="left &quot;half&quot;" rel="nofollow noopener"></a>' +
        '<span class="bb-imagemap__link" style="left:50%;top:0%;width:50.5%;height:100%" title=""></span></div>next',
    );
  });
  it("shows a malformed block as text", () => {
    expect(html("[imagemap]\nhttps://a.b/i.png\n[/imagemap]")).toBe(
      "[imagemap]<br>https://a.b/i.png<br>[/imagemap]",
    );
  });
});

describe("newline eating", () => {
  it.each([
    ["[box=t]\n\nx\n\n[/box]\n\ny", "x", "<br>y"],
    ["[notice]\nx\n[/notice]\n\ny", '<div class="bb-notice">x</div><br>y', null],
    ["[quote]\n  x \n[/quote]\n\n\ny", '<blockquote class="bb-quote">x</blockquote><br>y', null],
    ["[centre]\nx\n[/centre]\ny", '<div class="bb-align bb-align--centre">x<br></div>y', null],
    ["[heading]x[/heading]\ny", '<h2 class="bb-heading">x</h2>y', null],
    ["[code]x[/code]\n\ny", '<pre class="bb-code">x</pre><br>y', null],
    [
      "[list]\n[*]a\n[*]b\n[/list]\n\n\ny",
      '<ul class="bb-list"><li>a</li><li>b</li></ul><br>y',
      null,
    ],
    ["[b]x[/b]\ny", "<strong>x</strong><br>y", null],
  ])("%j", (bb, expected, tail) => {
    const out = html(bb);
    if (tail === null) expect(out).toBe(expected);
    else {
      expect(out).toContain(`<div class="bb-box__body">${expected}</div>`);
      expect(out.endsWith(`</details>${tail}`)).toBe(true);
    }
  });
  it("keeps a list title's leading newline and drops whitespace-only titles", () => {
    expect(html("[list]\nT\n[*]a[/list]")).toBe(
      '<div class="bb-list__title"><br>T</div><ul class="bb-list"><li>a</li></ul>',
    );
    expect(html("[list]\n [*]a[/list]")).toBe('<ul class="bb-list"><li>a</li></ul>');
  });
  it("keeps text after [/*] in that item", () => {
    expect(html("[list][*]a[/*]\n\nb\n[*]c[/list]")).toBe(
      '<ul class="bb-list"><li>ab</li><li>c</li></ul>',
    );
  });
  it("renders a list without items as an empty list", () => {
    expect(html("[list]x[/list]")).toBe(
      '<div class="bb-list__title">x</div><ul class="bb-list"></ul>',
    );
  });
  it("normalizes CRLF", () => {
    expect(html("a\r\nb\rc")).toBe("a<br>b<br>c");
  });
});

describe("automatic links", () => {
  const a = (href: string, text = href): string =>
    `<a class="bb-link" href="${href}" rel="nofollow noopener">${text}</a>`;
  it.each([
    ["https://osu.ppy.sh/home", a("https://osu.ppy.sh/home")],
    ["see (http://a.b/c).", `see (${a("http://a.b/c")}).`],
    ["www.a.b go", `${a("http://www.a.b", "www.a.b")} go`],
    ["mail me@a.bc", `mail ${a("mailto:me@a.bc", "me@a.bc")}`],
    ["x@y and user@nodot", "x@y and user@nodot"],
    ["nohttp://a.b", "nohttp://a.b"],
  ])("%s", (bb, expected) => {
    expect(html(bb)).toBe(expected);
  });
  it("doesn't link inside links or nest links", () => {
    expect(html("[url=https://a.b]see http://c.d [profile]x[/profile][/url]")).toBe(
      '<a class="bb-link" href="https://a.b" rel="nofollow noopener">see http://c.d <span class="bb-profile">x</span></a>',
    );
  });
});

describe("box titles and options", () => {
  it("parses inline tags in a box title", () => {
    expect(html("[box=[b]T[/b] & co]x[/box]")).toContain(
      '<summary class="bb-box__title"><strong>T</strong> &amp; co</summary>',
    );
  });
  it("wraps in div.bb with extra classes, escaped", () => {
    expect(render("x")).toBe('<div class="bb">x</div>');
    expect(render("x", { className: 'bb--light "y' })).toBe(
      '<div class="bb bb--light &quot;y">x</div>',
    );
  });
  it("renders a parsed document", () => {
    expect(render(parse("[b]x[/b]"), { wrap: false })).toBe("<strong>x</strong>");
  });
  it("sends media through the proxy and checks what comes back", () => {
    const proxy = (url: string, kind: string): string => `/p/${kind}?u=${encodeURIComponent(url)}`;
    expect(html("[img]https://a.b/c.png[/img]")).toContain('src="https://a.b/c.png"');
    expect(render("[img]https://a.b/c.png[/img]", { wrap: false, proxy })).toBe(
      '<img class="bb-img" src="/p/img?u=https%3A%2F%2Fa.b%2Fc.png" alt="" loading="lazy">',
    );
    expect(
      render("[audio]https://a.b/c.mp3[/audio]", { wrap: false, proxy: () => "javascript:x" }),
    ).toBe("[audio]https://a.b/c.mp3[/audio]");
    expect(render("[img]https://a.b/c.png[/img]", { wrap: false, proxy: () => "//evil" })).toBe(
      "[img]https://a.b/c.png[/img]",
    );
    const bad = (() => 5) as unknown as () => string;
    expect(render("[img]https://a.b/c.png[/img]", { wrap: false, proxy: bad })).toBe(
      "[img]https://a.b/c.png[/img]",
    );
  });
});
