/**
 * WRC Fantasy Football - Standings Page
 * Background: Field turf
 * Double Result standings by division with:
 *   - Games Back (from division leader)
 *   - Head-to-Head W / L
 *   - League Median W / L
 *   - Division Record
 *   - PF, PA, Streak
 */
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";

type TeamRow = {
  rank: number;
  team: string;
  owner: string;
  logo?: string; // URL to team logo — uploaded per franchise
  // Combined (H2H + Median) record
  w: number;
  l: number;
  // Head-to-head only
  h2hW: number;
  h2hL: number;
  // League median only
  medW: number;
  medL: number;
  // Division record
  divW: number;
  divL: number;
  pf: number;
  pa: number;
  streak: string;
};

// Build standings from real wrcData
function buildDivisions(): { name: string; teams: TeamRow[] }[] {
  const divNames = ["East", "Central", "West"] as const;
  return divNames.map(div => {
    const divTeams = TEAMS.filter(t => t.division === div)
      .sort((a, b) => b.wins - a.wins || b.ptsFor - a.ptsFor);
    return {
      name: `${div} Division`,
      teams: divTeams.map((t, i) => ({
        rank: i + 1,
        team: t.teamName,
        owner: t.owner,
        logo: undefined,
        w: t.wins,
        l: t.losses,
        h2hW: t.wins,
        h2hL: t.losses,
        medW: 0,
        medL: 0,
        divW: 0,
        divL: 0,
        pf: t.ptsFor,
        pa: t.ptsAgainst,
        streak: "—",
      })),
    };
  });
}

const DIVISIONS: { name: string; teams: TeamRow[] }[] = buildDivisions();

/** Calculate games back from division leader */
function gamesBack(leaderW: number, leaderL: number, teamW: number, teamL: number): string {
  const gb = ((leaderW - teamW) + (teamL - leaderL)) / 2;
  if (gb === 0) return "—";
  return gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1);
}

function StreakBadge({ streak }: { streak: string }) {
  const isWin = streak.startsWith("W");
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      fontWeight: 700,
      color: isWin ? "oklch(0.38 0.15 150)" : "oklch(0.52 0.22 25)",
      fontSize: "0.82rem",
    }}>
      {isWin ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {streak}
    </span>
  );
}

// Column header style
const TH: React.CSSProperties = {
  textAlign: "center",
  whiteSpace: "nowrap",
  padding: "0.55rem 0.5rem",
};

// Cell style
const TD_CENTER: React.CSSProperties = { textAlign: "center", padding: "0.55rem 0.4rem", fontSize: "0.82rem" };

