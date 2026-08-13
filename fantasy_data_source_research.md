# Fantasy Data Source Research — 2026-08-12

## Sources reviewed

| Source | Confirmed strengths | Integration relevance |
|---|---|---|
| RotoWire NFL News / Injury Report | Around-the-clock player news, injury updates, depth-chart and practice-report context; includes official and beat-reporter sourcing plus fantasy analysis. | Strongest editorial all-in-one source; API/licensing terms require a direct vendor conversation. |
| FantasyPros API | Production API provides NFL news, injuries, practice-report status, projections, player metadata, scored points, and consensus rankings from 130+ experts. Personal/non-commercial production access is bundled with FantasyPros HOF at $8.99/month annual billing. | Best documented structured API fit for WRC. |
| Rotoworld / NBC Sports | Fast public player news, source links, and fantasy commentary directly on each update. | Strong free editorial complement, but no public production API was identified. |
| Sports Injury Central | Former pro-team-doctor injury interpretations, player health scores, injury history, and in-game context. | Best supplemental medical interpretation; not a replacement for official availability feeds or a confirmed app API. |

## Recommendation basis

Use a structured primary provider for app display and a medical analyst as optional context. Continue Tank01 for live stats, schedule, depth charts, roster injury flags, and current integrations. Prefer FantasyPros for a well-documented news/injuries/rankings API if the league wants a new paid provider. RotoWire is the editorial-quality alternative if it can provide an appropriate data license.

## Source URLs

- https://www.fantasypros.com/api-data/
- https://www.fantasypros.com/nfl/injury-news.php
- https://www.rotowire.com/football/news.php
- https://www.rotowire.com/football/injury-report.php
- https://www.nbcsports.com/fantasy/football/player-news
- https://sicscore.com/

## FantasyPros API endpoint notes

- Base URL: `https://api.fantasypros.com/public/v2/json`
- `GET /nfl/news?limit={1..100}&category={injury|recap|transaction|rumor|breaking}&order_by={created|updated}` returns `items` with player ID, team, title, description, impact, author, link, and date.
- `GET /nfl/injuries?year=2026&week={week}&include_probabilities=true` returns injury type, status, status short code, practice participation, and probability of playing.
- `GET /nfl/2026/consensus-rankings?position={QB|RB|WR|TE|OP}&scoring=PPR` provides ECR/ADP/tier data; rankings documentation also supports weekly and rest-of-season contexts.
- Player metadata (`GET /nfl/players`) provides FantasyPros player IDs and external-ID cross references for matching.
- Source: https://api.fantasypros.com/public/v2/docs
