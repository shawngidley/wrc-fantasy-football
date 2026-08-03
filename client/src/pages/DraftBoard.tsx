/**
 * WRC Fantasy Football - Draft Board Page
 * Background: Stadium at night
 * Live draft with 1:30 timer, theme songs, player pool, snake rounds 3-18
 * Lottery picks 1-6 in Rounds 1-2, Commissioner controls
 */
import { useState, useEffect, useRef, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Pause, SkipForward, Search, Music, ArrowLeftRight, Grid3X3, Users, ChevronDown, ChevronUp } from "lucide-react";
import { DRAFT_PICKS_2026, OWNER_TO_TEAM_ID, getTradedPicks } from "@/lib/draftData2026";
import { TEAMS as WRC_TEAMS } from "@/lib/wrcData";

const TIMER_SECONDS = 90;
const TOTAL_ROUNDS = 18;
const TOTAL_TEAMS = 12;

// 2026 WRC Draft date — update this when the date is set
// Format: ISO 8601 string in Eastern Time
const DRAFT_DATE = new Date("2026-08-27T19:00:00-04:00"); // Aug 27, 2026 7:00 PM ET (Thursday)

function useDraftCountdown() {
  const [timeLeft, setTimeLeft] = useState(() => DRAFT_DATE.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(DRAFT_DATE.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (timeLeft <= 0) return null;
  const totalSecs = Math.floor(timeLeft / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hrs  = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return { days, hrs, mins, secs };
}

// Real 2026 draft order — round 1 pick order
const ROUND1_ORDER = [
  "Greg","Shawn","Bill","David R.","Jason","Scott N.",
  "David S.","Jonas","David R. (Jamie)","Keith","Scott M.","Dan",
];

// For the grid, use owner names (12 owners)
const TEAMS = ROUND1_ORDER.map(o => o.replace(/ \(.*\)/, ""));

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

// ── Draft Countdown Banner ────────────────────────────────────────────────────
function DraftCountdownBanner() {
  const cd = useDraftCountdown();
  if (!cd) return null;
  const isClose = cd.days < 3;
  const unitStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52,
  };
  const numStyle: React.CSSProperties = {
    fontFamily: "Oswald, sans-serif", fontWeight: 700,
    fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
    color: isClose ? "oklch(0.78 0.15 85)" : "white",
    lineHeight: 1,
    textShadow: isClose ? "0 0 18px oklch(0.78 0.15 85 / 0.6)" : "none",
  };
  const lblStyle: React.CSSProperties = {
    fontFamily: "Oswald, sans-serif", fontWeight: 400, fontSize: "0.65rem",
    letterSpacing: "0.1em", textTransform: "uppercase",
    color: "rgba(255,255,255,0.55)", marginTop: 2,
  };
  const sepStyle: React.CSSProperties = {
    fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.6rem",
    color: "rgba(255,255,255,0.3)", alignSelf: "flex-start", marginTop: 2,
  };
  return (
    <div style={{
      background: isClose
        ? "linear-gradient(90deg, oklch(0.22 0.09 150), oklch(0.28 0.1 150))"
        : "rgba(0,0,0,0.55)",
      border: `1.5px solid ${isClose ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.15)"}`,
      borderRadius: 12,
      padding: "1rem 1.5rem",
      marginBottom: "1rem",
      display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.78 0.15 85)" }}>
          {isClose ? "⚡ Draft is almost here!" : "Draft Countdown"}
        </span>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
          Thu Aug 27, 2026 · 7:00 PM ET
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.25rem" }}>
        <div style={unitStyle}><span style={numStyle}>{String(cd.days).padStart(2,"0")}</span><span style={lblStyle}>Days</span></div>
        <span style={sepStyle}>:</span>
        <div style={unitStyle}><span style={numStyle}>{String(cd.hrs).padStart(2,"0")}</span><span style={lblStyle}>Hrs</span></div>
        <span style={sepStyle}>:</span>
        <div style={unitStyle}><span style={numStyle}>{String(cd.mins).padStart(2,"0")}</span><span style={lblStyle}>Min</span></div>
        <span style={sepStyle}>:</span>
        <div style={unitStyle}><span style={numStyle}>{String(cd.secs).padStart(2,"0")}</span><span style={lblStyle}>Sec</span></div>
      </div>
    </div>
  );
}

// Owner color palette
const OWNER_COLORS: Record<string, string> = {
  "Greg":"oklch(0.55 0.18 260)","Shawn":"oklch(0.52 0.18 25)",
  "Bill":"oklch(0.50 0.16 150)","David R.":"oklch(0.52 0.18 85)",
  "Jason":"oklch(0.50 0.16 310)","Scott N.":"oklch(0.52 0.16 195)",
  "David S.":"oklch(0.50 0.18 45)","Jonas":"oklch(0.50 0.18 170)",
  "Jamie":"oklch(0.52 0.16 280)","Keith":"oklch(0.50 0.16 10)",
  "Scott M.":"oklch(0.52 0.16 230)","Dan":"oklch(0.50 0.16 130)",
};

type BoardView = "live" | "order" | "traded";

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
  const [boardView, setBoardView] = useState<BoardView>("live");
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tradedPicks = getTradedPicks();
  const picksByRound: Record<number, typeof DRAFT_PICKS_2026> = {};
  for (const p of DRAFT_PICKS_2026) {
    if (!picksByRound[p.round]) picksByRound[p.round] = [];
    picksByRound[p.round].push(p);
  }

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
        {/* Draft Countdown Banner */}
        {!draftStarted && <DraftCountdownBanner />}

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>2026 WRC Draft</h1>
            <p>2026 WRC Fantasy Football · 18 Rounds · 12 Teams · Snake Draft</p>
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

        {/* View Tabs */}
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem", background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 4, width: "fit-content" }}>
          {(["live","order","traded"] as BoardView[]).map(v => (
            <button key={v} onClick={() => setBoardView(v)} style={{
              background: boardView === v ? "oklch(0.78 0.15 85)" : "transparent",
              color: boardView === v ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.65)",
              border: "none", borderRadius: 6, padding: "0.4rem 0.9rem",
              fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 700,
              letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
            }}>
              {v === "live" ? "Live Board" : v === "order" ? `Draft Order (${DRAFT_PICKS_2026.length})` : `Traded Picks (${tradedPicks.length})`}
            </button>
          ))}
        </div>

        {/* Draft Order View */}
        {boardView === "order" && (
          <div style={{ marginBottom: "1.5rem" }}>
            {Array.from({ length: 18 }, (_, i) => i + 1).map(round => {
              const rPicks = picksByRound[round] ?? [];
              const isExp = expandedRound === round;
              return (
                <div key={round} className="wrc-card" style={{ marginBottom: "0.6rem" }}>
                  <div onClick={() => setExpandedRound(isExp ? null : round)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 1rem", cursor: "pointer", borderBottom: isExp ? "1px solid oklch(0.88 0.02 150)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.22 0.08 150)" }}>ROUND {round}</span>
                      <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>Picks {(round-1)*12+1}–{round*12}</span>
                      {rPicks.some(p => p.isTraded) && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "oklch(0.45 0.14 85)", background: "oklch(0.97 0.08 85)", border: "1px solid oklch(0.85 0.12 85)", borderRadius: 4, padding: "1px 6px" }}>{rPicks.filter(p=>p.isTraded).length} traded</span>}
                    </div>
                    {isExp ? <ChevronUp size={15} color="oklch(0.5 0.04 150)" /> : <ChevronDown size={15} color="oklch(0.5 0.04 150)" />}
                  </div>
                  <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {rPicks.map(pick => (
                      <div key={pick.overall} style={{
                        background: pick.isTraded ? "oklch(0.97 0.08 85)" : "oklch(0.95 0.02 150)",
                        border: `1.5px solid ${pick.isTraded ? "oklch(0.78 0.15 85)" : (OWNER_COLORS[pick.owner] ?? "oklch(0.8 0.04 150)")}`,
                        borderRadius: 5, padding: "3px 8px",
                      }}>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: OWNER_COLORS[pick.owner] ?? "oklch(0.35 0.06 150)" }}>{pick.owner}</span>
                        {pick.isTraded && <span style={{ fontSize: "0.6rem", color: "oklch(0.45 0.14 85)", marginLeft: 4 }}>via {pick.originalOwner}</span>}
                        <div style={{ fontSize: "0.6rem", color: "oklch(0.55 0.04 150)", fontStyle: "italic" }}>#{pick.overall} · Rd{pick.round} P{pick.pickInRound}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Traded Picks View */}
        {boardView === "traded" && (
          <div className="wrc-card" style={{ marginBottom: "1.5rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ArrowLeftRight size={14} /> Traded Picks ({tradedPicks.length})
            </div>
            <div style={{ padding: "1rem", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid oklch(0.88 0.02 150)" }}>
                    {["#","Round","Pick","Current Owner","Original Owner"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.75rem", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradedPicks.map((pick, i) => (
                    <tr key={pick.overall} style={{ background: i%2===0?"white":"oklch(0.97 0.005 150)", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                      <td style={{ padding: "0.45rem 0.75rem", fontWeight: 700, color: "oklch(0.35 0.06 150)" }}>#{pick.overall}</td>
                      <td style={{ padding: "0.45rem 0.75rem", color: "oklch(0.45 0.04 150)" }}>Rd {pick.round}</td>
                      <td style={{ padding: "0.45rem 0.75rem", color: "oklch(0.45 0.04 150)" }}>Pick {pick.pickInRound}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, color: OWNER_COLORS[pick.owner]??"oklch(0.35 0.06 150)", fontSize: "0.78rem" }}>{pick.owner}</span>
                      </td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, color: OWNER_COLORS[pick.originalOwner!]??"oklch(0.5 0.04 150)", fontSize: "0.78rem" }}>{pick.originalOwner}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
