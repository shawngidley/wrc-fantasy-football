# Player Stat Column Evaluation

- [x] Inspect Tank01 player, projection, game-log, and live-score response fields.
- [x] Review the Player Card and Free Agents layouts for desktop and mobile constraints.
- [x] Define recommended season, weekly, and availability columns by position.
- [x] Present the field inventory and a responsive implementation proposal for approval.

# Full Player Stat Tables

- [x] Create shared schemas and parsers for current-season position-specific stat columns.
- [x] Add complete current-season columns to the Player Card.
- [x] Add complete current-season columns to the Free Agents page.
- [x] Ensure both tables scroll horizontally on mobile and validate the responsive layout.

# Supabase Security Alert

- [x] Inventory public tables, RLS state, and existing public policies.
- [x] Map browser-side Supabase writes that must be protected.
- [x] Propose a PIN-compatible authorization and migration path.
- [x] Obtain approval before changing RLS policies or client access.

# Free Agents Sorting

- [x] Replace the limited sort controls with sortable market and season-stat table headers.
- [x] Add ascending and descending direction indicators to the active header.
- [x] Validate desktop and mobile sorting behavior.

# Free Agents Superflex Filter

- [x] Replace ALL with a QB/RB/WR/TE-only SFLEX filter.
- [x] Remove K and DST categories from the combined SFLEX stats table.
- [x] Verify position filters and mobile table behavior.

# Free Agents Top Scroll Rail

- [x] Add a top horizontal scroll rail synchronized with the stats table.
- [x] Preserve direct table swiping and keep both controls in sync.
- [x] Verify the control on mobile and desktop.

# Free Agents Custom Scroll Slider

- [x] Replace the browser-native scroll track with a custom WRC-styled slider.
- [x] Preserve drag, swipe, and synchronized table scrolling.
- [x] Verify slider contrast and behavior on mobile and desktop.

# Free Agents Scroll Reliability

- [x] Remove touch behavior that prevents normal vertical page scrolling.
- [x] Pin the Player header and player cells while the stats table scrolls horizontally.
- [x] Verify horizontal and vertical gestures on mobile and desktop.

# Free Agents Player Column Width

- [x] Reduce the width of the pinned Player column for mobile stat visibility.
- [x] Tighten the logo and player identity layout without losing readability.
- [x] Verify the narrower column on mobile and desktop.

# Fantasy Data Source Research

- [x] Research authoritative fantasy-player news, injury, and analysis sources.
- [x] Compare source speed, reliability, player context, and API availability.
- [x] Present a recommended WRC source stack.

# FantasyPros Usage Terms Review

- [x] Review the current FantasyPros API terms for account, project, and redistribution limits.
- [x] Give a terms-aligned recommendation for three private league builds.

# FantasyPros Secure Integration

- [x] Upgrade the static app for server-side secrets and API proxying.
- [x] Store the FantasyPros API key in a server-side secret.
- [x] Add cached server endpoints for FantasyPros news, injuries, rankings, and projections.
- [x] Integrate FantasyPros data into WRC views with visible attribution.
- [x] Verify no API key or raw API response is exposed to the browser.
- [x] Add clear FantasyPros attribution beside Free Agents ECR and injury-powered data.
- [x] Confirm the Player Card attribution renders with resolved player data.
- [x] Verify built client assets and browser requests contain no FantasyPros API key or direct API request.

# Player Card FantasyPros Layout

- [x] Add the horizontal FantasyPros Insights strip below the player header.
- [x] Add conditional FantasyPros injury and availability information.
- [x] Use FantasyPros as the sole Player Card news source with visible source labels.
- [ ] Verify desktop and mobile Player Card layout with a healthy and injured player.

# Full Player Names in Standings and News

- [x] Audit abbreviated player labels in Standings injury/news feeds and the dedicated News page.
- [x] Resolve and render full player names consistently for all injury and news items.
- [ ] Verify full-name display in the Standings and News views with a logged-in feed session.
- [x] Add focused display and canonical roster-name coverage for full player names.

# External Security Audit Follow-Up

- [x] Verify the reported Tank01 client-secret exposure against the live and current production bundles, then contain it in server-only code; rotate the existing key later when the RapidAPI account owner can do so.
- [x] Verify reported default PINs, authentication rate-limit behavior, and server-side authorization coverage against the current deployment.
- [x] Disable production source maps and add a compatible Content Security Policy, frame protection, and header hygiene.
- [x] Review public league read endpoints and correct the broken public team-directory response.
- [x] Re-run a production security check and document which audit findings were confirmed, remediated, or superseded.

# Approved Security Hardening

