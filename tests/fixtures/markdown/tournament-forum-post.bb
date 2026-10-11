---
name: Tournament forum post
kind: tournament
description: The forum post for a new tournament: information, schedule, rules, prizes, staff, mappools and links.
fields:
  - key: tournament
    label: Tournament name
    kind: text
    required: true
  - key: banner
    label: Banner image URL (hosted elsewhere)
    kind: url
  - key: format
    label: Format
    kind: text
    default: 1v1, double elimination
  - key: mode
    label: Game mode
    kind: text
    default: osu! (standard)
  - key: rank_range
    label: Rank range
    kind: text
    default: "#10,000 to #100,000"
  - key: region
    label: Region
    kind: text
    default: Open to everyone
  - key: registration_close
    label: Registrations close
    kind: date
    required: true
  - key: qualifiers
    label: Qualifiers
    kind: date
  - key: finals
    label: Grand finals
    kind: date
  - key: prizes
    label: Prizes, one per line
    kind: multiline
    default: "[*][b]1st place:[/b] profile badge and 4 months of osu!supporter\n[*][b]2nd place:[/b] 2 months of osu!supporter\n[*][b]3rd place:[/b] 1 month of osu!supporter"
  - key: hosts
    label: Hosts
    kind: users
    required: true
  - key: mappoolers
    label: Mappoolers
    kind: users
  - key: referees
    label: Referees
    kind: users
  - key: pool_link
    label: Mappool link
    kind: url
  - key: signup_link
    label: Registration form
    kind: url
    required: true
  - key: discord_link
    label: Discord server
    kind: url
  - key: sheet_link
    label: Main spreadsheet
    kind: url
---
[centre][img]{{banner}}[/img][/centre]

[notice][centre][size=150][b]{{tournament}}[/b][/size]
Registrations close on [b]{{registration_close}}[/b]. [url={{signup_link}}]Sign up here[/url].[/centre][/notice]

[heading]Information[/heading]
[list]
[*][b]Format:[/b] {{format}}
[*][b]Mode:[/b] {{mode}}
[*][b]Rank range:[/b] {{rank_range}}
[*][b]Region:[/b] {{region}}
[/list]

[box=Schedule]
[list]
[*][b]Registrations close:[/b] {{registration_close}}
[*][b]Qualifiers:[/b] {{qualifiers}}
[*][b]Grand finals:[/b] {{finals}}
[/list]
All times are UTC. The full schedule is on the [url={{sheet_link}}]spreadsheet[/url].
[/box]
[box=Rules]
[list=1]
[*]Players must be within the rank range when registrations close.
[*]Each match is played in a multiplayer room made by a referee. Be in the room on time; 10 minutes late counts as a forfeit.
[*]Warmups are allowed if both players agree, and must be shorter than 5 minutes.
[*]Each player gets one disconnect replay per match, used in the first 30 seconds of a map.
[*]Multi-accounting, score manipulation or abuse of staff means disqualification.
[*]The hosts have the final say on anything these rules don't cover.
[/list]
[/box]
[box=Prizes]
[list]
{{prizes}}
[/list]
[/box]
[box=Staff]
[b]Hosts[/b]
{{hosts}}

[b]Mappoolers[/b]
{{mappoolers}}

[b]Referees[/b]
{{referees}}
[/box]
[box=Mappools]
Mappools are released on the Monday before each round. [url={{pool_link}}]See every pool[/url].
[/box]

[heading]Links[/heading]
[list]
[*][url={{signup_link}}]Registration form[/url]
[*][url={{sheet_link}}]Main spreadsheet[/url]
[*][url={{discord_link}}]Discord server[/url]
[/list]
