# Verification Notes

## Compact Player Card News — 2026-08-13

Javonte Williams’s Player Card was checked in the browser. The initial view showed exactly the three most recent FantasyPros updates and a `Show all 10 updates` control. Selecting that control revealed the full ten-item history and changed the label to `Show fewer updates`. A separate true-mobile capture did not complete the external player-data load, so final hands-on mobile verification remains pending.

## Overall ECR and Position Rank — 2026-08-13

Woody Marks’s Player Card was checked in the browser after the FantasyPros overall-ranking query was added. The card displays `Overall ECR #151` separately from `Position Rank RB50`, confirming that the prior duplicate position-scoped rank is corrected.

## Published Rank Verification — 2026-08-13

The production URL for Woody Marks was checked directly. It currently returns `Overall ECR #151` and `Position Rank RB50`; the duplicate `#50` / `RB50` presentation is not present in the published build.

## Duplicate Rank Fallback — 2026-08-13

The reported duplicate `#50` and `RB50` presentation was not reproducible from the published Player Card, which returned `#151` and `RB50`. The most likely explanation is that the phone rendered an earlier deployed client bundle during the automatic-publish transition. A deterministic fallback now suppresses Overall ECR whenever its numeric value matches the numeric portion of Position Rank. This behavior is covered by a client Vitest test; the suite completed with five passing test files and six passing tests.

## Player Card Average and Pinned Year — 2026-08-13

Woody Marks’s current-season row was checked in the browser. The Player Card now calculates and shows rushing average `3.6` from 703 rushing yards on 196 carries. The Year cell uses an opaque background, higher stacking level, fixed width, and edge shadow; after horizontal scrolling, it remained above the moving stat cells rather than allowing them to show through.

## Trey McBride Historical Stats Investigation — 2026-08-13

Trey McBride’s Player Card resolves to ESPN athlete ID `4361307`. The current 2025 Tank01 row is complete, while prior historical rows appear after the ESPN game-log requests complete but have receiving fields shifted or absent. The next step is to inspect the per-season ESPN label sequence and category structure for that athlete.

The ESPN 2024 response uses receiving-first labels (`REC`, `TGTS`, `YDS`, `AVG`, `TD`) followed by optional rushing labels. The previous parser skipped receiving fields whenever a `CAR` label existed. The revised parser handles receiving and rushing independently, uses the first `YDS`/`TD` pair for receiving, and uses a versioned cache key so prior incorrect rows are invalidated. Trey’s corrected rows now display: 2024 — 111 REC, 147 TGTS, 1,146 YDS, 10.3 AVG, 2 TD; 2023 — 81 REC, 106 TGTS, 825 YDS, 10.2 AVG, 3 TD; 2022 — 29 REC, 39 TGTS, 265 YDS, 9.1 AVG, 1 TD.

The 2023 and 2022 ESPN source responses were independently totaled after the parser change. The source confirms 2023 — 17 games, 81 REC, 106 TGTS, 825 YDS, 10.2 AVG, 3 TD; and 2022 — 16 games, 29 REC, 39 TGTS, 265 YDS, 9.1 AVG, 1 TD. These match the Player Card rows.

## Trey McBride Published Cache-Bust Verification — 2026-08-13

The published card was loaded at `/player/Trey-McBride?v=cde2c289`, which forced a new client-page load. It showed the complete corrected 2024–2022 rows: 2024 — 111 REC, 147 TGTS, 1,146 YDS, 10.3 AVG, 2 TD; 2023 — 81 REC, 106 TGTS, 825 YDS, 10.2 AVG, 3 TD; 2022 — 29 REC, 39 TGTS, 265 YDS, 9.1 AVG, 1 TD. This confirms the deployed client is correct; the user’s original tab was retaining a pre-update client state.

## Historical Cache Recovery — 2026-08-13

The historical Player Card hook had versioned session-storage keys but did not actively remove obsolete schemas. The parser correction changed the cached data shape from `wrc_espn_gl_v3_` to `wrc_espn_gl_v4_`; on the next current-client run, the hook now removes all older `wrc_espn_gl_` keys before reading the current schema. The new behavior is covered by a Vitest cache-purge test.

Browser inspection of Trey McBride’s published Player Card found the prior cache schema still present: `wrc_espn_gl_v3_4361307_2022`, `_2023`, `_2024`, and `_2025`. After the new client bundle loads, it removes those stale keys, fetches the corrected game-log values under the `v4` schema, and then reuses only the fresh entries.

After the v4 recovery bundle published, the normal production URL `/player/Trey-McBride` was loaded without a query string. It returned the corrected historical rows directly: 2024 — 111 REC, 147 TGTS, 1,146 YDS, 10.3 AVG, 2 TD; 2023 — 81 REC, 106 TGTS, 825 YDS, 10.2 AVG, 3 TD; 2022 — 29 REC, 39 TGTS, 265 YDS, 9.1 AVG, 1 TD.

## All-Player Player Card Audit — 2026-08-13

The Player Card uses shared FantasyPros rank queries and the shared ESPN season-stats hook for all player positions. Initial Josh Allen inspection confirmed the quarterback row enters the shared renderer; the external ranking response and historical game-log requests had not completed at initial capture, so final cross-position verification remains pending.

Josh Allen’s completed Player Card shows the shared quarterback historical parser and team-logo row data. Saquon Barkley verified the shared running-back parser after cache refresh: his 2024 row now reads 345 CAR, 2,005 rushing YDS, 5.8 AVG, 13 rushing TD, 33 REC, 278 receiving YDS, and 2 receiving TD. DOM inspection confirmed the season-logo column resolves PHI for 2025–2024 and NYG for 2023–2020, without any player-specific lookup table.

Davante Adams identified a general veteran-player edge case: ESPN’s game-log endpoint returned a season filter without event data for athlete ID 16800, while its season-total endpoint returned complete category totals and team metadata. The shared hook now falls back to that season-total endpoint for any player whose game log has no labels, so older and veteran players receive prior-year stats and a primary-season team logo without a custom player map.

Davante Adams’s completed fallback rows verify the shared veteran path: 2024 — 85 REC, 141 TGTS, 1,063 YDS, 12.5 AVG, 8 TD; 2023 — 103 REC, 175 TGTS, 1,144 YDS, 11.1 AVG, 8 TD; 2022 — 100 REC, 180 TGTS, 1,516 YDS, 15.2 AVG, 14 TD. Comma-formatted ESPN totals are now parsed numerically before averages and WRC points are calculated.

The FantasyPros Overall ECR and Position Rank fields are produced through the shared Player Card queries for every supported position. Historical parsing has now been covered by unit tests for quarterback passing/rushing groups, running-back rushing/receiving groups, wide-receiver/tight-end receiving-first groups, kicker accuracy, and defensive categories. Representative live cards verified Josh Allen (QB), Saquon Barkley (RB, PHI/NYG season logos), Davante Adams (WR, LAR/NYJ/LV/GB season logos), and Trey McBride (TE).

## Global Season-Team Identity and Jaguars Normalization — 2026-08-13

