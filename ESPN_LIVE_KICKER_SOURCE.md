# ESPN Live Kicker Play-by-Play Source

WRC uses ESPN's public NFL game summary endpoint for exact live kicker events:

```text
https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={ESPN_EVENT_ID}
```

On a completed NFL game, the `drives.previous[].plays[]` data included textual kicker events with exact distances, including `B.Aubrey 41 yard field goal is GOOD` and `B.Aubrey 53 yard field goal is GOOD`. The parser uses these play records for WRC's made-kick yardage scoring and short-miss penalties.

Verified source: <https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401772510>
