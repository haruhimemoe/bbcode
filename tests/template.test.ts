/**
 * @file tests/template.test.ts
 * @desc fillTemplate by field kind, required fields and defaults, errors, and templateFields.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  FIELD_KINDS,
  type FieldKind,
  fillTemplate,
  type TemplateField,
  templateFields,
} from "../src/template/index.js";

const field = (
  key: string,
  kind: FieldKind,
  extra: Partial<TemplateField> = {},
): TemplateField => ({
  key,
  label: key,
  kind,
  ...extra,
});

describe("fillTemplate", () => {
  it.each([
    ["text", "Summer Cup", "Summer Cup"],
    ["multiline", "a\r\nb", "a\nb"],
    ["number", "  42 ", "42"],
    ["number", 1.5, "1.5"],
    ["date", "2026-09-28", "2026-09-28"],
    ["url", "https://osu.ppy.sh", "https://osu.ppy.sh"],
    ["user", 2, "[profile=2]2[/profile]"],
    ["user", "peppy", "[profile]peppy[/profile]"],
    ["user", "124493", "[profile=124493]124493[/profile]"],
    ["users", "peppy\n\n2\n", "[profile]peppy[/profile]\n[profile=2]2[/profile]"],
    ["users", ["a", 3], "[profile]a[/profile]\n[profile=3]3[/profile]"],
    ["country", "jp", "[img]https://assets.ppy.sh/old-flags/JP.png[/img]"],
    ["color", "#F6A", "#ff66aa"],
  ] as const)("%s %j", (kind, value, expected) => {
    const result = fillTemplate("<{{ v }}>", [field("v", kind)], { v: value });
    expect(result).toEqual({ text: `<${expected}>`, errors: [] });
  });

  it.each([
    ["text", "a\nb", "one line"],
    ["number", "abc", "number"],
    ["number", "", null],
    ["date", "28/09/2026", "YYYY-MM-DD"],
    ["date", "2026-13-45", "YYYY-MM-DD"],
    ["url", "javascript:x", "http"],
    ["country", "ZZ", "country code"],
    ["color", "rgb(0,0,0)", "color"],
    ["user", 0, "positive integer"],
    ["users", "a\nb\nc[/profile]", "one-line name"],
    ["text", ["a"], "single value"],
  ] as const)("refuses %s %j", (kind, value, message) => {
    const result = fillTemplate("{{v}}", [field("v", kind)], { v: value });
    if (message === null) {
      expect(result).toEqual({ text: "", errors: [] });
      return;
    }
    expect(result.text).toBe("{{v}}");
    expect(result.errors[0]?.key).toBe("v");
    expect(result.errors[0]?.message).toContain(message);
  });

  it("uses defaults, requires required fields and leaves undeclared placeholders", () => {
    const fields = [
      field("name", "text", { required: true }),
      field("mode", "text", { default: "osu!" }),
      field("note", "text"),
    ];
    const body = "{{name}} / {{mode}} / {{note}} / {{other}}";
    expect(fillTemplate(body, fields, { name: "Cup" })).toEqual({
      text: "Cup / osu! /  / {{other}}",
      errors: [],
    });
    expect(fillTemplate(body, fields, { name: " " })).toEqual({
      text: "{{name}} / osu! /  / {{other}}",
      errors: [{ key: "name", message: "Required." }],
    });
    expect(fillTemplate("{{u}}", [field("u", "users")], { u: [] }).text).toBe("");
  });

  it("rejects bad declarations", () => {
    const fields = [
      field("a b", "text"),
      field("x", "text"),
      field("x", "text"),
      field("k", "weird" as FieldKind),
    ];
    expect(fillTemplate("", fields, {}).errors.map((e) => e.message)).toEqual([
      "Keys use letters, digits, _, - and . only.",
      "This key is declared twice.",
      'Unknown field kind "weird".',
    ]);
  });
});

describe("templateFields", () => {
  it("lists keys, undeclared keys and unused fields", () => {
    const body = "{{a}} {{ b }} {{a}} {{c.d-e_f}} {{ not a key }}";
    expect(templateFields(body, [field("a", "text"), field("z", "text")])).toEqual({
      keys: ["a", "b", "c.d-e_f"],
      undeclared: ["b", "c.d-e_f"],
      unused: ["z"],
    });
    expect(templateFields("{{x}}").undeclared).toEqual(["x"]);
  });
  it("exports every kind", () => {
    expect(FIELD_KINDS).toHaveLength(9);
    expect(Object.isFrozen(FIELD_KINDS)).toBe(true);
  });
});
