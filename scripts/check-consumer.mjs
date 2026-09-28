/**
 * @file scripts/check-consumer.mjs
 * @desc Installs the packed package into a throwaway project, then typechecks a consumer strictly
 *       (no skipLibCheck, so a broken .d.ts can't hide as `any`) and runs it. No dependencies
 *       here, so there's no version matrix: usage is `node scripts/check-consumer.mjs` (after
 *       `bun run build`). Needs the npm registry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = mkdtempSync(path.join(tmpdir(), "bbcode-consumer-"));
const run = (command, args, cwd = dir) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

try {
  const tarball = run("npm", ["pack", "--silent", "--pack-destination", dir], root).trim();
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", private: true }));
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", path.join(dir, tarball)]);
  writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: false,
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "ES2023",
        lib: ["ES2023", "DOM"],
        types: [],
      },
      files: ["consumer.ts"],
    }),
  );
  writeFileSync(
    path.join(dir, "consumer.ts"),
    `import { type Diagnostic, type LintCode, lint, parse, render, serialize, type TagNode } from "@haruhimemoe/bbcode";
import { box, gradient, type Gradient } from "@haruhimemoe/bbcode/helpers";
import { type Imagemap, serializeImagemap } from "@haruhimemoe/bbcode/imagemap";
import { type Country, findCountry } from "@haruhimemoe/bbcode/flags";
import { fillTemplate, type TemplateField } from "@haruhimemoe/bbcode/template";

const source = "[box=Hi]\\n[b]x[/b]\\n[/box]";
if (serialize(parse(source)) !== source) throw new Error("round trip");
const first = parse(source).children[0] as TagNode;
if (first.arg !== "Hi") throw new Error("arg");
if (!render(source, { proxy: (url) => url }).startsWith('<div class="bb">')) throw new Error("render");
const diagnostics: Diagnostic[] = lint("[b]x");
if (diagnostics[0]?.code !== "unclosed-tag") throw new Error("lint");
// @ts-expect-error an unknown code must not typecheck (it would if types were any)
const bad: LintCode = "nonsense";
const g: Gradient = gradient("ab", ["#000", "#fff"]);
const map: Imagemap = { image: "https://a.b/i.png", regions: [{ x: 0, y: 0, w: 1, h: 1, href: "#", title: "" }] };
const country: Country | undefined = findCountry("us");
const fields: TemplateField[] = [{ key: "a", label: "A", kind: "user" }];
if (fillTemplate("{{a}}", fields, { a: 2 }).text !== "[profile=2]2[/profile]") throw new Error("template");
void [bad, g, serializeImagemap(map), country, box(null, "x")];
console.log("consumer: ok");
`,
  );
  run(path.join(root, "node_modules", ".bin", "tsc"), ["-p", dir]);
  run(process.execPath, ["--experimental-strip-types", "--no-warnings", "consumer.ts"]);
  console.log("consumer: ok");
} catch (error) {
  console.error(`consumer: FAILED\n${error.stdout ?? ""}${error.stderr ?? error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
