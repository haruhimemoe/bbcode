# AGENTS.md

`@haruhimemoe/bbcode`: one job. Parse, render, lint and count osu! BBCode the way osu! does, plus small builders for common output. Keep it that way.

## Rules

- **No runtime dependencies.** No network, no DOM, no Node-only APIs in `src/`. Everything runs in browsers and Node. A feature that needs a user lookup, an image fetch or storage belongs in an app.
- **Match osu!.** Behavior follows what osu-web renders: which tags exist, their arguments, pairing, newline eating, the list title rule, the imagemap line format, the size clamp. Where this package differs on purpose (safety, malformed nesting), the README's "Differences from osu!" says so.
- **Clean-room.** osu-web is AGPL and the osu! wiki is CC BY-NC. Never copy code, regexes, CSS, class names or wiki prose from them. Our classes use the `bb-` prefix.
- **Safe output.** `render` must never emit a script, an event handler attribute, a `javascript:` URL or an attribute breakout, from BBCode or from a hand-built tree. A new tag or option adds cases to `tests/safety.test.ts`.
- **Lossless parse.** `serialize(parse(x)) === x` for every input. `tests/roundtrip.test.ts` checks it on a corpus and seeded random input; add malformed input you meet to the corpus.
- **Public API is pinned** by `tests/api.test.ts`, per subpath. Adding or removing an export is a semver decision: say so in `CHANGELOG.md`. Keep the README's API section in step with `src/`.
- **Test first.** A behavior change starts as a failing golden test (`tests/render.test.ts`), lint case (`tests/lint.test.ts`) or pairing case (`tests/parse.test.ts`).
- **Changelog.** A change users can see gets a line under `## [Unreleased]` in `CHANGELOG.md` ([Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)). Never rewrite a released entry. While on 0.x, a change to rendered HTML or class names is a minor version.
- **Releases are cut by the maintainers.** Don't bump the version, tag, push or publish unless a maintainer asks.
- Code style: Biome (2 spaces, double quotes, 100 columns). Every file starts with the `@file / @desc / @author / @created / @modified` header. Functions exported from a file in `src/` get a JSDoc block with `@function`, `@param` and `@returns`. Keep files under about 250 lines; split by concern.
- Imports inside `src/` use `.js` extensions (Node ESM).
- Docs are for their readers: `README.md` for users, `CONTRIBUTING.md` for contributors, this file for agents. No maintainer notes in any of them.

## Layout

| Path | What's there |
| --- | --- |
| `src/index.ts` | The root exports. Nothing else. |
| `src/ast.ts` | `Document`, `Node`, `TagNode`, `TextNode`. |
| `src/tags.ts` | `TAGS` and `findTag`: the public tag registry. |
| `src/parser/` | `rules.ts` (per-tag pairing and argument rules), `scan.ts` (one tag token), `build.ts` (the tree builder and its events), `nodes.ts`, `find.ts` (the remembering search and box title table that keep parsing linear; scan a document with one `scanner`). Nesting stops at `LIMITS.nesting`. |
| `src/parse.ts` | `parse` and `serialize`. |
| `src/safety.ts` | Escaping and the URL, color, size and YouTube id checks. Internal. |
| `src/render/` | `index.ts` (`render`), `inline.ts`, `block.ts`, `text.ts` (escaping, automatic links), `eat.ts` (newline eating), `context.ts` (`RenderOptions`). |
| `src/lint/` | `index.ts` (`lint`, `applyFix`), `events.ts`, `tree.ts`, `scan.ts`, `colors.ts`, `types.ts`. |
| `src/limits.ts` | `LIMITS` and `count`. |
| `src/layout.ts` | `OSU_WIDTHS` and `OSU_FONT_SIZES`: osu!'s desktop content widths and font sizes, measured from osu-web's stylesheets (facts only, no copied CSS). |
| `src/helpers/` | `./helpers`: `color.ts` (color, gradient), `index.ts` (flag, profile, box, list, escapeBBCode). |
| `src/imagemap/` | `./imagemap`: parse, validate, serialize. |
| `src/flags/` | `./flags`: `countries.ts` (data), `url.ts` (flag URLs), `index.ts`. |
| `src/template/` | `./template`: `index.ts` (fill, fields), `format.ts` (values by kind). |
| `src/styles.css` | `./styles.css`. The build copies it to `dist/`. |
| `tests/` | Vitest: `render`, `safety`, `parse`, `roundtrip`, `lint`, `imagemap`, `helpers`, `flags`, `template`, `api`, `layout`, `styles`, `nesting` (deep input), `performance` (hostile input stays linear). |
| `scripts/smoke.mjs` | Imports the built package through its exports map (`bun run test:dist`). |
| `scripts/check-consumer.mjs` | Packs the package, installs it in a temp project, then typechecks and runs a strict consumer (`bun run check:consumer`). |
| `.github/workflows/` | `ci.yml` (checks, coverage, dist on Node 22.12 and 24, consumer) and `release.yml` (publishes on a GitHub release). |

## Before calling a change done

```sh
bun run check && bun run typecheck && bun run test && bun run test:dist
```

CI also runs `bun run test:coverage` (95% floor on `src/`) and `bun run check:consumer`.
