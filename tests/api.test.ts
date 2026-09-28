/**
 * @file tests/api.test.ts
 * @desc The public surface per subpath (so an added or removed export is a visible semver
 *       question), TAGS against the parser's rules, and count/LIMITS.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import * as flags from "../src/flags/index.js";
import * as helpers from "../src/helpers/index.js";
import * as imagemap from "../src/imagemap/index.js";
import * as root from "../src/index.js";
import { RULES } from "../src/parser/rules.js";
import * as template from "../src/template/index.js";

describe("exports", () => {
  it.each([
    [
      ".",
      root,
      [
        "LIMITS",
        "LINT_CODES",
        "TAGS",
        "applyFix",
        "count",
        "findTag",
        "lint",
        "parse",
        "render",
        "serialize",
      ],
    ],
    [
      "./helpers",
      helpers,
      ["box", "color", "escape", "flag", "gradient", "list", "normalizeColor", "profile"],
    ],
    [
      "./imagemap",
      imagemap,
      ["formatPercent", "parseImagemap", "serializeImagemap", "validateImagemap"],
    ],
    [
      "./flags",
      flags,
      ["COUNTRIES", "findCountry", "flagUrl", "normalizeCountryCode", "searchCountries"],
    ],
    ["./template", template, ["FIELD_KINDS", "fillTemplate", "templateFields"]],
  ])("%s", (_path, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
  });
});

describe("TAGS", () => {
  it("matches the parser's rules", () => {
    const written = root.TAGS.flatMap((t) => [t.name, ...t.aliases]).filter((n) => n !== "*");
    expect(written.sort()).toEqual([...RULES.keys()].sort());
    for (const tag of root.TAGS) {
      for (const name of [tag.name, ...tag.aliases]) {
        const rule = RULES.get(name);
        if (!rule) continue;
        expect(rule.name).toBe(tag.name);
        expect(rule.arg).toBe(tag.arg);
        expect(rule.singleLine).toBe(tag.singleLine);
      }
    }
  });
  it("parses and renders every example", () => {
    for (const tag of root.TAGS) {
      const doc = root.parse(tag.example);
      expect(
        doc.children.some((n) => n.type === "tag"),
        tag.name,
      ).toBe(true);
      expect(
        root.lint(tag.example).filter((d) => d.severity === "error"),
        tag.name,
      ).toEqual([]);
    }
  });
  it("finds tags by name and alias, case-sensitively", () => {
    expect(root.findTag("strike")?.name).toBe("s");
    expect(root.findTag("centre")?.display).toBe("block");
    expect(root.findTag("center")).toBeUndefined();
    expect(root.findTag("B")).toBeUndefined();
    expect(Object.isFrozen(root.TAGS)).toBe(true);
  });
});

describe("count and LIMITS", () => {
  it("counts code points against 60,000", () => {
    expect(root.count("a😀")).toEqual({ length: 2, limit: 60_000, remaining: 59_998, over: false });
    expect(root.count("abc", 2)).toEqual({ length: 3, limit: 2, remaining: -1, over: true });
  });
  it("has osu!'s limits", () => {
    expect(root.LIMITS).toEqual({
      forumPost: 60_000,
      userpage: 60_000,
      beatmapDescription: 60_000,
      sizeMin: 30,
      sizeMax: 200,
      sizePresets: [50, 85, 100, 150],
    });
    expect(Object.isFrozen(root.LIMITS)).toBe(true);
  });
});
