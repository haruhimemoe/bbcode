/**
 * @file tests/helpers.test.ts
 * @desc The builders in ./helpers: color, gradient (colors and cost), flag, profile, box, list
 *       and escapeBBCode.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  box,
  color,
  escapeBBCode,
  flag,
  gradient,
  list,
  normalizeColor,
  profile,
} from "../src/helpers/index.js";
import { count, lint, parse, render } from "../src/index.js";

describe("color", () => {
  it("normalizes and wraps", () => {
    expect(normalizeColor("#ABC")).toBe("#aabbcc");
    expect(normalizeColor("#FF66AA")).toBe("#ff66aa");
    expect(normalizeColor("HotPink")).toBe("HotPink");
    expect(color("x", "#f6a")).toBe("[color=#ff66aa]x[/color]");
  });
  it.each(["", "#ff66a", "red1", "rgb(1,2,3)"])("refuses %j", (value) => {
    expect(() => color("x", value)).toThrow(TypeError);
  });
});

describe("gradient", () => {
  it("colors each character from the first stop to the last", () => {
    expect(gradient("abc", ["#000000", "#ffffff"]).bbcode).toBe(
      "[color=#000000]a[/color][color=#808080]b[/color][color=#ffffff]c[/color]",
    );
  });
  it("reports the characters it adds", () => {
    const g = gradient("abc", ["#000000", "#ffffff"]);
    expect(g.cost).toBe(count(g.bbcode).length - 3);
    expect(g.cost).toBe(3 * "[color=#000000][/color]".length);
  });
  it("merges equal neighbours and handles one stop", () => {
    expect(gradient("ab", ["#f00"])).toEqual({ bbcode: "[color=#ff0000]ab[/color]", cost: 23 });
    expect(gradient("a", ["#000", "#fff"]).bbcode).toBe("[color=#000000]a[/color]");
  });
  it("skips spaces by default and never colors newlines", () => {
    expect(gradient("a b\nc", ["#000", "#fff"]).bbcode).toBe(
      "[color=#000000]a[/color] [color=#808080]b[/color]\n[color=#ffffff]c[/color]",
    );
    expect(gradient("a b", ["#000", "#fff"], { skipSpaces: false }).bbcode).toBe(
      "[color=#000000]a[/color][color=#808080] [/color][color=#ffffff]b[/color]",
    );
  });
  it("uses three stops evenly", () => {
    const { bbcode } = gradient("abcde", ["#ff0000", "#00ff00", "#0000ff"]);
    expect(bbcode.match(/#[0-9a-f]{6}/g)).toEqual([
      "#ff0000",
      "#808000",
      "#00ff00",
      "#008080",
      "#0000ff",
    ]);
  });
  it("keeps an emoji with its modifiers in one tag", () => {
    const { bbcode } = gradient("👍🏽a", ["#000", "#fff"]);
    expect(bbcode).toBe("[color=#000000]👍🏽[/color][color=#ffffff]a[/color]");
  });
  it("renders and lints clean", () => {
    const { bbcode } = gradient("hello world", ["#ff66aa", "#66aaff"]);
    expect(lint(bbcode)).toEqual([]);
    expect(render(bbcode)).not.toContain("[color");
  });
  it.each([[[]], [["red"]], [["#12"]]])("refuses stops %j", (stops) => {
    expect(() => gradient("x", stops)).toThrow(TypeError);
  });

  describe("without Intl.Segmenter", () => {
    const original = Intl.Segmenter;
    afterEach(() => {
      Object.defineProperty(Intl, "Segmenter", { value: original, configurable: true });
    });
    it("falls back to code points", () => {
      Reflect.deleteProperty(Intl, "Segmenter");
      expect(gradient("😀a", ["#000", "#fff"]).bbcode).toBe(
        "[color=#000000]😀[/color][color=#ffffff]a[/color]",
      );
    });
  });
});

describe("flag, profile, box, list", () => {
  it("builds flag images", () => {
    expect(flag("us")).toBe("[img]https://osu.ppy.sh/assets/images/flags/1f1fa-1f1f8.svg[/img]");
    expect(flag("JP", { style: "legacy" })).toBe(
      "[img]https://assets.ppy.sh/old-flags/JP.png[/img]",
    );
    expect(() => flag("USA")).toThrow(TypeError);
  });
  it("builds profile links", () => {
    expect(profile(2, "peppy")).toBe("[profile=2]peppy[/profile]");
    expect(profile(2)).toBe("[profile=2]2[/profile]");
    expect(profile("Toy [x]")).toBe("[profile]Toy [x][/profile]");
    for (const bad of [0, 1.5, -1]) expect(() => profile(bad)).toThrow(TypeError);
    for (const bad of ["", "a\nb", "a[/profile]"]) expect(() => profile(bad)).toThrow(TypeError);
    expect(parse(profile("Toy [x]")).children[0]?.type).toBe("tag");
  });
  it("builds boxes", () => {
    expect(box("Rules [b]!![/b]", "x")).toBe("[box=Rules [b]!![/b]]\nx\n[/box]");
    expect(box(null, "x")).toBe("[spoilerbox]\nx\n[/spoilerbox]");
    expect(box("", "x")).toBe("[spoilerbox]\nx\n[/spoilerbox]");
    expect(() => box("a]b", "x")).toThrow(TypeError);
    expect(() => box("a[b", "x")).toThrow(TypeError);
    expect(() => box("a\nb", "x")).toThrow(TypeError);
  });
  it("builds lists", () => {
    expect(list(["a", "b"])).toBe("[list]\n[*]a\n[*]b\n[/list]");
    expect(list(["a"], { ordered: true, title: "T" })).toBe("[list=1]\nT\n[*]a\n[/list]");
  });
});

describe("escapeBBCode", () => {
  it("breaks every tag osu! would read and nothing else", () => {
    const text = "[b]x[/b] [B] [x] [*] a[b";
    const escaped = escapeBBCode(text);
    expect(escaped).toBe("[​b]x[​/b] [B] [x] [​*] a[b");
    expect(render(escaped, { wrap: false })).not.toContain("<strong>");
    expect(escapeBBCode("plain")).toBe("plain");
  });
});
