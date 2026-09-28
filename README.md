<p align="center"><a href="https://github.com/haruhimemoe/bbcode"><picture><source media="(prefers-color-scheme: light)" srcset="https://www.haruhime.moe/brand/repos/bbcode-banner-on-light.svg"><img alt="@haruhimemoe/bbcode" src="https://www.haruhime.moe/brand/repos/bbcode-banner.svg" width="640"></picture></a></p>

# @haruhimemoe/bbcode

Parses, renders, lints and counts osu! BBCode the way osu! does. Use it for a live preview of a userpage, forum post or beatmap description, to catch mistakes before posting, or to build BBCode from code.

- Knows exactly the tags osu! supports, with osu!'s argument rules, pairing and newline handling. Tags osu! would show as text stay text.
- `render` returns HTML that needs no further sanitizing: text is escaped and every URL, color and size is checked.
- `parse` is lossless: `serialize(parse(text)) === text` for any input, and every node knows its source range.
- `lint` explains what osu! would show wrong, with a fix when it's obvious.
- Extras: color gradients, country flags, profile links, imagemaps, template fields and a stylesheet.
- No dependencies. Runs in browsers, Node 22.12+, Bun and Deno.

## Install

```sh
bun add @haruhimemoe/bbcode
# or: npm install @haruhimemoe/bbcode
# or: deno add npm:@haruhimemoe/bbcode
```

## Quick start

```ts
import { count, lint, render } from "@haruhimemoe/bbcode";
import "@haruhimemoe/bbcode/styles.css"; // or link dist/styles.css yourself

const source = "[centre][size=150][b]Hello![/b][/size][/centre]\n[box=About me]\nI map [i]a lot[/i].\n[/box]";

const html = render(source);
// <div class="bb"><div class="bb-align bb-align--centre"><span class="bb-size" style="font-size:150%"><strong>Hello!</strong></span></div><details class="bb-box">...</details></div>

for (const d of lint("[center]hi[/center] [size=300]big[/size]")) {
  console.log(d.code, d.severity, d.message);
}
// unknown-tag warning osu! spells it [centre]; [center] shows as text.
// ...

const { length, remaining, over } = count(source); // against osu!'s 60,000 characters
```

Build BBCode from code:

```ts
import { box, flag, gradient, list, profile } from "@haruhimemoe/bbcode/helpers";

const staff = list([`${flag("jp")} ${profile(2, "peppy")}`, `${flag("us")} ${profile("someone")}`], {
  title: "Staff",
});
const post = box("Tournament staff", staff);

const { bbcode, cost } = gradient("Summer Cup", ["#ff66aa", "#66aaff"]);
// cost: how many characters the colors add to the post
```

## API

Five entry points and a stylesheet:

| Import | What's in it |
| --- | --- |
| `@haruhimemoe/bbcode` | `parse`, `serialize`, `render`, `lint`, `applyFix`, `count`, `LIMITS`, `TAGS`, `findTag`, `LINT_CODES` |
| `@haruhimemoe/bbcode/helpers` | `color`, `normalizeColor`, `gradient`, `flag`, `profile`, `box`, `list`, `escapeBBCode` |
| `@haruhimemoe/bbcode/imagemap` | `parseImagemap`, `validateImagemap`, `serializeImagemap`, `formatPercent` |
| `@haruhimemoe/bbcode/flags` | `COUNTRIES`, `findCountry`, `searchCountries`, `flagUrl`, `normalizeCountryCode` |
| `@haruhimemoe/bbcode/template` | `fillTemplate`, `templateFields`, `FIELD_KINDS` |
| `@haruhimemoe/bbcode/styles.css` | Styles for `render` output |

Every function is pure and synchronous. Offsets are UTF-16 indices into the string you passed, like `String.prototype.slice` uses.

### `parse(text: string): Document`

Parses BBCode into a tree. Never throws. A tag osu! wouldn't treat as a tag (unclosed, unknown, wrong case, a bad argument) becomes part of a text node.

