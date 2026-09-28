/**
 * @file src/template/format.ts
 * @desc Turns one field value into BBCode according to the field's kind, or explains why it
 *       can't. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { findCountry } from "../flags/index.js";
import { normalizeColor } from "../helpers/color.js";
import { flag, profile } from "../helpers/index.js";
import { isLinkUrl } from "../safety.js";

/** Every field kind a template can declare. Frozen. */
export const FIELD_KINDS = Object.freeze([
  "text",
  "multiline",
  "number",
  "date",
  "url",
  "user",
  "users",
  "country",
  "color",
] as const);

/** One of `FIELD_KINDS`. */
export type FieldKind = (typeof FIELD_KINDS)[number];

/** A value for a field: text, a number, or a list (for `users`). */
export type FieldValue = string | number | readonly (string | number)[];

/** Thrown inside formatting; caught by fillTemplate and reported. */
class FieldError extends Error {}

const fail = (message: string): never => {
  throw new FieldError(message);
};

const oneLine = (text: string): string =>
  /[\r\n]/.test(text) ? fail("Keep this on one line.") : text;

function user(value: string | number): string {
  if (typeof value === "number") return profile(value);
  const name = value.trim();
  return /^\d+$/.test(name) ? profile(Number(name)) : profile(oneLine(name));
}

function scalar(kind: FieldKind, value: string | number): string {
  const text = String(value);
  switch (kind) {
    case "text":
      return oneLine(text);
    case "multiline":
      return text.replace(/\r\n?/g, "\n");
    case "number": {
      const n = typeof value === "number" ? value : Number(text.trim());
      return text.trim() !== "" && Number.isFinite(n) ? String(n) : fail("Enter a number.");
    }
    case "date": {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));
      return ok ? text : fail("Enter a date as YYYY-MM-DD.");
    }
    case "url":
      return isLinkUrl(text) ? text : fail("Enter a link starting with http:// or https://.");
    case "country":
      return findCountry(text.trim())
        ? flag(text.trim())
        : fail("Enter a two-letter country code.");
    case "color":
      try {
        return normalizeColor(text.trim());
      } catch {
        return fail("Enter a color like #ff66aa.");
      }
    default:
      return user(value);
  }
}

/**
 * Formats a value for a field kind.
 * @returns BBCode, or `{ error }` with a message.
 */
export function formatValue(kind: FieldKind, value: FieldValue): string | { error: string } {
  try {
    if (kind === "users") {
      const entries = typeof value === "object" ? [...value] : String(value).split(/\r?\n/);
      return entries
        .filter((v) => String(v).trim() !== "")
        .map(user)
        .join("\n");
    }
    if (typeof value === "object") return fail("Enter a single value.");
    return scalar(kind, value);
  } catch (error) {
    if (error instanceof FieldError || error instanceof TypeError) return { error: error.message };
    throw error;
  }
}
