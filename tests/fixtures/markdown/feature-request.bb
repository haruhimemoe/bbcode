---
name: Feature request or bug report
kind: forum
description: A clear forum post for a feature request or a bug report: what, why, steps to reproduce and your setup.
fields:
  - key: title
    label: One-line summary
    kind: text
    required: true
  - key: problem
    label: What's the problem, or what's missing?
    kind: multiline
    required: true
  - key: proposal
    label: What should happen instead?
    kind: multiline
  - key: steps
    label: Steps to reproduce (bugs), one per line
    kind: multiline
    default: "[*]Open ...\n[*]Click ...\n[*]See ..."
  - key: version
    label: Game or site version
    kind: text
    default: lazer 2026.928.0
  - key: platform
    label: Operating system
    kind: text
    default: Windows 11
  - key: log
    label: Error message or log
    kind: multiline
  - key: screenshot
    label: Screenshot or video link
    kind: url
---
[heading]{{title}}[/heading]

[b]The problem[/b]
{{problem}}

[b]What I'd like to happen[/b]
{{proposal}}

[box=Steps to reproduce]
[list=1]
{{steps}}
[/list]
[/box]
[box=My setup]
[list]
[*][b]Version:[/b] [c]{{version}}[/c]
[*][b]Platform:[/b] {{platform}}
[/list]
[/box]
[spoilerbox]
[code]
{{log}}
[/code]
[/spoilerbox]

[url={{screenshot}}]Screenshot or video[/url]
