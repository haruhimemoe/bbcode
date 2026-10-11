# bbcode

Parse, render, lint and count osu! BBCode the way osu! does. Zero dependencies.

## Install

```bash
npm install @haruhimemoe/bbcode
```

## Usage

```ts
import { parse, render } from "@haruhimemoe/bbcode";

const doc = parse("[b]hello[/b] [i]world[/i]");
render(doc);
```

Use `lint` to catch unclosed tags, bad URLs and other mistakes before you post. See the [full docs](https://github.com/haruhimemoe/bbcode#readme) for every tag.

## Supported tags

| Tag | Example | Notes |
| --- | --- | --- |
| `[b]` | **bold** | inline |
| `[i]` | *italic* | inline |
| `[code]` | `inline code` | preserves whitespace |
| `[url]` | a link | supports `[url=https://x.y]text[/url]` |

## Contributing

1. Fork the repo
2. Run the tests
3. Open a pull request

No warranty, see the license file.