- [x] Replace all nine Tank01 browser integrations with a server-side allowlisted proxy using the existing server secret; rotate the key later when the RapidAPI account owner can do so.
- [x] Document the commissioner-approved exception to retain existing owner PINs, including the fact that one or more weak/default values remain until owners change them.
- [x] Add server-side login rate limiting with a temporary lockout while retaining existing owner PINs.
- [x] Add CSP, frame-ancestors, Referrer-Policy, Permissions-Policy, and remove Express disclosure.
- [x] Prevent production source-map publication and verify the built client contains no source maps.
- [x] Restrict future owner and commissioner PIN changes to non-trivial six-to-twelve digit numeric PINs.

# Production Mobile Subscription Crash

- [ ] Reproduce the mobile production subscription-loop crash and capture the exact failing request or subscription.
- [x] Verify whether Supabase realtime WebSocket connections are blocked by production CSP before treating that as the root cause.
- [ ] Fix the crash while preserving production security headers and server-only Tank01 access.
- [ ] Verify the repaired production site on a mobile viewport.

# League Acceptance Testing Plan

- [x] Define an isolated testing approach that cannot change 2026 live league rosters, protections, draft results, or balances.
- [x] Document acceptance test cases for owner login, protections, draft controls, draft picks, roster assignment, queue, FAAB, trades, scoring, and permissions.
- [x] Add the commissioner-friendly acceptance-testing runbook to the repository.
- [x] Document a concrete staging reset and verification procedure for each rehearsal.

# Development Preview Reliability

- [x] Restore Vite module delivery in the development preview so `/src/main.tsx` is served as JavaScript instead of the SPA HTML shell.
- [x] Re-verify the mobile Lineup page after the preview route is restored.

# Lineup Roster-Table Reference Proposal

- [x] Compare the current Lineup view with the supplied comprehensive roster-table reference.
- [x] Define the player identity, matchup, fantasy-point, and position-stat columns suitable for WRC scoring.
- [x] Define desktop and mobile table behavior, including pinned identity fields and horizontal scrolling.
- [x] Present the proposed Lineup update for approval before implementation.

# Approved WRC Lineup Table

- [x] Build a reusable roster table with visible grouped and column-level headers.
- [x] Add pinned slot/player identity, matchup, decision, weekly-point, and position-stat columns.
- [x] Retain legal swaps, player locks, player-card navigation, and lineup saves in table rows.
- [x] Add mobile horizontal scrolling with pinned player identity cells.
- [x] Add position-aware K and D/ST detail columns plus visible locked-row treatment.
- [x] Verify desktop and mobile table layout with populated roster data.

# Lineup Table Width and Column Order Refinement

- [x] Expand the lineup table panel to the available page width.
- [x] Reorder leading table columns to Swap, Slot, Player, Age, Bye, Opp, Game, FPTS, and FP/G.
- [x] Validate the reordered labeled headers and pinned controls on desktop and mobile.

# Inline Lineup Swap Choices

- [x] Expand eligible replacement players directly below the selected starter or bench row.
- [x] Filter locked bench and starter players from inline swap selection and replacement choices.
- [x] Preserve position and slot legality, player locks, and roster-save behavior in inline swaps.
- [ ] Verify inline swap selection at desktop and mobile widths.

# Inline Swap Live Failure Recovery

- [ ] Reproduce the reported live inline-swap failure with an authenticated lineup.
- [ ] Confirm whether stable selected-row identity corrects the live expansion path or add targeted instrumentation if it does not.
- [ ] Verify that roster refreshes do not collapse selected inline swap choices after the stable-name change.
- [ ] Verify a live starter and bench inline swap end-to-end.

# Inline Swap State Instrumentation

- [ ] Surface selected-player and eligible-candidate state in the Lineup UI when Swap is tapped.
- [ ] Use the captured state to correct the actual live expansion failure and remove temporary diagnostics.

# Slot-Only Lineup Change Control

- [x] Restrict eligible lineup-change expansion to the position/Slot control only.
- [x] Ensure clicking the rest of a Lineup row cannot open replacement choices.
- [x] Preserve player-card navigation and verify Slot-only swap interaction.
- [x] Add click-level coverage proving only Slot controls invoke lineup change callbacks while Player cells retain Player Card navigation.

# Mobile Lineup Identity Compaction

- [x] Tighten mobile Slot and pinned Player widths to expose more stat columns.
- [x] Render individual player names as first initial plus last name on mobile while retaining full names on desktop and for D/ST.
- [x] Verify the mobile Lineup presents additional visible stats without disrupting Slot-only controls.

# Lineup Games Played Column

- [x] Add GP as the last stat column in SFLEX, K, and D/ST panels.
- [x] Keep GP aligned in expanded inline-candidate rows.
- [x] Verify populated GP values across all three Lineup position groups.
- [x] Add direct test coverage for populated GP values in representative SFLEX, K, and D/ST rows.

# Free Agents Lineup-Stat Alignment and WRC Team Status

