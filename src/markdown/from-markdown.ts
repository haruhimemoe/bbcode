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

type Ctx = { lost: Loss[]; refs: Map<string, string>; opts: Required<FromMarkdownOptions> };

const lose = (ctx: Ctx, code: Loss["code"], message: string, start: number, end: number): void => {
  ctx.lost.push({ code, message, start, end });
};

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
    case "code":
      return `[c]${n.value}[/c]`;
    case "break":
      return "\n";
    case "image":
      return `[img]${n.src}[/img]`;
    case "html":
      lose(ctx, "html", "HTML has no BBCode form, kept as text.", n.start, n.end);
      return n.value;
    case "link": {
      const label = inline(n.children, ctx);
      if (n.href.startsWith("mailto:")) return `[email]${n.href.slice(7)}[/email]`;
      return label === n.href ? `[url]${n.href}[/url]` : `[url=${n.href}]${label}[/url]`;
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
 * Collects `[start, end]` of every `code` block and every inline `code` node, walking paragraphs
 * and headings through `parseInlines` and recursing into quotes and list items. Used to exclude
 * literal BBCode-looking text inside code spans/blocks from the "typed BBCode" warning.
 */
const codeRanges = (
  list: MdBlock[],
  refs: ReadonlyMap<string, string>,
  out: [number, number][] = [],
): [number, number][] => {
  const walkInline = (nodes: MdInline[]): void => {
    for (const n of nodes) {
      if (n.kind === "code") out.push([n.start, n.end]);
      else if ("children" in n) walkInline(n.children);
    }
  };
  for (const b of list) {
    if (b.kind === "code") out.push([b.start, b.end]);
    else if (b.kind === "paragraph" || b.kind === "heading")
      walkInline(parseInlines(b.text, b.textStart, refs));
    else if (b.kind === "quote") codeRanges(b.children, refs, out);
    else if (b.kind === "list") for (const item of b.items) codeRanges(item, refs, out);
  }
  return out;
};

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
  };
  // Blank definitions in place (same length) so offsets still point into the input.
  const blankOut = (s: string, re: RegExp, keep: (m: RegExpMatchArray) => void) =>
    s.replace(re, (...args) => {
      keep(args as unknown as RegExpMatchArray);
      return (args[0] as string).replace(/[^\n]/g, " ");
    });
  let source = blankOut(markdown, REF_DEF, (m) =>
    ctx.refs.set((m[1] as string).trim().toLowerCase(), m[2] as string),
  );
  source = blankOut(source, FOOTNOTE_DEF, () => {});
  for (const m of markdown.matchAll(FOOTNOTE_REF)) {
    const at = m.index ?? 0;
    lose(ctx, "footnote", "osu! has no footnotes, kept the marker as text.", at, at + m[0].length);
  }
  const parsed = parseBlocks(source, LIMITS.nesting);
  const output = blocks(parsed, ctx).trim();
  // Typed BBCode in the markdown passes through, and osu! has no escape for it: warn once per
  // top-level tag (its children sit inside the same span), except inside code.
  const code = codeRanges(parsed, ctx.refs);
  for (const node of parse(markdown).children) {
    if (node.type !== "tag") continue;
    if (code.some(([s, e]) => s <= node.start && node.end <= e)) continue;
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
