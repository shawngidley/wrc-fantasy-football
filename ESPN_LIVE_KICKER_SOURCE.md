# ESPN Live Kicker Play-by-Play Source

WRC uses ESPN's public NFL game summary endpoint for exact live kicker events:

```text
https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={ESPN_EVENT_ID}
```

On a completed NFL game, the `drives.previous[].plays[]` data included textual kicker events with exact distances, including `B.Aubrey 41 yard field goal is GOOD` and `B.Aubrey 53 yard field goal is GOOD`. The parser uses these play records for WRC's made-kick yardage scoring and short-miss penalties.

Verified source: <https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401772510>

## Play identity in the summary payload

Verified against `summary?event=401873065` (2026-11-16): the payload has **no top-level `plays` array** — `drives.previous[].plays[]` is the only source — and every one of that game's 126 plays carried its own unique `id`.

Play text is not a unique identifier. A kicker who makes two field goals of the same distance with the same center and holder produces byte-identical text twice; 2 of the 12 games on Sunday 2026-11-15 contained such a pair (`B.Aubrey 52 yard field goal is GOOD, Center-T.Sieg, Holder-B.Anger.` in SF @ DAL, and C. Ryland's two 49-yarders in LAR @ ARI). The parser therefore de-duplicates on play id, falling back to text plus repeat-index only for a payload that omits ids.
