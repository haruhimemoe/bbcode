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
/** A section's opening marker, `{{#key}}`. */
const SECTION_OPEN = /\{\{\s*#\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
/** An innermost section: `{{#key}}`, text without another opening, `{{/key}}`, a line break. */
const SECTION =
  /\{\{\s*#\s*([A-Za-z0-9_.-]+)\s*\}\}((?:(?!\{\{\s*#)[\s\S])*?)\{\{\s*\/\s*\1\s*\}\}(\n?)/g;
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
  const keys = [...new Set(found.map((m) => m[1] as string))];
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

const atLineStart = (text: string, at: number): boolean => at === 0 || text[at - 1] === "\n";

/**
 * Keeps each section whose field filled to something and drops the rest, innermost first. A
 * section that fills whole lines takes its own line breaks with it. Sections for fields that
 * aren't declared or didn't fill stay as written.
 */
function fillSections(body: string, filled: ReadonlyMap<string, string>): string {
  let text = body;
  for (let changed = true; changed; ) {
    changed = false;
    text = text.replace(
      SECTION,
      (whole, key: string, inner: string, newline: string, at: number, all: string) => {
        const value = filled.get(key);
        if (value === undefined) return whole;
        changed = true;
        const lineStart = atLineStart(all, at);
        const lineEnd = newline !== "" || at + whole.length === all.length;
        if (value === "") return lineStart && lineEnd ? "" : newline;
        let kept = inner;
        if (lineStart && kept.startsWith("\n")) kept = kept.slice(1);
        if (lineEnd && kept.endsWith("\n")) kept = kept.slice(0, -1);
        return kept + newline;
      },
    );
  }
  return text;
}

export { FIELD_KINDS, type FieldKind, type FieldValue } from "./format.js";