```ts
interface Document { type: "document"; source: string; children: Node[] }
type Node = TextNode | TagNode;
interface TextNode { type: "text"; value: string; start: number; end: number }
interface TagNode {
  type: "tag";
  name: string;         // canonical, from TAGS: "s" for [strike], "*" for a list item
  tag: string;          // as written: "strike"
  arg: string | null;   // after "=", without the quotes of [quote="name"]
  open: string;         // the opening tag as written, e.g. "[color=#ff66aa]"
  close: string | null; // the closing tag as written; null for a list item ended by the next [*]
  children: Node[];     // raw tags (code, img, url without =, ...) hold one text node
  start: number;
  end: number;
}
```

A `[list]`'s children are its title (anything before the first item), then `*` items.

### `serialize(doc: Document | readonly Node[]): string`

Writes a tree back out. `serialize(parse(text)) === text` for every input.

### `render(input: string | Document, options?: RenderOptions): string`

Renders BBCode (or a parsed tree) as HTML wrapped in `<div class="bb">`. Carriage returns in a string are normalized first.

```ts
interface RenderOptions {
  proxy?: (url: string, kind: "img" | "audio" | "imagemap") => string;
  className?: string; // extra classes on the root, e.g. "bb--light"
  wrap?: boolean;     // false: no root div. Default true
}
```

`proxy` rewrites image, audio and imagemap URLs, for example through your own image proxy (osu! sends images through its own). It's only called with http(s) URLs and must return an http(s) URL or a path starting with `/`; anything else renders the tag as text.

### `lint(text: string, options?: { limit?: number }): Diagnostic[]`

Everything osu! would show differently than intended, sorted by position. `limit` is the character limit for `over-limit` (default 60,000).

```ts
interface Diagnostic {
  code: LintCode; // see Lint codes
  severity: "error" | "warning" | "info";
  message: string;
  start: number;
  end: number;
  fix?: { start: number; end: number; text: string }; // present when the fix is obvious
}
```

`LINT_CODES` lists every code.

### `applyFix(text: string, fix: Fix): string`

Replaces `fix.start..fix.end` with `fix.text`. Apply one fix, then lint again: offsets of other diagnostics move.

### `count(text: string, limit?: number): Count`

Counts Unicode code points, tags included, against `limit` (default 60,000). Returns `{ length, limit, remaining, over }`.

### `LIMITS`

`{ forumPost: 60000, userpage: 60000, beatmapDescription: 60000, sizeMin: 30, sizeMax: 200, sizePresets: [50, 85, 100, 150] }`. The userpage and beatmap descriptions are stored as forum posts, so they share the limit.

### `TAGS` and `findTag(name: string): TagSpec | undefined`

The registry of supported tags, for docs, toolbars and autocomplete. `findTag` takes a name or alias, case-sensitively.

```ts
interface TagSpec {
  name: string;               // "centre", "*"
  aliases: readonly string[]; // ["strike"] for "s"
  arg: "none" | "optional" | "required";
  argKind: "color" | "size" | "title" | "name" | "list" | "url" | "email" | "user-id" | null;
  display: "inline" | "block";
  content: "bbcode" | "raw" | "items"; // raw: not parsed as BBCode
  singleLine: boolean;                 // open and close must be on one line
  description: string;
  example: string;
}
```

### `@haruhimemoe/bbcode/helpers`