Chris Rodriguez Jr.’s initial Player Card load showed his current 2026 Jacksonville assignment while historical season data was still loading. The completed 2025 row must resolve to Washington from ESPN’s 2025 season data, so the shared season table now gives a completed season’s team priority over a present-day team. All Player Card team display, logos, matchups, schedules, depth-chart lookups, watchlist entries, and FantasyPros news tags pass through the canonical NFL team-code normalizer, which maps upstream `JAX` to `JAC`.

After the shared Tank01 and Player Card normalization updates, Chris Rodriguez Jr.’s active profile, FantasyPros news labels, and Week 1 matchup display use `JAC` consistently. His 2025 historical row displays Washington’s logo, while 2024 and 2023 rows also remain Washington. TypeScript and all 17 tests pass, including the shared JAC normalization test.

The 2025 Player Card row now renders only after the ESPN 2025 historical team is resolved; it has no present-day-team fallback. The regression test uses Chris Rodriguez Jr.’s WSH 2025 row after his 2026 Jacksonville move. Trevor Lawrence independently verified a second Jaguars player: Player Card header/logo, FantasyPros news tags, all historical season logos, and Week 1 matchup consistently use `JAC`.

## Standings Roster Briefing Expansion — 2026-08-13

The Standings page now calls a server-side FantasyPros roster-news procedure that resolves player IDs through weekly consensus rankings, retrieves up to six player-specific updates per roster player, supplies a missing player name from the known roster, removes duplicates, and sorts by timestamp. A direct endpoint verification for Alec Pierce, Trey McBride, and Ricky Pearsall returned multiple named items with FantasyPros author, description, and impact context. The initial on-page news preview limits to two items per player and eight total items so one player’s backlog cannot crowd out the rest of the roster; owners can expand the entire history. Injury cards expose FantasyPros comments, practice context, and availability probability directly. The mobile owner-view confirmation remains pending because the development browser is not logged into a team.

## Vipers Player News Regression — 2026-08-13

The published checkpoint used the initial player-specific roster-news path, which resolved FantasyPros rank IDs with the draft-mode ranking endpoint and then discarded player-specific news items whose API payloads omitted `player_name`. That is why the deployed Vipers Player News panel remained empty even while Injuries rendered. The exact `team-shawn` roster was retrieved through the same Supabase REST data path as the client and includes Alec Pierce, Trey McBride, Mike Evans, Ricky Pearsall, Javonte Williams, Woody Marks, and other current players. The corrected development endpoint now uses weekly position rankings to resolve IDs, restores each known roster name when FantasyPros omits `player_name`, and returns a 67,574-byte detailed Vipers response containing multiple player-specific FantasyPros updates and impact blurbs.

## Persistent Production Empty-State Diagnosis — 2026-08-13

The corrected production server endpoint returned a 67,574-byte Vipers response in 4.60 seconds, including detailed stories for Baker Mayfield, Mike Evans, Alec Pierce, Courtland Sutton, Chris Rodriguez Jr., Javonte Williams, Woody Marks, and others. Therefore, the remaining failure was client-side: the Player News panel copied the asynchronous query response into local state via an effect, allowing its empty-state update to win the render sequence. The panel now derives its items directly from the tRPC query data and adds a versioned query input to invalidate older client query cache entries.

## Standings Roster Briefing Headshots — 2026-08-13

The shared PlayerNewsRow now resolves player images from Tank01’s ESPN fields and displays the returned ESPN headshot URL. Baker Mayfield’s profile verification returned `espnID` 3052587 and `https://a.espncdn.com/i/headshots/nfl/players/full/3052587.png`. The component uses visible player initials whenever no player ID is available, for D/ST, or after an image load failure. Because both the Injury and Player News panels use this shared component, the behavior applies to every owner roster.

## Live Scoring Headshots — 2026-08-13

The Live Scoring page was loaded with two opposing lineups. After player-profile resolution, visible ESPN headshot image sources populated for individual players on both sides, including Jared Goff, Jordan Love, Jonathan Taylor, Ashton Jeanty, De'Von Achane, Jahmyr Gibbs, Justin Jefferson, Davante Adams, and multiple bench players. D/ST rows retained their initials fallback as designed.

## Dedicated News Disclosure Reproduction — 2026-08-13

The dedicated News page loaded 138 items and exposed each row as a disclosure control. The first explicit arrow button retained `aria-expanded="false"` after both a browser tap attempt and a programmatic `button.click()` followed by a 100ms React update wait. This confirms the reported no-open behavior is reproducible and not a mobile-only perception issue. Tank01 items also lack player-name and body fields in the current page mapping, so expanded rows must be given an explicit visible action even when no source summary exists.

The fragile React-managed expand state was replaced with native `details` and `summary` markup. A forced News-page reload activated the new component; the development page was still waiting for its external news request at immediate capture, so final populated-row interaction verification remains pending the response load.

After the feed loaded, the first native News summary was tapped. It opened visibly, showed an explicit source-summary fallback for the Tank01 item, and revealed its `Read full article` link. This native control avoids the React local-state path that had remained closed after every tap. Final phone-sized confirmation remains pending.

## News Source Dropdown — 2026-08-13

The News page now defaults to FantasyPros through a `News Source` dropdown. The first generic source request completed after the concurrently refreshed ESPN and Tank01 fetches, which allowed an earlier page request to set the empty state afterward. Request-version protection now ignores stale completions. The default FantasyPros view returned 49 current detailed items; Tank01 returned 50 items; and All News returned 140 combined items. When FantasyPros omits a player name in generic news, the page safely derives a leading name from the headline for display and headshot resolution, otherwise showing a neutral FantasyPros Update label.

At a 375×812 mobile viewport, the FantasyPros-default dropdown rendered above the position filter pills without clipping and remained legible. The data request was still loading at capture; desktop interaction separately verified Tank01 and All News content switches. Final hands-on mobile source-switch confirmation remains pending.

## FantasyPros Linked Player Identity — 2026-08-13

The generic FantasyPros news response includes a stable `playerId` even when it omits `playerName`. The News router now resolves unnamed generic stories through the current weekly FantasyPros rankings before returning them to the browser. The Kenneth Walker story carried player ID 23021; the resolved response returned `playerName: "Kenneth Walker III"` and retained his title, impact, and article link. The same resolver covers all ranking-supported fantasy positions, and unit tests verify resolution plus preservation of API-provided names.

The News UI was reloaded after the resolver and fallback updates. Kenneth Walker III rendered with his ESPN headshot, `K. Walker III` label, player-specific title, FantasyPros impact blurb, and article link. Spencer Rattler, formerly shown as `F. Update`, rendered with his actual name and headshot from the player-led headline fallback. No generic rows in the inspected populated viewport retained the F. Update label.

The final full rendered FantasyPros audit inspected all 50 disclosure rows and found zero `F. Update` or `FantasyPros Update` fallback labels. Spencer Rattler and Zamir White both rendered with resolved names, ESPN headshots, FantasyPros impact blurbs, and article links. Focused tests now cover generic player-ID resolution and player-led headline fallbacks for Kenneth Walker III, Spencer Rattler, and Zamir White.

## Production Mobile FantasyPros Empty-State Recovery — 2026-08-13

