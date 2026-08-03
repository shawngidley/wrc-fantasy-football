/**
 * WRC Fantasy Football - Live Scoring Page
 * Background: Stadium crowd
 * Auto-refreshes on countdown timer, shows all 6 matchups
 * Clicking a matchup card opens a full player breakdown drawer
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, Clock, X, ChevronRight } from "lucide-react";

const REFRESH_SECONDS = 300;

// Mock player data per team — replace with Supabase + Tank01 data
const MOCK_ROSTERS: Record<string, { slot: string; name: string; pos: string; nflTeam: string; status: "active" | "bye" | "out" | "bench"; pts: number; proj: number; stats: string }[]> = {
  "Team Gidley": [
    { slot: "QB", name: "Lamar Jackson", pos: "QB", nflTeam: "BAL", status: "active", pts: 28.6, proj: 32.4, stats: "24/36, 287 yds, 2 TD, 1 INT, 42 rush yds" },
    { slot: "RB1", name: "Christian McCaffrey", pos: "RB", nflTeam: "SF", status: "active", pts: 18.2, proj: 22.8, stats: "14 car, 88 yds, 1 TD, 4 rec, 32 yds" },
    { slot: "RB2", name: "Saquon Barkley", pos: "RB", nflTeam: "PHI", status: "active", pts: 14.4, proj: 18.2, stats: "12 car, 74 yds, 6 rec, 40 yds" },
    { slot: "WR1", name: "Tyreek Hill", pos: "WR", nflTeam: "MIA", status: "active", pts: 11.8, proj: 16.4, stats: "7 rec, 88 yds" },
    { slot: "WR2", name: "CeeDee Lamb", pos: "WR", nflTeam: "DAL", status: "active", pts: 8.2, proj: 14.6, stats: "5 rec, 62 yds" },
    { slot: "TE", name: "Travis Kelce", pos: "TE", nflTeam: "KC", status: "active", pts: 9.0, proj: 12.2, stats: "4 rec, 45 yds (1.5x PPR)" },
    { slot: "SFLEX", name: "Josh Allen", pos: "QB", nflTeam: "BUF", status: "active", pts: 4.8, proj: 28.6, stats: "Game not started" },
    { slot: "FLEX", name: "Davante Adams", pos: "WR", nflTeam: "LV", status: "active", pts: 3.4, proj: 11.2, stats: "2 rec, 24 yds" },
    { slot: "K", name: "Justin Tucker", pos: "K", nflTeam: "BAL", status: "active", pts: 0.0, proj: 8.8, stats: "0/0 FG" },
    { slot: "DST", name: "San Francisco 49ers", pos: "DST", nflTeam: "SF", status: "active", pts: 0.0, proj: 8.4, stats: "Game not started" },
    { slot: "BN", name: "Jaylen Waddle", pos: "WR", nflTeam: "MIA", status: "bench", pts: 6.2, proj: 10.4, stats: "4 rec, 52 yds" },
    { slot: "BN", name: "Tony Pollard", pos: "RB", nflTeam: "TEN", status: "bench", pts: 4.8, proj: 8.2, stats: "8 car, 38 yds" },
  ],
  "Team Pattie": [
    { slot: "QB", name: "Patrick Mahomes", pos: "QB", nflTeam: "KC", status: "active", pts: 22.4, proj: 28.8, stats: "21/32, 248 yds, 2 TD" },
    { slot: "RB1", name: "Derrick Henry", pos: "RB", nflTeam: "BAL", status: "active", pts: 19.6, proj: 21.4, stats: "18 car, 116 yds, 1 TD" },
    { slot: "RB2", name: "Josh Jacobs", pos: "RB", nflTeam: "GB", status: "active", pts: 11.2, proj: 14.8, stats: "10 car, 62 yds, 3 rec, 20 yds" },
    { slot: "WR1", name: "Stefon Diggs", pos: "WR", nflTeam: "HOU", status: "active", pts: 9.8, proj: 14.2, stats: "6 rec, 78 yds" },
    { slot: "WR2", name: "Keenan Allen", pos: "WR", nflTeam: "CHI", status: "active", pts: 7.4, proj: 12.6, stats: "5 rec, 54 yds" },
    { slot: "TE", name: "Sam LaPorta", pos: "TE", nflTeam: "DET", status: "active", pts: 6.0, proj: 9.4, stats: "3 rec, 28 yds (1.5x PPR)" },
    { slot: "SFLEX", name: "Jalen Hurts", pos: "QB", nflTeam: "PHI", status: "active", pts: 4.2, proj: 26.4, stats: "Game not started" },
    { slot: "FLEX", name: "Gus Edwards", pos: "RB", nflTeam: "LAC", status: "active", pts: 4.6, proj: 9.8, stats: "6 car, 36 yds, 1 rec" },
    { slot: "K", name: "Evan McPherson", pos: "K", nflTeam: "CIN", status: "active", pts: 2.0, proj: 7.6, stats: "1/1 FG (32 yds)" },
    { slot: "DST", name: "Dallas Cowboys", pos: "DST", nflTeam: "DAL", status: "active", pts: 0.0, proj: 7.2, stats: "Game not started" },
    { slot: "BN", name: "Amari Cooper", pos: "WR", nflTeam: "CLE", status: "bench", pts: 5.4, proj: 9.2, stats: "4 rec, 44 yds" },
    { slot: "BN", name: "Zack Moss", pos: "RB", nflTeam: "IND", status: "bench", pts: 3.6, proj: 7.4, stats: "7 car, 26 yds" },
  ],
};

const MOCK_MATCHUPS = [
  { id: 1, isChallenge: true, week: 14, home: { team: "Team Gidley", owner: "Shawn Gidley", score: 98.4, projected: 124.6 }, away: { team: "Team Pattie", owner: "Jonas Pattie", score: 87.2, projected: 118.3 }, gamesPlayed: 8, gamesTotal: 16 },
  { id: 2, isChallenge: false, week: 14, home: { team: "Team Sotka", owner: "David Sotka", score: 112.8, projected: 131.2 }, away: { team: "Team Krause", owner: "Bill Krause", score: 95.6, projected: 108.4 }, gamesPlayed: 10, gamesTotal: 16 },
  { id: 3, isChallenge: false, week: 14, home: { team: "Team Heiden", owner: "Jason Heiden", score: 78.2, projected: 119.8 }, away: { team: "Team Nelson", owner: "Scott Nelson", score: 84.6, projected: 112.2 }, gamesPlayed: 7, gamesTotal: 16 },
  { id: 4, isChallenge: false, week: 14, home: { team: "Team Akagi", owner: "Greg Akagi", score: 105.4, projected: 122.6 }, away: { team: "Team Yane", owner: "James Yane", score: 88.8, projected: 98.4 }, gamesPlayed: 11, gamesTotal: 16 },
  { id: 5, isChallenge: false, week: 14, home: { team: "Team Mackar", owner: "Scott Mackar", score: 92.2, projected: 115.4 }, away: { team: "Team Ryks", owner: "David Ryks", score: 101.6, projected: 120.8 }, gamesPlayed: 9, gamesTotal: 16 },
  { id: 6, isChallenge: false, week: 14, home: { team: "Team Cromer", owner: "Keith Cromer", score: 76.4, projected: 104.2 }, away: { team: "Team Osicki", owner: "Dan Osicki", score: 68.8, projected: 92.6 }, gamesPlayed: 8, gamesTotal: 16 },
];

const SLOT_ORDER = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "SFLEX", "FLEX", "K", "DST", "BN"];

function PlayerRow({ p }: { p: typeof MOCK_ROSTERS["Team Gidley"][0] }) {
  const isBench = p.slot === "BN";
  const isTE = p.pos === "TE";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "48px 1fr 60px 60px",
      alignItems: "center",
      padding: "0.55rem 1rem",
      borderBottom: "1px solid oklch(0.92 0.005 150)",
      background: isBench ? "oklch(0.97 0.003 150)" : "white",
      gap: "0.5rem",
    }}>
      <div style={{ textAlign: "center" }}>
        <span style={{
          fontFamily: "Oswald, sans-serif",
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: isBench ? "oklch(0.65 0.04 150)" : "oklch(0.28 0.09 150)",
          background: isBench ? "oklch(0.92 0.005 150)" : "oklch(0.92 0.05 150)",
          padding: "2px 5px",
          borderRadius: 3,
        }}>{p.slot}</span>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "oklch(0.2 0.03 150)" }}>
          {p.name}
          {isTE && !isBench && <span style={{ marginLeft: 4, fontSize: "0.6rem", color: "oklch(0.65 0.14 85)", fontWeight: 700, background: "oklch(0.97 0.08 85)", padding: "1px 4px", borderRadius: 3 }}>1.5x</span>}
        </div>
        <div style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>{p.pos} · {p.nflTeam}</div>
        <div style={{ fontSize: "0.68rem", color: "oklch(0.6 0.04 150)", marginTop: 1 }}>{p.stats}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: p.pts > 0 ? "oklch(0.22 0.08 150)" : "oklch(0.65 0.04 150)" }}>{p.pts.toFixed(1)}</div>
        <div style={{ fontSize: "0.65rem", color: "oklch(0.6 0.04 150)" }}>pts</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", color: "oklch(0.65 0.04 150)" }}>{p.proj.toFixed(1)}</div>
        <div style={{ fontSize: "0.65rem", color: "oklch(0.7 0.03 150)" }}>proj</div>
      </div>
    </div>
  );
}

function TeamBreakdown({ teamName, score, projected }: { teamName: string; score: number; projected: number }) {
  const players = MOCK_ROSTERS[teamName] ?? [];
  const starters = players.filter(p => p.slot !== "BN");
  const bench = players.filter(p => p.slot === "BN");
  return (
    <div>
      {/* Team Header */}
      <div style={{ background: "oklch(0.22 0.08 150)", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: "white", letterSpacing: "0.04em" }}>{teamName}</div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)" }}>Starters · {starters.length} players</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.6rem", color: "oklch(0.78 0.15 85)", lineHeight: 1 }}>{score.toFixed(1)}</div>
          <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.55)" }}>Proj: {projected.toFixed(1)}</div>
        </div>
      </div>
      {/* Starters */}
      <div style={{ background: "white" }}>
        {starters.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)).map((p, i) => <PlayerRow key={i} p={p} />)}
      </div>
      {/* Bench */}
      {bench.length > 0 && (
        <>
          <div style={{ background: "oklch(0.94 0.005 150)", padding: "0.35rem 1rem", fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.45 0.04 150)", textTransform: "uppercase" }}>
            Bench
          </div>
          {bench.map((p, i) => <PlayerRow key={i} p={p} />)}
        </>
      )}
    </div>
  );
}

