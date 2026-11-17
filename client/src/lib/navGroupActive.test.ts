import { describe, expect, it } from "vitest";
import { isNavGroupActive } from "./navGroupActive";

// Mirrors Navigation.tsx's DRAFT_SUB_ITEMS / LEAGUE_SUB_ITEMS.
const DRAFT = [
  { path: "/2027-draft-order" },
  { path: "/draft" },
  { path: "/draft-lottery" },
  { path: "/draft-recap" },
  { path: "/draft?tab=players" },
  { path: "/draft?tab=protections" },
];
const LEAGUE = [{ path: "/rules" }, { path: "/money" }, { path: "/history" }];

describe("isNavGroupActive", () => {
  it("marks the Draft group active on every page in it", () => {
    for (const path of ["/draft", "/draft-lottery", "/draft-recap", "/2027-draft-order"]) {
      expect(isNavGroupActive(path, DRAFT)).toBe(true);
    }
  });

  // wouter reports pathname only, so a sub-item path carrying a query string
  // has to match on its pathname or it can never match at all.
  it("matches a query-string sub-item on its pathname", () => {
    expect(isNavGroupActive("/draft", [{ path: "/draft?tab=players" }])).toBe(true);
    expect(isNavGroupActive("/draft?tab=players", [{ path: "/draft?tab=players" }])).toBe(false);
  });

  it("leaves the Draft group inactive elsewhere", () => {
    for (const path of ["/playoffs", "/schedule", "/", "/drafted", "/rules"]) {
      expect(isNavGroupActive(path, DRAFT)).toBe(false);
    }
  });

  it("marks the League group active only on its own pages", () => {
    expect(isNavGroupActive("/money", LEAGUE)).toBe(true);
    // Playoffs is a top-level link now, so it must not light up League.
    expect(isNavGroupActive("/playoffs", LEAGUE)).toBe(false);
  });

  it("is inactive for an empty group", () => {
    expect(isNavGroupActive("/draft", [])).toBe(false);
  });
});
