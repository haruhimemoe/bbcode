/**
 * @file src/render/eat.ts
 * @desc Newline eating: block tags swallow newlines next to them, so a box on its own line
 *       doesn't leave a gap. The amounts follow what osu! renders. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** How much to eat: up to N newlines (`Infinity` for all), or `"ws"` for all whitespace. */
export type Eat = number | "ws";

/** What a tag eats right after its opening tag, right before its close, and after its close. */
export interface EatRule {
  readonly afterOpen: Eat;
  readonly beforeClose: Eat;
  readonly afterClose: Eat;
}

const NONE: EatRule = { afterOpen: 0, beforeClose: 0, afterClose: 0 };
const WRAPPED: EatRule = { afterOpen: Infinity, beforeClose: Infinity, afterClose: 1 };
const ALIGN: EatRule = { afterOpen: 1, beforeClose: 0, afterClose: 1 };
const AFTER_ONE: EatRule = { afterOpen: 0, beforeClose: 0, afterClose: 1 };

const RULES: Record<string, EatRule> = {
  box: WRAPPED,
  spoilerbox: WRAPPED,
  notice: WRAPPED,
  code: WRAPPED,
  quote: { afterOpen: "ws", beforeClose: "ws", afterClose: 2 },
  list: { afterOpen: 0, beforeClose: "ws", afterClose: 2 },
  heading: AFTER_ONE,
  imagemap: AFTER_ONE,
  centre: ALIGN,
  left: ALIGN,
  right: ALIGN,
};

/** The eating rule for a canonical tag name. */
export function eatRule(name: string): EatRule {
  return RULES[name] ?? NONE;
}

/** Removes what `eat` allows from the start of `text`. */
export function eatStart(text: string, eat: Eat): string {
  if (eat === "ws") return text.replace(/^\s+/, "");
  let out = text;
  for (let n = 0; n < eat; n++) {
    const next = out.replace(/^\r?\n/, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Removes what `eat` allows from the end of `text`. */
export function eatEnd(text: string, eat: Eat): string {
  if (eat === "ws") return text.replace(/\s+$/, "");
  let out = text;
  for (let n = 0; n < eat; n++) {
    const next = out.replace(/\r?\n$/, "");
    if (next === out) break;
    out = next;
  }
  return out;
}