The production and development FantasyPros news endpoints returned equal nonempty payloads (26,692 bytes). The empty mobile view was therefore a client orchestration problem: it waited for an asynchronous combined ESPN/Tank01/FantasyPros aggregation and could reach an empty render during source sequencing. The News page now derives FantasyPros items directly from its tRPC query, shows the loading state while that query is pending, and retries it up to three times. The generic endpoint no longer waits for six ranking requests on first load; player identity uses safe client-side headline recovery when the API omits it. A fresh development load displayed 50 FantasyPros items after the loading state, including resolved Spencer Rattler, Kenneth Walker III, and Chuba Hubbard rows.

The recovery behavior now distinguishes four states: populated data, loading, temporary unavailability, and genuinely empty data. Last successful FantasyPros items are retained through a subsequent refresh so an in-flight or failed retry cannot clear the visible feed. Unit coverage verifies state selection and cache retention; a fresh News load displayed the 50-item FantasyPros feed after the spinner completed.

## Fantasy-Position-Only News Feed — 2026-08-13

The FantasyPros News view was verified after the eligibility filter. It removed the DST pill and displayed only QB, RB, WR, TE, and K rows, reducing the 50-item generic source to 13 eligible updates. Examples included Patrick Mahomes II (QB), Kenneth Walker III (RB), Jaylen Waddle (WR), Darren Waller (TE), and no defensive or unclassified players.

Tank01 selection returned a single current Deshaun Watson QB update and excluded the remaining non-fantasy-position items. All News combined 39 eligible FantasyPros, ESPN, and Tank01 entries. Every rendered row in the inspected lists carried one of QB, RB, WR, TE, or K; the dedicated DST filter pill was removed.

## FantasyPros Eligible-News Coverage — 2026-08-14

The narrow five-item feed was caused by using the local player pool as the only position resolver. Generic FantasyPros stories contain a stable player ID, and the weekly FantasyPros rankings provide authoritative player position and team for that ID. After enriching the generic response with those fields, a fresh News load displayed 12 current eligible stories, including Jaydon Blue (RB), Dontayvion Wicks (WR), Tucker Kraft (TE), Malik Nabers (WR), Puka Nacua (WR), Jordyn Tyson (WR), Patrick Mahomes II (QB), Kenneth Walker III (RB), DJ Moore (WR), James Cook III (RB), Josh Allen (QB), and Chuba Hubbard (RB). No defensive or non-fantasy rows appeared.

Browser reconciliation queried the current generic FantasyPros tRPC source and the rendered News DOM in the same page. The source contained 50 stories, 12 with authoritative QB/RB/WR/TE/K metadata; the rendered default feed contained exactly 12 disclosure rows. Source positions included only the 12 eligible positions plus 38 intentionally missing/non-fantasy metadata records; rendered rows contained RB, WR, TE, and QB only. A regression test now asserts that the eligible input count and filtered render count remain equal.

## FantasyPros Eligible-News Volume — 2026-08-14

The FantasyPros API supports a 100-story request and returned 92 current stories compared with the prior 50-story window. The maximum window contained 23 eligible QB/RB/WR/TE/K stories at measurement, including recent updates for Rashod Bateman, Jaydon Blue, Dontayvion Wicks, Tucker Kraft, Malik Nabers, Puka Nacua, Patrick Mahomes II, Kenneth Walker III, and later stories such as Shedeur Sanders, Bo Nix, Tua Tagovailoa, and Jonathon Brooks. After the source window expansion, a fresh News page load rendered 26 current eligible stories as new API updates arrived, while retaining no defensive or non-fantasy rows.

## Urgent Login Team Selector Diagnosis — 2026-08-14

The Login component remained in `Loading teams…` because its public Supabase `teams` REST request could not establish an upstream connection. The exact configured query was tested twice and returned HTTP 503 with `upstream connect error or disconnect/reset before headers`, rather than a code, schema, or permission error. The login page now retries the request three times and shows an explicit `Retry team list` action instead of indefinitely presenting a loading selector. Team selection itself cannot be restored until the upstream Supabase project endpoint responds again.

The Supabase teams REST endpoint subsequently recovered and returned HTTP 200. The published login page was reloaded and showed all 12 selectable franchises, including Vipers — Shawn. The standard PIN field and Sign In button were visible and enabled once a team is selected; PIN entry was not exercised because it is owner-provided authentication data.

## Generic versus Player-Specific FantasyPros News — 2026-08-14

The public generic FantasyPros News endpoint exposes only its current 100-story window, has no documented date or pagination query, and currently reaches back to Aug. 12. In contrast, its player-specific `fpid` endpoint returns multiple historical updates for a requested player. For five representative Vipers, the permitted roster-specific endpoint returned 27 updates: Alec Pierce had items from Aug. 11, Aug. 7, Aug. 5, Jul. 28, and Jun. 10; Mike Evans had entries from Aug. 11, Aug. 5, Aug. 3, and Mar. 9; Baker Mayfield had Aug. 11, Jul. 30, Jul. 28, Jul. 27, Jul. 14, and Jun. 6. The News page My Team view now uses this same player-specific endpoint as Standings, while the all-player view remains on the permitted 100-story generic endpoint rather than issuing high-volume individual calls for every league player.

A development-only failure exercise was used and then removed before publishing. With no cached items, a forced failed query displayed `FantasyPros news is temporarily unavailable` and the refresh guidance instead of the zero-article empty copy. With populated rows retained during a forced failure, all 50 FantasyPros rows remained visible. The normal, non-test News page was then revalidated with TypeScript plus focused recovery and source-filter tests passing.

## Private Rolling FantasyPros Archive — 2026-08-14

The private server-database archive stores a SHA-256 source key, source attribution, player identity, title, available FantasyPros description/impact, article link, published time, capture time, and a 30-day expiry. Current eligible News items are merged with archived items by the same stable key, with current data winning duplicate conflicts and newest-first ordering. The initial collection stored 23 eligible FantasyPros stories; its oldest published item was Aug. 12 and earliest expiry is Sep. 11. Archive helper tests cover eligible-position selection, stable keys, duplicate removal, and chronology.

The scheduled collector is active under task `J6ryuqqkdbnSVWjptTHL3B` at `0 0 */6 * * *` (every six hours) and invokes the authenticated `/api/scheduled/fantasypros-archive` endpoint. The task ID is stored in the archive configuration and the handler accepts only that cron identity. A repeated collection left the archive at 23 rows and 23 distinct keys, confirming idempotent deduplication. The persisted configuration reports 30-day retention, a recorded collection time, and expiry dates ranging from Sep. 11 to Sep. 13.

## Server-Only Login Session Migration — 2026-08-14

The Login page now loads its team selector through a server procedure that returns only redacted identity and standings fields. A direct endpoint inspection returned team IDs, names, and owners only; no `pin` or `pin_hash` fields appeared. PIN submission now routes to the server-only `verify_wrc_team_pin` database function, which writes a 12-hour signed httpOnly WRC team session. AuthContext reads that session through a server procedure rather than restoring a browser-stored team object or refreshing the `teams` table with a PIN field. The login screen was verified with all 12 selectable teams and no client-side PIN query. A valid-PIN session test remains owner-gated because testing requires a real owner credential.

## Secure Lineup Persistence — 2026-08-14

