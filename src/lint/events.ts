/**
 * @file src/lint/events.ts
 * @desc Turns what the tree builder noticed (unclosed, stray and self-nested tags, refused raw
 *       content) into diagnostics. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { LIMITS } from "../limits.js";
import type { ParseEvent } from "../parser/build.js";
import type { Diagnostic } from "./types.js";

const MEDIA = new Set(["img", "audio", "url", "email", "youtube"]);

function unclosed(e: Extract<ParseEvent, { kind: "unclosed" }>): Diagnostic {
  const tag = `[${e.tag}]`;
  if (e.reason === "box") {
    const message = `${tag} is never closed, so on osu! the box runs to the end of what holds it.`;
    return { code: "unclosed-tag", severity: "warning", message, start: e.start, end: e.end };
  }
  const message =
    e.reason === "line"
      ? `${tag} must be closed on the same line, or osu! shows it as text.`
      : e.reason === "crossed"
        ? `${tag} is still open when the tag around it closes, so osu! shows it as text. Close tags in reverse order.`
        : `${tag} is never closed, so osu! shows it as text.`;
  return { code: "unclosed-tag", severity: "error", message, start: e.start, end: e.end };
}

function raw(e: Extract<ParseEvent, { kind: "raw" }>, src: string): Diagnostic {
  const tag = `[${e.tag}]`;
  const at = { start: e.start, end: e.end };
  if (e.problem === "newline") return unclosed({ ...e, kind: "unclosed", reason: "line" });
  if (e.problem === "bracket" && e.tag === "img") {
    const message = "Image URLs can't contain [, so osu! shows this as text.";
    return { code: "img-bracket", severity: "error", message, ...at };
  }
  if (!MEDIA.has(e.tag)) {
    const message = `${tag} is empty, so osu! shows it as text.`;
    return { code: "unclosed-tag", severity: "error", message, ...at };
  }
  const content = src.slice(e.content[0], e.content[1]);
  const what: Record<string, string> = {
    empty: `${tag} is empty, so osu! shows it as text.`,
    bracket: `${tag} URLs can't contain [, so osu! shows this as text.`,
    url: `${tag} needs a link starting with http://, https:// or ftp://.`,
    email: `${tag} needs an email address like name@example.com.`,
  };
  const d: Diagnostic = {
    code: "bad-url",
    severity: "error",
    message: what[e.problem] as string,
    ...at,
  };
  if (e.problem === "url" && content.startsWith("www.")) {
    d.fix = { start: e.content[0], end: e.content[0], text: "https://" };
  }
  return d;
}

/**
 * Diagnostics for the builder's events.
 * @param events - From `build`.
 * @param src - The linted text.
 * @returns One diagnostic per event.
 */
export function eventDiagnostics(events: readonly ParseEvent[], src: string): Diagnostic[] {
  return events.map((e): Diagnostic => {
    const at = { start: e.start, end: e.end };
    switch (e.kind) {
      case "unclosed":
        return unclosed(e);
      case "raw":
        return raw(e, src);
      case "stray-close":
        return {
          code: "stray-close",
          severity: "warning",
          message: `[/${e.tag}] has no opening tag, so osu! shows it as text.`,
          ...at,
          fix: { ...at, text: "" },
        };
      case "self-nested":
        return {
          code: "self-nested",
          severity: "warning",
          message: `[${e.tag}] inside another [${e.tag}] doesn't work on osu!: the inner one shows as text and the outer one ends at the first [/${e.tag}].`,
          ...at,
        };
      case "too-deep":
        return {
          code: "too-deep",
          severity: "warning",
          message: `Tags nest more than ${LIMITS.nesting} deep from here, so the preview shows the rest as text.`,
          ...at,
        };
      default:
        return {
          code: "unknown-tag",
          severity: "warning",
          message: "[*] only works inside [list].",
          ...at,
        };
    }
  });
}