export default function Standings() {
  const { franchise } = useAuth();

  const tickerMessages = [
    "⚔️ CHALLENGE GAME — Week 14: Team Gidley vs. Team Pattie",
    "🏆 PLAYOFF PICTURE: Top 6 teams qualify — Division winners + 3 Wild Cards",
    "📅 REGULAR SEASON FINAL — Through Week 14",
  ];

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={true} tickerMessages={tickerMessages} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>WRC Fantasy Football 2025</h1>
          <p>Regular Season Standings — Through Week 14</p>
        </div>

        {/* Division Tables */}
        {DIVISIONS.map((division) => {
          const leader = division.teams[0];
          return (
            <div key={division.name} className="wrc-card" style={{ marginBottom: "1.5rem" }}>
              <div className="wrc-card-gold-stripe" />
              <div className="wrc-division-header">{division.name}</div>
              <div style={{ overflowX: "auto" }}>
                <table className="wrc-table" style={{ minWidth: 780 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 48, padding: "0.55rem 0.4rem" }}></th>
                      <th style={{ textAlign: "left", minWidth: 160, padding: "0.55rem 0.75rem", fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", letterSpacing: "0.06em" }}>Team</th>
                      <th style={TH}>W-L</th>
                      <th style={TH}>PCT</th>
                      <th style={TH}>GB</th>
                      <th style={{ ...TH, borderLeft: "2px solid oklch(0.82 0.06 150)", borderBottom: "2px solid oklch(0.82 0.06 150)" }} colSpan={2}>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>Head to Head</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.68rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>Win</span><span>Loss</span></div>
                      </th>
                      <th style={{ ...TH, borderLeft: "2px solid oklch(0.82 0.06 150)", borderBottom: "2px solid oklch(0.82 0.06 150)" }} colSpan={2}>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>League Median</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.68rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>Win</span><span>Loss</span></div>
                      </th>
                      <th style={{ ...TH, borderLeft: "2px solid oklch(0.82 0.06 150)", borderBottom: "2px solid oklch(0.82 0.06 150)" }} colSpan={2}>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>Division</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.68rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>Win</span><span>Loss</span></div>
                      </th>
                      <th style={{ ...TH, textAlign: "right" }}>PF</th>
                      <th style={{ ...TH, textAlign: "right" }}>PA</th>
                      <th style={TH}>Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {division.teams.map((team, i) => {
                      const isMyTeam = team.team === franchise?.team_name;
                      const pct = (team.w / (team.w + team.l)).toFixed(3).replace(/^0/, "");
                      const gb = gamesBack(leader.w, leader.l, team.w, team.l);
                      return (
                        <tr key={team.team} style={{
                          background: isMyTeam
                            ? "oklch(0.93 0.04 150)"
                            : i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)",
                          fontWeight: isMyTeam ? 600 : 400,
                        }}>
                          <td style={{ textAlign: "center", padding: "0.3rem 0.4rem" }}>
                            {team.logo ? (
                              <img
                                src={team.logo}
                                alt={team.team}
                                style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, display: "block", margin: "0 auto" }}
                              />
                            ) : (
                              <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 4,
                                background: "oklch(0.92 0.02 150)",
                                border: "1.5px dashed oklch(0.75 0.06 150)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto",
                                fontSize: "0.6rem",
                                color: "oklch(0.6 0.04 150)",
                                fontFamily: "Oswald, sans-serif",
                                letterSpacing: "0.04em",
                                fontWeight: 600,
                              }}>LOGO</div>
                            )}
                          </td>
                          <td style={{ padding: "0.55rem 0.75rem" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.18 0.05 150)" }}>{team.team}</div>
                            <div style={{ fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>{team.owner}</div>
                          </td>
                          {/* Combined W-L */}
                          <td style={TD_CENTER}>
                            <span style={{ fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{team.w}</span>
                            <span style={{ color: "oklch(0.65 0.03 150)", margin: "0 2px" }}>-</span>
                            <span style={{ color: "oklch(0.45 0.04 150)" }}>{team.l}</span>
                          </td>
                          {/* PCT */}
                          <td style={{ ...TD_CENTER, color: "oklch(0.45 0.04 150)" }}>{pct}</td>
                          {/* GB */}
                          <td style={{ ...TD_CENTER, fontWeight: gb === "—" ? 400 : 600, color: gb === "—" ? "oklch(0.65 0.03 150)" : "oklch(0.35 0.06 150)" }}>{gb}</td>
                          {/* H2H */}
                          <td style={{ ...TD_CENTER, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.h2hW}</td>
                          <td style={{ ...TD_CENTER, color: "oklch(0.52 0.22 25)" }}>{team.h2hL}</td>
                          {/* Median */}
                          <td style={{ ...TD_CENTER, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.medW}</td>
                          <td style={{ ...TD_CENTER, color: "oklch(0.52 0.22 25)" }}>{team.medL}</td>
                          {/* Division */}
                          <td style={{ ...TD_CENTER, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.divW}</td>
                          <td style={{ ...TD_CENTER, color: "oklch(0.52 0.22 25)" }}>{team.divL}</td>
                          {/* PF / PA */}
                          <td style={{ ...TD_CENTER, borderLeft: "1px solid oklch(0.92 0.005 150)", textAlign: "right", fontWeight: 600, color: "oklch(0.22 0.06 150)" }}>{team.pf.toFixed(1)}</td>
                          <td style={{ ...TD_CENTER, textAlign: "right", color: "oklch(0.5 0.04 150)" }}>{team.pa.toFixed(1)}</td>
                          {/* Streak */}
                          <td style={TD_CENTER}><StreakBadge streak={team.streak} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Double Result Explanation */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>Double Result System</div>
                <p style={{ fontSize: "0.82rem", color: "oklch(0.4 0.04 150)", margin: 0, lineHeight: 1.5 }}>
                  Each week produces 3 total results per team. The head-to-head matchup is worth 2 results — a win counts as 2W, a loss counts as 2L. The league median is worth 1 result — scoring above the median earns 1W, below earns 1L. Maximum possible: 3W (H2H win + above median) or 3L (H2H loss + below median) per week.
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>Playoff Seeding</div>
                <p style={{ fontSize: "0.82rem", color: "oklch(0.4 0.04 150)", margin: 0, lineHeight: 1.5 }}>
                  6 teams qualify: 3 Division Winners + 3 Wild Cards. Top 2 division winners receive a bye in Wild Card Round. Playoffs run Weeks 15–17.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
