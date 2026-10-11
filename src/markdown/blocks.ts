/**
 * @file src/markdown/blocks.ts
 * @desc parseBlocks: the block pass of fromMarkdown. Line-based, one pass per nesting level,
 *       containers re-parse their stripped lines. Inline text stays raw for the inline pass.
 *       maxDepth caps container nesting (quote-in-quote, list-in-list): a container opened at
 *       depth === maxDepth is not parsed as a container, so its content (and everything inside
 *       it) becomes paragraph text instead of recursing further. For the 1-indexed maxDepth
 *       walk test (`">".repeat(40)`, maxDepth 3) this lands exactly 3 quote levels deep before
 *       the paragraph, i.e. depth is 1-indexed and a quote is only opened while depth < maxDepth.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import type { MdBlock } from "./types.js";

type Line = { text: string; start: number };

const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const BULLET = /^( {0,3})([-*+])( +|$)/;
const ORDERED = /^( {0,3})(\d{1,9})[.)]( +|$)/;
const QUOTE = /^ {0,3}> ?/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
// A tag name must end at whitespace, `/`, `>` or end of line, so an autolink like
// `<https://x.y>` or `<mailto:a@b.c>` (scheme immediately followed by `:`) doesn't qualify.
const HTML_OPEN = /^ {0,3}<(\/?[a-zA-Z][\w-]*(?=[\s/>]|$)|!--)/;

// indexOf is a native, optimized scan; a per-character loop comparing source[i] === "\n"
// allocates a fresh one-character string for every position, which is the difference between a
// linear scan of hostile (tens-of-MB) input finishing in milliseconds or seconds.
const splitLines = (source: string): Line[] => {
  const lines: Line[] = [];
  let start = 0;
  const len = source.length;
  while (start <= len) {
    let i = source.indexOf("\n", start);
    if (i === -1) i = len;
    const end = i > start && source.charCodeAt(i - 1) === 13 /* \r */ ? i - 1 : i;
    lines.push({ text: source.slice(start, end), start });
    start = i + 1;
  }
  return lines;
};

