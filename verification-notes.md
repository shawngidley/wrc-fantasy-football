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
