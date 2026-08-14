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
