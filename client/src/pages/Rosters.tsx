/**
 * WRC Fantasy Football - Rosters Page
 * Background: Field turf
 * Shows all 12 franchise rosters at a glance — each team's 18 players
 * with position, NFL team, and starter/bench designation.
 */
import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TEAMS, type TeamRecord } from "@/lib/wrcData";
import { useDraftedRoster } from "@/hooks/useDraftedRoster";

type Player = {
  name: string;
  pos: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  nflTeam: string;
  isStarter?: boolean;
  // acquisition: "Rd 3" for draft pick, "FA $45" for FAAB waiver
  acq?: string;
};

type Franchise = {
  id: string;
  teamName: string;
  owner: string;
  division: "East" | "Central" | "West";
  logo?: string;
  faabRemaining?: number;
  players: Player[];
};

// Convert wrcData TeamRecord → local Franchise shape
function toFranchise(t: TeamRecord): Franchise {
  return {
    id: t.id,
    teamName: t.teamName,
    owner: t.owner,
    division: t.division,
    faabRemaining: t.faabRemaining,
    players: t.players.map((p, i) => ({
      name: p.name,
      pos: p.pos,
      nflTeam: p.nflTeam,
      // First 11 players are starters, rest are bench
      isStarter: i < 11,
      acq: p.acquisition === "Draft" ? "Draft" : "FA",
    })),
  };
}

// Static fallback — used before draft starts
const STATIC_ROSTERS: Franchise[] = TEAMS.map(toFranchise);

// ── Sort helpers ─────────────────────────────────────────────────────────────
const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DST: 5 };

/**
 * Parse acquisition string into a numeric sort key:
 *   "Rd 3"  → 3          (draft round — lower is earlier / better)
 *   "FA $28" → -28        (FAAB — higher dollar = earlier pick, so negate)
 *   undefined → 9999      (no acq data — sort last)
 */
function acqSortKey(acq?: string): number {
  if (!acq) return 9999;
  if (acq.startsWith("Rd ")) {
    const round = parseInt(acq.replace("Rd ", ""), 10);
    return isNaN(round) ? 9999 : round;
  }
  if (acq.startsWith("FA $")) {
    const dollars = parseInt(acq.replace("FA $", ""), 10);
    // Negate so higher FAAB sorts first (lower sort key)
    return isNaN(dollars) ? 9999 : -dollars;
  }
  return 9999;
}

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const posDiff = (POS_ORDER[a.pos] ?? 99) - (POS_ORDER[b.pos] ?? 99);
    if (posDiff !== 0) return posDiff;
    return acqSortKey(a.acq) - acqSortKey(b.acq);
  });
}

const POS_COLORS: Record<string, { bg: string; text: string }> = {
  QB:  { bg: "oklch(0.92 0.08 25)",  text: "oklch(0.35 0.15 25)"  },
  RB:  { bg: "oklch(0.92 0.07 150)", text: "oklch(0.3 0.12 150)"  },
  WR:  { bg: "oklch(0.9 0.08 260)",  text: "oklch(0.3 0.12 260)"  },
  TE:  { bg: "oklch(0.92 0.1 85)",   text: "oklch(0.35 0.15 85)"  },
  K:   { bg: "oklch(0.93 0.04 300)", text: "oklch(0.4 0.08 300)"  },
  DST: { bg: "oklch(0.92 0.04 0)",   text: "oklch(0.35 0.08 0)"   },
};

const DIVISIONS = ["East", "Central", "West"] as const;

