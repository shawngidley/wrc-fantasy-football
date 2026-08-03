/**
 * WRC Fantasy Football - Live Scoring Page
 * Background: Stadium crowd
 * Auto-refreshes on countdown timer, shows all 6 matchups
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, Clock } from "lucide-react";

const REFRESH_SECONDS = 300; // 5 minutes

const MOCK_MATCHUPS = [
  {
    id: 1,
    isChallenge: true,
    week: 14,
    home: { team: "Team Gidley", owner: "Shawn Gidley", score: 98.4, projected: 124.6 },
    away: { team: "Team Pattie", owner: "Jonas Pattie", score: 87.2, projected: 118.3 },
    gamesPlayed: 8,
    gamesTotal: 16,
  },
  {
    id: 2,
    isChallenge: false,
    week: 14,
    home: { team: "Team Sotka", owner: "David Sotka", score: 112.8, projected: 131.2 },
    away: { team: "Team Krause", owner: "Bill Krause", score: 95.6, projected: 108.4 },
    gamesPlayed: 10,
    gamesTotal: 16,
  },
  {
    id: 3,
    isChallenge: false,
    week: 14,
    home: { team: "Team Heiden", owner: "Jason Heiden", score: 78.2, projected: 119.8 },
    away: { team: "Team Nelson", owner: "Scott Nelson", score: 84.6, projected: 112.2 },
    gamesPlayed: 7,
    gamesTotal: 16,
  },
  {
    id: 4,
    isChallenge: false,
    week: 14,
    home: { team: "Team Akagi", owner: "Greg Akagi", score: 105.4, projected: 122.6 },
    away: { team: "Team Yane", owner: "James Yane", score: 88.8, projected: 98.4 },
    gamesPlayed: 11,
    gamesTotal: 16,
  },
  {
    id: 5,
    isChallenge: false,
    week: 14,
    home: { team: "Team Mackar", owner: "Scott Mackar", score: 92.2, projected: 115.4 },
    away: { team: "Team Ryks", owner: "David Ryks", score: 101.6, projected: 120.8 },
    gamesPlayed: 9,
    gamesTotal: 16,
  },
  {
    id: 6,
    isChallenge: false,
    week: 14,
    home: { team: "Team Cromer", owner: "Keith Cromer", score: 76.4, projected: 104.2 },
    away: { team: "Team Osicki", owner: "Dan Osicki", score: 68.8, projected: 92.6 },
    gamesPlayed: 8,
    gamesTotal: 16,
  },
];

function MatchupCard({ matchup }: { matchup: typeof MOCK_MATCHUPS[0] }) {
  const homeWinning = matchup.home.score > matchup.away.score;
  const progress = (matchup.gamesPlayed / matchup.gamesTotal) * 100;

  return (
    <div className="wrc-card" style={{ position: "relative" }}>
      {matchup.isChallenge && (
        <div style={{
          background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))",
          color: "oklch(0.15 0.02 150)",
          fontFamily: "Oswald, sans-serif",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "0.3rem 0.75rem",
          textAlign: "center",
        }}>
          ⚔️ Challenge Game
        </div>
      )}
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.5 0.04 150)" }}>
            Week {matchup.week}
          </span>
        </div>

        {/* Score Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Home Team */}
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: homeWinning ? "oklch(0.28 0.09 150)" : "oklch(0.4 0.04 150)", marginBottom: 2 }}>
              {matchup.home.team}
            </div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{matchup.home.owner}</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem", color: homeWinning ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)", lineHeight: 1.1, marginTop: 4 }}>
              {matchup.home.score.toFixed(1)}
            </div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)" }}>Proj: {matchup.home.projected.toFixed(1)}</div>
          </div>

          {/* VS */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.6 0.04 150)" }}>VS</div>
          </div>

          {/* Away Team */}
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: !homeWinning ? "oklch(0.28 0.09 150)" : "oklch(0.4 0.04 150)", marginBottom: 2 }}>
              {matchup.away.team}
            </div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{matchup.away.owner}</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem", color: !homeWinning ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)", lineHeight: 1.1, marginTop: 4 }}>
              {matchup.away.score.toFixed(1)}
            </div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)" }}>Proj: {matchup.away.projected.toFixed(1)}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: "0.875rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>{matchup.gamesPlayed}/{matchup.gamesTotal} games</span>
            <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)"}}>{Math.round(progress)}% complete</span>
          </div>
          <div style={{ height: 5, background: "oklch(0.9 0.005 150)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, oklch(0.28 0.09 150), oklch(0.38 0.1 150))", borderRadius: 3, transition: "width 0.5s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveScoring() {
  const { franchise } = useAuth();
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    setLastRefresh(new Date());
    setCountdown(REFRESH_SECONDS);
    // TODO: fetch live data from Supabase
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refresh(); return REFRESH_SECONDS; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const tickerMessages = [
    "🔴 LIVE — Week 14 Scoring in Progress",
    "⚔️ CHALLENGE GAME: Team Gidley 98.4 vs. Team Pattie 87.2",
    "📊 LEAGUE MEDIAN: 90.3 pts — 6 teams above, 6 below",
  ];

  return (
    <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={true} tickerMessages={tickerMessages} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title + Refresh */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>Live Scoring</h1>
            <p>Week 14 — Sunday, December 21, 2025</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "0.4rem 0.75rem",
            }}>
              <Clock size={14} color="rgba(255,255,255,0.7)" />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>
                Refreshing in {timeStr}
              </span>
            </div>
            <button
              onClick={refresh}
              style={{
                background: "oklch(0.28 0.09 150)",
                border: "none",
                borderRadius: 8,
                padding: "0.4rem 0.75rem",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontFamily: "Oswald, sans-serif",
                fontSize: "0.82rem",
                letterSpacing: "0.04em",
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* Matchup Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {MOCK_MATCHUPS.map(m => <MatchupCard key={m.id} matchup={m} />)}
        </div>

        {/* Last updated */}
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", textAlign: "center", marginTop: "1.5rem" }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