- [x] Align SFLEX, K, and D/ST Free Agents stat columns with their respective Lineup panels, including final GP.
- [x] Add a clear sortable WRC Team column that resolves a rostered player’s franchise or shows Free Agent.
- [x] Verify rostered and unrostered players as well as aligned stat columns on desktop and mobile.
- [x] Confirm production serves the Free Agents WRC Team and Lineup-aligned stat bundle after deployment propagation.

# Full Free Agents Column Parity

- [x] Replace the remaining non-Lineup Free Agents columns with Lineup-equivalent Age, Bye, Opp, Game, FPTS, FP/G, and Proj columns.
- [x] Preserve WRC Team as the one additional status column and move non-Lineup market metrics out of the roster table.
- [x] Verify complete SFLEX, K, and D/ST column parity with their Lineup panels on desktop and mobile.
- [x] Add direct schema regression coverage for full Free Agents-to-Lineup column parity by position.
- [ ] Verify the final Free Agents full-column parity on a true mobile viewport for SFLEX, K, and D/ST.
- [ ] Confirm the published production Free Agents page shows the final full-column parity on mobile and desktop.

# Full-Row Inline Swap Candidates

- [ ] Render each eligible swap candidate as a complete roster-table row beneath the selected player.
- [ ] Preserve candidate headshots, matchup, decision, fantasy, and position-stat columns in expanded rows.
- [ ] Make an expanded candidate row directly selectable to complete the legal swap.
- [ ] Verify full-row candidate expansion on desktop and mobile.

# Streamlined Lineup Swap Controls

- [x] Remove the dedicated Swap column from all lineup panels.
- [x] Make the Slot cell the direct trigger for eligible inline player changes.
- [x] Narrow the Player column to eliminate unused right-side padding.
- [ ] Verify Slot-triggered swaps and compact Player width on desktop and mobile.

# Updated 2026 Draft Schedule

- [x] Update the WRC draft datetime to Sunday, August 30, 2026 at 6:00 PM ET.
- [x] Update every draft-page and league-facing display that references the draft date or countdown.
- [x] Verify the displayed date, time zone, and countdown target.

# Updated 2026 Protection Deadline and Draft Pool

- [x] Update the protection deadline to Tuesday, August 25, 2026 at 9:00 PM ET.
- [x] Show the updated deadline consistently on the Protections and Settings pages.
- [x] Implement an idempotent release of unprotected players and server-side protection enforcement for draft picks.
- [x] Schedule the one-time 9:00 PM ET post-deadline release task for August 25.
- [x] Verify deadline messaging and post-deadline player availability.

# Mobile Slot Controls and D/ST Logos

- [x] Add a mobile-safe inset for pinned Slot controls so badges do not clip at the viewport edge.
- [x] Render official NFL team logos in D/ST identity rows and expanded D/ST candidate rows.
- [x] Verify Slot badge placement and D/ST team logos on a mobile lineup view.

# Desktop Lineup Panel and Slot Legibility

- [x] Tighten the desktop Lineup panel and table presentation where it has excess width.
- [x] Widen the Slot action cell so its interactive badge is easier to target and read.
- [x] Increase desktop Lineup table type sizing without regressing mobile density or horizontal scrolling.
- [x] Verify the desktop Lineup refinement with populated roster data.

# Lineup Player Names and D/ST Stats

- [x] Widen the pinned Player column so full Lineup names are readable on desktop.
- [x] Diagnose why D/ST season-stat values are not resolving in the Lineup table.
- [x] Correct the D/ST stat mapping and verify the displayed defense totals.

# D/ST Fantasy Column Simplification

- [x] Remove the redundant D/ST PTS and PA columns from the Lineup table and expanded candidates.
- [x] Compute and display D/ST FP/G from season fantasy points and games played.
- [x] Verify the streamlined D/ST columns with populated team totals.

# Published D/ST Lineup Verification

- [x] Compare production and development Lineup assets after the reported missing D/ST change.
- [x] Resolve any public deployment or cache mismatch.
- [x] Confirm the live Lineup shows the streamlined D/ST columns and computed FP/G.

# WRC D/ST Scoring Columns

- [x] Replace D/ST detail headers with SK, SFT, TA, and TDDST.
- [x] Calculate TA as defensive interceptions plus fumble recoveries.
- [x] Verify the scoring-focused totals in standard and inline candidate D/ST rows.

# League-Wide 2025 D/ST Stat Accuracy Audit

- [x] Identify why the current D/ST team-stat source is returning incorrect completed-season values.
- [x] Reconcile 2025 SK, SFT, TA, and TDDST totals for all 32 NFL teams against an authoritative completed-season source.
- [x] Replace the incorrect D/ST mapping with the reconciled 2025 team totals.
- [x] Add all-team regression coverage and verify Tampa Bay (23 TA, 1 SFT) and Green Bay (14 TA) in the Lineup table.
- [x] Render and inspect Tampa Bay’s corrected SFT 1 and TA 23 in the D/ST Lineup table.
- [x] Render and inspect Green Bay’s corrected TA 14 in the D/ST Lineup table.

