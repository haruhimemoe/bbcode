/**
 * @file src/lint/scan.ts
 * @desc Finds bracketed text that looks like a tag but isn't one osu! accepts: `[center]`,
 *       `[B]`, `[color=#fff]`, `[size=big]`, `[quote=name]`, `[font=...]`. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { RULES } from "../parser/rules.js";
import type { Diagnostic, Fix } from "./types.js";

const LOOKS_LIKE_TAG = /\[(\/?)([A-Za-z][A-Za-z0-9]*)(=[^\]\n[]*)?\]/g;

/** Common BBCode tags from other forums that osu! doesn't support. */
const FOREIGN = new Set(
  "font align justify indent table tr td th hr sub sup video h1 h2 h3 h4 h5 h6 ul ol li pre small big highlight glow shadow link a image mail strikethrough".split(
    " ",
  ),
);

function colorFix(arg: string): string | null {
  if (/^#[0-9A-Fa-f]{3}$/.test(arg)) return `#${[...arg.slice(1)].map((c) => c + c).join("")}`;
  if (/^[0-9A-Fa-f]{6}$/.test(arg)) return `#${arg}`;
  return null;
}

/** Diagnoses a known tag whose argument osu! refuses. */
function badArg(name: string, slash: string, arg: string | null, at: Fix): Diagnostic {
  const range = { start: at.start, end: at.end };
  const tag = `[${slash}${name}]`;
  const value = arg === null ? null : arg.slice(1);
  const rule = RULES.get(name);
  if (slash || rule?.arg === "none") {
    const message = `${tag} takes no argument, so osu! shows this as text.`;
    return {
      code: "unknown-tag",
      severity: "warning",
      message,
      ...range,
      fix: { ...at, text: tag },
    };
  }
  if (name === "color") {
    const fixed = value === null ? null : colorFix(value);
    const message = "[color=] takes #rrggbb (six hex digits) or a color name made of letters.";
    const d: Diagnostic = { code: "bad-color", severity: "error", message, ...range };
    if (fixed) d.fix = { ...at, text: `[color=${fixed}]` };
    return d;
  }
  if (name === "size") {
    const message = "[size=] takes a whole number of percent, like 150.";
    return { code: "bad-size", severity: "error", message, ...range };
  }
  if (name === "url" || name === "email") {
    const message =
      name === "url"
        ? "[url=] needs a link starting with http://, https:// or ftp://."
        : "[email=] needs an email address like name@example.com.";
    const d: Diagnostic = { code: "bad-url", severity: "error", message, ...range };
    if (value?.startsWith("www.")) d.fix = { ...at, text: `[url=https://${value}]` };
    return d;
  }
  if (name === "quote" && value) {
    const message = 'osu! wants the name in quotes: [quote="name"].';
    const fix = { ...at, text: `[quote="${value.replace(/^"|"$/g, "")}"]` };
    return { code: "unknown-tag", severity: "warning", message, ...range, fix };
  }
  const message =
    name === "box"
      ? "[box] needs a title: [box=Title]. Use [spoilerbox] for a box without one."
      : name === "profile"
        ? "[profile=] takes a numeric user id."
        : `osu! doesn't accept this argument for [${name}], so it shows as text.`;
  return { code: "unknown-tag", severity: "warning", message, ...range };
}

/**
 * Reports bracketed text that looks like a tag osu! doesn't accept.
 * @param src - The linted text.
 * @param tokenStarts - Offsets of real tag tokens, which are skipped.
 * @param rawRanges - Content of raw tags (code, img...), which is skipped.
 * @param failedOpens - Opening tags osu! refuses are pushed here as `[name, start]`.
 * @returns Diagnostics, in source order.
 */
export function scanText(
  src: string,
  tokenStarts: ReadonlySet<number>,
  rawRanges: readonly [number, number][],
  failedOpens: [string, number][],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const m of src.matchAll(LOOKS_LIKE_TAG)) {
    const start = m.index as number;
    if (tokenStarts.has(start) || rawRanges.some(([a, b]) => start >= a && start < b)) continue;
    const [whole, slash = "", name = "", arg] = m;
    const at: Fix = { start, end: start + whole.length, text: "" };
    const range = { start: at.start, end: at.end };
    const lower = name.toLowerCase();
    const rest = arg ?? "";
    if (lower === "center") {
      const message = "osu! spells it [centre]; [center] shows as text.";
      const fix = { ...at, text: `[${slash}centre${rest}]` };
      out.push({ code: "unknown-tag", severity: "warning", message, ...range, fix });
    } else if (RULES.has(name)) {
      if (!slash) failedOpens.push([name, start]);
      out.push(badArg(name, slash, arg ?? null, at));
    } else if (RULES.has(lower)) {
      const message = `osu! tags are lowercase: [${slash}${name}] shows as text.`;
      const fix = { ...at, text: `[${slash}${lower}${rest}]` };
      out.push({ code: "unknown-tag", severity: "warning", message, ...range, fix });
    } else if (FOREIGN.has(lower)) {
      const message = `osu! doesn't support [${lower}], so it shows as text.`;
      out.push({ code: "unknown-tag", severity: "warning", message, ...range });
    }
  }
  return out;
}