Lineup reads now use a server procedure, while saves use a team-session procedure that discards any browser authority over the target team. The server derives `team_id` solely from the signed session before replacing the requested week and season rows. A direct unauthenticated POST to the save procedure was rejected with `UNAUTHORIZED` and `Please sign in with your league team` before any data operation occurred. A valid owner-save test remains session-gated.

## Secure Draft Queue Migration — 2026-08-14

Draft queue reads, adds, removals, and reordering now use signed-team server procedures. Reads are scoped to the session team; mutations never accept a browser team ID. The reorder operation verifies that every submitted queue item belongs to that session team before updating ranks. A direct unauthenticated attempt to add a test player was rejected with `UNAUTHORIZED` and `Please sign in with your league team` before any draft-queue record was written.

## Secure Watchlist Migration — 2026-08-14

Personal watchlist reads and add/remove actions now use signed-team server procedures. The server scopes every query and write to the session team and never accepts a browser-provided team ID. A direct unauthenticated watchlist mutation was rejected with `UNAUTHORIZED` and `Please sign in with your league team` before a record could be changed. Focused Vitest coverage also asserts that unauthenticated watchlist reads and changes fail before database access.

## Secure FAAB Migration — 2026-08-14

The owner bid modal now loads the owner roster and current FAAB balance through a signed-team server procedure, while bid submission derives the bidder and team name from the session. The server enforces the current FAAB balance, rejects a drop player not on the owner’s roster, requires a drop at the 18-player roster limit, and rejects bids for a player already rostered in WRC. Commissioner bid review and award processing now require the commissioner session; only the server can change bid statuses, team FAAB, player ownership, and transaction history. A direct unauthenticated bid POST was rejected with `UNAUTHORIZED`; focused tests also confirm that an owner session receives `FORBIDDEN` for commissioner bid review. The full Vitest suite passed with 18 files and 37 tests, and TypeScript completed without errors.

## Secure Protection Migration — 2026-08-14

The Protections page now loads and saves through signed-team server procedures. The server ignores browser-provided team identity and checks selected player ownership against the current team roster before replacing the saved selections. Shared rules tests cover fixed-cost protections, valid round assignments, a fixed round-seven cost consuming round six, and rejection of an out-of-roster player. An unauthenticated direct protection-save request returned `UNAUTHORIZED` before any data action; focused authorization coverage also rejects unauthenticated protection reads and saves.

## Secure Trade Migration — 2026-08-14

Trade asset pickers, the incoming inbox, proposal creation, counter-offers, decline responses, and acceptance execution now use signed-team server procedures. The server checks both rosters, both FAAB balances, and current ownership of every selected 2026/2027 draft pick at proposal time and again before acceptance. Only the receiving team’s signed session can respond to a pending proposal; accepted trades update rosters, FAAB, picks, proposal status, and transaction history on the server. A direct unauthenticated create-proposal POST returned `UNAUTHORIZED`, and focused authorization coverage guards trade inbox, proposal, and response procedures. The full suite passed with 19 files and 42 tests, and TypeScript completed successfully.

## Secure Draft Control Migration — 2026-08-14

Draft start, pause/resume, skip, and reset controls now require the commissioner session. Owner pick submission is server-authorized: the server reads the current draft state, derives the expected drafting team from the approved 2026 order, rejects an out-of-turn owner, blocks already drafted players, records the pick, assigns the roster, and advances the draft state. A direct unauthenticated commissioner-start request returned `FORBIDDEN`; focused tests also reject unauthenticated draft actions before database access. The full suite passed with 19 files and 43 tests, and TypeScript completed successfully.

## Secure Results Finalization Migration — 2026-08-14

Commissioner score entry now calls a server-only finalization procedure. The server saves the score, recomputes every finalized 2026 weekly result from authoritative rows, recalculates each week’s league median, and replaces the affected standings totals, division records, median records, and streaks deterministically instead of incrementing browser-calculated values. A direct unauthenticated finalization request returned `FORBIDDEN`; focused authorization coverage also rejects it before data access. The full suite passed with 19 files and 44 tests, and TypeScript completed successfully.

## Secure Transaction Adjustment Migration — 2026-08-14

Manual add/drop adjustments now submit through a signed-team server procedure. An owner may submit only for the team in that session, while a commissioner may select another team. The server verifies the target team, FAAB balance, current free-agent status of the addition, and ownership of the drop before writing the paired transaction rows and deducting FAAB. A direct unauthenticated manual-transaction request returned `UNAUTHORIZED`; focused authorization coverage also rejects it before data access. The full suite passed with 19 files and 45 tests, and TypeScript completed successfully.

## Secure Settings and Team Media Migration — 2026-08-14

Settings no longer reads PIN values or writes team records through the browser. Owner PIN updates verify the current PIN server-side; commissioner resets use commissioner-only procedures and return only redacted team identity. Team logos and theme songs are uploaded through the signed team session to managed storage, then saved through the server; removals are also server-authorized. A direct unauthenticated PIN-change request returned `UNAUTHORIZED`, focused authorization coverage rejects PIN/media operations before data access, and a source audit found no remaining browser-side Supabase `insert`, `update`, `delete`, or storage upload calls. The full suite passed with 19 files and 46 tests, and TypeScript completed successfully.

## Server-Only Weekly Result Finalization and Final Mutation Audit — 2026-08-14

The automatic weekly result writer no longer exposes the Tank01 key or writes results, standings, Game of the Week, or earnings from browser code. It now calls a signed-session server procedure, which retrieves final Tank01 data using a server secret and writes with the service-role client. The Tank01 credential passed a live lightweight validation request. A direct unauthenticated finalization request returned `UNAUTHORIZED`, focused coverage rejects the procedure before data access, and the full client mutation audit found no live direct Supabase `insert`, `update`, `delete`, or storage mutations; the sole match was a unit-test `Map.delete` stub. The full suite passed with 20 files and 48 tests, and TypeScript completed successfully.

## Secure Money Management and Complete Mutation Audit — 2026-08-14

Commissioner Money-page edits for balances owed and Game of the Week now use commissioner-only server procedures. The old direct browser PIN-login helper and local team persistence helpers were removed because login now relies entirely on the server-issued httpOnly session. The final audit, including `upsert`, identified no live browser Supabase mutation; its only match is a unit-test `Map.delete` mock. The full suite passed with 20 files and 49 tests, and TypeScript completed successfully.

## Supabase RLS Cutover — 2026-08-14

The corrected PostgreSQL cutover script completed after automatically skipping the absent `fp_news_archive` table. The returned policy inventory contains exactly the twelve intended `wrc_public_read_*` SELECT-only policies for public league-display tables and no policy for sensitive tables such as `teams`, `watchlist`, `faab_bids`, `protections`, `trade_proposals`, or `draft_queue`. Direct anonymous REST verification returned a normal public `players` result (`200`) while a direct request for `teams` fields including `pin` and `pin_hash` returned `[]`. This confirms sensitive team rows are no longer browser-readable; server procedures retain service-role access for authorized workflows.

## Post-Cutover Owner Session Smoke Test — 2026-08-14

The league owner confirmed that a normal owner PIN login, harmless Lineup save, and refresh persistence check all succeeded after the final RLS cutover. This validates the signed server session and server-authorized lineup persistence in the live workflow. Combined with direct anonymous REST denials and focused commissioner authorization coverage, the post-cutover access matrix is complete.

