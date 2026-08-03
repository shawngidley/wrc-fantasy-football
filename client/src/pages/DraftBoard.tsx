/**
 * WRC Fantasy Football - Draft Board Page
 * Background: Stadium at night
 * Live draft with 1:30 timer, theme songs, player pool, snake rounds 3-18
 * Lottery picks 1-6 in Rounds 1-2, Commissioner controls
 */
import { useState, useEffect, useRef, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Pause, SkipForward, Search, Music, Clock, Trophy } from "lucide-react";

const TIMER_SECONDS = 90;
const TOTAL_ROUNDS = 18;
const TOTAL_TEAMS = 12;

const TEAMS = [
  "Team Gidley", "Team Osicki", "Team Sotka", "Team Nelson",
  "Team Yane", "Team Cromer", "Team Pattie", "Team Krause",
  "Team Ryks", "Team Heiden", "Team Akagi", "Team Mackar",
];

const SAMPLE_PLAYERS = [
  { id: "1", name: "Josh Allen", pos: "QB", nflTeam: "BUF", adp: 1.2 },
  { id: "2", name: "Lamar Jackson", pos: "QB", nflTeam: "BAL", adp: 2.1 },
  { id: "3", name: "Saquon Barkley", pos: "RB", nflTeam: "PHI", adp: 3.4 },
  { id: "4", name: "CeeDee Lamb", pos: "WR", nflTeam: "DAL", adp: 4.2 },
  { id: "5", name: "Tyreek Hill", pos: "WR", nflTeam: "MIA", adp: 5.8 },
  { id: "6", name: "Derrick Henry", pos: "RB", nflTeam: "BAL", adp: 6.1 },
  { id: "7", name: "Justin Jefferson", pos: "WR", nflTeam: "MIN", adp: 7.3 },
  { id: "8", name: "Sam LaPorta", pos: "TE", nflTeam: "DET", adp: 8.6 },
  { id: "9", name: "Jahmyr Gibbs", pos: "RB", nflTeam: "DET", adp: 9.2 },
  { id: "10", name: "Stefon Diggs", pos: "WR", nflTeam: "HOU", adp: 10.4 },
  { id: "11", name: "Travis Kelce", pos: "TE", nflTeam: "KC", adp: 11.1 },
  { id: "12", name: "Davante Adams", pos: "WR", nflTeam: "LV", adp: 12.8 },
  { id: "13", name: "Tony Pollard", pos: "RB", nflTeam: "TEN", adp: 13.5 },
  { id: "14", name: "Amon-Ra St. Brown", pos: "WR", nflTeam: "DET", adp: 14.2 },
  { id: "15", name: "Jaylen Waddle", pos: "WR", nflTeam: "MIA", adp: 15.6 },
];

const POS_COLORS: Record<string, string> = {
  QB: "#6366f1",
  RB: "oklch(0.42 0.15 150)",
  WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)",
  K: "#64748b",
  DST: "#ef4444",
};

function getPickTeamIndex(round: number, pick: number): number {
  if (round % 2 === 1) return pick; // odd round: normal order
  return TOTAL_TEAMS - 1 - pick; // even round: reversed (snake)
}

type DraftPick = { team: string; player: string; pos: string };

