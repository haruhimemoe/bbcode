/**
 * @file src/template/index.ts
 * @desc @haruhimemoe/bbcode/template: BBCode templates with `{{key}}` placeholders, optional
 *       `{{#key}}...{{/key}}` sections and declared fields. Fill them from form values and find
 *       placeholders nobody declared.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 11, 2026
 */

import { FIELD_KINDS, type FieldKind, type FieldValue, formatValue } from "./format.js";

/** A field a template declares. */
export interface TemplateField {
  /** Placeholder key: letters, digits, `_`, `-` and `.`. Used as `{{key}}`. */
  key: string;
  /** Label for the form. */
  label: string;
  /** What the value is and how it's written into the BBCode. */
  kind: FieldKind;
  /** Filling fails without a value (or a default). */
  required?: boolean;
  /** Used when no value is given. */
  default?: string;
}

/** A field that couldn't be filled. Its placeholder is left in the text. */
export interface TemplateError {
  key: string;
  message: string;
}

/** The result of `fillTemplate`. */
export interface FillResult {
  /** The BBCode with every fillable placeholder replaced. */
  text: string;
  /** Problems, one per field. Empty when everything filled. */
  errors: TemplateError[];
}

/** The result of `templateFields`. */
export interface TemplateFieldsResult {
  /** Every placeholder key in the body, in first-use order. */
  keys: string[];
  /** Keys used in the body but not declared in `fields`. */
  undeclared: string[];
  /** Declared keys the body never uses. */
  unused: string[];
}

/** `{{key}}`, spaces allowed inside the braces. */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
/** A section's key list: one key, or keys joined by `|` (kept when any fills). */
const KEY_LIST = "[A-Za-z0-9_.-]+(?:\\|[A-Za-z0-9_.-]+)*";
/** A section's opening marker, `{{#key}}` or `{{#key|other}}`. */
const SECTION_OPEN = new RegExp(`\\{\\{\\s*#\\s*(${KEY_LIST})\\s*\\}\\}`, "g");
/** Either section marker: `{{#keys}}` opens, `{{/keys}}` closes. */
const MARKER = new RegExp(`\\{\\{\\s*([#/])\\s*(${KEY_LIST})\\s*\\}\\}`, "g");
const KEY = /^[A-Za-z0-9_.-]+$/;

/**
 * Lists the placeholders in a template body and compares them with the declared fields.
 * @function templateFields
 * @param {string} body - Template BBCode.
 * @param {readonly TemplateField[]} [fields] - Declared fields.
 * @returns {TemplateFieldsResult} Keys used, undeclared keys and unused fields.
 */
export function templateFields(
  body: string,
  fields: readonly TemplateField[] = [],
): TemplateFieldsResult {
  const found = [...body.matchAll(PLACEHOLDER), ...body.matchAll(SECTION_OPEN)].sort(
    (a, b) => a.index - b.index,
  );
  const keys = [...new Set(found.flatMap((m) => (m[1] as string).split("|")))];
  const declared = new Set(fields.map((f) => f.key));
  return {
    keys,
    undeclared: keys.filter((k) => !declared.has(k)),
    unused: [...declared].filter((k) => !keys.includes(k)),
  };
}

const isEmpty = (value: FieldValue | undefined): boolean =>
  value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (typeof value === "object" && value.length === 0);

/**
 * Fills a template. Each declared field's value is checked and written by kind: `user` and
 * `users` become `[profile]` links (a number is an id, text a name), `country` a flag image,
 * `color` a normalized `#rrggbb`, `url` an http(s) link, `number` and `date` (YYYY-MM-DD) as
 * given. Placeholders without a declared field, and fields with errors, stay as `{{key}}`.
 * @function fillTemplate
 * @param {string} body - Template BBCode.
 * @param {readonly TemplateField[]} fields - Declared fields.
 * @param {Readonly<Record<string, FieldValue>>} values - Values by key.
 * @returns {FillResult} The filled BBCode and any errors.
 */
