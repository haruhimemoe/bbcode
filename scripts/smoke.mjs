/**
 * @file scripts/smoke.mjs
 * @desc Imports the built package through its own exports map, the way Node consumers will
 *       (every subpath, plus ./styles.css resolving to a real file), and checks one result per
 *       subpath. Run by `bun run test:dist`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { lint, parse, render, serialize, TAGS } = await import("@haruhimemoe/bbcode");
const { gradient, flag } = await import("@haruhimemoe/bbcode/helpers");
const { parseImagemap } = await import("@haruhimemoe/bbcode/imagemap");
const { COUNTRIES } = await import("@haruhimemoe/bbcode/flags");
const { fillTemplate } = await import("@haruhimemoe/bbcode/template");

const source = "[centre][b]hi[/b] [url]javascript:x[/url][/centre]\n";
assert.equal(serialize(parse(source)), source);
assert.equal(
  render(source),
  '<div class="bb"><div class="bb-align bb-align--centre"><strong>hi</strong> [url]javascript:x[/url]</div></div>',
);
assert.deepEqual(
  lint("[center]x[/center]").map((d) => d.fix?.text),
  ["[centre]", "[/centre]"],
);
assert.ok(TAGS.length > 20);
assert.equal(gradient("ab", ["#000", "#fff"]).cost, 46);
assert.equal(flag("us"), "[img]https://assets.ppy.sh/old-flags/US.png[/img]");
assert.equal(parseImagemap("\nhttps://a.b/i.png\n0 0 1 1 #\n").ok, true);
assert.equal(COUNTRIES.length, 249);
assert.equal(fillTemplate("{{a}}", [{ key: "a", label: "A", kind: "text" }], { a: "x" }).text, "x");

const css = fileURLToPath(import.meta.resolve("@haruhimemoe/bbcode/styles.css"));
assert.ok(readFileSync(css, "utf8").includes(".bb-box"), "styles.css missing or empty");
for (const sub of ["index", "helpers/index", "imagemap/index", "flags/index", "template/index"]) {
  assert.ok(
    existsSync(new URL(`../dist/${sub}.d.ts`, import.meta.url)),
    `dist/${sub}.d.ts missing`,
  );
}
console.log("smoke: ok");
