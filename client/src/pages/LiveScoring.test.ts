import { describe, expect, it } from "vitest";
import { displayName } from "./LiveScoring";

describe("displayName", () => {
  describe("DST", () => {
    it("shortens multi-word city names to their initials", () => {
      expect(displayName("New England Patriots", "DST", "NE")).toBe("NE Patriots");
      expect(displayName("Los Angeles Rams", "DST", "LAR")).toBe("LA Rams");
      expect(displayName("Los Angeles Chargers", "DST", "LAC")).toBe("LA Chargers");
      expect(displayName("New York Giants", "DST", "NYG")).toBe("NY Giants");
      expect(displayName("New York Jets", "DST", "NYJ")).toBe("NY Jets");
      expect(displayName("Kansas City Chiefs", "DST", "KC")).toBe("KC Chiefs");
      expect(displayName("San Francisco 49ers", "DST", "SF")).toBe("SF 49ers");
      expect(displayName("Tampa Bay Buccaneers", "DST", "TB")).toBe("TB Buccaneers");
      expect(displayName("Green Bay Packers", "DST", "GB")).toBe("GB Packers");
      expect(displayName("Las Vegas Raiders", "DST", "LV")).toBe("LV Raiders");
      expect(displayName("New Orleans Saints", "DST", "NO")).toBe("NO Saints");
    });

    it("leaves single-word city names unchanged", () => {
      expect(displayName("Seattle Seahawks", "DST", "SEA")).toBe("Seattle Seahawks");
      expect(displayName("Denver Broncos", "DST", "DEN")).toBe("Denver Broncos");
      expect(displayName("Philadelphia Eagles", "DST", "PHI")).toBe("Philadelphia Eagles");
    });

    it("resolves from the team code even when the stored full name differs, since the code is the reliable field", () => {
      // Whatever the actual stored name happens to be, the display name
      // is driven entirely by the (already-correct) team code.
      expect(displayName("N. England Patriots", "DST", "NE")).toBe("NE Patriots");
    });

    it("normalizes team code aliases before lookup (e.g. AZ -> ARI, LA -> LAR)", () => {
      expect(displayName("Arizona Cardinals", "DST", "AZ")).toBe("Arizona Cardinals");
      expect(displayName("Los Angeles Rams", "DST", "LA")).toBe("LA Rams");
    });

    it("falls back to the stored name if the team code isn't recognized", () => {
      expect(displayName("Some Unknown Team", "DST", "ZZZ")).toBe("Some Unknown Team");
    });
  });

  describe("non-DST (human players)", () => {
    it("abbreviates the first name to an initial, unaffected by this change", () => {
      expect(displayName("Brock Purdy", "QB", "SF")).toBe("B. Purdy");
    });

    it("leaves a single-word name unchanged", () => {
      expect(displayName("Ochocinco", "WR", "MIA")).toBe("Ochocinco");
    });
  });
});