export function fillTemplate(
  body: string,
  fields: readonly TemplateField[],
  values: Readonly<Record<string, FieldValue>>,
): FillResult {
  const errors: TemplateError[] = [];
  const filled = new Map<string, string>();
  for (const field of fields) {
    const error = (message: string): void => {
      errors.push({ key: field.key, message });
    };
    if (!KEY.test(field.key)) error("Keys use letters, digits, _, - and . only.");
    else if (filled.has(field.key) || errors.some((e) => e.key === field.key)) {
      error("This key is declared twice.");
    } else if (!(FIELD_KINDS as readonly string[]).includes(field.kind)) {
      error(`Unknown field kind "${field.kind}".`);
    } else {
      const given = Object.hasOwn(values, field.key) ? values[field.key] : undefined;
      const value = isEmpty(given) ? field.default : given;
      if (isEmpty(value)) {
        if (field.required) error("Required.");
        else filled.set(field.key, "");
      } else {
        const out = formatValue(field.kind, value as FieldValue);
        if (typeof out === "string") filled.set(field.key, out);
        else error(out.error);
      }
    }
  }
  const text = fillSections(body, filled).replace(
    PLACEHOLDER,
    (whole, key: string) => filled.get(key) ?? whole,
  );
  return { text, errors };
}

/** A section found in a body: its keys, where its markers sit, and the sections inside it. */
interface Section {
  keys: string;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
  children: Section[];
}

const byStart = (a: Section, b: Section): number => a.start - b.start;

/**
 * Pairs every `{{#keys}}` with the next `{{/keys}}` of the same keys that closes it, in one
 * pass. An opening marker never closed, and a closing one with no opening, are plain text; the
 * sections inside an unclosed one belong to what holds it.
 */
function parseSections(src: string): Section[] {
  const root: Section[] = [];
  const stack: { keys: string; start: number; openEnd: number; children: Section[] }[] = [];
  const holder = (): Section[] => stack.at(-1)?.children ?? root;
  for (const m of src.matchAll(MARKER)) {
    const [whole, kind, keys] = m as unknown as [string, string, string];
    if (kind === "#") {
      stack.push({ keys, start: m.index, openEnd: m.index + whole.length, children: [] });
      continue;
    }
    const at = stack.findLastIndex((frame) => frame.keys === keys);
    if (at < 0) continue;
    const frame = stack[at] as (typeof stack)[number];
    for (const lost of stack.splice(at + 1)) frame.children.push(...lost.children);
    stack.pop();
    holder().push({
      ...frame,
      children: frame.children.sort(byStart),
      closeStart: m.index,
      end: m.index + whole.length,
    });
  }
  // Openings never closed are text: what they held belongs to what holds them.
  for (let lost = stack.pop(); lost; lost = stack.pop()) holder().push(...lost.children);
  return root.sort(byStart);
}

/** How long the line break right at `at` is: 2 for CRLF, 1 for LF, 0 for none. */
const breakAt = (src: string, at: number): number =>
  src.startsWith("\r\n", at) ? 2 : src[at] === "\n" ? 1 : 0;

/**
 * Keeps each section whose field filled to something (any of them, for `{{#a|b}}`) and drops
 * the rest. A section that fills whole lines takes its own line breaks with it, CRLF or LF.
 * Sections naming a field that isn't declared or didn't fill stay as written (the sections
 * inside them still resolve).
 */
function renderSections(
  src: string,
  from: number,
  to: number,
  sections: readonly Section[],
  filled: ReadonlyMap<string, string>,
): string {
  let out = "";
  let pos = from;
  for (const section of sections) {
    out += src.slice(pos, section.start);
    pos = section.end;
    const inner = () =>
      renderSections(src, section.openEnd, section.closeStart, section.children, filled);
    const values = section.keys.split("|").map((key) => filled.get(key));
    if (values.some((value) => value === undefined)) {
      out += src.slice(section.start, section.openEnd) + inner();
      out += src.slice(section.closeStart, section.end);
      continue;
    }
    const lineBreak = breakAt(src, section.end);
    const lineStart = section.start === 0 || src[section.start - 1] === "\n";
    const lineEnd = lineBreak > 0 || section.end === src.length;
    if (values.every((value) => value === "")) {
      if (!lineStart || !lineEnd) continue;
      pos = section.end + lineBreak;
      // A whole-line section at the very end also takes the line break before it.
      if (lineBreak === 0) out = out.replace(/\r?\n$/, "");
      continue;
    }
    let kept = inner();
    if (lineStart) kept = kept.replace(/^\r?\n/, "");
    if (lineEnd) kept = kept.replace(/\r?\n$/, "");
    out += kept;
  }
  return out + src.slice(pos, to);
}

/** Resolves every section in `body` against the filled values. */
function fillSections(body: string, filled: ReadonlyMap<string, string>): string {
  return renderSections(body, 0, body.length, parseSections(body), filled);
}

export { FIELD_KINDS, type FieldKind, type FieldValue } from "./format.js";
