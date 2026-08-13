# Verification Notes

## Compact Player Card News — 2026-08-13

Javonte Williams’s Player Card was checked in the browser. The initial view showed exactly the three most recent FantasyPros updates and a `Show all 10 updates` control. Selecting that control revealed the full ten-item history and changed the label to `Show fewer updates`. A separate true-mobile capture did not complete the external player-data load, so final hands-on mobile verification remains pending.

## Overall ECR and Position Rank — 2026-08-13

Woody Marks’s Player Card was checked in the browser after the FantasyPros overall-ranking query was added. The card displays `Overall ECR #151` separately from `Position Rank RB50`, confirming that the prior duplicate position-scoped rank is corrected.

## Published Rank Verification — 2026-08-13

The production URL for Woody Marks was checked directly. It currently returns `Overall ECR #151` and `Position Rank RB50`; the duplicate `#50` / `RB50` presentation is not present in the published build.

## Duplicate Rank Fallback — 2026-08-13

The reported duplicate `#50` and `RB50` presentation was not reproducible from the published Player Card, which returned `#151` and `RB50`. The most likely explanation is that the phone rendered an earlier deployed client bundle during the automatic-publish transition. A deterministic fallback now suppresses Overall ECR whenever its numeric value matches the numeric portion of Position Rank. This behavior is covered by a client Vitest test; the suite completed with five passing test files and six passing tests.