| Function | Returns |
| --- | --- |
| `color(text, value)` | `[color=value]text[/color]`. `value` is `#rgb`, `#rrggbb` or a color name; throws `TypeError` otherwise. |
| `normalizeColor(value)` | `#abc` → `#aabbcc`, hex lowercased, names kept. Throws `TypeError` for anything else. |
| `gradient(text, stops, { skipSpaces? })` | `{ bbcode, cost }`: one color per character, spread evenly over one or more hex `stops`. Neighbours with the same color share a tag; newlines are never colored; whitespace is skipped unless `skipSpaces: false`. `cost` is the characters the colors add. Emoji and other multi-code-point characters stay whole. |
| `flag(code, { style? })` | `[img]<flag>[/img]` for a two-letter country code. `style`: `"modern"` (SVG, default) or `"legacy"` (old PNG). |
| `profile(idOrName, name?)` | A number is a user id: `[profile=2]peppy[/profile]` (name defaults to the id; osu! swaps in the current username when the post is saved). A string is a username: `[profile]peppy[/profile]`. |
| `box(title, body)` | `[box=title]` with the body on its own lines, or `[spoilerbox]` when `title` is `null` or `""`. Throws `TypeError` for a title with a newline or unbalanced brackets. |
| `list(items, { ordered?, title? })` | `[list]` (or `[list=1]`), an optional title line, one `[*]` line per item, `[/list]`. |
| `escapeBBCode(text)` | The text with every tag osu! would read broken by a zero-width space after its `[`, so user input shows as typed. |

osu! can't tell whether its image proxy passes SVG flags until you post; if a modern flag doesn't show, use `style: "legacy"`.

### `@haruhimemoe/bbcode/imagemap`

```ts
interface ImagemapRegion { x: number; y: number; w: number; h: number; href: string; title: string }
interface Imagemap { image: string; regions: ImagemapRegion[] }
```

Positions and sizes are percentages of the image. `href` is `#` (no link), an `http(s)://` URL or `mailto:...`.

| Function | What it does |
| --- | --- |
| `parseImagemap(text)` | Reads a whole `[imagemap]...[/imagemap]` block or just its content. Returns `{ ok: true, imagemap, issues: [] }` or `{ ok: false, imagemap: null, issues }`, where each issue is `{ line, start, end, message }` for a line osu! would refuse. |
| `validateImagemap(map)` | Checks an object: http(s) image without spaces, at least one region, numbers from 0 to 100, valid links, one-line titles. Returns `{ field, message }[]`. |
| `serializeImagemap(map)` | Writes the block. Throws `TypeError` listing the problems when `validateImagemap` finds any. |
| `formatPercent(n)` | A number with at most 4 decimals and no exponent. |

osu!'s format: a newline after `[imagemap]`, the image URL on the first line, then one line per region, `x y width height link title`, and `[/imagemap]` on its own line. If any line is wrong, osu! shows the whole block as text, and so does `render`.

### `@haruhimemoe/bbcode/flags`

| Export | What it is |
| --- | --- |
| `COUNTRIES` | Every ISO 3166-1 alpha-2 country and territory (249), sorted by code: `{ code, name, flag: { modern, legacy } }`. Frozen. |
| `findCountry(code)` | The country for a code (any case), or `undefined`. |
| `searchCountries(query)` | Matches by code or name, best first: exact code, then names starting with the query, then names containing it. Case and accents are ignored. |
| `flagUrl(code, style?)` | `https://osu.ppy.sh/assets/images/flags/<codepoints>.svg` (US is `1f1fa-1f1f8`), or with `"legacy"`, `https://assets.ppy.sh/old-flags/<CC>.png`. Throws `TypeError` unless `code` is two ASCII letters. |
| `normalizeCountryCode(code)` | Checks and uppercases a two-letter code. |

### `@haruhimemoe/bbcode/template`

A template is BBCode with `{{key}}` placeholders plus field declarations:

```ts
interface TemplateField {
  key: string;   // letters, digits, _, - and .
  label: string;
  kind: "text" | "multiline" | "number" | "date" | "url" | "user" | "users" | "country" | "color";
  required?: boolean;
  default?: string;
}
```

`fillTemplate(body, fields, values)` returns `{ text, errors }`. Each value is checked and written by kind:

| Kind | Value | Written as |
| --- | --- | --- |
| `text` | one line | as given |
| `multiline` | text | as given, CRLF → LF |
| `number` | a number or numeric text | the number |
| `date` | `YYYY-MM-DD` | as given |
| `url` | http, https or ftp URL | as given |
| `user` | id (number or digits) or username | `[profile]` link |
| `users` | an array, or one per line | `[profile]` links, one per line |
| `country` | two-letter code | flag `[img]` |
| `color` | `#rgb`, `#rrggbb` or a name | normalized color |

