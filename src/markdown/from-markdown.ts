/**
 * @file src/markdown/from-markdown.ts
 * @desc fromMarkdown: block pass, inline pass, then BBCode out. Tables become an aligned [code]
 *       block; HTML, footnotes, rules and deep headings are reported as lost.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { LIMITS } from "../limits.js";
import { parse } from "../parse.js";
import { parseBlocks } from "./blocks.js";
import { parseInlines } from "./inlines.js";
import type { Conversion, FromMarkdownOptions, Loss, MdBlock, MdInline } from "./types.js";

const REF_DEF = /^ {0,3}\[([^\]^][^\]]*)\]:\s*<?(\S+?)>?(?:\s+"[^"]*")?\s*$/gm;
const FOOTNOTE_DEF = /^ {0,3}\[\^[^\]]+\]:.*$/gm;
const FOOTNOTE_REF = /\[\^[^\]]+\]/g;

type Ctx = {
  lost: Loss[];
  refs: Map<string, string>;
  opts: Required<FromMarkdownOptions>;
  /** The source actually parsed (markdown with definitions blanked out, same length as input). */
  source: string;
  /** `[start, end]` of every `[c]`/`[code]` span emitted so far; filled in as blocks() runs. */
  codeRanges: [number, number][];
};

const lose = (ctx: Ctx, code: Loss["code"], message: string, start: number, end: number): void => {
  ctx.lost.push({ code, message, start, end });
};

// osu! shows `[`, `]` and a bare space in a URL argument or raw URL as the literal character,
// which (for `[`/`]`) can also cut a `[url=...]` argument short. Percent-encoding them keeps the
// tag intact and the URL working.
const encodeHref = (href: string): string =>
  href.replace(/[[\] ]/g, (c) => (c === " " ? "%20" : c === "[" ? "%5B" : "%5D"));

// Scheme-only checks, deliberately not src/safety.ts's isLinkUrl/isMediaUrl: those also demand
// isClean (no whitespace), but a markdown href can legitimately carry a space or `[`/`]` (an
// angle-bracket destination, or an escaped bracket) that encodeHref percent-encodes below. What
// actually determines whether osu! accepts the tag is the scheme, checked before encoding.
const LINK_SCHEME = /^(?:https?|ftp):\/\/./i;
const MEDIA_SCHEME = /^https?:\/\/./i;

const inlineOf = (n: MdInline, ctx: Ctx): string => {
  switch (n.kind) {
    case "text":
      return n.value;
    case "strong":
      return `[b]${inline(n.children, ctx)}[/b]`;
    case "em":
      return `[i]${inline(n.children, ctx)}[/i]`;
    case "strike":
      return `[s]${inline(n.children, ctx)}[/s]`;
    case "code": {
      ctx.codeRanges.push([n.start, n.end]);
      // [c] isn't raw (see src/tags.ts): osu! parses its content as BBCode, so a tag typed
      // inside backticks will actually render instead of staying a literal `[b]`.
      if (parse(n.value).children.some((child) => child.type === "tag")) {
        lose(
          ctx,
          "no-equivalent",
          "osu! reads BBCode inside [c]; this will render as markup.",
          n.start,
          n.end,
        );
      }
      return `[c]${n.value}[/c]`;
    }
    case "break":
      return "\n";
    case "image":
      if (!MEDIA_SCHEME.test(n.src)) {
        lose(
          ctx,
          "no-equivalent",
          "[img] needs an http:// or https:// URL; kept the alt text.",
          n.start,
          n.end,
        );
        return n.alt;
      }
      return `[img]${encodeHref(n.src)}[/img]`;
    case "html":
      lose(ctx, "html", "HTML has no BBCode form, kept as text.", n.start, n.end);
      return n.value;
    case "link": {
      const label = inline(n.children, ctx);
      if (n.href.startsWith("mailto:")) return `[email]${n.href.slice(7)}[/email]`;
      if (!LINK_SCHEME.test(n.href)) {
        lose(
          ctx,
          "no-equivalent",
          "[url] needs an http://, https:// or ftp:// link; kept the link text.",
          n.start,
          n.end,
        );
        return label;
      }
      const href = encodeHref(n.href);
      return label === n.href ? `[url]${href}[/url]` : `[url=${href}]${label}[/url]`;
    }
  }
};

const inline = (nodes: MdInline[], ctx: Ctx): string => nodes.map((n) => inlineOf(n, ctx)).join("");

const textOf = (text: string, start: number, ctx: Ctx): string => {
  for (const m of text.matchAll(/\[([^\]]*)\]\[([^\]]*)\]/g)) {
    const key = ((m[2] || m[1]) as string).trim().toLowerCase();
    if (!ctx.refs.has(key)) {
      const at = start + (m.index ?? 0);
      lose(
        ctx,
        "reference-link-unresolved",
        `No definition for [${key}], kept as text.`,
        at,
        at + m[0].length,
      );
    }
  }
  return inline(parseInlines(text, start, ctx.refs), ctx);
};

