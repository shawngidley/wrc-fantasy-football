/**
 * WRC Fantasy Football - Standings Page
 * Background: Field turf
 * Shows Double Result standings by division (East, Central, West)
 */
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const DIVISIONS = [
  {
    name: "East Division",
    teams: [
      { rank: 1, team: "Team Gidley", owner: "Shawn Gidley", w: 10, l: 4, pct: ".714", pf: 1482.6, pa: 1301.2, streak: "W3" },
      { rank: 2, team: "Team Sotka", owner: "David Sotka", w: 8, l: 6, pct: ".571", pf: 1390.4, pa: 1355.8, streak: "L1" },
      { rank: 3, team: "Team Nelson", owner: "Scott Nelson", w: 6, l: 8, pct: ".429", pf: 1280.2, pa: 1410.6, streak: "W1" },
      { rank: 4, team: "Team Yane", owner: "James Yane", w: 4, l: 10, pct: ".286", pf: 1198.8, pa: 1450.2, streak: "L4" },
    ],
  },
  {
    name: "Central Division",
    teams: [
      { rank: 1, team: "Team Pattie", owner: "Jonas Pattie", w: 11, l: 3, pct: ".786", pf: 1520.4, pa: 1280.6, streak: "W5" },
      { rank: 2, team: "Team Krause", owner: "Bill Krause", w: 9, l: 5, pct: ".643", pf: 1440.2, pa: 1310.8, streak: "W2" },
      { rank: 3, team: "Team Ryks", owner: "David Ryks", w: 7, l: 7, pct: ".500", pf: 1320.6, pa: 1380.4, streak: "L2" },
      { rank: 4, team: "Team Osicki", owner: "Dan Osicki", w: 3, l: 11, pct: ".214", pf: 1150.2, pa: 1510.8, streak: "L6" },
    ],
  },
  {
    name: "West Division",
    teams: [
      { rank: 1, team: "Team Heiden", owner: "Jason Heiden", w: 9, l: 5, pct: ".643", pf: 1460.8, pa: 1330.2, streak: "W1" },
      { rank: 2, team: "Team Akagi", owner: "Greg Akagi", w: 8, l: 6, pct: ".571", pf: 1380.4, pa: 1340.6, streak: "W3" },
      { rank: 3, team: "Team Mackar", owner: "Scott Mackar", w: 6, l: 8, pct: ".429", pf: 1260.6, pa: 1390.4, streak: "L1" },
      { rank: 4, team: "Team Cromer", owner: "Keith Cromer", w: 5, l: 9, pct: ".357", pf: 1220.2, pa: 1420.8, streak: "L2" },
    ],
  },
];

function StreakBadge({ streak }: { streak: string }) {
  const isWin = streak.startsWith("W");
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      fontWeight: 700,
      color: isWin ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)",
      fontSize: "0.85rem",
    }}>
      {isWin ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {streak}
    </span>
  );
}

export default function Standings() {
  const { franchise } = useAuth();

  const tickerMessages = [
    "⚔️ CHALLENGE GAME — Week 14: Team Gidley vs. Team Pattie",
    "🏆 PLAYOFF PICTURE: Top 6 teams qualify — Division winners + 3 Wild Cards",
    "📅 REGULAR SEASON FINAL — Through Week 14",
  ];

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation
        showTicker={true}
        tickerMessages={tickerMessages}
        teamName={franchise?.team_name}
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>WRC Fantasy Football 2025</h1>
          <p>Regular Season Final — Through Week 14</p>
        </div>

        {/* Standings Tables */}
        {DIVISIONS.map((division) => (
          <div key={division.name} className="wrc-card" style={{ marginBottom: "1.5rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-division-header">{division.name}</div>
            <div style={{ overflowX: "auto" }}>
              <table className="wrc-table" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Team</th>
                    <th style={{ display: "none" }} className="hide-mobile">Owner</th>
                    <th style={{ textAlign: "center" }}>W</th>
                    <th style={{ textAlign: "center" }}>L</th>
                    <th style={{ textAlign: "center" }}>PCT</th>
                    <th style={{ textAlign: "right" }}>PF</th>
                    <th style={{ textAlign: "right" }}>PA</th>
                    <th style={{ textAlign: "center" }}>Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {division.teams.map((team, i) => (
                    <tr key={team.team} style={{
                      background: team.team === franchise?.team_name
                        ? "oklch(0.94 0.03 150)"
                        : i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)",
                    }}>
                      <td style={{ fontWeight: 700, color: "oklch(0.35 0.06 150)", textAlign: "center" }}>{team.rank}</td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)" }}>{team.team}</div>
                        <div style={{ fontSize: "0.75rem", color: "oklch(0.5 0.04 150)" }}>{team.owner}</div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{team.w}</td>
                      <td style={{ textAlign: "center", color: "oklch(0.45 0.04 150)" }}>{team.l}</td>
                      <td style={{ textAlign: "center", color: "oklch(0.45 0.04 150)" }}>{team.pct}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "oklch(0.22 0.06 150)" }}>{team.pf.toFixed(1)}</td>
                      <td style={{ textAlign: "right", color: "oklch(0.5 0.04 150)" }}>{team.pa.toFixed(1)}</td>
                      <td style={{ textAlign: "center" }}><StreakBadge streak={team.streak} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Double Result Explanation */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>Double Result System</div>
                <p style={{ fontSize: "0.82rem", color: "oklch(0.4 0.04 150)", margin: 0, lineHeight: 1.5 }}>
                  Each team earns two results per week: a head-to-head result (2W or 2L) and a league median result (1W for top 6 scorers, 1L for bottom 6). Maximum 3W or 3L per week.
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
