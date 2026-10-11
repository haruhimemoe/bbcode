---
name: Tournament staff list
kind: tournament
description: Every role on a tournament's staff, each in its own box with the people on it linked to their profiles.
fields:
  - key: tournament
    label: Tournament name
    kind: text
    required: true
  - key: color
    label: Role color
    kind: color
    default: "#ffcc22"
  - key: hosts
    label: Hosts
    kind: users
    required: true
  - key: mappoolers
    label: Mappoolers
    kind: users
  - key: playtesters
    label: Playtesters
    kind: users
  - key: referees
    label: Referees
    kind: users
  - key: streamers
    label: Streamers
    kind: users
  - key: commentators
    label: Commentators
    kind: users
  - key: designers
    label: Graphic designers
    kind: users
  - key: contact
    label: Who to message with questions
    kind: user
---
[centre][size=150][b]{{tournament}} staff[/b][/size][/centre]

[box=Hosts]
[color={{color}}][b]Hosts[/b][/color]
{{hosts}}
[/box]
[box=Mappooling]
[color={{color}}][b]Mappoolers[/b][/color]
{{mappoolers}}

[color={{color}}][b]Playtesters[/b][/color]
{{playtesters}}
[/box]
[box=Matches]
[color={{color}}][b]Referees[/b][/color]
{{referees}}
[/box]
[box=Broadcast]
[color={{color}}][b]Streamers[/b][/color]
{{streamers}}

[color={{color}}][b]Commentators[/b][/color]
{{commentators}}
[/box]
[box=Design]
[color={{color}}][b]Graphic designers[/b][/color]
{{designers}}
[/box]

[size=85]Questions? Message {{contact}}.[/size]