const table = (rows: string[][], style: "code" | "text"): string => {
  if (style === "text") return rows.map((r) => r.join(" | ")).join("\n");
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(...rows.map((r) => (r[c] ?? "").length)),
  );
  const line = (r: string[]) =>
    widths
      .map((w, c) => (r[c] ?? "").padEnd(w))
      .join(" | ")
      .trimEnd();
  const rule = widths.map((w) => "-".repeat(w)).join("-+-");
  const [head, ...body] = rows;
  return `[code]\n${[line(head as string[]), rule, ...body.map(line)].join("\n")}\n[/code]`;
};

const blockOf = (b: MdBlock, ctx: Ctx): string => {
  switch (b.kind) {
    case "paragraph":
      if (b.capped) {
        lose(
          ctx,
          "no-equivalent",
          `nested deeper than ${LIMITS.nesting}; kept as text.`,
          b.start,
          b.end,
        );
        // Trimmed here, once, on a direct slice of the flat source: cheap. Deferring this to
        // every ancestor list/quote level (as blockOf used to, via `.trim()` on each level's
        // already-assembled result) forces V8 to flatten that whole rope to inspect it, once per
        // level, turning a capped (and possibly huge) hostile payload into O(maxDepth * size).
        return ctx.source.slice(b.start, b.end).trim();
      }
      return textOf(b.text, b.textStart, ctx);
    case "heading": {
      if (b.level > 1) {
        lose(
          ctx,
          "heading-level",
          `osu! has one heading size; h${b.level} became ${
            ctx.opts.headingStyle === "bold" ? "bold" : "[heading]"
          }.`,
          b.start,
          b.end,
        );
      }
      const body = textOf(b.text, b.textStart, ctx);
      return b.level > 1 && ctx.opts.headingStyle === "bold"
        ? `[b]${body}[/b]`
        : `[heading]${body}[/heading]`;
    }
    case "quote":
      return `[quote]${blocks(b.children, ctx)}[/quote]`;
    case "list": {
      // No .trim() here: every blockOf branch already returns clean-edged text (tags, or text
      // trimmed at its own source above), so trimming the composed per-item string again would
      // just re-flatten it at every ancestor list/quote level for no benefit.
      const items = b.items.map((item) => `[*]${blocks(item, ctx)}`).join("\n");
      return `[list${b.ordered ? "=1" : ""}]\n${items}\n[/list]`;
    }
    case "code":
      ctx.codeRanges.push([b.start, b.end]);
      return `[code]\n${b.value}\n[/code]`;
    case "rule":
      lose(ctx, "no-equivalent", "osu! has no horizontal rule, left a blank line.", b.start, b.end);
      return "";
    case "table":
      lose(ctx, "table", "osu! has no tables, kept as aligned text.", b.start, b.end);
      return table(b.rows, ctx.opts.tableStyle);
    case "html":
      lose(ctx, "html", "HTML has no BBCode form, kept as text.", b.start, b.end);
      return b.value;
  }
};

// Collapsing runs/{3,} newlines is a top-level concern, not a per-container one: blockOf
// recurses into blocks() once per quote/list nesting level (up to maxDepth deep), and running
// the replace at every level re-scans that whole (possibly huge) subtree's text on every level
// instead of once, which turns hostile nesting into O(maxDepth * size) work. blocks() just joins;
// fromMarkdown collapses once over the finished output.
// Array.prototype.join (unlike `+` or a template literal) eagerly flattens a rope-backed string
// argument of 2+ elements instead of leaving it as a lazy ConsString; reduce() with `+` keeps the
// concatenation lazy. A list item that's deeply right-nested (hostile input, or an ordinary list
// whose body starts with a paragraph before its sub-list) otherwise re-flattens its own, possibly
// huge, rendered subtree on every ancestor level: O(maxDepth * size) instead of O(size).
const blocks = (list: MdBlock[], ctx: Ctx): string =>
  list.map((b) => blockOf(b, ctx)).reduce((acc, s, i) => (i === 0 ? s : `${acc}\n\n${s}`), "");

/**
 * Collects `[start, end]` of every fenced/indented code block in `list`, recursing into quotes
 * and list items. Used before any definition is blanked, so a reference or footnote definition
 * written inside a code block is left alone (both in the output and in `refs`).
 */
const blockCodeRanges = (list: MdBlock[], out: [number, number][] = []): [number, number][] => {
  for (const b of list) {
    if (b.kind === "code") out.push([b.start, b.end]);
    else if (b.kind === "quote") blockCodeRanges(b.children, out);
    else if (b.kind === "list") for (const item of b.items) blockCodeRanges(item, out);
  }
  return out;
};

const insideAny = (ranges: readonly [number, number][], at: number, end: number): boolean =>
  ranges.some(([s, e]) => at >= s && end <= e);

