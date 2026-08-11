# Player Stat Column Evaluation

- [x] Inspect Tank01 player, projection, game-log, and live-score response fields.
- [x] Review the Player Card and Free Agents layouts for desktop and mobile constraints.
- [x] Define recommended season, weekly, and availability columns by position.
- [x] Present the field inventory and a responsive implementation proposal for approval.

# Full Player Stat Tables

- [x] Create shared schemas and parsers for current-season position-specific stat columns.
- [x] Add complete current-season columns to the Player Card.
- [x] Add complete current-season columns to the Free Agents page.
- [ ] Ensure both tables scroll horizontally on mobile and validate the responsive layout.

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
