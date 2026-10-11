/**
 * @file src/markdown/inlines.ts
 * @desc parseInlines: the inline pass of fromMarkdown. Tokenize once, then match emphasis with a
 *       delimiter stack (CommonMark's algorithm, cut down to *, _ and ~~). Linear time.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import type { MdInline } from "./types.js";

type Delim = {
  kind: "delim";
  char: "*" | "_" | "~";
  count: number;
  canOpen: boolean;
  canClose: boolean;
  start: number;
  end: number;
};
// A `[`/`![` opener, kept as its own non-mergeable identity so pushText never absorbs the
// label text that follows it into the marker itself. Resolved to a link/image (spliced out)
// or demoted to literal text (bracketText) once we know whether it closed.
type Bracket = { kind: "bracket"; image: boolean; start: number; end: number };
type Tok = MdInline | Delim | Bracket;
// What's left once every "bracket" marker has been resolved or demoted to text — matchDelims
// only ever sees this, never a raw Bracket.
type Node = MdInline | Delim;

const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/;
const ESCAPABLE = /[!-/:-@[-`{-~]/;
const URL_RE = /^https?:\/\/[^\s<>]+/;
const HTML_RE = /^<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>|^<!--[\s\S]*?-->/;

const flank = (before: string, after: string) => {
  const left =
    !SPACE.test(after || " ") &&
    (!PUNCT.test(after) || SPACE.test(before || " ") || PUNCT.test(before));
  const right =
    !SPACE.test(before || " ") &&
    (!PUNCT.test(before) || SPACE.test(after || " ") || PUNCT.test(after));
  return { left, right };
};

const pushText = (out: Tok[], value: string, start: number, end: number): void => {
  const last = out[out.length - 1];
  if (last && last.kind === "text" && last.end === start) {
    last.value += value;
    last.end = end;
  } else {
    out.push({ kind: "text", value, start, end });
  }
};

const bracketText = (b: Bracket): MdInline => ({
  kind: "text",
  value: b.image ? "![" : "[",
  start: b.start,
  end: b.end,
});

// Any "bracket" tokens left in a slice (never closed, or closed-but-failed-to-resolve) must
// become plain text before the slice is handed to matchDelims or returned from tokenize —
// "bracket" isn't a valid MdInline kind.
const sanitizeBrackets = (toks: Tok[]): Node[] =>
  toks.map((t) => (t.kind === "bracket" ? bracketText(t) : t));

const tokenize = (s: string, base: number, refs: ReadonlyMap<string, string>): Node[] => {
  const out: Tok[] = [];
  const brackets: { index: number; pos: number; image: boolean }[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i] as string;
    if (c === "\\" && i + 1 < s.length) {
      const next = s[i + 1] as string;
      if (next === "\n") {
        out.push({ kind: "break", start: base + i, end: base + i + 2 });
        i += 2;
        continue;
      }
      if (ESCAPABLE.test(next)) {
        pushText(out, next, base + i, base + i + 2);
        i += 2;
        continue;
      }
    }
    if (c === "`") {
      let n = 1;
      while (s[i + n] === "`") n++;
      const fence = "`".repeat(n);
      const close = s.indexOf(fence, i + n);
      if (close !== -1 && s[close + n] !== "`") {
        let value = s.slice(i + n, close).replace(/\n/g, " ");
        if (/^ .* $/.test(value) && value.trim()) value = value.slice(1, -1);
        out.push({ kind: "code", value, start: base + i, end: base + close + n });
        i = close + n;
        continue;
      }
      pushText(out, fence, base + i, base + i + n);
      i += n;
      continue;
    }
    if (c === "<") {
      const auto = s.slice(i).match(/^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/);
      if (auto) {
        const href = auto[1] as string;
        out.push({
          kind: "link",
          href,
          children: [
            {
              kind: "text",
              value: href.replace(/^mailto:/, ""),
              start: base + i + 1,
              end: base + i + 1 + href.length,
            },
          ],
          start: base + i,
          end: base + i + auto[0].length,
        });
        i += auto[0].length;
        continue;
      }
      const html = s.slice(i).match(HTML_RE);
      if (html) {
        out.push({ kind: "html", value: html[0], start: base + i, end: base + i + html[0].length });
        i += html[0].length;
        continue;
      }
    }
    if (c === "h" && (i === 0 || !/\w/.test(s[i - 1] as string))) {
      const url = s.slice(i).match(URL_RE);
      if (url) {
        const href = url[0].replace(/[.,;:!?)]+$/, "");
        out.push({
          kind: "link",
          href,
          children: [{ kind: "text", value: href, start: base + i, end: base + i + href.length }],
          start: base + i,
          end: base + i + href.length,
        });
        i += href.length;
        continue;
      }
    }
    if (c === " " && s.startsWith("  \n", i)) {
      let n = i;
      while (s[n] === " ") n++;
      out.push({ kind: "break", start: base + i, end: base + n + 1 });
      i = n + 1;
      continue;
    }
    if (c === "!" && s[i + 1] === "[") {
      brackets.push({ index: out.length, pos: i, image: true });
      out.push({ kind: "bracket", image: true, start: base + i, end: base + i + 2 });
      i += 2;
      continue;
    }
    if (c === "[") {
      brackets.push({ index: out.length, pos: i, image: false });
      out.push({ kind: "bracket", image: false, start: base + i, end: base + i + 1 });
      i += 1;
      continue;
    }
    if (c === "]" && brackets.length) {
      const open = brackets.pop() as (typeof brackets)[number];
      if (open.index === -1) {
        pushText(out, "]", base + i, base + i + 1);
        i += 1;
        continue;
      }
      const rest = s.slice(i + 1);
      const inlineDest = rest.match(/^\(\s*<?([^\s<>()]*)>?(?:\s+"[^"]*")?\s*\)/);
      const refDest = rest.match(/^\[([^\]]*)\]/);
      const label = s.slice(open.pos + (open.image ? 2 : 1), i);
      const href = inlineDest
        ? inlineDest[1]
        : refs.get(((refDest?.[1] || label) as string).trim().toLowerCase());
      const used = inlineDest
        ? inlineDest[0].length
        : refDest && href !== undefined
          ? refDest[0].length
          : 0;
      if (href !== undefined) {
        const children = sanitizeBrackets(out.splice(open.index + 1) as Tok[]);
        out.pop();
        const start = base + open.pos;
        const end = base + i + 1 + used;
        if (open.image) {
          out.push({ kind: "image", src: href as string, alt: label, start, end });
        } else {
          out.push({
            kind: "link",
            href: href as string,
            children: matchDelims(children),
            start,
            end,
          });
          // A link can't contain a link: demote the outer open-link brackets still on the
          // stack to literal text now, and mark them invalidated so their eventual `]`
          // (if any) also falls back to literal text instead of re-resolving.
          for (const b of brackets) {
            if (!b.image && b.index !== -1) {
              const tok = out[b.index];
              if (tok && tok.kind === "bracket") out[b.index] = bracketText(tok);
              b.index = -1;
            }
          }
        }
        i += 1 + used;
        continue;
      }
      // Failed to resolve: the opener becomes literal text (`[` or `![`) and the `]` is a
      // separate literal character — pushText may still merge the two if they end up adjacent.
      const openTok = out[open.index];
      if (openTok && openTok.kind === "bracket") out[open.index] = bracketText(openTok);
      pushText(out, "]", base + i, base + i + 1);
      i += 1;
      continue;
    }
    if (c === "*" || c === "_" || (c === "~" && s[i + 1] === "~")) {
      let n = 1;
      while (s[i + n] === c) n++;
      if (c === "~" && n !== 2) {
        pushText(out, s.slice(i, i + n), base + i, base + i + n);
        i += n;
        continue;
      }
      const { left, right } = flank(s[i - 1] ?? "", s[i + n] ?? "");
      const word = c === "_";
      out.push({
        kind: "delim",
        char: c as Delim["char"],
        count: n,
        canOpen: left && (!word || !right || PUNCT.test(s[i - 1] ?? "")),
        canClose: right && (!word || !left || PUNCT.test(s[i + n] ?? "")),
        start: base + i,
        end: base + i + n,
      });
      i += n;
      continue;
    }
    pushText(out, c, base + i, base + i + 1);
    i += 1;
  }
  // Any brackets that never closed are literal text; matchDelims merges adjacent text at the end.
  return sanitizeBrackets(out);
};

const toText = (d: Delim): MdInline => ({
  kind: "text",
  value: (d.char === "~" ? "~" : d.char).repeat(d.count),
  start: d.start,
  end: d.end,
});

const merge = (nodes: MdInline[]): MdInline[] => {
  const out: MdInline[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.kind === "text" && last?.kind === "text" && last.end === n.start) {
      last.value += n.value;
      last.end = n.end;
    } else out.push(n);
  }
  return out;
};

function matchDelims(toks: Node[]): MdInline[] {
  const stack: Node[] = [];
  const bottom = new Map<Delim["char"], number>([
    ["*", 0],
    ["_", 0],
    ["~", 0],
  ]);
  for (let tok of toks) {
    if (tok.kind !== "delim" || !tok.canClose) {
      stack.push(tok);
      continue;
    }
    // A closer may consume more than one opener run; loop until it is exhausted
    // or no opener remains, so a leftover count is handled in this same pass
    // (CommonMark keeps the closer "active" instead of re-scanning later).
    for (;;) {
      let found = -1;
      const low = bottom.get(tok.char) ?? 0;
      for (let k = stack.length - 1; k >= low; k--) {
        const o = stack[k] as Tok;
        if (o.kind === "delim" && o.char === tok.char && o.canOpen) {
          found = k;
          break;
        }
      }
      if (found === -1) {
        bottom.set(tok.char, stack.length);
        if (tok.canOpen) stack.push(tok);
        else stack.push(toText(tok));
        break;
      }
      const opener = stack[found] as Delim;
      const use: number = tok.char === "~" ? 2 : Math.min(opener.count, tok.count) >= 2 ? 2 : 1;
      const children = merge(
        stack.splice(found + 1).map((t) => (t.kind === "delim" ? toText(t) : t)),
      );
      const kind: "strike" | "strong" | "em" =
        tok.char === "~" ? "strike" : use === 2 ? "strong" : "em";
      opener.count -= use;
      const node: MdInline = { kind, children, start: opener.end - use, end: tok.start + use };
      opener.end -= use;
      if (opener.count === 0) stack.pop();
      stack.push(node);
      const rest: number = tok.count - use;
      if (rest <= 0) break;
      tok = { ...tok, count: rest, start: tok.start + use };
    }
  }
  return merge(stack.map((t) => (t.kind === "delim" ? toText(t) : t)));
}

/**
 * @function parseInlines
 * @param text {string} a block's raw inline text
 * @param offset {number} where text starts in the original markdown
 * @param refs {ReadonlyMap<string, string>} reference definitions, label (lowercased) to URL
 * @returns {MdInline[]} inline nodes; unmatched markers stay text
 */
export const parseInlines = (
  text: string,
  offset: number,
  refs: ReadonlyMap<string, string>,
): MdInline[] => matchDelims(tokenize(text, offset, refs));
