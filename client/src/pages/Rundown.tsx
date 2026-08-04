import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

// Pre-season placeholder — will be replaced with live Supabase data once Week 1 is complete
const WEEK_MATCHUPS = [
  { home: "Jonas Pattie",       hScore: 0, away: "Keith Cromer",          aScore: 0, isChallenge: false },
  { home: "The Boys of Fall",   hScore: 0, away: "Millertime",            aScore: 0, isChallenge: false },
  { home: "Heiden's Hardtimes", hScore: 0, away: "Billy Goats Gruff",     aScore: 0, isChallenge: false },
  { home: "The Four Horsemen",  hScore: 0, away: "Legion of Doom",        aScore: 0, isChallenge: false },
  { home: "Xavier Musketeers",  hScore: 0, away: "Legends",               aScore: 0, isChallenge: false },
  { home: "Vipers",             hScore: 0, away: 'Larry "Bud" Melman123', aScore: 0, isChallenge: false },
];

const MEDIAN = 0;
const WEEK_LABEL = "Week 1";
const WEEK_STATUS = "Upcoming — Sept. 9–14";

export default function Rundown() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Weekly Rundown</h1>
          <p>{WEEK_LABEL} · {WEEK_STATUS}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {WEEK_MATCHUPS.map((m, i) => {
            const isPending = m.hScore === 0 && m.aScore === 0;
            const homeWon = !isPending && m.hScore > m.aScore;
            return (
              <div key={i} className="wrc-card">
                {m.isChallenge && (
                  <div style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", color: "oklch(0.15 0.02 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.3rem 0.75rem", textAlign: "center" }}>⚔️ Challenge Game</div>
                )}
                <div className="wrc-card-gold-stripe" />
                <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)" }}>{m.home}</div>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.04 150)" }}>
                        {isPending ? "—" : m.hScore.toFixed(1)}
                      </div>
                      {!isPending && MEDIAN > 0 && (
                        <div style={{ fontSize: "0.72rem", color: m.hScore >= MEDIAN ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 600 }}>
                          {m.hScore >= MEDIAN ? "↑ Above Median" : "↓ Below Median"}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.6 0.04 150)" }}>
                      {isPending ? "UPCOMING" : "FINAL"}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: !homeWon && !isPending ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)" }}>{m.away}</div>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: !homeWon && !isPending ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.04 150)" }}>
                        {isPending ? "—" : m.aScore.toFixed(1)}
                      </div>
                      {!isPending && MEDIAN > 0 && (
                        <div style={{ fontSize: "0.72rem", color: m.aScore >= MEDIAN ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 600 }}>
                          {m.aScore >= MEDIAN ? "↑ Above Median" : "↓ Below Median"}
                        </div>
                      )}
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
