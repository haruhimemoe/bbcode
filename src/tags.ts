/**
 * @file src/tags.ts
 * @desc TAGS: every tag osu! supports, with its argument, layout and an example. Drives docs,
 *       toolbars and autocomplete. The parser's own rules live in src/parser/rules.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** Whether a tag takes an `=argument`. */
export type TagArg = "none" | "optional" | "required";

/** What a tag's argument holds. */
export type TagArgKind = "color" | "size" | "title" | "name" | "list" | "url" | "email" | "user-id";

/** One entry of `TAGS`. */
export interface TagSpec {
  /** Canonical name, as written in BBCode (`"centre"`, `"*"` for a list item). */
  readonly name: string;
  /** Other spellings osu! accepts for the same tag (`[strike]` for `[s]`). */
  readonly aliases: readonly string[];
  /** Whether the tag takes an `=argument`. */
  readonly arg: TagArg;
  /** What the argument holds, or `null` when there is none. */
  readonly argKind: TagArgKind | null;
  /** `"block"` tags start on their own line and eat newlines around them. */
  readonly display: "inline" | "block";
  /** `"raw"`: content is not parsed as BBCode. `"items"`: holds `[*]` items. */
  readonly content: "bbcode" | "raw" | "items";
  /** The opening and closing tag must be on the same line. */
  readonly singleLine: boolean;
  /** One sentence on what the tag does. */
  readonly description: string;
  /** A short example of the tag in use. */
  readonly example: string;
}

/** Builds an entry; `extra` overrides the inline, no-argument, parsed-content defaults. */
const spec = (
  name: string,
  description: string,
  example: string,
  extra: Partial<Omit<TagSpec, "name" | "description" | "example">> = {},
): TagSpec =>
  Object.freeze({
    name,
    aliases: Object.freeze(extra.aliases ?? []),
    arg: extra.arg ?? "none",
    argKind: extra.argKind ?? null,
    display: extra.display ?? "inline",
    content: extra.content ?? "bbcode",
    singleLine: extra.singleLine ?? false,
    description,
    example,
  });

const BLOCK = { display: "block" } as const;

/** Every tag osu! supports, in the order its docs list them. Frozen. */
export const TAGS: readonly TagSpec[] = Object.freeze([
  spec("b", "Bold text.", "[b]bold[/b]"),
  spec("i", "Italic text.", "[i]italic[/i]"),
  spec("u", "Underlined text.", "[u]underlined[/u]"),
  spec("s", "Struck-through text.", "[s]struck[/s]", { aliases: ["strike"] }),
  spec("spoiler", "Blacked-out text that shows on hover.", "[spoiler]secret[/spoiler]"),
  spec("color", "Colored text: `#rrggbb` or a color name.", "[color=#ff66aa]pink[/color]", {
    arg: "required",
    argKind: "color",
  }),
  spec("size", "Text size in percent, clamped to 30..200.", "[size=150]big[/size]", {
    arg: "required",
    argKind: "size",
  }),
  spec("centre", "Centered block.", "[centre]middle[/centre]", BLOCK),
  spec("left", "Left-aligned block.", "[left]left[/left]", BLOCK),
  spec("right", "Right-aligned block.", "[right]right[/right]", BLOCK),
  spec("heading", "A heading, on one line.", "[heading]Rules[/heading]", {
    ...BLOCK,
    singleLine: true,
  }),
  spec("c", "Inline code, on one line.", "[c]npm install[/c]", { singleLine: true }),
  spec("code", "A code block. Its content is shown as written.", "[code]\nfoo()\n[/code]", {
    ...BLOCK,
    content: "raw",
  }),
  spec("notice", "A boxed notice.", "[notice]Registrations close Friday.[/notice]", BLOCK),
  spec("box", "A collapsible box with a title, closed by default.", "[box=Rules]...[/box]", {
    ...BLOCK,
    arg: "required",
    argKind: "title",
  }),
  spec(
    "spoilerbox",
    'A collapsible box labelled "SPOILER".',
    "[spoilerbox]...[/spoilerbox]",
    BLOCK,
  ),
  spec("quote", 'A quote, optionally "name wrote:".', '[quote="peppy"]hello[/quote]', {
    ...BLOCK,
    arg: "optional",
    argKind: "name",
  }),
  spec(
    "list",
    "A bulleted list, or numbered with any argument. Text before the first item is its title.",
    "[list]\n[*]one\n[*]two\n[/list]",
    { ...BLOCK, arg: "optional", argKind: "list", content: "items" },
  ),
  spec("*", "A list item. Only works inside [list].", "[list]\n[*]item\n[/list]", BLOCK),
  spec("url", "A link. http, https and ftp only.", "[url=https://osu.ppy.sh]osu![/url]", {
    arg: "optional",
    argKind: "url",
    singleLine: true,
  }),
  spec("email", "A mailto link.", "[email]hi@example.com[/email]", {
    arg: "optional",
    argKind: "email",
    content: "raw",
    singleLine: true,
  }),
  spec("img", "An image. The URL can't contain `[`.", "[img]https://example.com/a.png[/img]", {
    content: "raw",
  }),
  spec("audio", "An audio player.", "[audio]https://example.com/a.mp3[/audio]", {
    ...BLOCK,
    content: "raw",
    singleLine: true,
  }),
  spec("youtube", "An embedded YouTube video: an id or a link.", "[youtube]dQw4w9WgXcQ[/youtube]", {
    ...BLOCK,
    content: "raw",
    singleLine: true,
  }),
  spec("profile", "A link to an osu! user.", "[profile=2]peppy[/profile]", {
    arg: "optional",
    argKind: "user-id",
    content: "raw",
    singleLine: true,
  }),
  spec(
    "imagemap",
    "An image with link regions.",
    "[imagemap]\nhttps://example.com/a.png\n0 0 50 100 https://osu.ppy.sh left half\n[/imagemap]",
    {
      ...BLOCK,
      content: "raw",
    },
  ),
]);

const BY_NAME = new Map<string, TagSpec>();
for (const tag of TAGS) {
  BY_NAME.set(tag.name, tag);
  for (const alias of tag.aliases) BY_NAME.set(alias, tag);
}

/**
 * Looks up a tag by its name or an alias. Names are case-sensitive, like osu!'s.
 * @function findTag
 * @param {string} name - `"strike"`, `"centre"`, `"*"`...
 * @returns {TagSpec | undefined} The entry, or `undefined` for a tag osu! doesn't support.
 */
export function findTag(name: string): TagSpec | undefined {
  return BY_NAME.get(name);
}
