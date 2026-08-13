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
- [ ] Propose a PIN-compatible authorization and migration path.
- [ ] Obtain approval before changing RLS policies or client access.

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

# Homepage FantasyPros Roster Feeds

- [ ] Match FantasyPros injury availability to every player on the logged-in owner’s roster.
- [ ] Match FantasyPros news to every player on the logged-in owner’s roster.
- [ ] Render all matched injuries and news in the homepage sections with FantasyPros attribution.
- [ ] Verify feeds for an owner roster on desktop and mobile.

# Player Card FantasyPros Outlook

- [ ] Extract the latest player-specific FantasyPros impact context.
- [ ] Render a concise FantasyPros Outlook blurb on Player Cards.
- [ ] Verify an outlook is shown only when a player has matched FantasyPros context.

# Player Card Outlook Placement

- [ ] Place the conditional FantasyPros Outlook directly below the Insights strip.
- [ ] Verify the ownership card remains below the Outlook when it is available.

# Player Card Outlook Visibility

- [ ] Fix Outlook stacking and spacing so the next card cannot cover it.
- [ ] Show a headline-based Outlook fallback when no FantasyPros description is present.
- [ ] Verify the visible card hierarchy on desktop and mobile.

# Player Card ECR and Outlook Revision

- [ ] Remove the duplicate FantasyPros ECR badge from the player header.
- [ ] Build the Outlook from the available FantasyPros news or injury context.
- [ ] Verify the revised Player Card hierarchy with a player who has an active injury update.

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

# Live Scoring Lineup Headshots

- [x] Resolve ESPN headshots for every offensive and defensive Live Scoring lineup player.
- [x] Preserve initials fallback for D/ST and unresolved player images.
- [ ] Verify headshot layout on both opposing lineups at mobile size.
