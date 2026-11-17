/**
 * Whether a collapsible nav group (Draft, League) should read as active for
 * the current location.
 *
 * Derived from the group's own sub-item list rather than hand-written per
 * group, because the hand-written version drifted: the Draft group tested
 * `location === "/draft" || location.startsWith("/draft?")`, which left
 * /draft-lottery and /2027-draft-order unhighlighted even though both are
 * Draft sub-items, and needed remembering again every time a page was added
 * to the group.
 *
 * The startsWith test was also dead. wouter's useLocation reports
 * location.pathname only -- see use-browser-location.js, where
 * currentPathname is `() => location.pathname` and the query string is a
 * separate useSearch hook -- so no location ever contains "?". That is why a
 * sub-item whose path carries a query string (/draft?tab=players) is compared
 * on its pathname: its page is /draft, which is already in the list, and
 * matching on the full string would never fire.
 */
export function isNavGroupActive(
  location: string,
  items: readonly { path: string }[],
): boolean {
  return items.some(item => location === item.path.split("?")[0]);
}