/**
 * Replaces every match of `re` with blanks of the same length (so offsets elsewhere keep
 * pointing into the same positions), except a match that falls inside `skip` (a code block):
 * that one is left as written and `keep` is never called for it.
 */
const blankOut = (
  s: string,
  re: RegExp,
  skip: readonly [number, number][],
  keep: (m: RegExpMatchArray, offset: number) => void,
): string =>
  s.replace(re, (...args) => {
    const full = args[0] as string;
    const offset = args[args.length - 2] as number;
    const groups = args.slice(0, -2) as unknown as RegExpMatchArray;
    if (insideAny(skip, offset, offset + full.length)) return full;
    keep(groups, offset);
    return full.replace(/[^\n]/g, " ");
  });

/**
 * @function fromMarkdown
 * @param markdown {string} markdown (CommonMark subset plus GFM strike, autolinks and tables)
 * @param options {FromMarkdownOptions} headingStyle, tableStyle
 * @returns {Conversion} BBCode, and what BBCode can't say
 */
export const fromMarkdown = (markdown: string, options: FromMarkdownOptions = {}): Conversion => {
  const ctx: Ctx = {
    lost: [],
    refs: new Map(),
    opts: {
      headingStyle: options.headingStyle ?? "heading",
      tableStyle: options.tableStyle ?? "code",
    },
    source: markdown,
    codeRanges: [],
  };
  // None of REF_DEF, FOOTNOTE_DEF or FOOTNOTE_REF can match without a literal `[` somewhere in
  // the input, so a cheap indexOf (a native, optimized scan) skips three regex passes over
  // hostile (tens-of-MB) input that has none. This also sidesteps a V8 regex-tiering quirk where
  // running one of these patterns against a short string first measurably slows a later run
  // against a huge one on the very same regex object.
  const hasBracket = markdown.includes("[");

  // Code blocks are found on the untouched input, before any definition is blanked out, so a
  // definition written inside one is left exactly as written (finding 4). codeSkip is only ever
  // read by blankOut below, and blankOut only runs when hasBracket, so this whole extra parse
  // (parseBlocks run a second time, just to locate code fences) is skippable whenever there's no
  // `[` to blank around - the common case for hostile input with no brackets at all.
  const codeSkip = hasBracket ? blockCodeRanges(parseBlocks(markdown, LIMITS.nesting)) : [];

  // Blank definitions in place (same length) so offsets still point into the input.
  let source = hasBracket
    ? blankOut(markdown, REF_DEF, codeSkip, (m) =>
        ctx.refs.set((m[1] as string).trim().toLowerCase(), m[2] as string),
      )
    : markdown;
  const footnoteDefs: [number, number][] = [];
  source = hasBracket
    ? blankOut(source, FOOTNOTE_DEF, codeSkip, (m, offset) =>
        footnoteDefs.push([offset, offset + (m[0] as string).length]),
      )
    : source;
  ctx.source = source;

  // Each definition drops its own text (once); a reference that resolves to one of these spans
  // (the `[^1]` that opens it) is not also a dangling reference (finding 7).
  for (const [s, e] of footnoteDefs) {
    lose(ctx, "footnote", "osu! has no footnotes, dropped the note text.", s, e);
  }
  if (hasBracket) {
    for (const m of markdown.matchAll(FOOTNOTE_REF)) {
      const at = m.index ?? 0;
      const end = at + (m[0] as string).length;
      if (insideAny(footnoteDefs, at, end)) continue;
      lose(ctx, "footnote", "osu! has no footnotes, kept the marker as text.", at, end);
    }
  }

  const parsed = parseBlocks(source, LIMITS.nesting);
  const output = blocks(parsed, ctx)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Typed BBCode in the markdown passes through, and osu! has no escape for it: warn once per
  // top-level tag (its children sit inside the same span), except inside code. Both the tags
  // (siblings of a document, so already in increasing, non-overlapping order) and the code
  // ranges collected while emitting are sorted, so one pass with a single moving index covers
  // the whole document in O(n + m) instead of a range scan per tag.
  // A BBCode tag node can't exist without a `[` either, so this whole pass (parsing the raw
  // markdown a third time, just to look for stray tags) is skippable under the same hasBracket
  // guard as above.
  if (hasBracket) {
    const ranges = ctx.codeRanges.slice().sort((a, b) => a[0] - b[0]);
    let ri = 0;
    for (const node of parse(markdown).children) {
      if (node.type !== "tag") continue;
      while (ri < ranges.length && (ranges[ri] as [number, number])[1] <= node.start) ri++;
      const range = ranges[ri];
      const covered = range !== undefined && range[0] <= node.start && node.end <= range[1];
      if (covered) continue;
      lose(
        ctx,
        "no-equivalent",
        "This looks like BBCode and osu! will show it as a tag.",
        node.start,
        node.end,
      );
    }
  }
  ctx.lost.sort((a, b) => a.start - b.start);
  return { output, lost: ctx.lost };
};