export default function DraftBoard() {
  const { franchise, isCommissioner } = useAuth();
  const [draftStarted, setDraftStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentPick, setCurrentPick] = useState(0);
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [isPaused, setIsPaused] = useState(false);
  const [picks, setPicks] = useState<Record<string, DraftPick>>({});
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [availablePlayers, setAvailablePlayers] = useState(SAMPLE_PLAYERS);
  const [showPlayerPool, setShowPlayerPool] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTeamIndex = getPickTeamIndex(currentRound, currentPick);
  const currentTeam = TEAMS[currentTeamIndex];
  const pickKey = `${currentRound}-${currentPick}`;
  const isMyTurn = franchise?.team_name === currentTeam;
  const totalPicksMade = Object.keys(picks).length;
  const draftComplete = totalPicksMade >= TOTAL_ROUNDS * TOTAL_TEAMS;

  const advancePick = useCallback(() => {
    let nextPick = currentPick + 1;
    let nextRound = currentRound;
    if (nextPick >= TOTAL_TEAMS) {
      nextPick = 0;
      nextRound = currentRound + 1;
    }
    if (nextRound > TOTAL_ROUNDS) return;
    setCurrentPick(nextPick);
    setCurrentRound(nextRound);
    setTimer(TIMER_SECONDS);
    setIsPaused(false);
  }, [currentPick, currentRound]);

  // Timer countdown
  useEffect(() => {
    if (!draftStarted || isPaused || draftComplete) return;
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          setIsPaused(true); // pause and wait for commish
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [draftStarted, isPaused, draftComplete]);

  const handlePickPlayer = (player: typeof SAMPLE_PLAYERS[0]) => {
    if (!draftStarted || draftComplete) return;
    if (!isMyTurn && !isCommissioner) return;
    setPicks(prev => ({ ...prev, [pickKey]: { team: currentTeam, player: player.name, pos: player.pos } }));
    setAvailablePlayers(prev => prev.filter(p => p.id !== player.id));
    setShowPlayerPool(false);
    advancePick();
  };

  const handleSkip = () => {
    if (!isCommissioner) return;
    advancePick();
  };

  const mins = Math.floor(timer / 60);
  const secs = timer % 60;
  const timerStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const timerPct = (timer / TIMER_SECONDS) * 100;
  const timerColor = timer > 45 ? "oklch(0.42 0.15 150)" : timer > 20 ? "oklch(0.65 0.14 85)" : "#ef4444";

  const filteredPlayers = availablePlayers.filter(p => {
    const matchPos = posFilter === "ALL" || p.pos === posFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.nflTeam.toLowerCase().includes(search.toLowerCase());
    return matchPos && matchSearch;
  });

  return (
    <div className="bg-stadium-night bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "1rem 1rem 3rem" }}>
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>2025 WRC Draft</h1>
            <p>Thursday, August 27, 2025 · 7:00 PM ET · 18 Rounds</p>
          </div>
          {!draftStarted && isCommissioner && (
            <button
              onClick={() => setDraftStarted(true)}
              style={{
                background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))",
                color: "oklch(0.15 0.02 150)",
                border: "none",
                borderRadius: 8,
                padding: "0.6rem 1.5rem",
                fontFamily: "Oswald, sans-serif",
                fontSize: "0.95rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Play size={16} /> Start Draft
            </button>
          )}
        </div>

        {/* On The Clock Banner */}
        {draftStarted && !draftComplete && (
          <div style={{
            background: isMyTurn ? "linear-gradient(90deg, oklch(0.28 0.09 150), oklch(0.35 0.1 150))" : "rgba(0,0,0,0.55)",
            border: isMyTurn ? "2px solid oklch(0.78 0.15 85)" : "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12,
            padding: "0.875rem 1.25rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>
                On The Clock — Round {currentRound}, Pick {currentPick + 1}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.3rem", color: isMyTurn ? "oklch(0.78 0.15 85)" : "white" }}>
                {currentTeam}
                {isMyTurn && " — YOUR PICK"}
              </div>
            </div>

            {/* Timer */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem", color: timerColor, lineHeight: 1 }}>
                {timerStr}
              </div>
              <div style={{ height: 4, width: 80, background: "rgba(255,255,255,0.15)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, transition: "width 1s linear, background 0.5s" }} />
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(isMyTurn || isCommissioner) && (
                <button
                  onClick={() => setShowPlayerPool(true)}
                  style={{
                    background: "oklch(0.78 0.15 85)",
                    color: "oklch(0.15 0.02 150)",
                    border: "none",
                    borderRadius: 8,
                    padding: "0.5rem 1rem",
                    fontFamily: "Oswald, sans-serif",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Make Pick
                </button>
              )}
              {isCommissioner && (
                <>
                  <button onClick={() => setIsPaused(p => !p)} style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "0.5rem 0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Oswald, sans-serif", fontSize: "0.78rem" }}>
                    {isPaused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
                  </button>
                  <button onClick={handleSkip} style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "0.5rem 0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Oswald, sans-serif", fontSize: "0.78rem" }}>
                    <SkipForward size={13} /> Skip
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Draft Grid */}
        <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
          <div style={{ minWidth: TOTAL_TEAMS * 120 + 60 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${TOTAL_TEAMS}, 1fr)`, gap: 2, marginBottom: 2 }}>
              <div style={{ background: "rgba(0,0,0,0.5)", padding: "0.4rem", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>RD</div>
              {TEAMS.map((team, i) => (
                <div key={i} style={{ background: "oklch(0.22 0.08 150)", padding: "0.4rem 0.25rem", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", fontWeight: 600, color: "white", textAlign: "center", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {team.replace("Team ", "")}
                </div>
              ))}
            </div>

            {/* Pick rows */}
            {Array.from({ length: TOTAL_ROUNDS }, (_, r) => (
              <div key={r} style={{ display: "grid", gridTemplateColumns: `60px repeat(${TOTAL_TEAMS}, 1fr)`, gap: 2, marginBottom: 2 }}>
                <div style={{ background: "rgba(0,0,0,0.4)", padding: "0.4rem", fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {r + 1}
                  {r < 2 && <span style={{ fontSize: "0.55rem", color: "oklch(0.78 0.15 85)", marginLeft: 2 }}>L</span>}
                </div>
                {Array.from({ length: TOTAL_TEAMS }, (_, p) => {
                  const teamIdx = getPickTeamIndex(r + 1, p);
                  const team = TEAMS[teamIdx];
                  const key = `${r + 1}-${p}`;
                  const pick = picks[key];
                  const isCurrent = draftStarted && r + 1 === currentRound && p === currentPick && !draftComplete;
                  return (
                    <div key={p} style={{
                      background: isCurrent ? "oklch(0.78 0.15 85)" : pick ? "oklch(0.94 0.01 150)" : "rgba(255,255,255,0.06)",
                      border: isCurrent ? "2px solid oklch(0.65 0.14 85)" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 4,
                      padding: "0.35rem 0.25rem",
                      minHeight: 52,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      transition: "background 0.2s",
                    }}>
                      {pick ? (
                        <>
                          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "oklch(0.22 0.08 150)", textAlign: "center", lineHeight: 1.2 }}>{pick.player}</div>
                          <div style={{ textAlign: "center", marginTop: 2 }}>
                            <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "white", background: POS_COLORS[pick.pos] || "#64748b", borderRadius: 3, padding: "1px 4px" }}>{pick.pos}</span>
                          </div>
                        </>
                      ) : isCurrent ? (
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "oklch(0.15 0.02 150)", textAlign: "center" }}>ON CLOCK</div>
                      ) : (
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>{r + 1}.{p + 1}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Theme Song Note */}
        <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Music size={18} color="oklch(0.78 0.15 85)" />
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "white", letterSpacing: "0.04em" }}>Theme Songs</div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>Each owner can upload their theme song in Account Settings. It plays automatically when they go on the clock.</div>
          </div>
        </div>
      </div>

      {/* Player Pool Modal */}
      {showPlayerPool && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 600, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "oklch(0.22 0.08 150)", padding: "1rem 1.25rem", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: "white", letterSpacing: "0.06em" }}>SELECT A PLAYER</div>
              <button onClick={() => setShowPlayerPool(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>
            {/* Search + Filter */}
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid oklch(0.9 0.005 150)" }}>
              <div style={{ position: "relative", marginBottom: "0.5rem" }}>
                <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..." style={{ width: "100%", padding: "0.5rem 0.5rem 0.5rem 2rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map(pos => (
                  <button key={pos} onClick={() => setPosFilter(pos)} style={{ padding: "0.25rem 0.6rem", borderRadius: 6, border: "1.5px solid", borderColor: posFilter === pos ? "oklch(0.28 0.09 150)" : "oklch(0.88 0.01 150)", background: posFilter === pos ? "oklch(0.28 0.09 150)" : "white", color: posFilter === pos ? "white" : "oklch(0.4 0.04 150)", fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>
                    {pos}
                  </button>
                ))}
              </div>
            </div>
            {/* Player list */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filteredPlayers.map(player => (
                <div key={player.id} onClick={() => handlePickPlayer(player)} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid oklch(0.95 0.003 150)", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.96 0.01 150)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  <span style={{ width: 36, textAlign: "center", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 4, padding: "2px 0" }}>{player.pos}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)" }}>{player.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{player.nflTeam} · ADP {player.adp}</div>
                  </div>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "oklch(0.28 0.09 150)" }}>Draft</span>
                </div>
              ))}
              {filteredPlayers.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: "oklch(0.6 0.04 150)", fontSize: "0.9rem" }}>No players found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