# League-Wide WRC FPTS Accuracy Audit

- [x] Trace every Lineup FPTS field from provider response through WRC scoring calculation.
- [x] Reconcile QB, RB, WR, TE, K, and D/ST provider fields against WRC scoring rules.
- [x] Correct any scoring-rule or provider-field mismatch and add representative regression coverage.
- [x] Verify corrected Lineup FPTS values for every position before publishing.
- [x] Capture raw Tank01 season fields and independently reconcile representative QB, WR, and TE Lineup FPTS.
- [x] Compare rendered QB, RB, WR, TE, K, and D/ST Lineup FPTS and FP/G values with their completed WRC calculations.
- [x] Independently calculate Cleveland and Chargers D/ST FPTS and FP/G from reconciled 2025 totals and compare them to their rendered Lineup rows.

# Deterministic FantasyPros Adapter Regression

- [x] Replace the rate-limit-sensitive live adapter test with deterministic mocked response coverage.

# Position-Specific Lineup Panels

- [x] Group all QB/RB/WR/TE lineup players into one SFLEX panel.
- [x] Render K players in a separate kicking panel with kicking-first stats.
- [x] Render D/ST players in a separate defense panel with defense-first stats.
- [x] Preserve position-appropriate headers, full-row candidate swaps, locks, and lineup saves in every panel.
- [x] Verify grouped panels on desktop and mobile.

# Lineup Starter Row Shading

- [x] Keep starting rows clear across SFLEX, K, and D/ST panels.
- [x] Apply subtle shading to bench rows while preserving selected, candidate, and locked states.
- [x] Verify bench-row shading on desktop and mobile.

# High-Contrast Bench Row Refinement

- [x] Increase the bench background, border, and pinned-cell contrast until bench rows are visibly distinct from clear starters.
- [x] Verify the strengthened bench treatment on the live Lineup page.

# Requested SFLEX Stat Order

- [x] Reorder SFLEX decision and stat columns to Age, Bye, Opp, Game, FPTS, FP/G, Proj, Pass YDS/TD/INT, Rush ATT/YDS/TD, Rec TGT/REC/YDS/TD, and TO.
- [x] Keep grouped headers and full-row inline swap candidates aligned with the reordered SFLEX columns.
- [x] Verify the requested SFLEX stat order on the live Lineup page.

# Requested Kicker Stat Order

- [x] Render K columns as Age, Bye, Opp, Game, FPTS, FP/G, Proj, FGM 1–39, FGM 40–49, FGM 50–59, FGM 60+, FGYD, FGM/A, and XPM/A.
- [x] Keep the detailed K columns aligned in full-row inline swap candidates.
- [ ] Verify the requested K stat order on the live Lineup page.

# Lineup Bye Week and Kicker Data Correction

- [x] Restore populated Bye-week values for every lineup player from the team-schedule data.
- [x] Replace unavailable kicker distance-bucket placeholders with source-supported populated kicking statistics.
- [ ] Verify Bye weeks and every displayed K stat value on the live Lineup page.

# Live Bye Week Display Regression

- [ ] Capture the actual Tank01 schedule payload and determine why the derived Bye week is missing in rendered rows.
- [ ] Correct the live Bye-week data path and verify populated values for multiple NFL teams.

# Kicker Stat Loading Crash

- [x] Guard every kicker season-stat and percentage cell against undefined loading data.
- [ ] Verify the Lineup page renders before, during, and after K season-stat loading.

# Tank01 Live Kicker Distance Statistics

- [ ] Verify whether Tank01 live-game responses provide field-goal makes and attempts by distance bucket.
- [ ] Document the supported live kicking totals and any alternative needed for distance-level stats.

# Exact Live Kicker Make and Miss Scoring

- [x] Integrate ESPN game-summary play-by-play that reports each made and missed field goal’s exact yardage.
- [x] Calculate WRC live kicker points from each made kick’s yardage, including a 54-yard make as 5.4 points.
- [ ] Display made and missed kick distances in an active Live Scoring game and validate the rendered total against a completed NFL game.

# ESPN Live Kicker Play-by-Play

- [x] Parse made and missed field-goal plays from ESPN game summaries using exact yardage and kicker identity.
- [x] Replace aggregate Tank01 kicker live totals with event-derived WRC points and event history.
- [x] Show exact made and missed kick events in Live Scoring for active games.
- [ ] Perform an active-game browser verification when live NFL play-by-play is available.

# Homepage FantasyPros Roster Feeds

