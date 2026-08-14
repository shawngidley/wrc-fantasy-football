# Supabase RLS Post-Cutover Verification

## Cutover method and rollback

RLS was applied as one atomic PostgreSQL transaction after the application had already moved browser writes and sensitive team access to signed server procedures. The transaction either completed fully or would have rolled back fully; the first run failed on an absent table and made no change. The corrected schema-aware script then completed successfully.

The safe rollback is **not** to disable RLS globally, because that could expose team PIN fields again. If an emergency application issue occurs, restore the prior published application checkpoint first, preserve the RLS policy inventory for review, and make a narrowly scoped temporary policy only for the affected table. The finalized cutover script is idempotent for the covered tables and can be run again to restore the intended least-privilege state.

## Policy inventory

The Supabase verification export reported twelve policies, all named `wrc_public_read_*`, and each is a `SELECT` policy for `anon` and `authenticated`. Sensitive tables have no browser policy.

| Category | Tables | Browser direct access |
|---|---|---|
| Public league displays | `players`, `weekly_results`, `draft_picks`, `lineups`, `money_owed`, `gow_history`, `earnings`, `team_standings`, `roster_moves`, `traded_picks`, `draft_state` | Read-only |
| Sensitive team and owner data | `teams`, `watchlist`, `faab_bids`, `protections`, `trade_proposals`, `draft_queue` | Denied; signed server procedures only |
| Server-managed updates | Draft controls, score finalization, transactions, money, media, PINs, weekly results | Denied; server service-role procedures only |

## Direct anonymous verification

The post-cutover anonymous REST checks produced the following results:

| Check | Result | Expected outcome |
|---|---:|---|
| `GET /players?select=name&limit=1` | `200` with data | Public display reads work |
| `GET /teams?select=id,name,pin,pin_hash&limit=1` | `200` with `[]` | Team records, including PIN fields, are hidden by RLS |
| `GET /watchlist?select=player_name&limit=1` | `200` with `[]` | Owner-private watchlists are hidden by RLS |
| Anonymous `POST /watchlist` | `401`, PostgreSQL `42501` | Direct write denied |
| Anonymous `PATCH /teams` | `401`, PostgreSQL `42501` | Direct write denied |

## Server authorization coverage

The focused authorization suite contains no-session and non-commissioner checks for watchlists, FAAB, protections, trades, draft controls, results, transactions, team PIN/media changes, weekly finalization, money changes, and commissioner protection overview. The complete test suite passed after the cutover preparation with **20 test files and 50 tests**.

## Pending owner-session smoke check

One final interactive check remains: an owner should sign in with a normal league PIN and save their own lineup. The UI must work without any browser Supabase access to PIN or team rows, and the server must reject any attempt to save another team’s lineup. This requires a real owner session and should be performed from the deployed site.
