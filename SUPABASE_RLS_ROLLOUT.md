# WRC Supabase RLS Rollout Blueprint

## Purpose

This document defines the staged migration from browser-mediated Supabase access to validated server procedures with Row-Level Security. The goal is to protect league data and owner actions **without interrupting active league workflows**.

> **Cutover rule:** Do not enable RLS on a table until every required browser read and write has a tested replacement that uses the signed WRC team session and the server-only Supabase service role.

## Current exposure inventory

The browser currently uses the public Supabase client for direct reads and writes across core league operations. The highest-risk issue is the `teams` table: it is queried by the Login and Auth context paths with the PIN field included, and it is also updated directly by Settings, Trades, and Transactions.

| Area | Browser-accessed tables or buckets | Current direct browser operation | Migration priority |
|---|---|---|---|
| Login and team identity | `teams` | Reads team identity and PIN; updates PIN | **Critical** |
| Owner lineup and roster activity | `players`, `weekly_results`, `roster_moves`, `faab_bids` | Reads roster data; records moves, bids, and results | **Critical** |
| Trades and draft assets | `trade_proposals`, `traded_picks`, `draft_queue`, `draft_picks`, `draft_state` | Creates and accepts trades; edits picks and owner queues | **Critical** |
| Keeper and waiver workflows | `protections`, `watchlist`, `faab_bids`, `roster_moves` | Creates, updates, and deletes owner selections | **High** |
| Commissioner scoring and history | `team_standings`, `weekly_results`, `earnings`, `money_owed`, `gow_history` | Updates standings, results, payments, and awards | **High** |
| Team assets | `teams`, `team-logos`, `theme-songs` | Uploads public assets and updates team URLs | **High** |
| League read-only pages | `teams`, `players`, `team_standings`, `weekly_results`, `draft_picks`, `earnings`, `money_owed`, `gow_history`, `traded_picks` | Reads public league information | **Medium** |

## Target authorization model

The application will use the existing PIN-hash and server-session foundation as its source of identity. A successful server-side PIN verification creates a signed, httpOnly WRC team session. All owner and commissioner mutations must validate that session on the server before accessing Supabase with the service-role client.

| Actor | Server authorization rule | Examples |
|---|---|---|
| Visitor | Read only deliberately public league data through redacted server procedures | standings, schedules, public rosters |
| Owner | Signed session team ID must match the record owner/team ID | own lineup, own queue, own bids, own trade proposal, own theme/logo |
| Commissioner | Signed session must identify a commissioner team | results, standings, draft administration, payment and award operations |
| Scheduled collector | Authenticated project schedule identity only | rolling FantasyPros archive collection |

## Migration sequence

### 1. Secure login and team directory

Create server procedures for the redacted team directory, PIN verification, session refresh, and logout. Remove all browser reads of `pin`, `pin_hash`, and any secret team fields. The browser should receive a redacted session payload only.

### 2. Replace owner writes

Migrate owner workflows in small testable groups: lineups, draft queue and watchlist, FAAB bids, protections, trade proposals, team assets, and roster moves. Each procedure must derive the acting team from the signed session rather than accepting an arbitrary team ID from the browser.

### 3. Replace commissioner writes

Migrate schedule results, standings, draft administration, transaction corrections, earnings, money, and other commissioner workflows. Every procedure must explicitly verify commissioner status server-side.

### 4. Replace sensitive browser reads

Move identity-sensitive reads, including teams, private roster state, bids, draft queues, and trade proposals, behind server procedures. Public pages may use dedicated redacted server reads rather than the raw table.

### 5. Enable RLS in table batches

Enable RLS only after a batch no longer has direct browser dependencies. The default policy will deny anonymous access. The service-role server client bypasses RLS, while public data is exposed only through deliberately redacted server responses.

### 6. Remove legacy credentials and browser writes

Drop the plaintext PIN application flow, stop storing PINs in browser state or local storage, and remove every direct browser insert, update, delete, upload, and private select. Retain only the public Supabase client if it is needed for intentionally public asset URLs; otherwise remove it from authenticated workflows.

## Validation gates

Before each RLS batch, test three perspectives: an unauthenticated visitor, a signed-in owner, and a signed-in commissioner. Verify that the owner can perform only their allowed operations, the commissioner can perform permitted administration, and direct REST requests with the public browser key cannot read or mutate protected records.

The team-selector and PIN login, lineup save, FAAB bid, protection submission, trade proposal and acceptance, draft queue edit, team asset upload, commissioner result entry, and read-only league pages are mandatory regression flows before the final RLS cutover.
