# Changelog

All notable changes to `@haruhimemoe/bbcode` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). While on 0.x, a change to rendered HTML or class names is a minor version.

## [Unreleased]

### Changed

- An unclosed `[box]` or `[spoilerbox]` renders as a box that runs to the end of what holds it (the post, or the quote or box around it), as on osu!, instead of as text. `lint` reports it as an `unclosed-tag` warning, and the node's `close` is `null`.

### Fixed

- Deeply nested tags no longer overflow the stack. A 60,000 character post of nested `[quote]`, `[box]` or `[list]` tags, or boxes nested inside box titles, threw `RangeError` from `render` and `lint` in Node and Chromium. Tags nested past `LIMITS.nesting` (100) now stay text, and `lint` reports the new `too-deep` warning once.
- `validateImagemap` (and so `serializeImagemap`) refuses `[/imagemap]` in the image URL, a link or a title. It ended the written block early, so osu! showed the imagemap as text.
- Parsing, rendering and linting take linear time on hostile input. 60,000 characters of `[box=`, `[c]` with a close on a later line, `[url]` or unterminated `[a=` took up to 5 seconds in Node, so one post could stall a server rendering it. Close tags, newlines and box title ends are now found once per document.
- A bare link followed by bracketed text (`https://a.b[x]`) leaves the brackets out, as osu! does.

## [0.1.0] - 2026-09-28

### Added

- `parse` and `serialize`: osu! BBCode to a lossless tree with source ranges and back. Unclosed, unknown and malformed tags stay text, as on osu!.
- `render`: safe HTML with `bb-` classes, osu!'s newline eating and automatic links, and an optional media proxy.
- `lint` with eleven codes and fixes where obvious, `applyFix`, `count`, `LIMITS`, `TAGS` and `findTag`.
- `./styles.css`: a dark stylesheet for rendered output, with a light variant (`bb--light`).
- `./helpers`: `color`, `normalizeColor`, `gradient` (with its character cost), `flag`, `profile`, `box`, `list` and `escapeBBCode`.
- `./imagemap`: `parseImagemap`, `validateImagemap`, `serializeImagemap` and `formatPercent`.
- `./flags`: `COUNTRIES` (ISO 3166-1 alpha-2), `findCountry`, `searchCountries`, `flagUrl` and `normalizeCountryCode`.
- `./template`: `fillTemplate`, `templateFields` and `FIELD_KINDS`.

[unreleased]: https://github.com/haruhimemoe/bbcode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/haruhimemoe/bbcode/releases/tag/v0.1.0
