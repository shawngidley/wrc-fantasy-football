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
