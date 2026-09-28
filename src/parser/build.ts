/**
 * @file src/parser/build.ts
 * @desc The tree builder behind `parse` and `lint`. Pairs tags the way osu!'s regex passes do
 *       (see rules.ts) and records why a tag stayed text, so lint can explain it. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Document, Node, TagNode } from "../ast.js";
import { flattenInto, openNode, pushNode, pushText } from "./nodes.js";
import { type RawProblem, RULES, type Rule } from "./rules.js";
import { scanToken, type Token } from "./scan.js";

/** Why a tag token stayed text, or a note about one. */
export type ParseEvent =
  | {
      kind: "unclosed";
      tag: string;
      start: number;
      end: number;
      reason: "eof" | "crossed" | "line";
    }
  | { kind: "stray-close"; tag: string; start: number; end: number }
  | { kind: "self-nested"; tag: string; start: number; end: number }
  | { kind: "stray-item"; start: number; end: number }
  | {
      kind: "raw";
      tag: string;
      problem: RawProblem;
      start: number;
      end: number;
      content: [number, number];
    };

/** A parsed document plus what the builder noticed on the way. */
export interface BuildResult {
  doc: Document;
  events: ParseEvent[];
  /** Offsets of every `[` that began a tag token osu! recognizes. */
  tokenStarts: Set<number>;
}

interface Frame {
  node: TagNode | null;
  children: Node[];
}

/**
 * Parses `src` into a tree, collecting events.
 * @param src - BBCode source.
 * @returns The document, events and recognized token offsets.
 */
export function build(src: string): BuildResult {
  const root: Node[] = [];
  const stack: Frame[] = [{ node: null, children: root }];
  const events: ParseEvent[] = [];
  const tokenStarts = new Set<number>();
  const failedCloses = new Set<number>();
  let textStart = 0;

  const top = (): Frame => stack[stack.length - 1] as Frame;
  const flush = (to: number): void => {
    pushText(top().children, src, textStart, to);
    textStart = Math.max(textStart, to);
  };
  const push = (node: TagNode): void => {
    stack.push({ node, children: node.children });
    textStart = node.end;
  };
  /** Pops the top frame as a closed node ending at `end`. */
  const finish = (end: number, close: string | null): void => {
    const node = (stack.pop() as Frame).node as TagNode;
    node.close = close;
    node.end = end;
    pushNode(top().children, node);
  };
  /** Pops the top frame as text. */
  const unwind = (reason: "eof" | "crossed"): void => {
    const node = (stack.pop() as Frame).node as TagNode;
    if (node.name !== "*") {
      const end = node.start + node.open.length;
      events.push({ kind: "unclosed", tag: node.tag, start: node.start, end, reason });
    }
    flattenInto(top().children, node);
  };

  const openRaw = (tok: Token, rule: Rule): number => {
    const closeTag = `[/${tok.tag}]`;
    const closeAt = src.indexOf(closeTag, tok.end);
    if (closeAt < 0) {
      events.push({
        kind: "unclosed",
        tag: tok.tag,
        start: tok.start,
        end: tok.end,
        reason: "eof",
      });
      return tok.end;
    }
    const content = src.slice(tok.end, closeAt);
    let problem = rule.checkRaw(content, tok.arg !== null);
    if (!problem && rule.singleLine && /[\r\n]/.test(content)) problem = "newline";
    if (problem) {
      failedCloses.add(closeAt);
      const range: [number, number] = [tok.end, closeAt];
      events.push({
        kind: "raw",
        tag: tok.tag,
        problem,
        start: tok.start,
        end: tok.end,
        content: range,
      });
      return tok.end;
    }
    flush(tok.start);
    const closeEnd = closeAt + closeTag.length;
    const node = openNode(rule.name, tok.tag, tok.arg, src, tok.start, tok.end);
    pushText(node.children, src, tok.end, closeAt);
    node.close = closeTag;
    node.end = closeEnd;
    pushNode(top().children, node);
    tokenStarts.add(closeAt);
    textStart = closeEnd;
    return closeEnd;
  };

  const open = (tok: Token): number => {
    const rule = RULES.get(tok.tag) as Rule;
    const mode = rule.mode(tok.arg !== null);
    if (mode === "raw") return openRaw(tok, rule);
    if (mode === "lazy") {
      if (stack.some((f) => f.node?.tag === tok.tag)) {
        events.push({ kind: "self-nested", tag: tok.tag, start: tok.start, end: tok.end });
        return tok.end;
      }
      if (rule.singleLine) {
        const closeAt = src.indexOf(`[/${tok.tag}]`, tok.end);
        const empty = tok.tag === "url" && closeAt === tok.end;
        if (closeAt < 0 || empty || /[\r\n]/.test(src.slice(tok.end, closeAt))) {
          events.push({
            kind: "unclosed",
            tag: tok.tag,
            start: tok.start,
            end: tok.end,
            reason: "line",
          });
          return tok.end;
        }
      }
    }
    flush(tok.start);
    push(openNode(rule.name, tok.tag, tok.arg, src, tok.start, tok.end));
    return tok.end;
  };

  const item = (tok: Token): number => {
    const name = top().node?.name;
    if (tok.kind === "close") {
      if (name !== "*") {
        events.push({ kind: "stray-close", tag: "*", start: tok.start, end: tok.end });
        return tok.end;
      }
      flush(tok.start);
      finish(tok.end, src.slice(tok.start, tok.end));
      textStart = tok.end;
      return tok.end;
    }
    if (name !== "*" && name !== "list") {
      events.push({ kind: "stray-item", start: tok.start, end: tok.end });
      return tok.end;
    }
    flush(tok.start);
    if (name === "*") finish(tok.start, null);
    push(openNode("*", "*", null, src, tok.start, tok.end));
    return tok.end;
  };

  const close = (tok: Token): number => {
    let idx = stack.length - 1;
    while (idx > 0 && stack[idx]?.node?.tag !== tok.tag) idx--;
    if (idx === 0) {
      if (!failedCloses.has(tok.start)) {
        events.push({ kind: "stray-close", tag: tok.tag, start: tok.start, end: tok.end });
      }
      return tok.end;
    }
    flush(tok.start);
    while (stack.length - 1 > idx) {
      const implicitItem = top().node?.name === "*" && stack.length - 2 === idx;
      if (implicitItem) finish(tok.start, null);
      else unwind("crossed");
    }
    finish(tok.end, src.slice(tok.start, tok.end));
    textStart = tok.end;
    return tok.end;
  };

  let i = 0;
  while (i < src.length) {
    const at = src.indexOf("[", i);
    if (at < 0) break;
    const tok = scanToken(src, at);
    if (!tok) {
      i = at + 1;
      continue;
    }
    tokenStarts.add(at);
    if (tok.tag === "*") i = item(tok);
    else i = tok.kind === "open" ? open(tok) : close(tok);
  }
  flush(src.length);
  while (stack.length > 1) unwind("eof");
  return { doc: { type: "document", source: src, children: root }, events, tokenStarts };
}