// A line's content is checked for blankness far more often than it's actually blank: a deeply
// indented line (hostile input, or just a long nested list) can have thousands of leading spaces,
// and l.text.trim() scans every one of them to find the first non-space character. Checking the
// first and last code units first answers "not blank" in O(1) for any line that has real content
// at either end (the overwhelmingly common case) without walking the whole run of spaces; trim()
// only runs for the rare line that's whitespace at both ends.
const isWs = (c: number): boolean => c === 32 || c === 9 || c === 11 || c === 12;
const blank = (l: Line): boolean => {
  const t = l.text;
  if (t.length === 0) return true;
  if (!isWs(t.charCodeAt(0)) || !isWs(t.charCodeAt(t.length - 1))) return false;
  return t.trim() === "";
};
const endOf = (l: Line): number => l.start + l.text.length;
const cells = (row: string): string[] =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const parseLines = (lines: Line[], depth: number, maxDepth: number): MdBlock[] => {
  const out: MdBlock[] = [];
  let i = 0;
  const paragraph = (from: number, to: number, capped?: boolean): void => {
    const first = lines[from] as Line;
    const last = lines[to - 1] as Line;
    out.push({
      kind: "paragraph",
      text: lines
        .slice(from, to)
        .map((l) => l.text.trim())
        .join("\n"),
      textStart: first.start + (first.text.length - first.text.trimStart().length),
      start: first.start,
      end: endOf(last),
      ...(capped ? { capped: true as const } : {}),
    });
  };
  while (i < lines.length) {
    const line = lines[i] as Line;
    if (blank(line)) {
      i++;
      continue;
    }
    const text = line.text;

    const fenceMatch = text.match(FENCE);
    if (fenceMatch) {
      const m = fenceMatch;
      const marker = m[1] as string;
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !(lines[j] as Line).text.trimStart().startsWith(marker)) {
        body.push((lines[j] as Line).text);
        j++;
      }
      const closed = j < lines.length;
      const last = lines[Math.min(j, lines.length - 1)] as Line;
      out.push({
        kind: "code",
        lang: m[2] ?? "",
        value: body.join("\n"),
        start: line.start,
        end: endOf(last),
      });
      i = closed ? j + 1 : j;
      continue;
    }
    if (text.startsWith("    ") || text.startsWith("\t")) {
      const body: string[] = [];
      let j = i;
      while (
        j < lines.length &&
        (/^( {4}|\t)/.test((lines[j] as Line).text) || blank(lines[j] as Line))
      ) {
        body.push((lines[j] as Line).text.replace(/^( {4}|\t)/, ""));
        j++;
      }
      while (body.length && body[body.length - 1]?.trim() === "") {
        body.pop();
        j--;
      }
      out.push({
        kind: "code",
        lang: "",
        value: body.join("\n"),
        start: line.start,
        end: endOf(lines[j - 1] as Line),
      });
      i = j;
      continue;
    }
    const atxMatch = text.match(ATX);
    if (atxMatch) {
      const m = atxMatch;
      const content = (m[2] ?? "").trim();
      out.push({
        kind: "heading",
        level: (m[1] as string).length,
        text: content,
        textStart: line.start + Math.max(0, text.indexOf(content)),
        start: line.start,
        end: endOf(line),
      });
      i++;
      continue;
    }
    if (RULE.test(text)) {
      out.push({ kind: "rule", start: line.start, end: endOf(line) });
      i++;
      continue;
    }
    if (QUOTE.test(text)) {
      const inner: Line[] = [];
      let j = i;
      while (j < lines.length && QUOTE.test((lines[j] as Line).text)) {
        const l = lines[j] as Line;
        const cut = (l.text.match(QUOTE) as RegExpMatchArray)[0].length;
        inner.push({ text: l.text.slice(cut), start: l.start + cut });
        j++;
      }
      const end = endOf(lines[j - 1] as Line);
      if (depth >= maxDepth) {
        paragraph(i, j, true);
      } else {
        out.push({
          kind: "quote",
          children: parseLines(inner, depth + 1, maxDepth),
          start: line.start,
          end,
        });
      }
      i = j;
      continue;
    }
    const listMatch = text.match(BULLET) ?? text.match(ORDERED);
    if (listMatch) {
      const ordered = !text.match(BULLET);
      const items: MdBlock[][] = [];
      let j = i;
      while (j < lines.length) {
        const l = lines[j] as Line;
        const im = ordered ? l.text.match(ORDERED) : l.text.match(BULLET);
        if (!im) break;
        const width = im[0].length;
        // Loop-invariant: width doesn't change across the continuation scan below, so build the
        // indent prefix once instead of re-allocating it on every line (it was costing a fresh
        // string on every iteration of a loop that, for hostile input, runs tens of thousands of
        // times).
        const indent = " ".repeat(width);
        const body: Line[] = [{ text: l.text.slice(im[0].length), start: l.start + im[0].length }];
        j++;
        while (j < lines.length) {
          const next = lines[j] as Line;
          // Binding these checks before branching on them (instead of inline in the `if`)
          // keeps V8's inline caches monomorphic here; left inline, this loop megamorphs on
          // hostile input (tens of thousands of iterations) and runs ~10x slower.
          const isBlank = blank(next);
          if (isBlank) {
            const after = lines[j + 1];
            if (!after?.text.startsWith(indent)) break;
            body.push(next);
            j++;
            continue;
          }
          const indented = next.text.startsWith(indent);
          if (indented) {
            body.push({ text: next.text.slice(width), start: next.start + width });
            j++;
            continue;
          }
          if (
            BULLET.test(next.text) ||
            ORDERED.test(next.text) ||
            QUOTE.test(next.text) ||
            ATX.test(next.text) ||
            FENCE.test(next.text) ||
            RULE.test(next.text) ||
            HTML_OPEN.test(next.text)
          )
            break;
          body.push({
            text: next.text.trimStart(),
            start: next.start + (next.text.length - next.text.trimStart().length),
          });
          j++;
        }
        if (depth >= maxDepth) {
          const first = body[0] as Line;
          items.push([
            {
              kind: "paragraph",
              text: body.map((b) => b.text).join("\n"),
              textStart: first.start,
              start: first.start,
              end: endOf(body[body.length - 1] as Line),
              capped: true,
            },
          ]);
        } else {
          items.push(parseLines(body, depth + 1, maxDepth));
        }
        while (
          j < lines.length &&
          blank(lines[j] as Line) &&
          lines[j + 1] &&
          (ordered ? ORDERED : BULLET).test((lines[j + 1] as Line).text)
        )
          j++;
      }
      out.push({
        kind: "list",
        ordered,
        items,
        start: line.start,
        end: endOf(lines[j - 1] as Line),
      });
      i = j;
      continue;
    }
    if (text.includes("|") && lines[i + 1] && TABLE_SEP.test((lines[i + 1] as Line).text)) {
      const header = cells(text);
      const width = header.length;
      const pad = (row: string[]): string[] =>
        row.length === width
          ? row
          : [...row.slice(0, width), ...Array(Math.max(0, width - row.length)).fill("")];
      const rows = [pad(header)];
      let j = i + 2;
      while (
        j < lines.length &&
        !blank(lines[j] as Line) &&
        (lines[j] as Line).text.includes("|")
      ) {
        rows.push(pad(cells((lines[j] as Line).text)));
        j++;
      }
      out.push({ kind: "table", rows, start: line.start, end: endOf(lines[j - 1] as Line) });
      i = j;
      continue;
    }
    if (HTML_OPEN.test(text)) {
      let j = i;
      while (j < lines.length && !blank(lines[j] as Line)) j++;
      out.push({
        kind: "html",
        value: lines
          .slice(i, j)
          .map((l) => l.text)
          .join("\n"),
        start: line.start,
        end: endOf(lines[j - 1] as Line),
      });
      i = j;
      continue;
    }
    // Paragraph: runs until a blank line, a setext underline, or a line that starts another block.
    let j = i + 1;
    let consumedBySetext = false;
    while (j < lines.length) {
      const next = (lines[j] as Line).text;
      if (blank(lines[j] as Line)) break;
      if (SETEXT.test(next)) {
        const level = next.trim().startsWith("=") ? 1 : 2;
        const first = lines[i] as Line;
        out.push({
          kind: "heading",
          level,
          text: lines
            .slice(i, j)
            .map((l) => l.text.trim())
            .join(" "),
          textStart: first.start,
          start: first.start,
          end: endOf(lines[j] as Line),
        });
        i = j + 1;
        consumedBySetext = true;
        break;
      }
      if (
        ATX.test(next) ||
        FENCE.test(next) ||
        QUOTE.test(next) ||
        RULE.test(next) ||
        BULLET.test(next)
      )
        break;
      j++;
    }
    if (consumedBySetext) continue;
    paragraph(i, j);
    i = j;
  }
  return out;
};

/**
 * @function parseBlocks
 * @param source {string} markdown
 * @param maxDepth {number} deepest quote or list nesting; deeper content stays paragraph text
 * @returns {MdBlock[]} top-level blocks, offsets into source
 */
export const parseBlocks = (source: string, maxDepth: number): MdBlock[] =>
  parseLines(splitLines(source), 0, maxDepth);