## Full Player Names in Standings and News — 2026-08-14

The shared news row now renders `item.playerName` without shortening the first name to an initial. Standings injuries use the roster’s canonical player name, and roster-specific FantasyPros news maps abbreviated source labels to the canonical roster name, including suffixes such as `Kenneth Walker III`. The dedicated News page now uses the resolved player record’s full name for ESPN, Tank01, and FantasyPros rows. Focused mapping tests and TypeScript validation pass; the full suite reports 20 files and 51 tests passing.

## External Audit Containment — 2026-08-17

The external review correctly identified an exposed Tank01 credential in the public client bundle. All nine browser integrations now call an allowlisted local server proxy, which stores the RapidAPI credential exclusively in the server environment. A production build contains neither the prior key, RapidAPI authorization headers, the Tank01 host, nor source-map files. The proxy returned current Tank01 news successfully (`200`) using the server secret.

The app now sends a CSP compatible with its current fonts, analytics, Supabase, ESPN, and managed media hosts, along with `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`; Express disclosure is disabled. The build no longer produces source maps, and production static handling returns `404` for absent `.map` requests rather than the SPA shell.

Login now applies a five-failure, 15-minute per-team/IP lockout. New and commissioner-reset PINs must be at least six digits and cannot use common, repeated, or simple sequential patterns. A secure database check confirmed that one or more teams retain a listed weak/default PIN; the commissioner explicitly chose to leave current owner PINs unchanged, so the control applies to future changes and login throttling rather than forcibly resetting existing credentials. The public team directory was repaired to return only redacted league display fields. Full regression, TypeScript, and production-build checks passed with 22 test files and 55 tests.

## External Audit Production Verification — 2026-08-17

After the published checkpoint deployed, `wrcfantasyfootball.com` served the new `index-DG_t3uwp.js` asset. A direct production bundle scan found none of the previously exposed Tank01 key prefix, RapidAPI authorization header, or Tank01 host. A non-existent production source-map URL returned `404 text/plain` rather than source or the SPA shell. The live response includes the CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy` headers; `X-Powered-By` is absent. These checks confirm the credential-containment, source-map, and response-header remediation findings are live.

## Exact ESPN Live Kicker Scoring — 2026-08-17

Tank01 aggregate kicker data cannot identify individual field-goal or miss distances, so WRC now polls ESPN public NFL game summaries for active games. The parser reads exact play text such as `B.Aubrey 54 yard field goal is GOOD`, maps ESPN abbreviated names to the full WRC roster name, and calculates made kicks at 0.1 points per yard. It also applies WRC's 60- and 65-yard bonuses, short-miss penalty, and extra-point make/miss values. Live Scoring renders each detected kicker event, such as `54 yd FG made (+5.4)` or `47 yd FG missed (-2)`, and Lineup uses the same event-derived total. Focused parser/scoring coverage and the complete regression suite passed with 23 files and 57 tests; an active-game browser check remains pending until live NFL play-by-play is available.

## Mobile Lineup Slot Controls and D/ST Logos — 2026-08-17

After restoring the development preview's Vite module delivery and React refresh preamble, the read-only Legends Lineup was inspected at a 375×812 viewport. The pinned Slot badges remained inset from the left viewport edge while the SFLEX, K, and D/ST tables retained horizontal-scroll access. In the D/ST panel, New York Giants and Carolina Panthers rows displayed their official ESPN NFL team marks rather than player-initial avatars. The shared `LineupIdentity` component also serves expanded candidate rows, so the same D/ST logo behavior applies when a Slot control reveals legal swaps. The mobile capture completed without a browser runtime error; the full suite subsequently passed with 25 files and 60 tests, and TypeScript validation completed without errors.

## 2026 Draft Schedule Display — 2026-08-17

The canonical WRC draft constant targets `2026-08-30T22:00:00.000Z`, which is Sunday, August 30, 2026 at 6:00 PM ET. A complete client/server source audit found DraftBoard as the sole league-facing schedule display, and it consumes the shared date and display constants rather than retaining a hard-coded copy. The Draft page was inspected in the browser: its visible countdown label read `Sun Aug 30, 2026 · 6:00 PM ET`, with a countdown of 13 days, 7 hours, 2 minutes, and 53 seconds at capture. No August 27 or stale schedule references remained in client or server source.

## Protection Deadline and Draft-Pool Release — 2026-08-17

The unauthenticated Protections view was inspected in the browser and visibly displayed `Tuesday, August 25, 2026 · 9:00 PM ET` above the live deadline countdown. Both Protections and the commissioner Settings panel import the same shared deadline and display constants. The task-bound release handler permits only Heartbeat task `LaGfDUk5V3f3SfxaBF5krR` during the 2026 cycle, and calls the idempotent release routine only after the exact `2026-08-26T01:00:00.000Z` boundary. A new mocked regression suite verifies that the routine performs no read or change before the deadline, releases only rostered unprotected player IDs after the deadline, and reports an already-released state when nothing remains to move. The focused suite passed three tests, and TypeScript validation passed. The live release itself is intentionally not invoked early because it would alter real league rosters.

## Desktop and Mobile Lineup Table Validation — 2026-08-17

The read-only Legends Lineup was inspected with populated roster data at 1440×900 and 375×812. On desktop, SFLEX rendered the requested grouped headers for Weekly Decision, Fantasy, Pass, Rush, Rec, and Turnovers, with leading columns in the requested order: Slot, Player, Age, Bye, Opponent, Game, FPTS, FP/G, and Projection. The separate K and D/ST panels used their kicking and defense header groups, respectively. On both viewport sizes, starter rows remained white while bench rows—including the pinned Slot and Player cells—used a visibly warmer neutral shade. The completed desktop follow-up added and verified explicit gold-neutral inset edge lines on the pinned Slot and Player bench cells, so the start and end of each bench row remain distinguishable even when the table is horizontally scrolled. The mobile capture retained the same grouped SFLEX, K, and D/ST panels with horizontally scrollable detail columns and pinned identity cells. Inline swap interaction remains deliberately pending authenticated-owner testing because read-only lineup views correctly disable Slot controls.

## Player Card Expert Impact Validation — 2026-08-17

The loaded Mike Evans Player Card was inspected after the secure Tank01 lookup completed. The header contains player, NFL, and WRC roster identity without a duplicate ECR badge. The single FantasyPros Insights strip contains the rank metrics. Directly beneath it, a conditional `FantasyPros Expert Impact` card displayed the latest FantasyPros impact text — `Evans was back in pads for the 49ers-Titans joint practice. He was sidelined with a quad injury.` — with author attribution and the external full-note link. The card appeared above Latest News and the hidden legacy ownership card, confirming it remains visible and is not covered by the following content. Rendering is guarded by written FantasyPros impact or injury-comment context, so a rank value alone does not produce redundant Outlook copy.

## Production Subscription-Crash Triage — 2026-08-17

The public production entry page was opened and allowed to settle. It initially displayed the normal temporary `Loading teams…` state, then recovered to the full 12-team selector without a console error. Production CSP explicitly permits both `https://*.supabase.co` and `wss://*.supabase.co` in `connect-src`, so the applied security policy does not block Supabase Realtime WebSocket connections. Source inspection found Realtime subscriptions only in pages and hooks that consume live league data; the unauthenticated Login screen does not create one. Production Standings then loaded normally, had no browser-console errors, and fetched standings from the secured Supabase REST endpoint. Every existing client Realtime channel was verified to remove itself during effect cleanup. The reported mobile-only subscription crash was not reproduced in this browser session, so no security-header change is warranted; remaining reproduction and mobile-session verification stay open for a device that exhibits the issue.