function MatchupDrawer({ matchup, onClose }: { matchup: typeof MOCK_MATCHUPS[0]; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"home" | "away">("home");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, backdropFilter: "blur(2px)" }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(520px, 100vw)",
        background: "white",
        zIndex: 301,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.3)",
        animation: "slideInRight 0.25s cubic-bezier(0.23, 1, 0.32, 1)",
      }}>
        {/* Drawer Header */}
        <div style={{ background: "oklch(0.18 0.07 150)", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "white", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Week {matchup.week} Matchup
            </div>
            {matchup.isChallenge && (
              <div style={{ fontSize: "0.7rem", color: "oklch(0.78 0.15 85)", fontFamily: "Oswald, sans-serif", fontWeight: 600, letterSpacing: "0.06em" }}>⚔️ CHALLENGE GAME</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <X size={22} />
          </button>
        </div>

        {/* Score Summary */}
        <div style={{ background: "oklch(0.96 0.005 150)", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.22 0.08 150)" }}>{matchup.home.team}</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: matchup.home.score > matchup.away.score ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)", lineHeight: 1 }}>{matchup.home.score.toFixed(1)}</div>
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.6 0.04 150)", padding: "0 0.75rem" }}>VS</div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.22 0.08 150)" }}>{matchup.away.team}</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: matchup.away.score > matchup.home.score ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)", lineHeight: 1 }}>{matchup.away.score.toFixed(1)}</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", borderBottom: "2px solid oklch(0.9 0.005 150)", flexShrink: 0 }}>
          {(["home", "away"] as const).map(tab => {
            const team = tab === "home" ? matchup.home : matchup.away;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "0.65rem 1rem",
                  border: "none",
                  background: "none",
                  fontFamily: "Oswald, sans-serif",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: activeTab === tab ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)",
                  borderBottom: activeTab === tab ? "3px solid oklch(0.28 0.09 150)" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: -2,
                }}
              >
                {team.team}
                <span style={{ marginLeft: 6, color: "oklch(0.65 0.14 85)" }}>{team.score.toFixed(1)}</span>
              </button>
            );
          })}
        </div>

        {/* Player List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "home"
            ? <TeamBreakdown teamName={matchup.home.team} score={matchup.home.score} projected={matchup.home.projected} />
            : <TeamBreakdown teamName={matchup.away.team} score={matchup.away.score} projected={matchup.away.projected} />
          }
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.8; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function MatchupCard({ matchup, onClick }: { matchup: typeof MOCK_MATCHUPS[0]; onClick: () => void }) {
  const homeWinning = matchup.home.score > matchup.away.score;
  const progress = (matchup.gamesPlayed / matchup.gamesTotal) * 100;

  return (
    <div
      className="wrc-card"
      onClick={onClick}
      style={{ position: "relative", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.28)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      {matchup.isChallenge && (
        <div style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", color: "oklch(0.15 0.02 150)", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.3rem 0.75rem", textAlign: "center" }}>
          ⚔️ Challenge Game
        </div>
      )}
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.5 0.04 150)" }}>Week {matchup.week}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: homeWinning ? "oklch(0.28 0.09 150)" : "oklch(0.4 0.04 150)", marginBottom: 2 }}>{matchup.home.team}</div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{matchup.home.owner}</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem", color: homeWinning ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)", lineHeight: 1.1, marginTop: 4 }}>{matchup.home.score.toFixed(1)}</div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)" }}>Proj: {matchup.home.projected.toFixed(1)}</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.6 0.04 150)" }}>VS</div>
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: !homeWinning ? "oklch(0.28 0.09 150)" : "oklch(0.4 0.04 150)", marginBottom: 2 }}>{matchup.away.team}</div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{matchup.away.owner}</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem", color: !homeWinning ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)", lineHeight: 1.1, marginTop: 4 }}>{matchup.away.score.toFixed(1)}</div>
            <div style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)" }}>Proj: {matchup.away.projected.toFixed(1)}</div>
          </div>
        </div>
        <div style={{ marginTop: "0.875rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>{matchup.gamesPlayed}/{matchup.gamesTotal} games</span>
            <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>{Math.round(progress)}% complete</span>
          </div>
          <div style={{ height: 5, background: "oklch(0.9 0.005 150)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, oklch(0.28 0.09 150), oklch(0.38 0.1 150))", borderRadius: 3, transition: "width 0.5s" }} />
          </div>
        </div>
        {/* Click hint */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: "0.75rem", paddingTop: "0.6rem", borderTop: "1px solid oklch(0.93 0.005 150)" }}>
          <span style={{ fontSize: "0.68rem", color: "oklch(0.6 0.04 150)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>VIEW PLAYER BREAKDOWN</span>
          <ChevronRight size={12} color="oklch(0.6 0.04 150)" />
        </div>
      </div>
    </div>
  );
}

export default function LiveScoring() {
  const { franchise } = useAuth();
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeMatchup, setActiveMatchup] = useState<typeof MOCK_MATCHUPS[0] | null>(null);

  const refresh = useCallback(() => {
    setLastRefresh(new Date());
    setCountdown(REFRESH_SECONDS);
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>Live Scoring</h1>
            <p>Week 14 — Sunday, December 21, 2025 · Tap any matchup to see player stats</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "0.4rem 0.75rem" }}>
              <Clock size={14} color="rgba(255,255,255,0.7)" />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>Refreshing in {timeStr}</span>
            </div>
            <button onClick={refresh} style={{ background: "oklch(0.28 0.09 150)", border: "none", borderRadius: 8, padding: "0.4rem 0.75rem", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", letterSpacing: "0.04em" }}>
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {MOCK_MATCHUPS.map(m => (
            <MatchupCard key={m.id} matchup={m} onClick={() => setActiveMatchup(m)} />
          ))}
        </div>

        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", textAlign: "center", marginTop: "1.5rem" }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>

      {activeMatchup && (
        <MatchupDrawer matchup={activeMatchup} onClose={() => setActiveMatchup(null)} />
      )}
    </div>
  );
}
