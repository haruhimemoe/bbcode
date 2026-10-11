import { describe, expect, it } from "vitest";
import { escapeMarkdown } from "../src/markdown/escape.js";
import { LOSS_CODES } from "../src/markdown/index.js";

describe("markdown basics", () => {
  it("freezes the loss codes", () => {
    expect(Object.isFrozen(LOSS_CODES)).toBe(true);
    expect(LOSS_CODES).toEqual([
      "no-equivalent",
      "table",
      "html",
      "nested-list-flattened",
      "heading-level",
      "footnote",
      "reference-link-unresolved",
    ]);
  });
  it("escapes inline markers anywhere", () => {
    expect(escapeMarkdown("a*b_c`d[e]f~g", false)).toBe("a\\*b\\_c\\`d\\[e\\]f\\~g");
  });
  it("escapes line-start markers only at line start", () => {
    expect(escapeMarkdown("# x", true)).toBe("\\# x");
    expect(escapeMarkdown("> x", true)).toBe("\\> x");
    expect(escapeMarkdown("- x", true)).toBe("\\- x");
    expect(escapeMarkdown("1. x", true)).toBe("1\\. x");
    expect(escapeMarkdown("a # b", false)).toBe("a # b");
  });
});