- [ ] Match FantasyPros injury availability to every player on the logged-in owner’s roster.
- [ ] Match FantasyPros news to every player on the logged-in owner’s roster.
- [ ] Render all matched injuries and news in the homepage sections with FantasyPros attribution.
- [ ] Verify feeds for an owner roster on desktop and mobile.

# Player Card FantasyPros Outlook

- [x] Extract the latest player-specific FantasyPros impact context.
- [x] Render a concise FantasyPros Outlook blurb on Player Cards.
- [x] Verify an outlook is shown only when a player has matched FantasyPros context.

# Player Card Outlook Placement

- [x] Place the conditional FantasyPros Outlook directly below the Insights strip.
- [x] Verify the ownership card remains below the Outlook when it is available.

# Player Card Outlook Visibility

- [ ] Fix Outlook stacking and spacing so the next card cannot cover it.
- [ ] Show a headline-based Outlook fallback when no FantasyPros description is present.
- [ ] Verify the visible card hierarchy on desktop and mobile.

# Player Card ECR and Outlook Revision

- [x] Remove the duplicate FantasyPros ECR badge from the player header.
- [x] Build the Outlook from the available FantasyPros news or injury context.
- [x] Verify the revised Player Card hierarchy with a player who has an active injury update.

# Reliable Player Card Outlook

- [ ] Render the Outlook whenever FantasyPros rank, injury, or news data exists.
- [ ] Use a meaningful rank or injury fallback when no news blurb is returned.
- [ ] Verify the Outlook appears for Mike Evans and a healthy player.

# Non-Redundant Player Card Outlook

- [ ] Remove rank-repetition text from the FantasyPros Outlook fallback.
- [ ] Show the Outlook only when written FantasyPros player context is available.
- [ ] Verify rank-only players retain Insights without a redundant Outlook card.

# Player Card Source and Ownership Header

- [x] Use FantasyPros expert-impact fields only for the Outlook, excluding third-party attribution text.
- [x] Remove the standalone ownership row from Player Cards.
- [x] Add the roster team logo and team name to the Player Card header.
- [x] Verify source labeling and ownership header layout.

# Compact Player Card News

- [x] Show only the three newest FantasyPros updates initially on Player Cards.
- [x] Add a control to reveal and collapse the complete player-news history.
- [ ] Verify the compact and expanded views on a loaded mobile session.

# Player Card Rank Distinction

- [x] Retrieve a true FantasyPros overall consensus rank separately from position rank.
- [x] Label the Player Card rank values as Overall ECR and Position Rank.
- [x] Verify a player with differing overall and positional rank values.

# Duplicate Player Card Rank Values

- [x] Inspect why the user still sees identical overall and position rank values.
- [x] Prevent a duplicate overall-rank display when FantasyPros rank data cannot be distinguished.
- [x] Verify the corrected Player Card rank presentation with the reported player.

# Rank Duplicate Fallback

- [x] Document the most likely stale-build or cached-data explanation for the reported duplicate display.
- [x] Suppress the Overall ECR value when it exactly duplicates the numeric position rank.
- [x] Add and verify a unit test for duplicate-rank fallback behavior.

# Player Card Average and Mobile Stat Scroll

- [x] Populate average columns from the applicable player-stat totals and attempts.
- [x] Fix the pinned Year column layering during horizontal stat-table scrolling.
- [x] Verify Player Card stat values and mobile scroll behavior.

# True-Mobile Player Card Stat Table Verification

- [ ] Verify a rushing player’s average and pinned Year column in a loaded mobile session.
- [ ] Verify the receiving average column in a loaded mobile session.

# Missing Live Player Card Table Update

- [ ] Inspect the published Player Card bundle and stat-table output after the reported missing update.
- [ ] Correct any stale-client or live-rendering issue preventing the average and Year-column changes from appearing.
- [ ] Verify the updated Player Card in the live site.

# Trey McBride Historical Stats

- [x] Inspect the ESPN game-log response and label sequence for Trey McBride’s prior seasons.
- [x] Correct tight-end receiving totals, averages, touchdowns, and fumbles in historical rows.
- [x] Verify Trey McBride’s 2022–2024 Player Card stats against the source response.

# Trey McBride Prior-Season Source Verification

- [x] Verify Trey McBride’s 2023 historical row against the ESPN game-log response.
- [x] Verify Trey McBride’s 2022 historical row against the ESPN game-log response.

# Trey McBride Live Historical Display

- [x] Inspect the published Trey McBride card and the browser-side historical cache after the reported unsuccessful update.
- [x] Correct any remaining live client or cache path that serves pre-fix historical rows.
- [x] Verify the exact published Trey McBride historical rows after the correction.

# Historical Stats Cache Recovery

- [x] Inspect session-storage cache behavior for pre-parser Player Card data and document the recovery path.
- [x] Automatically clear obsolete historical-stat cache keys when the cache schema changes.
- [x] Verify Trey McBride’s published page loads corrected prior-season rows without a cache-busting query string.

