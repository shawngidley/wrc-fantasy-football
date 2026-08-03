import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

const WEEKS = Array.from({ length: 14 }, (_, i) => ({ week: i + 1, label: `Week ${i + 1}` }));
const RESULTS = [
  { week: 14, home: "Team Gidley", hScore: 142.6, away: "Team Pattie", aScore: 118.3 },
  { week: 14, home: "Team Sotka", hScore: 128.4, away: "Team Krause", aScore: 98.2 },
  { week: 14, home: "Team Heiden", hScore: 104.6, away: "Team Nelson", aScore: 118.8 },
  { week: 13, home: "Team Gidley", hScore: 118.2, away: "Team Akagi", aScore: 104.6 },
  { week: 13, home: "Team Pattie", hScore: 138.4, away: "Team Yane", aScore: 88.2 },
];

export default function Results() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}><h1>Results</h1><p>Weekly matchup results and box scores — 2025 Season</p></div>
        {[14, 13].map(week => (
          <div key={week} className="wrc-card" style={{ marginBottom: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header">Week {week} Results</div>
            <div style={{ overflowX: "auto" }}>
              <table className="wrc-table" style={{ minWidth: 400 }}>
                <thead><tr><th>Home Team</th><th style={{ textAlign: "center" }}>Score</th><th style={{ textAlign: "center" }}>Score</th><th>Away Team</th><th>Result</th></tr></thead>
                <tbody>
                  {RESULTS.filter(r => r.week === week).map((r, i) => {
                    const homeWon = r.hScore > r.aScore;
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: homeWon ? 700 : 400 }}>{r.home}</td>
                        <td style={{ textAlign: "center", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)" }}>{r.hScore.toFixed(1)}</td>
                        <td style={{ textAlign: "center", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: !homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)" }}>{r.aScore.toFixed(1)}</td>
                        <td style={{ fontWeight: !homeWon ? 700 : 400 }}>{r.away}</td>
                        <td><span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", fontWeight: 700, color: homeWon ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)" }}>{homeWon ? r.home : r.away} W</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