export default function Rosters() {
  const { franchise } = useAuth();
  const [selectedDivision, setSelectedDivision] = useState<"All" | "East" | "Central" | "West">("All");
  const { rostersByTeam, loading: draftLoading, hasPicks } = useDraftedRoster();

  // Build live rosters from draft picks (or fall back to static)
  const ROSTERS: Franchise[] = useMemo(() => {
    if (!hasPicks) return STATIC_ROSTERS;
    return TEAMS.map(t => {
      const draftedPlayers = rostersByTeam[t.teamName] ?? [];
      return {
        id: t.id,
        teamName: t.teamName,
        owner: t.owner,
        division: t.division,
        faabRemaining: t.faabRemaining,
        players: draftedPlayers.map((p, i) => ({
          name: p.name,
          pos: p.pos,
          nflTeam: p.nflTeam,
          isStarter: i < 11,
          acq: p.acquisition === "Draft" ? "Draft" : "FA",
        })),
      };
    });
  }, [rostersByTeam, hasPicks]);

  const filtered = selectedDivision === "All"
    ? ROSTERS
    : ROSTERS.filter(f => f.division === selectedDivision);

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>WRC Rosters</h1>
          <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            2026 Season — All 12 Franchises
            {draftLoading && <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.08em" }}>Loading rosters…</span>}
            {!draftLoading && hasPicks && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "oklch(0.93 0.06 85)", color: "oklch(0.35 0.14 85)", borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>
                ⚡ LIVE DRAFT ROSTERS
              </span>
            )}
          </p>
        </div>

        {/* Division Filter */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {(["All", "East", "Central", "West"] as const).map(div => (
            <button
              key={div}
              onClick={() => setSelectedDivision(div)}
              style={{
                padding: "0.4rem 1.1rem",
                borderRadius: 20,
                border: "2px solid",
                borderColor: selectedDivision === div ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.25)",
                background: selectedDivision === div ? "oklch(0.78 0.15 85)" : "rgba(0,0,0,0.3)",
                color: selectedDivision === div ? "oklch(0.18 0.05 85)" : "white",
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 700,
                fontSize: "0.78rem",
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition: "all 0.18s ease",
              }}
            >
              {div === "All" ? "All Divisions" : `${div} Division`}
            </button>
          ))}
        </div>

        {/* Roster Cards Grid */}
        {DIVISIONS.filter(d => selectedDivision === "All" || selectedDivision === d).map(div => (
          <div key={div} style={{ marginBottom: "2rem" }}>
            {/* Division Label */}
            <div style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 700,
              fontSize: "0.82rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "oklch(0.78 0.15 85)",
              marginBottom: "0.75rem",
              paddingLeft: "0.25rem",
            }}>
              {div} Division
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}>
              {ROSTERS.filter(f => f.division === div).map(team => {
                const isMyTeam = team.teamName === franchise?.team_name;
                const starters = sortPlayers(team.players.filter(p => p.isStarter));
                const bench = sortPlayers(team.players.filter(p => !p.isStarter));

                return (
                  <div
                    key={team.id}
                    className="wrc-card wrc-card-hover wrc-fade-in"
                    style={{
                      outline: isMyTeam ? "2px solid oklch(0.78 0.15 85)" : "none",
                    }}
                  >
                    <div className="wrc-card-gold-stripe" />

                    {/* Team Header */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.85rem 1rem 0.6rem",
                    }}>
                      {/* Logo slot */}
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 6,
                        background: "oklch(0.92 0.02 150)",
                        border: "1.5px dashed oklch(0.75 0.06 150)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: "0.55rem",
                        color: "oklch(0.6 0.04 150)",
                        fontFamily: "Barlow Condensed, sans-serif",
                        letterSpacing: "0.04em",
                        fontWeight: 600,
                      }}>
                        {team.logo ? <img src={team.logo} alt={team.teamName} style={{ width: 40, height: 40, objectFit: "contain" }} /> : "LOGO"}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "Barlow Condensed, sans-serif",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: "oklch(0.18 0.05 150)",
                          letterSpacing: "0.02em",
                        }}>
                          {team.teamName}
                          {isMyTeam && (
                            <span style={{
                              marginLeft: "0.5rem",
                              fontSize: "0.6rem",
                              background: "oklch(0.78 0.15 85)",
                              color: "oklch(0.18 0.05 85)",
                              borderRadius: 10,
                              padding: "1px 6px",
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              verticalAlign: "middle",
                            }}>YOU</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "oklch(0.5 0.04 150)" }}>{team.owner}</div>
                        {team.faabRemaining !== undefined && (
                          <div style={{
                            marginTop: "0.2rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.68rem",
                            fontFamily: "Barlow Condensed, sans-serif",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: team.faabRemaining > 100 ? "oklch(0.35 0.13 150)" : team.faabRemaining > 50 ? "oklch(0.5 0.12 85)" : "oklch(0.45 0.18 25)",
                            background: team.faabRemaining > 100 ? "oklch(0.93 0.04 150)" : team.faabRemaining > 50 ? "oklch(0.95 0.06 85)" : "oklch(0.95 0.05 25)",
                            borderRadius: 4,
                            padding: "1px 6px",
                          }}>
                            {`FAAB: $${team.faabRemaining}`}
                          </div>
                        )}
                      </div>


                    </div>

                    {/* Full roster — always open */}
                      <div style={{ padding: "0 0 0.5rem" }}>
                        {/* Starters */}
                        <div style={{
                          padding: "0.3rem 1rem 0.2rem",
                          fontSize: "0.65rem",
                          fontFamily: "Barlow Condensed, sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "oklch(0.38 0.09 150)",
                          background: "oklch(0.96 0.01 150)",
                          borderTop: "1px solid oklch(0.9 0.01 150)",
                        }}>
                          Starters ({starters.length})
                        </div>
                        {starters.map((p, i) => (
                          <PlayerRow key={i} player={p} alt={i % 2 !== 0} />
                        ))}

                        {/* Bench */}
                        <div style={{
                          padding: "0.3rem 1rem 0.2rem",
                          fontSize: "0.65rem",
                          fontFamily: "Barlow Condensed, sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "oklch(0.5 0.04 150)",
                          background: "oklch(0.97 0.005 150)",
                          borderTop: "1px solid oklch(0.9 0.01 150)",
                        }}>
                          Bench ({bench.length})
                        </div>
                        {bench.map((p, i) => (
                          <PlayerRow key={i} player={p} alt={i % 2 !== 0} bench />
                        ))}
                      </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerRow({ player, alt, bench }: { player: Player; alt: boolean; bench?: boolean }) {
  const c = POS_COLORS[player.pos];
  const isFa = player.acq?.startsWith("FA");
  return (
    <div className="wrc-row-hover" style={{
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      padding: "0.35rem 1rem",
      background: alt ? "oklch(0.975 0.003 150)" : "white",
      opacity: bench ? 0.85 : 1,
    }}>
      <span style={{
        background: c.bg,
        color: c.text,
        borderRadius: 3,
        padding: "1px 5px",
        fontSize: "0.62rem",
        fontWeight: 700,
        fontFamily: "Barlow Condensed, sans-serif",
        letterSpacing: "0.04em",
        minWidth: 28,
        textAlign: "center",
        flexShrink: 0,
      }}>{player.pos}</span>
      <span style={{
        flex: 1,
        fontSize: "0.8rem",
        fontWeight: bench ? 400 : 600,
        color: bench ? "oklch(0.5 0.04 150)" : "oklch(0.18 0.05 150)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>{player.name}</span>
      <span style={{
        fontSize: "0.68rem",
        color: "oklch(0.55 0.06 150)",
        fontWeight: 600,
        fontFamily: "Barlow Condensed, sans-serif",
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}>{player.nflTeam}</span>

      {player.acq && (
        <span style={{
          fontSize: "0.6rem",
          fontFamily: "Barlow Condensed, sans-serif",
          fontWeight: 700,
          letterSpacing: "0.04em",
          padding: "1px 5px",
          borderRadius: 3,
          flexShrink: 0,
          background: isFa ? "oklch(0.93 0.06 250)" : "oklch(0.93 0.03 150)",
          color: isFa ? "oklch(0.32 0.14 250)" : "oklch(0.35 0.08 150)",
        }}>{player.acq}</span>
      )}
    </div>
  );
}