# All-Player Player Card Consistency

- [x] Confirm overall ECR and position rank use shared FantasyPros logic for every player position.
- [x] Audit shared ESPN historical-stat parsing across quarterback, running back, wide receiver, tight end, kicker, and defense cards.
- [x] Populate an NFL team logo for every historical season row using the team recorded for that season.
- [x] Verify the standard with representative Player Cards across positions and team changes.

# Global Season-Team Identity and Jaguars Normalization

- [x] Replace all Jaguars variants with the canonical JAC abbreviation across data, display, matchups, and logos.
- [x] Ensure every historical season row uses the team returned for that season rather than the player’s later current team.
- [x] Correct current-season historical rows when the present-day player team differs from the completed season team.
- [x] Verify Chris Rodriguez Jr. and a Jaguars player across Player Card, news, and matchup views.

# Guaranteed Season-Team Identity and Jaguars Verification

- [x] Remove the present-day team fallback from completed 2025 Player Card season rows.
- [x] Add a regression test for a post-2025 team change that keeps the 2025 row on the completed-season team.
- [x] Verify a second Jaguars player across Player Card, FantasyPros news labels, matchup, and logo display.

# Standings Roster Briefing Feeds

- [x] Expand FantasyPros roster-news matching so all current player updates can appear on the Standings page.
- [x] Show several current roster injuries and news results rather than the minimal preview.
- [x] Include the available FantasyPros impact, description, practice, and availability blurbs in feed panels.
- [ ] Verify roster briefing feeds on a mobile owner view.

# Vipers Player News Feed Regression

- [x] Inspect the exact Vipers roster names and FantasyPros player-ID resolution in production.
- [x] Correct global roster-news matching when a deployed owner roster receives no player-specific updates.
- [ ] Verify detailed Player News renders for the Vipers mobile roster briefing.

# Vipers Production Player News Persistence

- [x] Compare the exact production and development Vipers roster-news responses.
- [x] Correct the live server or client response path still leaving the production Player News panel empty.
- [ ] Verify visible detailed Vipers Player News in production on mobile.

# Standings Roster Briefing Headshots

- [x] Resolve ESPN player headshots for roster briefing injury and news entries without using FantasyPros image URLs.
- [x] Preserve readable initials as the fallback if a headshot cannot load.
- [x] Apply headshots globally for every owner’s Standings injury and Player News feeds.
- [ ] Verify the mobile briefing layout with headshots and detailed blurbs.

# Dedicated Player News Row Interaction

- [x] Inspect dedicated News-page player row click and dropdown event handling.
- [x] Restore reliable player-news disclosure and article-link behavior.
- [ ] Verify the interaction on mobile and desktop.

# Persistent Mobile News Row Tap Failure

- [x] Inspect the dedicated News-page mobile row hit targets and event propagation.
- [x] Make the complete news row expand on tap while preserving a separate full-article link.
- [ ] Verify the repaired interaction with a mobile-sized News-page row.

# News Source Dropdown

- [x] Add a News source dropdown with FantasyPros as the default selection.
- [x] Support FantasyPros, Tank01, and All News source options alongside position filters.
- [x] Verify source-switching content and default FantasyPros behavior on mobile.

# FantasyPros Default News Population

- [x] Diagnose the empty generic FantasyPros News response in the deployed News page.
- [x] Ensure the default FantasyPros source option returns current detailed player-news items.
- [x] Verify the FantasyPros default, Tank01, and All News options with populated results.

# Mobile News Source Dropdown Verification

- [x] Verify the FantasyPros-default News source dropdown at a true mobile viewport.
- [ ] Verify Tank01 and All News switching remains usable alongside position filters on mobile.

# FantasyPros Linked Player Identity

- [x] Inspect FantasyPros generic-news link metadata for authoritative player identity.
- [x] Resolve generic FantasyPros stories to the linked player before headline or neutral fallback naming.
- [x] Verify Kenneth Walker and another linked FantasyPros story show actual player names and headshots.

# FantasyPros Linked Player UI Verification

- [x] Verify Kenneth Walker and a second formerly unnamed FantasyPros story render with resolved names and headshots in the News UI.
- [x] Investigate and resolve any remaining generic FantasyPros rows that fail player-name resolution.

# Complete FantasyPros Player Identity Audit

- [x] Verify Spencer Rattler renders with both his resolved name and ESPN headshot in the News UI.
- [x] Audit the full populated FantasyPros feed for remaining generic fallback labels.
- [x] Add focused coverage for multiple unnamed generic FantasyPros player-ID resolutions.

# Production Mobile FantasyPros Zero-Result Failure

- [x] Compare the production and development FantasyPros News request lifecycle and result payloads.
- [x] Prevent mobile clients from reaching an empty FantasyPros state when the source request is delayed or transiently fails.
- [ ] Verify the published mobile FantasyPros News view displays current items after a fresh load.

