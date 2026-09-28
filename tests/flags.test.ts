/**
 * @file tests/flags.test.ts
 * @desc The country list, flag URLs, lookup and search.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  findCountry,
  flagUrl,
  normalizeCountryCode,
  searchCountries,
} from "../src/flags/index.js";

describe("COUNTRIES", () => {
  it("has every ISO 3166-1 alpha-2 code once, sorted", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(codes).toHaveLength(249);
    expect(new Set(codes).size).toBe(249);
    expect(codes).toEqual([...codes].sort());
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.name.trim()).toBe(c.name);
      expect(c.name).not.toMatch(/[&’]/);
    }
  });
  it("is frozen", () => {
    expect(Object.isFrozen(COUNTRIES)).toBe(true);
    expect(Object.isFrozen(COUNTRIES[0])).toBe(true);
    expect(Object.isFrozen(COUNTRIES[0]?.flag)).toBe(true);
  });
  it("carries flag URLs", () => {
    expect(findCountry("us")).toEqual({
      code: "US",
      name: "United States",
      flag: {
        modern: "https://osu.ppy.sh/assets/images/flags/1f1fa-1f1f8.svg",
        legacy: "https://assets.ppy.sh/old-flags/US.png",
      },
    });
  });
});

describe("flagUrl", () => {
  it.each([
    ["US", "1f1fa-1f1f8"],
    ["jp", "1f1ef-1f1f5"],
    ["AZ", "1f1e6-1f1ff"],
  ])("%s", (code, points) => {
    expect(flagUrl(code)).toBe(`https://osu.ppy.sh/assets/images/flags/${points}.svg`);
  });
  it("legacy PNGs use the uppercase code", () => {
    expect(flagUrl("gb", "legacy")).toBe("https://assets.ppy.sh/old-flags/GB.png");
  });
  it.each(["", "U", "USA", "1A", "ÜS"])("refuses %j", (code) => {
    expect(() => normalizeCountryCode(code)).toThrow(TypeError);
    expect(() => flagUrl(code)).toThrow(TypeError);
  });
});

describe("findCountry and searchCountries", () => {
  it("finds by code", () => {
    expect(findCountry("KR")?.name).toBe("South Korea");
    expect(findCountry("ZZ")).toBeUndefined();
  });
  it("ranks exact code, then prefix, then substring, ignoring accents", () => {
    const names = searchCountries("ca").map((c) => c.code);
    expect(names[0]).toBe("CA");
    expect(names.indexOf("KH")).toBeGreaterThan(names.indexOf("CV"));
    expect(searchCountries("cote").map((c) => c.code)).toEqual(["CI"]);
    expect(searchCountries("  ")).toEqual([]);
  });
});
