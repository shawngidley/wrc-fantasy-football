# WRC Fantasy Football Acceptance-Testing Runbook

## Rule Zero: Never Test State Changes in the Real League

Testing draft picks, keeper/protection submissions, roster assignment, FAAB awards, trades, draft resets, or the post-deadline release in production can alter the real 2026 league. Those tests belong in an isolated **WRC Test League** with separate data, test accounts, and a resettable clock.

The production site is limited to a short **read-only smoke test** after releases: pages load, the team selector appears, a permitted owner can sign in, and read views such as Standings, News, Lineup, and Draft display normally. Do not make a production pick or submit a production protection simply to test it.

## Required Test-Legue Setup

The technical administrator creates a staging environment with the same application version and environment variables as production, except that it points to a separate database and separate storage prefix. It uses twelve test teams and temporary test PINs that are unrelated to owner PINs. The test league contains a deterministic player pool, draft order, mock rosters, FAAB balances, protected-player examples, and fixture data for scoring.

| Staging component | Requirement |
|---|---|
| Database | Separate from production; no production write credentials or production tables |
| Teams | Twelve named test teams plus a test commissioner |
| Player pool | Known available and rostered players, including legal and illegal protection examples |
| Clock | Test-only deadline/time override; never invoke the live August 25 job |
| Reset point | A named staging-only baseline backup or database snapshot created immediately before rehearsal |
| Access | Private test URL; only commissioner, technical administrator, and designated testers |

## Staging Reset Procedure

Only the **technical administrator** resets staging. The commissioner and owner testers do not receive database or reset access.

1. Before each rehearsal, the technical administrator creates or confirms a staging-only snapshot named `wrc-test-baseline-2026`. It must include the test teams, test player pool, draft order, mock rosters, zeroed transactions, configured test deadline, and the test commissioner account.
2. The administrator records the snapshot timestamp in the rehearsal log and confirms the target is the staging database, not `aquroadkdiltzsvahuff` or any production database.
3. After a rehearsal, the administrator restores `wrc-test-baseline-2026` through the staging database provider’s restore/clone control. No SQL, reset action, or scheduled endpoint may be run against production.
4. The administrator redeploys/restarts only the staging service if the restore requires it, then signs in as the test commissioner.
5. The administrator verifies the reset with this checklist: test draft is not started; no draft picks exist beyond the fixture; every player has the baseline team assignment; test queues and watchlists are empty; FAAB balances equal the fixture values; the test protection deadline is restored; no pending trade or waiver result remains.
6. Two testers independently refresh the test league and confirm the same baseline state before the next rehearsal begins.

If any item fails, testing pauses. The administrator restores the staging baseline again; they must not manually patch individual roster or draft records unless creating a new documented fixture version.

## Acceptance Test Matrix

| Area | Test action | Expected result |
|---|---|---|
| Login and security | Valid test login; invalid PIN; repeated invalid PIN; cross-team URL/input tampering | Valid owner enters the test league; invalid attempts are safely rejected/rate-limited; no owner can alter another team |
| Protections | Protect a Tier 1 player, then two Tier 2 players; attempt invalid/duplicate choices | Tier 1 consumes the required round; remaining legal rounds are offered; invalid choices are rejected |
| Protection deadline | Advance the **test-only** clock; invoke the staging release handler once and again | Late edits are blocked; protected players remain rostered; only unprotected roster players move to the draft pool; repeat run makes no extra changes |
| Owner queue | Add, order, remove, and draft queued players | Queue is private; ordering persists; drafted players no longer appear as actionable queue entries |
| Draft controls | Start, pause, resume, skip, and reset as test commissioner | State and clock synchronize; only commissioner controls work; reset affects staging baseline only |
| Draft pick and roster | Current owner drafts an available player while a second owner watches | One pick is recorded; player leaves pool; player appears on drafting roster; next pick advances; second session updates without reload |
| Invalid draft attempt | Out-of-turn pick or attempt to draft an already drafted player | Rejected server-side with no roster, board, or clock side effect |
| Lineup | Save a valid lineup; perform a Slot-triggered legal swap; attempt illegal/locked swap | Valid lineup persists across refresh; legal swap works; invalid selection is blocked |
| FAAB and trades | Submit valid/invalid bids; propose, counter, accept trade; third owner attempts acceptance | Balances and permissions are enforced; only recipient may accept; accepted transaction is atomic |
| Scoring and results | Use a known completed-game fixture, including a 54-yard made field goal and a missed kick | WRC totals match fixture; 54-yard make earns 5.4; event history and standings change once |
| News and mobile | At 375 px width, test News sources, filters, disclosure rows, horizontal tables, lineup Slot control, Draft menus | Controls are visible/tappable; no clipped content; vertical and horizontal scrolling both work |

## Rehearsal Sequence

Run the tests in this order: authentication and permission boundaries; protections and deadline release; draft/queue/roster updates; lineup, FAAB, and trades; scoring and standings; News and mobile. Use two browsers for every draft-state test—one acts, one observes realtime updates.

Record for each case: date, staging snapshot name, tester, browser/device, action, expected result, actual result, screenshot or screen recording for failures, and whether the reset verification passed. Any defect involving protection rules, authorization, roster ownership, draft turns, player assignment, release logic, or score finalization is a **no-go** until it is fixed, retested, and reset cleanly.

## Production Smoke Test After Release

After a production deployment, perform only this short check: open the public Login page; confirm team list loads; sign in with an authorized owner only if the commissioner agrees; open Standings, News, Lineup, and Draft; verify the date, data, and page load are normal; then sign out. Do not submit a protection, pick, trade, FAAB bid, lineup change, or reset action for smoke testing.
