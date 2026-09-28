/**
 * @file src/parse.ts
 * @desc `parse` and `serialize`: BBCode to a tree with source ranges, and back, losslessly.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Document, Node } from "./ast.js";
import { build } from "./parser/build.js";

/**
 * Parses osu! BBCode into a tree. Never throws: tags osu! would show as text (unclosed, unknown,
 * a bad argument) become text nodes, like on osu!.
 * @function parse
 * @param {string} text - BBCode source.
 * @returns {Document} The tree. Every character of `text` is in exactly one node.
 */
export function parse(text: string): Document {
  return build(text).doc;
}

function write(nodes: readonly Node[], out: string[]): void {
  for (const node of nodes) {
    if (node.type === "text") {
      out.push(node.value);
      continue;
    }
    out.push(node.open);
    write(node.children, out);
    if (node.close !== null) out.push(node.close);
  }
}

/**
 * Turns a tree back into BBCode. `serialize(parse(text)) === text` for any input.
 * @function serialize
 * @param {Document | readonly Node[]} doc - A document, or a list of nodes.
 * @returns {string} The BBCode.
 */
export function serialize(doc: Document | readonly Node[]): string {
  const out: string[] = [];
  write("children" in doc ? doc.children : doc, out);
  return out.join("");
}
