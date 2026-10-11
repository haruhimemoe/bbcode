/**
 * @file src/markdown/to-markdown.ts
 * @desc toMarkdown: walks the parse tree and writes markdown, noting each tag markdown can't say.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import type { Document, Node, TagNode } from "../ast.js";
import { parse } from "../parse.js";
import { escapeMarkdown } from "./escape.js";
import type { Conversion, Loss, ToMarkdownOptions } from "./types.js";

const WRAP: Record<string, string> = { b: "**", i: "*", s: "~~" };
const DROPPED = new Set(["u", "color", "size", "spoiler", "centre", "left", "right", "notice"]);

type Ctx = { lost: Loss[]; boxStyle: "bold-title" | "quote" };

const lose = (ctx: Ctx, node: TagNode, what: string): void => {
  ctx.lost.push({
    code: "no-equivalent",
    message: `[${node.tag}] has no markdown form, kept ${what}.`,
    start: node.start,
    end: node.end,
  });
};

const rawText = (node: TagNode): string =>
  node.children.map((c) => (c.type === "text" ? c.value : c.open)).join("");

const prefix = (text: string, mark: string): string =>
  text
    .split("\n")
    .map((line) => (line ? `${mark}${line}` : mark.trimEnd()))
    .join("\n");

const inline = (nodes: Node[], ctx: Ctx, lineStart: boolean): string => {
  let out = "";
  for (const node of nodes) {
    const atStart = lineStart && (out === "" || out.endsWith("\n"));
    out += node.type === "text" ? escapeMarkdown(node.value, atStart) : tag(node, ctx, atStart);
  }
  return out;
};

const listItems = (node: TagNode, ctx: Ctx): string => {
  const items = node.children.filter((c): c is TagNode => c.type === "tag" && c.name === "*");
  return items
    .map((item, i) => {
      const mark = node.arg ? `${i + 1}. ` : "- ";
      const body = inline(item.children, ctx, true).trim();
      return mark + body.replace(/\n/g, `\n${" ".repeat(mark.length)}`);
    })
    .join("\n");
};

const tag = (node: TagNode, ctx: Ctx, lineStart: boolean): string => {
  const wrap = WRAP[node.name];
  if (wrap) return `${wrap}${inline(node.children, ctx, false)}${wrap}`;
  if (DROPPED.has(node.name)) {
    lose(ctx, node, "the text");
    return inline(node.children, ctx, lineStart);
  }
  switch (node.name) {
    case "heading":
      return `## ${inline(node.children, ctx, false)}`;
    case "c":
      return `\`${rawText(node)}\``;
    case "code":
      return `\`\`\`\n${rawText(node).replace(/^\n|\n$/g, "")}\n\`\`\``;
    case "quote": {
      const body = inline(node.children, ctx, true).trim();
      const head = node.arg ? `**${node.arg}** wrote:\n` : "";
      return prefix(head + body, "> ");
    }
    case "list":
      return listItems(node, ctx);
    case "url": {
      const href = node.arg ?? rawText(node);
      return node.arg ? `[${inline(node.children, ctx, false)}](${href})` : `<${href}>`;
    }
    case "email":
      return `<mailto:${node.arg ?? rawText(node)}>`;
    case "img":
      return `![](${rawText(node)})`;
    case "profile": {
      const name = rawText(node);
      return `[${name}](https://osu.ppy.sh/users/${encodeURIComponent(node.arg ?? name)})`;
    }
    case "youtube":
      return `<https://www.youtube.com/watch?v=${rawText(node)}>`;
    case "audio":
      return `<${rawText(node)}>`;
    case "box": {
      lose(ctx, node, "the title and text");
      const title = node.arg ?? "";
      const body = inline(node.children, ctx, true).trim();
      return ctx.boxStyle === "quote"
        ? prefix(`**${title}**\n${body}`, "> ")
        : `**${title}**\n\n${body}`;
    }
    case "imagemap": {
      lose(ctx, node, "the image and its links");
      const [src = "", ...areas] = rawText(node).trim().split("\n");
      const links = areas
        .map((line) => line.trim().split(/\s+/))
        .filter((parts) => parts.length >= 5)
        .map((parts) => `- [${parts.slice(5).join(" ") || parts[4]}](${parts[4]})`);
      return [`![](${src.trim()})`, ...links].join("\n");
    }
    default:
      return node.open + inline(node.children, ctx, false) + (node.close ?? "");
  }
};

/**
 * @function toMarkdown
 * @param input {string | Document} BBCode, or a tree from parse
 * @param options {ToMarkdownOptions} boxStyle
 * @returns {Conversion} markdown, and each tag markdown can't say (its text is kept)
 */
export const toMarkdown = (
  input: string | Document,
  options: ToMarkdownOptions = {},
): Conversion => {
  const doc = typeof input === "string" ? parse(input) : input;
  const ctx: Ctx = { lost: [], boxStyle: options.boxStyle ?? "bold-title" };
  const output = inline(doc.children, ctx, true);
  return { output, lost: ctx.lost };
};