## Seven-Day FantasyPros News Coverage — 2026-08-17

The FantasyPros endpoint ignores unrecognized `page` and `start_date` parameters, so the stable implementation uses WRC’s permitted rolling archive together with the live response rather than assuming unavailable API pagination. The private archive contained eligible QB, RB, WR, TE, and K stories on August 12–17. A new tested client filter retains only valid articles published in the trailing seven days and excludes older, future-dated, and invalidly dated entries. The development News page was inspected after the query completed: the default FantasyPros view rendered 45 chronologically ordered eligible articles and visibly labeled the result `45 articles · Last 7 days`.

## Published FantasyPros News Comparison — 2026-08-17

Immediately after the seven-day checkpoint, the published News page was loaded from `wrcfantasyfootball.com`. It initially returned the same 45 FantasyPros articles in the same descending chronology as development, but the browser was still executing the preceding asset revision and did not show the new label. After the deployment completed, the published asset revision changed from `index-DZjUE3Tm.js` to `index-CSOJ9eeE.js`, and the latter was confirmed to contain the `Last 7 days` label. A fresh published-page load then displayed 48 current eligible stories, including the three newer Tampa Bay updates, with the visible text `48 articles · Last 7 days`. The increase reflects newer FantasyPros content arriving between reads; it confirms that the live feed is current, fully eligible-position-filtered, and no longer served from the earlier client bundle.

## Desktop Lineup Legibility Refinement — 2026-08-17

The populated Legends Lineup was inspected at 1440×900. SFLEX, K, and D/ST panels now center at their natural table width rather than stretching into unused desktop space. The page-level container is constrained to 1360 px, the sticky Slot column increased from 52 px to 66 px, and the Slot badges increased from a 32 px to 46 px desktop target. Desktop table body type increased from 0.72 rem to 0.81 rem, with proportionally larger grouped and column labels. The inspection confirmed the wider badges, clearer player/stat rows, stable sticky identity cells, and unchanged compact K/DST panel widths.

## D/ST Stat-Loading Investigation — 2026-08-17

Tank01’s `getNFLTeams?teamStats=true` response was probed through the secured proxy and confirmed to return team-level `Defense` totals for New York, including sacks, defensive interceptions, fumble recoveries, and defensive touchdowns. D/ST rows had been incorrectly requesting a nonexistent player record by team name, unlike the individual-player path. The Lineup now loads the one team-total response, maps each D/ST by NFL abbreviation, and normalizes defense-only statistics rather than including team offensive totals. A direct rendered-cell inspection verified the New York Giants row contains `154.0` FPTS, `8.3` projection, `38` sacks, `9` defensive interceptions, `11` fumble recoveries, and `3` defensive touchdowns. The Player identity column increased to 205 px, which displays full roster names such as David Montgomery and New York Giants without truncating their identity label.

## D/ST Fantasy Column Simplification — 2026-08-17

The D/ST table now omits the redundant in-week `PTS` and points-allowed `PA` columns in both standard and inline-candidate rows. Its remaining Fantasy sequence is FPTS, FP/G, and Proj, followed by Sack, D INT, FR, and D TD. Tank01 resets preseason standings to 0–0 while retaining completed team defense totals; when this occurs, the D/ST normalizer safely uses the completed 17-game season to calculate FP/G. A direct rendered-cell check confirmed the Giants row headers omit PTS and PA and display `154.0` FPTS with calculated `9.1` FP/G, followed by `8.3` projection, 38 sacks, 9 interceptions, 11 recoveries, and 3 D/ST touchdowns.

## Published D/ST Lineup Verification — 2026-08-17

The production route `https://wrcfantasyfootball.com/lineup/team-davids` was opened in a fresh browser session. It served deployed bundle `index-CWSVF-NV.js`, and its rendered D/ST header sequence was exactly `AGE, BYE, OPP, GAME, FPTS, FP/G, PROJ, SACK, D INT, FR, D TD`; neither PTS nor PA is present. After the live data requests completed, direct DOM inspection confirmed the New York Giants row displayed `154.0` FPTS, calculated `9.1` FP/G, `8.3` projection, 38 sacks, 9 interceptions, 11 recoveries, and 3 defensive touchdowns. No production deployment mismatch remained.

## WRC D/ST Scoring Columns — 2026-08-17

The revised local D/ST header rendered the requested `SK, SFT, TA, TDDST` labels. The initial view correctly retained prior cached totals for FPTS and FP/G but did not contain the newly derived safety, takeaway, and D/ST-touchdown fields, so the stat-cache schema was advanced before final validation. A refreshed browser read then confirmed the Giants row rendered `SK 38`, `SFT —` (zero), `TA 20`, and `TDDST 3`. The takeaway calculation is 9 defensive interceptions plus 11 fumble recoveries, and TDDST represents all recorded defensive/special-teams touchdowns. A focused server-rendered Lineup table regression test opens the D/ST inline-candidate branch and confirms both the selected row and candidate row use the same requested headers and 38/20/3 scoring totals. The focused candidate and stat-normalization suite passed three tests, and TypeScript validation passed.

## League-Wide 2025 D/ST Reconciliation — 2026-08-17

The prior D/ST data path called Tank01 `getNFLTeams?teamStats=true` without a completed-season selector. During the 2026 preseason it returned zeroed current records alongside retained prior aggregate fields. More importantly, its `Defense.fumblesRecovered` includes a team’s recoveries of its own offensive fumbles, so adding that field to defensive interceptions materially overstated takeaways. Tampa Bay demonstrated the defect: Tank01 returned 13 interceptions plus 22 aggregate recoveries, while the completed 2025 team-defense record is 13 interceptions plus 10 opponent fumbles lost, for 23 takeaways; it also had one safety. Green Bay’s corrected line is 7 interceptions plus 7 opponent fumbles lost, for 14 takeaways.

The replacement dataset covers all 32 NFL teams. Sacks, safeties, and D/ST return touchdowns were derived from nflverse’s 2025 regular-season play-by-play (`https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.csv.gz`), while takeaways, defensive interceptions, opponent fumbles lost, and points allowed were reconciled to Pro Football Reference’s completed 2025 team-defense table (`https://www.pro-football-reference.com/years/2025/opp.htm`). The resulting 32-team season totals reconcile to 1,287 sacks, 12 safeties, 629 takeaways, and 67 D/ST touchdowns. The Lineup hook now consumes this completed-season map instead of the ambiguous Tank01 team-recovery field; focused coverage validates all 32 teams and the specific Tampa Bay and Green Bay corrections.

