/**
 * @file src/parser/nodes.ts
 * @desc Small node helpers for the tree builder: append text, append a node (merging adjacent
 *       text), and flatten a tag back into text when osu! wouldn't treat it as one. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Node, TagNode } from "../ast.js";

/** Appends a node, merging it into the previous text node when both are adjacent text. */
export function pushNode(children: Node[], node: Node): void {
  const last = children[children.length - 1];
  if (node.type === "text" && last?.type === "text" && last.end === node.start) {
    last.value += node.value;
    last.end = node.end;
    return;
  }
  children.push(node);
}

/** Appends `src.slice(start, end)` as text. Does nothing for an empty range. */
export function pushText(children: Node[], src: string, start: number, end: number): void {
  if (end <= start) return;
  pushNode(children, { type: "text", value: src.slice(start, end), start, end });
}

/**
 * Appends an unclosed tag to `children` as text: its opening tag, then its children. List items
 * inside it are flattened too, since `[*]` means nothing outside a list.
 */
export function flattenInto(children: Node[], node: TagNode): void {
  const openEnd = node.start + node.open.length;
  pushNode(children, { type: "text", value: node.open, start: node.start, end: openEnd });
  for (const child of node.children) {
    if (child.type === "tag" && child.name === "*") flattenInto(children, child);
    else pushNode(children, child);
  }
  if (node.close !== null) {
    const closeStart = node.end - node.close.length;
    pushNode(children, { type: "text", value: node.close, start: closeStart, end: node.end });
  }
}

/** A new tag node for an opening token, not yet closed. */
export function openNode(
  name: string,
  tag: string,
  arg: string | null,
  src: string,
  start: number,
  end: number,
): TagNode {
  return {
    type: "tag",
    name,
    tag,
    arg,
    open: src.slice(start, end),
    close: null,
    children: [],
    start,
    end,
  };
}
