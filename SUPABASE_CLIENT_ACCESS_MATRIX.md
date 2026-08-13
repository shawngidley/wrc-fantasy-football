# WRC Client-to-Supabase Access Matrix

## Classification Rules

| Classification | Meaning after migration |
|---|---|
| Public read | League visitors may view published information through a read-only server endpoint or narrow RLS view. |
| Owner protected | A signed WRC team session may read or change only records belonging to that team. |
| Commissioner only | A signed commissioner session may perform the action. |
| Server only | The browser must not access the table or bucket directly. |

## Workflow Migration Matrix

| Current browser workflow / file area | Table or bucket | Current operation | Target classification |
|---|---|---|---|
| `AuthContext`, `Login` | `teams` | Reads team, owner, FAAB, and PIN data to sign in | **Server only** for PIN data; public read may expose only display-safe team fields |
| `Lineup`, `useLineupPersistence` | `lineups`, `players`, `teams` | Reads rosters and deletes/inserts saved lineup slots | Public read for published rosters; **owner protected** for a team’s lineup writes |
| `useDraftQueue`, `DraftBoard` | `draft_queue` | Creates, reorders, and deletes queued players | **Owner protected** |
| `DraftBoard` | `draft_picks`, `draft_state`, `players`, `traded_picks` | Reads draft board; starts draft, submits picks, updates ownership | Public read for published board; **commissioner only** for draft state and official pick writes |
| `Protections` | `protections`, `players`, `traded_picks` | Reads roster/pick data and saves selections | Public read for published protections; **owner protected** before lock; **commissioner only** for final administrative override |
| `FAABBidModal`, `FreeAgents` | `faab_bids`, `players`, `roster_moves`, `teams` | Creates bids; displays players and balances; awards/cuts players | Public read for free-agent pool; **owner protected** for own bids; **commissioner only** for awards, FAAB deductions, player moves, and transaction log writes |
| `Trades` | `trade_proposals`, `traded_picks`, `players`, `teams`, `roster_moves` | Creates/counters/accepts trade proposals; moves assets | **Owner protected** for a participant’s proposal/counter/accept; **server only** for execution, player moves, balance/pick changes, and transaction writes |
| `useWatchlist`, `FreeAgents`, `PlayerPage` | `watchlist` | Reads and changes a personal watchlist | **Owner protected** |
| `Settings` | `teams`, `team-logos`, `theme-songs` | Changes team logo and theme song files/settings | **Owner protected** for own assets; **commissioner only** for other teams; browser uploads replaced by signed server upload paths |
| `Money` | `money_owed`, `earnings`, `gow_history`, `teams` | Shows financial status and edits balances | Public read of published summary only; **commissioner only** for all edits and unredacted balances |
| `useWeeklyResultsWriter`, `Results`, `Standings` | `weekly_results`, `team_standings`, `gow_history`, `earnings` | Shows published outcomes; writes automatic/final results | Public read; **server only** for writes |
| `Transactions` | `roster_moves` | Shows league activity; records league activity | Public read; **server only** for inserts |
| `Rosters`, `PlayerPage`, `PlayerNews`, `LiveScoring`, `Schedule`, `ScheduleResults`, `DraftRecap`, `History`, `Rundown` | `teams`, `players`, `lineups`, `draft_picks`, `weekly_results`, `team_standings`, `roster_moves` | Read-only league display | Public read through narrowed read routes/views |
| `useTeamLogos` | `teams`, `team-logos` | Reads logo references | Public read of a safe `logo_url` field; bucket objects read through public/signed URLs only |

## Direct Tables and Buckets Identified

The browser presently calls `teams`, `team_standings`, `roster_moves`, `players`, `trade_proposals`, `draft_picks`, `protections`, `gow_history`, `draft_queue`, `weekly_results`, `traded_picks`, `money_owed`, `earnings`, `draft_state`, and `faab_bids`; it also accesses the `theme-songs` and `team-logos` buckets. Every write to these resources will move behind an authenticated server procedure before RLS is enabled.

## Implementation Boundary

The first secured release will retain public viewing of published league information and replace sensitive writes in this order: PIN login, lineup persistence, draft queue, watchlist, FAAB bids, protections, trades, draft actions, commissioner operations, and storage uploads. RLS will be enabled only when the associated browser operation has been removed or routed through a server procedure.