The Lineup roster-table renderer was then exercised with the actual completed-season source entries: Tampa Bay as the rendered D/ST row and Green Bay as its expanded inline candidate. The shared D/ST columns rendered the expected Tampa Bay `SK 37`, `SFT 1`, and `TA 23`, as well as Green Bay `TA 14`. The same focused suite verifies the all-32 map and lineup candidate path together.

## WRC FPTS Calculation Audit — 2026-08-17

Independent raw-provider reconciliation was completed for one player in each offensive position group and compared to the rendered Lineup cells. Tank01 season fields produce Jared Goff (QB) 284.1 FPTS / 16.7 FP/G, Aaron Jones (RB) 117.7 / 9.8, Justin Jefferson (WR) 201.5 / 11.9, and Darren Waller (TE) 100.7 / 11.2 under the WRC formula; each matches the post-fix Lineup. The rendered exact-event kicker line for Chase McLaughlin remains 156.6 / 9.2. The post-fix D/ST table rendered Cleveland 184.0 / 10.8 and the Chargers 161.0 / 9.5. Independently applying the completed 2025 source data produces Cleveland: 53 sacks × 2 + 18 takeaways × 3 + 4 D/ST touchdowns × 6 = 184, and Chargers: 45 sacks × 2 + 23 takeaways × 3 + 1 safety × 2 = 161; both expected totals and their 17-game FP/G values match the rendered Lineup rows.

## Slot-Only Lineup Change Control — 2026-08-17

Main Lineup rows now use the existing position/Slot badge as the only control that can expand eligible replacement choices. The row itself has no swap handler; the Player cell continues to open the Player Card. Expanded candidate rows no longer treat the full row as a swap target: their Slot button is the sole control that executes the change, while their Player cell opens the candidate Player Card. Focused renderer coverage confirms the candidate action has an explicit accessible label, `Move Green Bay Packers into DST`, and TypeScript validation passed.

The click-level DOM test confirms the interaction boundary directly: clicking Tampa Bay’s Slot button invokes only the selection callback, clicking its Player cell invokes only Player Card navigation, clicking Green Bay’s candidate Slot button invokes only the inline-swap callback, and clicking the candidate Player cell again invokes navigation without a second swap. The focused test and TypeScript validation pass.

## Mobile Lineup Identity Compaction — 2026-08-18

At a 375×812 mobile viewport, the Lineup’s sticky identity area now uses a 42 px Slot column and 126 px Player column, replacing the desktop 66 px and 205 px widths. Individual players render as first initial plus last name—for example, J. Goff, A. Jones, and J. Jefferson—while D/ST rows retain their full NFL team names. The capture visibly exposes the Age, Bye, and Opp columns at the same time as the compact Slot controls and player identity. A focused unit test covers individual and D/ST mobile name formatting, and existing click-level interaction coverage confirms the Slot-only control remains intact.

## Lineup Games Played Column — 2026-08-18

GP is now the final right-side stat column in SFLEX, K, and D/ST, under a final Season header group. The desktop Lineup capture verified the column after SFLEX turnovers, after K XP%, and after D/ST TDDST. It displayed the populated Chase McLaughlin kicker GP of 17 and Cleveland/Los Angeles Chargers D/ST GP of 17. The shared candidate-row renderer uses the same final GP cell, with focused table coverage asserting both starter and expanded D/ST candidate values.

Direct table-rendering coverage now also verifies a populated GP of 17 after the final header in each SFLEX, K, and D/ST panel. This guards the final-column placement and value independently of the visual capture, while the expanded D/ST candidate test continues to verify the same GP mapping in candidate rows.

## Free Agents Alignment Checkpoint — 2026-08-18

The initial unauthenticated development Free Agents inspection showed the page remaining in its `Loading...` ownership state with zero rows and no browser-console error. The public `league.rosteredPlayers` endpoint was then probed directly and returned rostered names plus team names successfully; after the batched rank/injury request settled, the same browser page loaded the complete table. In All Players view, the visible sortable `WRC Team` column showed franchises such as HamSandwich, Legends, and The Super Snuffleupagus, while Josh Downs visibly showed `Free Agent`. The SFLEX headers now read FPTS, FP/G, passing, rushing, receiving, TO, and final GP in the same sequence as the Lineup panel. Season-stat batches were still progressively loading during this check, so K and D/ST panel verification remains pending.

The loaded K tab then rendered FPTS, FP/G, FGM, FGA, FG%, XPM, XPA, XP%, and final GP, matching the K Lineup panel. It visibly showed franchise labels such as The Four Horsemen for Cameron Dicker and Free Agent for Tyler Bass. The loaded D/ST tab rendered FPTS, FP/G, SK, SFT, TA, TDDST, and final GP, and included rostered Green Bay (Vipers) alongside unrostered Tennessee (Free Agent). These browser checks confirm the aligned desktop position columns and roster-status labels; the mobile table retains the existing horizontal-scroll design, with its initial data-loading state still under separate asynchronous rendering verification.

## Published Free Agents Propagation Check — 2026-08-18

Immediately after checkpoint `a7be3b85`, the development page showed the expected WRC Team column and Lineup-aligned schemas. A fresh production load initially rendered the prior header set—without WRC Team and with the former GP-first/stat-order layout—while bundle `index-Cd1GPxfx.js` was still active. After propagation, production served `index-C7pev4pk.js`, which contains `WRC Team`. A fresh public-page load then displayed the column, Free Agent labels, FPTS/FP-G, passing, rushing, receiving, TO, and final GP in the expected SFLEX sequence. The public Free Agents update is now live.

## Complete Free Agents Column Parity — 2026-08-18

The Free Agents roster tables now remove ADP and ECR from their primary grid and use the same field order as Lineup, with WRC Team as the one added roster-status column. The loaded SFLEX table showed Player, WRC Team, Age, Bye, Opp, Game, FPTS, FP/G, Proj, passing, rushing, receiving, turnovers, and final GP. The loaded K table showed the same leading context and fantasy fields followed by FGM, FGA, FG%, XPM, XPA, XP%, and GP. The loaded D/ST table used the same leading fields followed by SK, SFT, TA, TDDST, and GP. An exported table-schema test asserts the exact full order for all three panels; it and TypeScript validation pass.

The mobile 375×812 loading state was then checked after the full-parity update. It now retains the scrollable table header rather than a blank white skeleton panel; Player and WRC Team are immediately visible at the sticky left edge, with the full schema available through the existing horizontal scroll rail while roster ownership and season rows load.

## Free Agents Desktop Width and Warm-Load Check — 2026-08-18

The development Free Agents table was re-opened at desktop width after the container increased from 900 px to 1360 px. Its visible table span now contains the Player, WRC Team, Age, Bye, Opp, Game, FPTS, FP/G, Proj, and the first passing/rushing stat columns without immediately needing a rightward scroll. The initially empty table retained its full headers during roster ownership loading; once the request completed, the player rows loaded into that same expanded table. The next validation step is the K panel’s exact completed-season values and persistent cache warm read.

The Free Agents K panel subsequently displayed exact completed-2025 WRC values for Harrison Butker (143.3 FPTS / 8.4 FP/G), Matt Gay (92.1 / 7.7), Wil Lutz (132.7 / 7.8), Nick Folk (134.5 / 8.4), Younghoe Koo (28.3 / 4.7), and Graham Gano (37.8 / 7.6). A direct provider check returned RapidAPI HTTP 451 for K records without a completed exact-event entry. The loader now deliberately leaves those players’ historical values unavailable rather than using an inaccurate aggregate fallback or waiting on a failing request; kickers with the exact event map resolve immediately and are saved in the versioned persistent cache.

