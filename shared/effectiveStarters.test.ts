import { describe, expect, it } from "vitest";
import { buildEffectiveStarters, type RosterPlayerWithId, type SavedLineupRow } from "./effectiveStarters";

const P = (id: string, name: string, position: string, nfl_team: string, team_id: string): RosterPlayerWithId => ({ id, name, position, nfl_team, team_id });

// Scott N, Week 6: the saved lineup still names Mevis and the Jets, but he
// won Santos and the Colts on FAAB (dropping them) before the games.
const roster: RosterPlayerWithId[] = [
  P("1", "Caleb Williams", "QB", "CHI", "team-scottn"),
  P("2", "Daniel Jones", "QB", "IND", "team-scottn"),
  P("3", "Kyren Williams", "RB", "LAR", "team-scottn"),
  P("4", "J.K. Dobbins", "RB", "DEN", "team-scottn"),
  P("5", "Jaxon Smith-Njigba", "WR", "SEA", "team-scottn"),
  P("6", "Nico Collins", "WR", "HOU", "team-scottn"),
  P("7", "Kyle Pitts", "TE", "ATL", "team-scottn"),
  P("8", "Jaylen Waddle", "WR", "DEN", "team-scottn"),
  P("9", "Cairo Santos", "K", "CHI", "team-scottn"),
  P("10", "Indianapolis Colts", "DST", "IND", "team-scottn"),
];
const row = (slot: string, player_name: string, player_id: string | null = null): SavedLineupRow => ({ team_id: "team-scottn", slot, player_name, player_id, is_bench: false });
const saved: SavedLineupRow[] = [
  row("QB", "Caleb Williams", "scottm-caleb-williams"),
  row("SFLEX", "Daniel Jones", "scottn-daniel-jones"),
  row("RB1", "Kyren Williams"), row("RB2", "J.K. Dobbins", "greg-j-k--dobbins"),
  row("WR1", "Jaxon Smith-Njigba"), row("WR2", "Nico Collins"),
  row("TE", "Kyle Pitts Sr."), row("FLEX", "Jaylen Waddle"),
  row("K", "Harrison Mevis", "jonas-harrison-mevis"), row("DST", "NY Jets", "scottn-ny-jets"),
];

describe("buildEffectiveStarters", () => {
  it("scores the player who replaced a dropped starter, not the stale saved name", () => {
    const names = buildEffectiveStarters(saved, roster, []).map(s => s.player.name).sort();
    expect(names).toContain("Cairo Santos");
    expect(names).toContain("Indianapolis Colts");
    expect(names).not.toContain("Harrison Mevis");
    expect(names).not.toContain("NY Jets");
    expect(names).toHaveLength(10);
  });

  it("never scores a player who is on another team's roster", () => {
    const otherTeamKicker = P("99", "Harrison Mevis", "K", "LAR", "team-jonas");
    const players = buildEffectiveStarters(saved, roster, []).map(s => s.player);
    expect(players.some(p => p.id === otherTeamKicker.id)).toBe(false);
    expect(players.every(p => p.team_id === "team-scottn")).toBe(true);
  });

  it("matches a saved player by name despite a stale id or a name suffix", () => {
    const names = buildEffectiveStarters(saved, roster, []).map(s => s.player.name);
    expect(names).toContain("Kyle Pitts");
    expect(names).toContain("Caleb Williams");
  });

  it("falls back to the default lineup when nothing is saved", () => {
    expect(buildEffectiveStarters([], roster, []).length).toBeGreaterThanOrEqual(9);
  });

  it("keeps a saved starter on the roster in his saved slot", () => {
    const wr2 = buildEffectiveStarters(saved, roster, []).filter(s => s.slot === "FLEX");
    expect(wr2.map(s => s.player.name)).toEqual(["Jaylen Waddle"]);
  });

  // The 11 teams whose saved lineup is complete and whose players are all
  // still rostered must score on exactly what they saved -- no substitution,
  // no backfill, no reordering. This is what makes the change safe to apply
  // to official scoring mid-season.
  it("changes nothing for a complete, fully-rostered saved lineup", () => {
    const clean: SavedLineupRow[] = [
      row("QB", "Caleb Williams"), row("RB1", "Kyren Williams"), row("RB2", "J.K. Dobbins"),
      row("WR1", "Jaxon Smith-Njigba"), row("WR2", "Nico Collins"), row("TE", "Kyle Pitts"),
      row("SFLEX", "Daniel Jones"), row("FLEX", "Jaylen Waddle"),
      row("K", "Cairo Santos"), row("DST", "Indianapolis Colts"),
    ];
    const out = buildEffectiveStarters(clean, roster, []);
    expect(out.map(s => `${s.slot}:${s.player.name}`)).toEqual([
      "QB:Caleb Williams", "RB:Kyren Williams", "RB:J.K. Dobbins",
      "WR:Jaxon Smith-Njigba", "WR:Nico Collins", "TE:Kyle Pitts",
      "SFLEX:Daniel Jones", "FLEX:Jaylen Waddle",
      "K:Cairo Santos", "DST:Indianapolis Colts",
    ]);
  });

  // A benched player is never promoted over a valid saved starter, and bench
  // rows themselves are never scored.
  it("does not score a bench player while every starter slot is filled", () => {
    const withBench: SavedLineupRow[] = [
      ...[
        row("QB", "Caleb Williams"), row("RB1", "Kyren Williams"), row("RB2", "J.K. Dobbins"),
        row("WR1", "Jaxon Smith-Njigba"), row("WR2", "Nico Collins"), row("TE", "Kyle Pitts"),
        row("SFLEX", "Daniel Jones"), row("FLEX", "Jaylen Waddle"),
        row("K", "Cairo Santos"), row("DST", "Indianapolis Colts"),
      ],
      { team_id: "team-scottn", slot: "BENCH_0", player_name: "Jaylen Waddle", player_id: null, is_bench: true },
    ];
    const out = buildEffectiveStarters(withBench, roster, []);
    expect(out).toHaveLength(10);
    expect(out.filter(s => s.player.name === "Jaylen Waddle")).toHaveLength(1);
  });

  // Two saved rows resolving to the same roster player must not score him
  // twice -- the whole-team total would be inflated by a real player's points.
  it("never scores the same player twice", () => {
    const duplicated: SavedLineupRow[] = [
      row("QB", "Caleb Williams"), row("SFLEX", "Caleb Williams"),
      row("RB1", "Kyren Williams"), row("RB2", "J.K. Dobbins"),
      row("WR1", "Jaxon Smith-Njigba"), row("WR2", "Nico Collins"), row("TE", "Kyle Pitts"),
      row("FLEX", "Jaylen Waddle"), row("K", "Cairo Santos"), row("DST", "Indianapolis Colts"),
    ];
    const out = buildEffectiveStarters(duplicated, roster, []);
    expect(out.filter(s => s.player.name === "Caleb Williams")).toHaveLength(1);
    expect(new Set(out.map(s => s.player.id)).size).toBe(out.length);
  });
});
