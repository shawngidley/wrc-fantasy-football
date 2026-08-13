# WRC Supabase Security Migration Plan

## Purpose

This plan removes public write access to WRC league data while preserving the familiar team-selector and PIN sign-in experience. The website will continue to use Supabase as the league system of record, but the browser will no longer receive PIN values or issue trusted writes directly to Supabase.

## Target Access Model

| Area | Current exposure | Target access after migration |
|---|---|---|
| Team PINs | Downloaded to the browser and compared locally | Verified only on the WRC server against a one-way hash |
| Public league information | Direct public Supabase reads | Read-only server endpoint or narrowly scoped public view |
| Owner actions | Browser writes directly to Supabase | Server validates the signed owner session and performs the action |
| Commissioner actions | Client-side role checks and direct writes | Server checks commissioner role before executing the action |
| Supabase service key | Not used | Stored only as a server secret; never sent to a browser |

## Migration Sequence

First, create a backup/export of the affected Supabase tables and storage policy definitions. The migration then adds a `pin_hash` value for each team, verifies that every owner can still sign in through a server-side PIN endpoint, and removes the browser-visible PIN field from all client queries. Plain-text PIN values are removed only after the complete login verification pass succeeds.

Next, owner actions move behind server procedures. The first priority actions are lineup saves, draft queue changes, protections, FAAB bids, watchlist updates, and trade proposals. Commissioner-controlled actions such as draft execution, FAAB awards, result writing, financial updates, and roster moves receive separate server-side commissioner checks.

> Row Level Security must be enabled only after browser-side writes have been replaced. Enabling it beforehand would stop the current direct Supabase workflows.

Once the new server paths have been validated, enable RLS for every public table. Public read-only information, such as standings, schedules, historical results, and published rosters, can remain visible through carefully limited read policies or server procedures. Sensitive tables, including PIN fields, bids, queues, trade proposals, financial balances, and administrative records, become server-only.

## Safeguards and Acceptance Tests

| Test | Expected result |
|---|---|
| Team PIN sign-in | Correct PIN creates only that team’s signed session; incorrect PIN fails without revealing whether a team exists |
| Lineup save | Owner can modify only their own team’s lineup; another team ID is rejected server-side |
| FAAB and trades | Owner can submit only their own bid or proposal; commissioner-only approvals reject normal owner sessions |
| Draft actions | Owners can submit their own queue; only commissioner/authorized draft flow can make official picks |
| Public browsing | Standings, schedule, rosters, history, and news continue to render without exposing PINs or private balances |
| Direct Supabase requests | An anonymous browser request cannot read private tables or insert/update/delete protected records |
| Regression testing | Draft, lineup, Free Agents, trades, protections, money, and transactions remain functional after RLS is enabled |

## Required Inputs Before Implementation

The migration requires a Supabase **service-role key** stored as a server-side secret, plus approval to add a hashed-PIN field and replace the current browser-to-Supabase write paths. The existing owner-facing sign-in screen can remain visually unchanged.

## Rollback Strategy

Before enabling RLS, save a deployment checkpoint and export affected Supabase table schemas and policies. If a regression appears in the acceptance tests, restore the application checkpoint and temporarily retain existing policies while the server procedure is corrected. No PIN deletion or restrictive policy is applied until the server-verified sign-in flow passes for all teams.

## References

[1] [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

[2] [Supabase: Securing Your Data API](https://supabase.com/docs/guides/api/securing-your-api)
