---
name: Beatmap description
kind: beatmap
description: A beatmap set's description: the song, the difficulties and who made them, thanks, and hitsound and storyboard credits.
fields:
  - key: artist
    label: Artist
    kind: text
    required: true
  - key: title
    label: Song title
    kind: text
    required: true
  - key: color
    label: Accent color
    kind: color
    default: "#aa88ff"
  - key: song_link
    label: Where to listen to the song
    kind: url
  - key: difficulties
    label: Difficulties, one per line
    kind: multiline
    default: "[*][b]Easy[/b] by me\n[*][b]Normal[/b] by me\n[*][b]Hard[/b] by a guest mapper\n[*][b]Insane[/b] by me"
  - key: hitsounds
    label: Hitsounds by
    kind: user
  - key: modders
    label: Thanks for mods, one per line
    kind: users
  - key: story
    label: A note about the map
    kind: multiline
    default: My first set with a full spread. Thanks to everyone who helped along the way.
---
[centre][size=150][color={{color}}][b]{{artist}} - {{title}}[/b][/color][/size]
[url={{song_link}}]Listen to the song[/url][/centre]

{{story}}

[heading]Difficulties[/heading]
[list]
{{difficulties}}
[/list]

[box=Credits]
[b]Hitsounds:[/b] {{hitsounds}}

[b]Thanks for modding[/b]
{{modders}}
[/box]
