/**
 * @file src/flags/index.ts
 * @desc @haruhimemoe/bbcode/flags: countries (ISO 3166-1 alpha-2 code, English name) with their
 *       osu! flag URLs, lookup and search.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { COUNTRY_ROWS } from "./countries.js";
import { flagUrl } from "./url.js";

/** A country or territory with its flag URLs on osu!. */
export interface Country {
  /** ISO 3166-1 alpha-2 code, uppercase. */
  readonly code: string;
  /** English short name. */
  readonly name: string;
  /** Flag image URLs. */
  readonly flag: { readonly modern: string; readonly legacy: string };
}

/** Every ISO 3166-1 alpha-2 country and territory, sorted by code. Frozen. */
export const COUNTRIES: readonly Country[] = Object.freeze(
  COUNTRY_ROWS.map(([code, name]) =>
    Object.freeze({
      code,
      name,
      flag: Object.freeze({ modern: flagUrl(code), legacy: flagUrl(code, "legacy") }),
    }),
  ),
);

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/**
 * Looks up a country by its code.
 * @function findCountry
 * @param {string} code - Two-letter code, any case.
 * @returns {Country | undefined} The country, or `undefined` for an unknown code.
 */
export function findCountry(code: string): Country | undefined {
  return BY_CODE.get(code.toUpperCase());
}

/** Lowercase without accents, for matching "cote" to "Côte". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Finds countries by name or code. An exact code comes first, then names starting with the
 * query, then names containing it. Case and accents don't matter.
 * @function searchCountries
 * @param {string} query - Part of a name, or a code.
 * @returns {Country[]} Matches, best first. Empty for a blank query.
 */
export function searchCountries(query: string): Country[] {
  const q = fold(query.trim());
  if (q === "") return [];
  const exact = COUNTRIES.filter((c) => c.code.toLowerCase() === q);
  const starts = COUNTRIES.filter((c) => !exact.includes(c) && fold(c.name).startsWith(q));
  const contains = COUNTRIES.filter(
    (c) => !exact.includes(c) && !starts.includes(c) && fold(c.name).includes(q),
  );
  return [...exact, ...starts, ...contains];
}

export { type FlagStyle, flagUrl, normalizeCountryCode } from "./url.js";