After a full Free Agents reload, the K panel showed all exact-map values immediately and no longer reported any pending season-total loads. Butker, Gay, Lutz, Folk, Koo, and Gano remained populated with the same exact FPTS/FP-G values; players without a 2025 completed-event record remained as dashes instead of delaying the table or receiving a non-WRC approximation. The expanded desktop container also kept the entire leading K context through Projection visible before stat scrolling began.

Browser inspection confirmed the v10 local-storage cache contains normalized player-season entries, including the exact static K records and already loaded SFLEX entries. The cache uses a 24-hour TTL and a versioned key prefix, so reopening Free Agents in the same browser restores the season values without repeating the individual network requests while a version change cleanly invalidates old mappings.

The cache was advanced to v11 after completing the full K pool map, preventing any incomplete pre-map K entry from surviving a release. The final K-panel reload showed every listed player with a validated FPTS and FP/G value immediately: Butker 143.3/8.4, Gay 92.1/7.7, Lutz 132.7/7.8, Folk 134.5/8.4, Koo 28.3/4.7, and Gano 37.8/7.6 from completed 2025 kick-event totals. Tyler Bass, Justin Tucker, Greg Joseph, Ryan Succop, and Robbie Gould have no 2025 regular-season kick event in the completed source and display explicit 0.0/0.0 rather than a delayed or inaccurate provider estimate. This completes the K FPTS/FP-G coverage for every Free Agents row.

The zero-event designations were independently checked against Pro Football Reference player kicking histories. Tyler Bass, Justin Tucker, and Greg Joseph have no 2025 regular-season row after their 2024 entries, while Ryan Succop’s record ends in 2022; the completed nflverse 2025 regular-season play-by-play likewise has no named kick event for any of these players. The same check applies to Robbie Gould, whose NFL career ended before 2025. Therefore the map’s 0 games, 0.0 FPTS, and 0.0 FP/G entries are explicit completed-season no-event values, not provider fallbacks. Sources: https://www.pro-football-reference.com/players/B/BassTy00.htm, https://www.pro-football-reference.com/players/T/TuckJu00.htm, https://www.pro-football-reference.com/players/J/JoseGr00.htm, https://www.pro-football-reference.com/players/S/SuccRy44.htm, and https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.csv.gz.

The full post-fix suite passed: 33 files and 85 tests, plus TypeScript validation. The former live Tank01 credential check was converted to deterministic server-configuration coverage; the allowlisted proxy itself retains mocked success and timeout tests, so provider network blocks cannot make the regression suite flaky.

## Public Shell Check After Full-Parity Deployment — 2026-08-18

After the deployment notification arrived, the public Free Agents route with a cache-busting query initially rendered a blank shell; it had no interactive elements and no console error. The new JavaScript asset was present and served successfully, but its first transfer took approximately 26.7 seconds, during which the root contained only the notification region. Once the asset completed, the public page rendered normally. The production SFLEX table then showed Player, WRC Team, Age, Bye, Opp, Game, FPTS, FP/G, Proj, the Lineup matching stat sequence, and final GP. This was delayed bundle loading rather than a runtime failure.

The full regression suite initially encountered FantasyPros HTTP 429 rate limiting because one test made four live external API calls. That test now uses deterministic mocked provider payloads to validate the same news, injury, rank, and projection normalization contracts without hitting the provider. The full suite completed with 31 files and 76 tests passing, and TypeScript validation passed.

The Rules page and canonical scoring engine agree on the WRC scoring system: 0.04 passing points per yard, 0.1 rushing/receiving points per yard, 1 PPR for RB/WR, 1.5 PPR for TE, 4 passing-TD points, 6 rushing/receiving/return-TD points, -3 for interceptions and fumbles lost, and the published K/DST rules. The audit found three issues: historical `Fumbles.fumblesLost` data could be skipped, individual return touchdowns were not counted, and kicker FPTS used a fabricated 38-yard average whenever Tank01 omitted its season FG-distance aggregate. A freshly loaded read-only Lineup showed season FPTS arriving progressively as Tank01 queries settled; it also confirmed the exact-kicker static map must be applied without waiting for a separate Tank01 player lookup so the K FPTS cell cannot remain temporarily blank.

The corrected read-only Lineup was then inspected for Chase McLaughlin. Its rendered K row contained `156.6` FPTS and `9.2` FP/G, followed by the correct 2025 source counts of 32 FGM, 38 FGA, 32 XPM, and 33 XPA. This value is derived from each completed 2025 field-goal and extra-point event, including the WRC fractional-distance and miss rules, rather than a made-kick-distance estimate.

The production scoring path now has one canonical engine for season, historical, and live offense/D/ST point calculations. The audit corrected historical lost-fumble recognition from the provider’s `Fumbles` object, counts individual return touchdowns, and removes a non-WRC live D/ST points-allowed bonus/penalty. Tank01’s player response was verified to return the correct 2025 raw categories for a representative player, including rushing, receiving, lost fumbles, and games played. Exact 2025 kicker totals for every active WRC rostered kicker are derived from the completed nflverse play-by-play release (`https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.csv.gz`) because Tank01 reports `fgYds: 0` for season player records. Focused coverage now exercises published QB/RB/WR/TE/DST scoring, lost-fumble source variants, return touchdowns, combined D/ST touchdowns, all-team D/ST values, and exact kicker scoring; 16 focused tests and TypeScript validation passed.

## Free Agents SFLEX Source Availability — 2026-08-18

The Free Agents SFLEX table continued to show dashes after the cache work because the current server’s Tank01 player-info requests return HTTP 451 from RapidAPI’s location restriction. The browser network log captured the provider response for individual player names; it is not a parsing or cache defect. K and D/ST remain populated because they use completed-season maps rather than Tank01. The Free Agents season path must use a completed 2025 offline/public source for QB/RB/WR/TE as well, so normal FPTS values do not depend on a provider request that can be blocked.

## Complete Current Tank01 Kicker Inventory — 2026-08-18

The missing kickers were caused by the static `NFL_PLAYERS_2026` pool, which contained only 18 draft-ranked K records. The same authorized Tank01 player-list source used for the team-assignment sync currently returns 71 `PK` records across all 32 teams. A generated current-kicker module now replaces the limited static K subset in both All Players and Free Agents filtering, while leaving the QB/RB/WR/TE pool unchanged. A development Free Agents load confirmed the corrected full player inventory is active; the new inventory regression test asserts all 71 current Tank01 kicker records, all 32 NFL teams, and representative newly included kickers Chad Ryland (ARI) and John Hoyland (BAL).

The All Players + K filter was then opened directly in the browser and rendered `Showing 71 players at K`. The table included the formerly absent Chad Ryland, Joshua Karty, Parker Romo, John Hoyland, Andre Szmyt, Dominic Zvada, and the broader current Tank01 depth records, with rostered kickers retaining their WRC Team label and unrostered kickers labeled Free Agent.