An empty value falls back to `default`; an empty required field is an error. A field with an error, and a placeholder with no declared field, stay as `{{key}}` in the text. `errors` is `{ key, message }[]`.

`templateFields(body, fields?)` returns `{ keys, undeclared, unused }`: placeholders in the body, those without a declared field, and declared fields the body never uses. `FIELD_KINDS` lists the kinds.

### `@haruhimemoe/bbcode/styles.css`

Styles for everything `render` outputs. Dark by default; add `bb--light` to the root (`render(text, { className: "bb--light" })`) for a light version. Colors are CSS custom properties on `.bb` (`--bb-text`, `--bb-link`, `--bb-surface`...), so you can retheme without overriding rules.

## Supported tags

Tag names are lowercase and case-sensitive, like on osu!.

| Tag | Form | Renders as |
| --- | --- | --- |
| `b` `i` `u` | `[b]x[/b]` | `<strong>`, `<em>`, `<u>` |
| `s`, `strike` | `[s]x[/s]`, `[strike]x[/strike]` | `<del>` |
| `spoiler` | `[spoiler]x[/spoiler]` | blacked-out `span.bb-spoiler`, shown on hover |
| `color` | `[color=#rrggbb]`, `[color=name]` (letters only) | `span.bb-color` |
| `size` | `[size=N]`, a whole number | `span.bb-size`, clamped to 30..200 % |
| `centre` `left` `right` | `[centre]x[/centre]` | `div.bb-align`. `[center]` is not a tag |
| `heading` | one line | `h2.bb-heading` |
| `c` | one line | inline `code.bb-c` |
| `code` | block, content shown as written | `pre.bb-code` |
| `notice` | block | `div.bb-notice` |
| `box` | `[box=Title]`, the title can hold inline tags | closed `details.bb-box` |
| `spoilerbox` | `[spoilerbox]` | closed `details.bb-box` titled "SPOILER" |
| `quote` | `[quote]`, `[quote="name"]` | `blockquote.bb-quote`, "name wrote:" |
| `list` | `[list]` bullets, `[list=anything]` numbered, items `[*]` | `ul`/`ol.bb-list`; text before the first `[*]` is `div.bb-list__title` |
| `url` | `[url]https://..[/url]`, `[url=https://..]text[/url]`, one line | `a.bb-link`; http, https and ftp only |
| `email` | `[email]a@b.c[/email]`, `[email=a@b.c]text[/email]` | mailto `a.bb-link`; the text isn't parsed |
| `img` | `[img]url[/img]`, no `[` in the URL | `img.bb-img`; http and https only |
| `audio` | `[audio]url[/audio]` | `audio.bb-audio` |
| `youtube` | a video id or a youtube.com, youtu.be or shorts link | `iframe.bb-youtube` |
| `profile` | `[profile]name[/profile]`, `[profile=id]name[/profile]` | `a.bb-profile` to the osu! user |
| `imagemap` | see [imagemap](#haruhimemoebbcodeimagemap) | `div.bb-imagemap` with positioned links |

Also like osu!:

- Newlines become `<br>`. Block tags eat newlines next to them so a block on its own line leaves no gap: boxes, notices and code eat all newlines inside their edges and one after; quotes eat whitespace inside and two newlines after; lists eat whitespace before items and two newlines after; alignment eats one newline after the opening and one after the closing tag; headings and imagemaps eat one after.
- Bare `http://`, `https://`, `ftp://` and `www.` URLs and email addresses become links.
- A tag inside itself (`[b]a[b]b[/b]c[/b]`) breaks: the first close ends the outer tag and the inner one shows as text. Boxes, quotes and lists nest fine.
- `[s]` closes only with `[/s]` and `[strike]` only with `[/strike]`.

## Lint codes

| Code | Severity | When | Fix |
| --- | --- | --- | --- |
| `unclosed-tag` | error | An opening tag with no close (or closed after the tag around it, or on another line for one-line tags) | |
| `stray-close` | warning | A closing tag with no opening tag | removes it |
| `unknown-tag` | warning | `[center]`, wrong case (`[B]`), tags from other forums (`[font]`, `[table]`...), an argument a tag doesn't take, `[quote=name]` without quotes, `[*]` outside a list | `[centre]`, lowercase, drop the argument, add quotes |
| `bad-size` | error | Not a whole number, or outside 30..200 (osu! clamps) | the clamped value |
| `bad-size` | warning | In range but not 50, 85, 100 or 150 | |
| `bad-color` | error | Not `#rrggbb` or letters | `#abc` → `#aabbcc`, `ff66aa` → `#ff66aa` |
| `bad-color` | warning | A name browsers don't know | |
| `bad-url` | error | A link, image, audio or email osu! or `render` refuses, or a bad YouTube id | adds `https://` to `www.` links |
| `self-nested` | warning | An inline tag inside itself | |
| `img-bracket` | error | An image URL containing `[` | |
| `imagemap-line` | error | A line osu! would refuse (one diagnostic per line) | |
| `list-no-items` | warning | A list without `[*]` | |
| `over-limit` | error | Over the character limit; the range starts at the first character over | |

## Safety

`render`'s output is meant to go into a page as is:

- Every text node and attribute value is HTML-escaped.
- Links allow `http`, `https` and `ftp`; images, audio and imagemaps `http` and `https`; emails `mailto:`. A URL with whitespace or control characters is refused. A refused tag renders as its source text, escaped.
- Colors must be `#rrggbb` or letters only; sizes are whole numbers clamped to 30..200; YouTube ids are limited to `A-Z a-z 0-9 _ -`; imagemap numbers must be plain decimals.
- These checks run again when you render a hand-built tree, not only on parsed input.
- A `proxy` result must be an http(s) URL or a `/` path.

Images, audio and YouTube embeds load from their own hosts in the viewer's browser. If your page has a Content Security Policy, allow those hosts (for example `img-src https:`, `media-src https:`, `frame-src https://www.youtube.com`), or send media through `proxy`.

## Differences from osu!

- **Malformed nesting.** osu! converts each tag on its own, so crossed tags (`[b][i]x[/b][/i]`) can still render there. A tree can't hold that, so here the inner tag shows as text and `lint` reports it.
- **Unclosed boxes, quotes and lists** show as text here; osu! may open them to the end of the post.
- **Strict values.** URLs with spaces, imagemap numbers like `1.2.3`, and YouTube ids with other characters are refused here, where osu! outputs something broken.
- **Markup.** Boxes are native `<details>` elements and classes use a `bb-` prefix. The output is meant to look like osu!, not to copy its HTML.
- **Not rendered:** smilies, image sizes (osu! measures images on its servers), and profile names (osu! replaces them with the current username when the post is saved).
- **Counting.** `count` counts code points of the BBCode as typed.

## Compatibility

- **ESM only.** Node 22.12+ can also `require()` it.
- **Node** 22.12 or later (`engines`). CI runs the built package on Node 22.12 and 24.
- **Browsers**, **Bun** and **Deno** (through the `npm:` specifier). No DOM or Node APIs are used.
- **Bundlers:** import `@haruhimemoe/bbcode/styles.css` where your bundler handles CSS; the file is at `dist/styles.css` otherwise. `sideEffects` covers only the CSS, so the JavaScript tree-shakes.
- **TypeScript:** types ship in the package. CI typechecks a consumer with `strict`, `exactOptionalPropertyTypes` and `skipLibCheck: false`.

## License

MIT. See [LICENSE](LICENSE).

Written from osu!'s observed behavior. No code, styles or text from osu-web or the osu! wiki. Not affiliated with osu! or ppy Pty Ltd.

## Links

- [npm package](https://www.npmjs.com/package/@haruhimemoe/bbcode)
- [CHANGELOG.md](CHANGELOG.md) for release history
- [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and how to submit a change
- [SECURITY.md](SECURITY.md) to report a vulnerability
- [haruhime.moe Discord server](https://discord.gg/bKy9kjMV4y) for questions and feedback
