import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

const SCHEDULE = [
  { week: 1, date: "Sep 4–8, 2025", matchups: [["Team Gidley","Team Osicki"],["Team Sotka","Team Nelson"],["Team Yane","Team Cromer"],["Team Pattie","Team Krause"],["Team Ryks","Team Heiden"],["Team Akagi","Team Mackar"]] },
  { week: 2, date: "Sep 11–15, 2025", matchups: [["Team Gidley","Team Sotka"],["Team Osicki","Team Nelson"],["Team Yane","Team Pattie"],["Team Cromer","Team Krause"],["Team Ryks","Team Akagi"],["Team Heiden","Team Mackar"]] },
  { week: 3, date: "Sep 18–22, 2025", matchups: [["Team Gidley","Team Nelson"],["Team Sotka","Team Osicki"],["Team Yane","Team Krause"],["Team Cromer","Team Pattie"],["Team Ryks","Team Mackar"],["Team Heiden","Team Akagi"]] },
];

export default function Schedule() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}><h1>2025 Schedule</h1><p>Regular Season — Weeks 1-14 · Playoffs Weeks 15-17</p></div>
        {SCHEDULE.map(week => (
          <div key={week.week} className="wrc-card" style={{ marginBottom: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header">Week {week.week} <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: "0.78rem", color: "rgba(255,255,255,0.65)" }}>{week.date}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 0 }}>
              {week.matchups.map(([h, a], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", borderBottom: "1px solid oklch(0.92 0.005 150)", borderRight: i % 2 === 0 ? "1px solid oklch(0.92 0.005 150)" : "none" }}>
                  <span style={{ fontWeight: h === franchise?.team_name ? 700 : 400, fontSize: "0.875rem", color: h === franchise?.team_name ? "oklch(0.22 0.08 150)" : "oklch(0.3 0.04 150)" }}>{h}</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", color: "oklch(0.6 0.04 150)", fontWeight: 600, padding: "0 0.5rem" }}>vs</span>
                  <span style={{ fontWeight: a === franchise?.team_name ? 700 : 400, fontSize: "0.875rem", color: a === franchise?.team_name ? "oklch(0.22 0.08 150)" : "oklch(0.3 0.04 150)" }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