# FantasyPros News Failure-State Recovery

- [x] Prevent a failed FantasyPros query from rendering the ordinary zero-article empty state.
- [x] Retain the last successful FantasyPros feed while a refresh or retry is in progress.
- [x] Verify delayed and failed FantasyPros query states display clear recovery feedback.

# Browser FantasyPros Failure Recovery Verification

- [x] Force a failed FantasyPros News query and verify the temporary-unavailable message instead of the zero-article state.
- [x] Verify last successful FantasyPros rows stay visible during a delayed or failed refresh.

# Live Scoring Lineup Headshots

- [x] Resolve ESPN headshots for every offensive and defensive Live Scoring lineup player.
- [x] Preserve initials fallback for D/ST and unresolved player images.
- [ ] Verify headshot layout on both opposing lineups at mobile size.

# Fantasy-Position-Only News Feed

- [x] Restrict every News source to QB, RB, WR, TE, and K player updates.
- [x] Exclude defensive and other non-fantasy-position updates from FantasyPros, Tank01, and All News.
- [x] Verify all source options and position filters display only eligible fantasy positions.

# FantasyPros Eligible-News Coverage

- [x] Identify valid FantasyPros QB, RB, WR, TE, and K stories discarded by unresolved player-position mapping.
- [x] Resolve eligible FantasyPros positions from authoritative API metadata before applying local name fallback.
- [x] Verify the FantasyPros default feed contains all current eligible player stories without defensive or non-fantasy items.

# FantasyPros Eligible-News Reconciliation

- [x] Compare the raw generic FantasyPros payload with rendered default rows to confirm every eligible player story is retained.
- [x] Add regression coverage that counts eligible FantasyPros stories before and after client filtering.

# Production FantasyPros Full-Feed Persistence

- [x] Compare production and development FantasyPros source payloads, enriched positions, and rendered eligible counts.
- [x] Invalidate any production client or server cache still serving the earlier limited eligible feed.
- [x] Verify the published mobile News page displays every current eligible FantasyPros story.

# FantasyPros Manual Refresh Recovery

- [x] Make the News refresh control explicitly re-fetch FantasyPros stories as well as non-FantasyPros sources.
- [x] Ensure a News-page remount cannot retain an older limited FantasyPros list for fifteen minutes.

# FantasyPros Eligible-News Volume

- [x] Measure raw FantasyPros pagination limits and total current eligible QB, RB, WR, TE, and K stories beyond the 50-item window.
- [x] Expand source retrieval if additional current eligible stories are available.
- [x] Verify the News article count reflects the complete current eligible FantasyPros feed.

# Seven-Day FantasyPros News Coverage

- [x] Determine the FantasyPros API pagination or date parameters needed to retrieve a full seven-day window.
- [x] Retrieve and display all eligible QB, RB, WR, TE, and K FantasyPros updates from the last seven days.
- [x] Label and verify the seven-day article count and chronological coverage on the News page.

# News and Standings FantasyPros Retrieval Alignment

- [x] Compare generic league-wide and player-specific FantasyPros response histories for the same eligible players.
- [x] Apply the fuller permitted player-specific retrieval strategy to the dedicated News page without violating API terms.
- [ ] Verify the News page carries comparable multi-entry player history to the Standings roster briefing.

# News My Team FantasyPros History

- [x] Use the same player-specific FantasyPros roster-news query for the News page My Team view.
- [x] Preserve the generic FantasyPros league-wide source for the all-player News view.
- [ ] Verify the News My Team view shows the richer multi-entry roster history from Standings.

# Private Rolling FantasyPros News Archive

- [x] Create a private archive schema for attributed FantasyPros news metadata with stable deduplication keys.
- [x] Merge current and archived eligible QB, RB, WR, TE, and K stories into one chronological News feed.
- [x] Retain a 30-day rolling archive and remove expired archive records deterministically.
- [x] Add an idempotent scheduled collector for current eligible FantasyPros stories.
- [x] Verify archive creation, merging, deduplication, and expiry behavior.

# Urgent Login Team Selector Recovery

- [x] Inspect production team-list request, Supabase response, and Login page loading state.
- [x] Add retry and explicit recovery behavior for transient login team-list failures.
- [x] Restore a visible selectable team list for the PIN login flow.
- [x] Verify a team can be selected and the sign-in flow is available in production.

# Phased Supabase RLS Security Migration

- [x] Inventory every public Supabase table, client-side read, client-side write, and Storage policy used by the app.
- [x] Define server-session authorization requirements for owners, commissioners, and public read-only data.
- [x] Move sensitive owner and commissioner writes behind validated server procedures.
- [x] Remove plaintext PIN fields from browser-accessible Supabase queries and migrate login to server-only verification.
- [x] Document the applied single-transaction RLS cutover and an explicit rollback procedure for the secured tables.
- [x] Verify owner, commissioner, and unauthenticated public-access behavior for every secured workflow after the final RLS cutover.

