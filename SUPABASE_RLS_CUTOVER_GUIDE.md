# Supabase RLS Cutover Guide

The application migration is complete: browser writes and sensitive team reads now route through signed WRC team-session procedures, while public league data remains read-only. The accompanying `SUPABASE_RLS_CUTOVER.sql` script enables RLS for the known WRC application tables that exist in the deployed schema, denies direct API access to sensitive tables, and allows direct `SELECT` only for public league displays.

## Required action

Open the **Supabase SQL Editor** for project `aquroadkdiltzsvahuff`, paste the complete contents of `SUPABASE_RLS_CUTOVER.sql`, and run it once. The Manus application database console cannot run this script because it routes through TiDB rather than the Supabase PostgreSQL database.

After it completes, reply with the result of the two verification queries at the bottom of the script. I will then test the development and production endpoints for public reads, denied direct writes, owner flows, and commissioner flows.

| Data category | Direct browser access after cutover |
|---|---|
| League displays: players, results, draft picks, lineups, standings, moves, money, earnings, Game of the Week, traded picks, draft state | Read-only |
| Teams and PIN fields | Denied; redacted server procedures only |
| Owner-private queue, watchlist, bids, protections, trades | Denied; signed server procedures only |
| Archive collector data | Denied; server and scheduled collector only |

The server uses the Supabase service-role credential and remains able to perform authorized operations despite RLS. The script does not remove or modify existing team-logo or theme-song bucket data.
