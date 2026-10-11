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
      return `[img]${encodeHref(n.src)}[/img]`;
    case "html":
      lose(ctx, "html", "HTML has no BBCode form, kept as text.", n.start, n.end);
      return n.value;
    case "link": {
      const label = inline(n.children, ctx);
      if (n.href.startsWith("mailto:")) return `[email]${n.href.slice(7)}[/email]`;
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
        return ctx.source.slice(b.start, b.end);
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
      const items = b.items.map((item) => `[*]${blocks(item, ctx).trim()}`).join("\n");
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

const blocks = (list: MdBlock[], ctx: Ctx): string =>
  list
    .map((b) => blockOf(b, ctx))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");

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
  // Code blocks are found on the untouched input, before any definition is blanked out, so a
  // definition written inside one is left exactly as written (finding 4).
  const codeSkip = blockCodeRanges(parseBlocks(markdown, LIMITS.nesting));

  // Blank definitions in place (same length) so offsets still point into the input.
  let source = blankOut(markdown, REF_DEF, codeSkip, (m) =>
    ctx.refs.set((m[1] as string).trim().toLowerCase(), m[2] as string),
  );
  const footnoteDefs: [number, number][] = [];
  source = blankOut(source, FOOTNOTE_DEF, codeSkip, (m, offset) =>
    footnoteDefs.push([offset, offset + (m[0] as string).length]),
  );
  ctx.source = source;

  // Each definition drops its own text (once); a reference that resolves to one of these spans
  // (the `[^1]` that opens it) is not also a dangling reference (finding 7).
  for (const [s, e] of footnoteDefs) {
    lose(ctx, "footnote", "osu! has no footnotes, dropped the note text.", s, e);
  }
  for (const m of markdown.matchAll(FOOTNOTE_REF)) {
    const at = m.index ?? 0;
    const end = at + (m[0] as string).length;
    if (insideAny(footnoteDefs, at, end)) continue;
    lose(ctx, "footnote", "osu! has no footnotes, kept the marker as text.", at, end);
  }

  const parsed = parseBlocks(source, LIMITS.nesting);
  const output = blocks(parsed, ctx).trim();

  // Typed BBCode in the markdown passes through, and osu! has no escape for it: warn once per
  // top-level tag (its children sit inside the same span), except inside code. Both the tags
  // (siblings of a document, so already in increasing, non-overlapping order) and the code
  // ranges collected while emitting are sorted, so one pass with a single moving index covers
  // the whole document in O(n + m) instead of a range scan per tag.
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
  ctx.lost.sort((a, b) => a.start - b.start);
  return { output, lost: ctx.lost };
};