# Server-Only Login Session Migration

- [x] Return a redacted server-side team directory with no PIN or PIN-hash fields.
- [x] Verify selected team PINs through the server-only verification function and establish an httpOnly team session.
- [x] Replace Login and AuthContext browser PIN queries with server session procedures.
- [x] Migrate commissioner and owner Settings PIN controls away from direct browser Supabase access.
- [x] Verify a valid owner PIN establishes a post-cutover server session without browser PIN exposure.

# Secure Lineup Persistence Migration

- [x] Move lineup reads and writes to server procedures.
- [x] Derive lineup ownership from the signed WRC team session instead of a browser-supplied team ID.
- [x] Verify an owner can save their lineup and cannot save another team’s lineup.

# Secure Draft Queue Migration

- [x] Move private draft-queue reads, adds, removals, and rank changes behind signed-session server procedures.
- [x] Derive draft-queue team ownership from the signed WRC session for every mutation.
- [x] Verify unauthenticated and cross-team draft-queue changes are rejected.

# Secure Watchlist Migration

- [x] Move personal watchlist reads and add/remove actions behind signed-session server procedures.
- [x] Scope every watchlist operation to the signed WRC team session.
- [x] Verify unauthenticated watchlist changes are rejected.

# Secure FAAB Migration

- [x] Move owner roster lookup and FAAB bid submission behind signed-session server procedures.
- [x] Derive bidder identity from the session and validate bid amount, roster ownership, and available FAAB server-side.
- [x] Move commissioner-only FAAB bid review and award processing behind commissioner server procedures.
- [x] Verify unauthenticated and non-commissioner FAAB requests are rejected.

# Secure Protection Migration

- [x] Move protection reads and submissions behind signed-session server procedures.
- [x] Revalidate keeper eligibility, round assignments, and roster ownership on the server.
- [x] Verify unauthenticated protection changes are rejected.

# Secure Trade Migration

- [x] Move personal trade-proposal reads, creation, counters, and responses behind signed-session server procedures.
- [x] Revalidate roster ownership, FAAB balances, and traded-pick ownership before executing an accepted trade.
- [x] Ensure trade acceptance is authorized only for the receiving team and recorded server-side.
- [x] Verify unauthenticated and non-recipient trade actions are rejected.

# Secure Draft Control Migration

- [x] Move commissioner draft start, pause, skip, and reset controls behind commissioner procedures.
- [x] Validate owner picks against the signed session and current draft turn before recording them.
- [x] Move draft-pick persistence, roster assignment, and clock advance to server procedures.
- [x] Verify unauthenticated and out-of-turn draft actions are rejected.

# Secure Results Finalization Migration

- [x] Move commissioner score finalization and standings updates behind a commissioner server procedure.
- [x] Calculate league median and standings changes server-side from the authoritative result state.
- [x] Verify unauthenticated and non-commissioner result-finalization requests are rejected.

# Secure Transaction Adjustment Migration

- [x] Move commissioner manual add/drop transaction recording and FAAB deductions behind a commissioner server procedure.
- [x] Verify unauthenticated and non-commissioner transaction adjustments are rejected.

# Secure Settings and Team Media Migration

- [x] Move owner PIN changes and commissioner PIN resets behind signed-session server procedures without exposing PIN values.
- [x] Move team logo and theme-song reads, uploads, and removals behind signed-session server procedures and managed file storage.
- [x] Replace Settings page browser Supabase PIN, team, and storage operations with server procedures.
- [x] Verify unauthenticated and non-commissioner Settings operations are rejected.

# Remaining Client Write Audit

- [x] Move weekly live-result, standings, and earnings updates from the automatic scoring writer to authenticated server procedures.
- [x] Remove the obsolete browser PIN update helper so no direct client database mutation remains.
- [x] Re-run a full client-source mutation audit and document the clean result.

# Secure Money Management Migration

- [x] Move commissioner money-owed and Game of the Week edits behind commissioner server procedures.
- [x] Remove legacy browser PIN helper reads that expose the raw teams table.
- [x] Re-run the full mutation audit, including upserts, before RLS cutover.

# Sensitive Browser Read Migration

- [x] Replace browser reads of private team, lineup, queue, bid, and trade data with redacted server procedures before the RLS cutover.
- [x] Retain only intentionally public read access after documenting each table’s permitted browser data.
- [x] Replace player-page and free-agent browser joins to the protected teams table with redacted server procedures.

# RLS Cutover Schema Reconciliation

- [x] Remove absent database objects from the PostgreSQL RLS cutover script and retry the transaction.
- [x] Verify the final RLS policy inventory and secured anonymous-access behavior after the corrected cutover.
