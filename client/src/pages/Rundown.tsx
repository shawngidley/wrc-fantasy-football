import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

const WEEK_MATCHUPS = [
  { home: "Team Gidley", hScore: 142.6, away: "Team Pattie", aScore: 118.3, isChallenge: true },
  { home: "Team Sotka", hScore: 128.4, away: "Team Krause", aScore: 98.2, isChallenge: false },
  { home: "Team Heiden", hScore: 104.6, away: "Team Nelson", aScore: 118.8, isChallenge: false },
  { home: "Team Akagi", hScore: 132.2, away: "Team Yane", aScore: 96.4, isChallenge: false },
  { home: "Team Mackar", hScore: 108.6, away: "Team Ryks", aScore: 122.4, isChallenge: false },
  { home: "Team Cromer", hScore: 88.2, away: "Team Osicki", aScore: 76.6, isChallenge: false },
];

const MEDIAN = 115.5;

export default function Rundown() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Weekly Rundown</h1>
          <p>Week 14 Final Results · League Median: {MEDIAN} pts</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {WEEK_MATCHUPS.map((m, i) => {
            const homeWon = m.hScore > m.aScore;
            return (
              <div key={i} className="wrc-card">
                {m.isChallenge && <div style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", color: "oklch(0.15 0.02 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.3rem 0.75rem", textAlign: "center" }}>⚔️ Challenge Game</div>}
                <div className="wrc-card-gold-stripe" />
                <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)" }}>{m.home}</div>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.04 150)" }}>{m.hScore.toFixed(1)}</div>
                      <div style={{ fontSize: "0.72rem", color: m.hScore >= MEDIAN ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 600 }}>{m.hScore >= MEDIAN ? "↑ Above Median" : "↓ Below Median"}</div>
                    </div>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.6 0.04 150)" }}>FINAL</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: !homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)" }}>{m.away}</div>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: !homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.04 150)" }}>{m.aScore.toFixed(1)}</div>
                      <div style={{ fontSize: "0.72rem", color: m.aScore >= MEDIAN ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 600 }}>{m.aScore >= MEDIAN ? "↑ Above Median" : "↓ Below Median"}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
