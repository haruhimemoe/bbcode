/**
 * @file src/parser/rules.ts
 * @desc How each tag pairs and what its argument and content must look like for osu! to treat
 *       it as a tag. Keyed by the name as written. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { TagArg } from "../tags.js";

/**
 * How a tag pairs with its close. `lazy`: first close after it, can't contain itself. `nest`:
 * stack pairing, can contain itself. `raw`: first close after it, content not parsed.
 */
export type Mode = "lazy" | "nest" | "raw";

/** Why a raw tag's content was refused. */
export type RawProblem = "empty" | "bracket" | "url" | "email" | "newline";

/** Parser rules for one written tag name. */
export interface Rule {
  /** The name as written (`"strike"`). */
  readonly written: string;
  /** The canonical name from TAGS (`"s"`). */
  readonly name: string;
  readonly arg: TagArg;
  /** How the argument is delimited: up to `]`, balanced brackets, or `"..."`. */
  readonly argForm: "plain" | "balanced" | "quoted";
  readonly checkArg: (arg: string) => boolean;
  /** Mode with and without an argument (`[url]` is raw, `[url=...]` is lazy). */
  readonly mode: (hasArg: boolean) => Mode;
  readonly singleLine: boolean;
  /** For raw tags: checks the content, returning why it isn't valid or `null`. */
  readonly checkRaw: (content: string, hasArg: boolean) => RawProblem | null;
}

/** osu!'s email pattern, anchored. */
export const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z-]+$/;
/** A `[color=]` argument osu! accepts. */
export const COLOR_ARG = /^(?:#[0-9A-Fa-f]{6}|[A-Za-z]+)$/;
/** A link URL osu! accepts in `[url]`. */
export const LINK_URL = /^(?:https?|ftp):\/\/./;
const DIGITS = /^\d+$/;

const any = (): boolean => true;
const nonEmpty = (arg: string): boolean => arg.length > 0;
const always = (mode: Mode) => (): Mode => mode;
const noRaw = (): null => null;

/** Content checks for raw tags. */
const rawCheck = {
  any: (content: string): RawProblem | null => (content === "" ? "empty" : null),
  noBracket: (content: string): RawProblem | null => {
    if (content === "") return "empty";
    return content.includes("[") ? "bracket" : null;
  },
  url: (content: string, hasArg: boolean): RawProblem | null => {
    if (content === "") return "empty";
    return hasArg || LINK_URL.test(content) ? null : "url";
  },
  email: (content: string, hasArg: boolean): RawProblem | null => {
    if (content === "") return "empty";
    return hasArg || EMAIL.test(content) ? null : "email";
  },
};

const rule = (written: string, extra: Partial<Rule> = {}): Rule => ({
  written,
  name: written,
  arg: "none",
  argForm: "plain",
  checkArg: any,
  mode: always("lazy"),
  singleLine: false,
  checkRaw: noRaw,
  ...extra,
});

const raw = always("raw");
const nest = always("nest");

const LIST: Rule[] = [
  rule("b"),
  rule("i"),
  rule("u"),
  rule("s"),
  rule("strike", { name: "s" }),
  rule("spoiler"),
  rule("color", { arg: "required", checkArg: (a) => COLOR_ARG.test(a) }),
  rule("size", { arg: "required", checkArg: (a) => DIGITS.test(a) }),
  rule("centre"),
  rule("left"),
  rule("right"),
  rule("heading", { singleLine: true }),
  rule("c", { singleLine: true }),
  rule("code", { mode: raw, checkRaw: rawCheck.any }),
  rule("notice"),
  rule("box", { arg: "required", argForm: "balanced", mode: nest }),
  rule("spoilerbox", { mode: nest }),
  rule("quote", { arg: "optional", argForm: "quoted", checkArg: nonEmpty, mode: nest }),
  rule("list", { arg: "optional", checkArg: nonEmpty, mode: nest }),
  rule("url", {
    arg: "optional",
    checkArg: (a) => LINK_URL.test(a),
    mode: (hasArg) => (hasArg ? "lazy" : "raw"),
    singleLine: true,
    checkRaw: rawCheck.url,
  }),
  rule("email", {
    arg: "optional",
    checkArg: (a) => EMAIL.test(a),
    mode: raw,
    singleLine: true,
    checkRaw: rawCheck.email,
  }),
  rule("img", { mode: raw, checkRaw: rawCheck.noBracket }),
  rule("audio", { mode: raw, singleLine: true, checkRaw: rawCheck.noBracket }),
  rule("youtube", { mode: raw, singleLine: true, checkRaw: rawCheck.any }),
  rule("profile", {
    arg: "optional",
    checkArg: (a) => DIGITS.test(a),
    mode: raw,
    singleLine: true,
    checkRaw: rawCheck.any,
  }),
  rule("imagemap", { mode: raw, checkRaw: rawCheck.any }),
];

/** Rules by the name as written. `*` (list items) is handled by the tree builder. */
export const RULES: ReadonlyMap<string, Rule> = new Map(LIST.map((r) => [r.written, r]));
