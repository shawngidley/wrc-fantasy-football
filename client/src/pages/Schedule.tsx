/**
 * WRC Fantasy Football — Schedule Page
 * Design: Dark forest green / gold WRC palette
 * Features:
 *   - Full 17-week 2026 schedule (Weeks 1-14 regular + Playoffs)
 *   - Current week auto-highlighted
 *   - Owner's matchups highlighted in gold
 *   - "My Schedule" filtered view with running W/L record
 *   - Inline scores on completed matchups (from RESULTS_2026)
 *   - Playoff seed wiring from live Supabase standings
 *   - Week jump tabs (scrollable)
 */
import { useState, useRef, useEffect, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Calendar, User, ChevronDown, ChevronUp } from "lucide-react";
import {
  SCHEDULE_2026, OWNER_TO_TEAM, ownerToTeam, getCurrentWeek,
  getResult, derivePlayoffSeeds,
  type ScheduleWeek, type StandingsTeam,
} from "@/lib/scheduleData2026";
import { supabase } from "@/lib/supabase";
import { TEAMS } from "@/lib/wrcData";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isMyMatchup(matchup: [string, string], myTeam: string | undefined): boolean {
  if (!myTeam) return false;
  return matchup.some(owner => ownerToTeam(owner) === myTeam || owner === myTeam);
}

function getPlayoffLabel(type: ScheduleWeek["type"]): string {
  if (type === "wildcard")   return "WILD CARD";
  if (type === "divisional") return "DIVISIONAL";
  if (type === "superbowl")  return "SUPER BOWL";
  return "";
}

const PLAYOFF_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  wildcard:   { bg: "oklch(0.20 0.06 260)", border: "oklch(0.50 0.18 260)", badge: "oklch(0.55 0.18 260)" },
  divisional: { bg: "oklch(0.20 0.06 85)",  border: "oklch(0.60 0.16 85)",  badge: "oklch(0.65 0.14 85)"  },
  superbowl:  { bg: "oklch(0.18 0.08 150)", border: "oklch(0.78 0.15 85)",  badge: "oklch(0.78 0.15 85)"  },
};

// ── Matchup Row ───────────────────────────────────────────────────────────────

function MatchupRow({
  matchup,
  weekNum,
  myTeam,
  isPlayoff,
  seeds,
}: {
  matchup: [string, string];
  weekNum: number;
  myTeam: string | undefined;
  isPlayoff: boolean;
  seeds: string[];
}) {
  const [ownerA, ownerB] = matchup;
  const isTBD = ownerA === "TBD";

  // Resolve TBD slots using playoff seeds
  const resolvedA = isTBD ? "TBD" : ownerToTeam(ownerA);
  const resolvedB = isTBD ? "TBD" : ownerToTeam(ownerB);

  // For playoff weeks, if seeds are available, show seeded teams
  let displayA = resolvedA;
  let displayB = resolvedB;
  let seedA = "";
  let seedB = "";

  if (isPlayoff && seeds.length === 6) {
    if (weekNum === 15) {
      // Wild Card: 3v6 and 4v5
      const wc = [
        [seeds[2], seeds[5]], // 3 vs 6
        [seeds[3], seeds[4]], // 4 vs 5
      ];
      const idx = SCHEDULE_2026.find(w => w.week === weekNum)?.matchups.indexOf(matchup) ?? -1;
      if (idx >= 0 && wc[idx]) {
        displayA = wc[idx][0]; seedA = `#${idx === 0 ? 3 : 4}`;
        displayB = wc[idx][1]; seedB = `#${idx === 0 ? 6 : 5}`;
      }
    } else if (weekNum === 16) {
      // Divisional: 1 vs WC winner, 2 vs WC winner
      const idx = SCHEDULE_2026.find(w => w.week === weekNum)?.matchups.indexOf(matchup) ?? -1;
      if (idx === 0) { displayA = seeds[0]; seedA = "#1 (bye)"; displayB = "WC Winner 1"; }
      if (idx === 1) { displayA = seeds[1]; seedA = "#2 (bye)"; displayB = "WC Winner 2"; }
    } else if (weekNum === 17) {
      displayA = "Div Winner 1"; displayB = "Div Winner 2";
    }
  }

  const mine = myTeam && (displayA === myTeam || displayB === myTeam ||
    resolvedA === myTeam || resolvedB === myTeam);

  const isAMe = myTeam && (displayA === myTeam || resolvedA === myTeam);
  const isBMe = myTeam && (displayB === myTeam || resolvedB === myTeam);

  // Result lookup
  const result = isTBD ? null : getResult(weekNum, ownerA, ownerB);
  const hasResult = !!result;

  // Determine winner
  let aWon: boolean | null = null;
  if (hasResult && result) {
    // If ownerA in result matches the left side
    const aIsLeft = result.ownerA === ownerA;
    const leftScore = aIsLeft ? result.scoreA : result.scoreB;
    const rightScore = aIsLeft ? result.scoreB : result.scoreA;
    aWon = leftScore > rightScore;
  }

  return (
    <div
      className="wrc-row-hover"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.65rem 1.25rem",
        borderBottom: "1px solid oklch(0.92 0.005 150)",
        background: mine ? "oklch(0.97 0.04 85 / 0.45)" : "white",
        gap: "0.5rem",
      }}
    >
      {mine && (
        <div style={{
          width: 3, alignSelf: "stretch", borderRadius: 2,
          background: "oklch(0.65 0.14 85)", flexShrink: 0,
          marginRight: "0.25rem",
        }} />
      )}

      {/* Left team */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: isAMe ? 700 : 500,
          fontSize: "0.875rem",
          color: hasResult && aWon === false ? "oklch(0.55 0.04 150)"
               : isAMe ? "oklch(0.22 0.08 150)"
               : isTBD ? "oklch(0.65 0.02 150)"
               : "oklch(0.28 0.04 150)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {displayA}
        </div>
        {!isTBD && seedA && (
          <div style={{ fontSize: "0.65rem", color: "oklch(0.55 0.14 85)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700 }}>{seedA}</div>
        )}
        {!isTBD && !seedA && (
          <div style={{ fontSize: "0.7rem", color: "oklch(0.58 0.04 150)", marginTop: 1 }}>{ownerA}</div>
        )}
      </div>

      {/* Score / VS */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, minWidth: 80 }}>
        {hasResult && result ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {(() => {
              const aIsLeft = result.ownerA === ownerA;
              const leftScore = aIsLeft ? result.scoreA : result.scoreB;
              const rightScore = aIsLeft ? result.scoreB : result.scoreA;
              const leftWon = leftScore > rightScore;
              return (
                <>
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem",
                    color: leftWon ? "oklch(0.22 0.08 150)" : "oklch(0.60 0.04 150)",
                  }}>{leftScore.toFixed(1)}</span>
                  <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", color: "oklch(0.65 0.04 150)", fontWeight: 600 }}>–</span>
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem",
                    color: !leftWon ? "oklch(0.22 0.08 150)" : "oklch(0.60 0.04 150)",
                  }}>{rightScore.toFixed(1)}</span>
                </>
              );
            })()}
          </div>
        ) : (
          <span style={{
            fontFamily: "Barlow Condensed, sans-serif",
            fontSize: "0.68rem", fontWeight: 700,
            letterSpacing: "0.06em",
            color: isPlayoff ? "oklch(0.65 0.14 85)" : "oklch(0.65 0.04 150)",
          }}>
            VS
          </span>
        )}
        {hasResult && result && (
          <div style={{ fontSize: "0.6rem", color: "oklch(0.65 0.04 150)", marginTop: 1, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.04em" }}>FINAL</div>
        )}
      </div>

      {/* Right team */}
      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
        <div style={{
          fontWeight: isBMe ? 700 : 500,
          fontSize: "0.875rem",
          color: hasResult && aWon === true ? "oklch(0.55 0.04 150)"
               : isBMe ? "oklch(0.22 0.08 150)"
               : isTBD ? "oklch(0.65 0.02 150)"
               : "oklch(0.28 0.04 150)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {displayB}
        </div>
        {!isTBD && seedB && (
          <div style={{ fontSize: "0.65rem", color: "oklch(0.55 0.14 85)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700 }}>{seedB}</div>
        )}
        {!isTBD && !seedB && (
          <div style={{ fontSize: "0.7rem", color: "oklch(0.58 0.04 150)", marginTop: 1 }}>{ownerB}</div>
        )}
      </div>
    </div>
  );
}

// ── Week Card ─────────────────────────────────────────────────────────────────

function WeekCard({
  week,
  myTeam,
  isCurrent,
  seeds,
  isRef,
  myOnly,
}: {
  week: ScheduleWeek;
  myTeam: string | undefined;
  isCurrent: boolean;
  seeds: string[];
  isRef?: (el: HTMLDivElement | null) => void;
  myOnly: boolean;
}) {
  const isPlayoff = week.type !== "regular";
  const playoffStyle = isPlayoff ? PLAYOFF_COLORS[week.type] : null;

  const matchupsToShow = myOnly
    ? week.matchups.filter(m => isMyMatchup(m, myTeam))
    : week.matchups;

  if (myOnly && matchupsToShow.length === 0) return null;

  const hasMyGame = week.matchups.some(m => isMyMatchup(m, myTeam));

  return (
    <div
      ref={isRef}
      className="wrc-card"
      style={{
        marginBottom: "1rem",
        border: isCurrent ? "2px solid oklch(0.78 0.15 85)" : isPlayoff ? `2px solid ${playoffStyle?.border}` : undefined,
        background: isPlayoff ? playoffStyle?.bg : undefined,
        animation: "fadeInUp 0.3s ease both",
      }}
    >
      <div className="wrc-card-gold-stripe" style={isPlayoff ? { background: playoffStyle?.badge } : undefined} />

      <div
        className="wrc-card-header"
        style={isPlayoff ? { background: playoffStyle?.bg, borderBottom: `1px solid ${playoffStyle?.border}30` } : undefined}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isPlayoff ? <Trophy size={13} color={playoffStyle?.badge} /> : <Calendar size={13} />}
          <span>
            {isPlayoff
              ? <span style={{ color: playoffStyle?.badge }}>{getPlayoffLabel(week.type)}</span>
              : `Week ${week.week}`
            }
          </span>
          {isCurrent && (
            <span style={{
              fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700,
              letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 3,
              background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)",
              textTransform: "uppercase",
            }}>CURRENT</span>
          )}
          {hasMyGame && !isCurrent && !myOnly && (
            <span style={{
              fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700,
              letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 3,
              background: "oklch(0.94 0.06 85)", color: "oklch(0.38 0.14 85)",
              border: "1px solid oklch(0.84 0.08 85)", textTransform: "uppercase",
            }}>MY GAME</span>
          )}
        </div>
        <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: "0.78rem", color: isPlayoff ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.65)" }}>
          {week.dates}
        </span>
      </div>

      <div style={{ background: isPlayoff ? "rgba(255,255,255,0.97)" : "white" }}>
        {matchupsToShow.map((matchup, i) => (
          <MatchupRow
            key={i}
            matchup={matchup}
            weekNum={week.week}
            myTeam={myTeam}
            isPlayoff={isPlayoff}
            seeds={seeds}
          />
        ))}
      </div>
    </div>
  );
}

// ── My Schedule Summary ───────────────────────────────────────────────────────

function MyScheduleSummary({ myTeam }: { myTeam: string | undefined }) {
  if (!myTeam) return null;

  // Find my owner key from team name
  const myOwner = Object.entries(OWNER_TO_TEAM).find(([, v]) => v === myTeam)?.[0];
  if (!myOwner) return null;

  const regularWeeks = SCHEDULE_2026.filter(w => w.type === "regular");
  let wins = 0, losses = 0;
  const rows: { week: number; dates: string; opp: string; scoreMe: number | null; scoreOpp: number | null; won: boolean | null }[] = [];

  for (const w of regularWeeks) {
    const myMatchup = w.matchups.find(m => m.includes(myOwner as never));
    if (!myMatchup) continue;
    const [a, b] = myMatchup;
    const oppOwner = a === myOwner ? b : a;
    const oppTeam = ownerToTeam(oppOwner);
    const result = getResult(w.week, a, b);

    let scoreMe: number | null = null;
    let scoreOpp: number | null = null;
    let won: boolean | null = null;

    if (result) {
      const iAmA = result.ownerA === myOwner;
      scoreMe  = iAmA ? result.scoreA : result.scoreB;
      scoreOpp = iAmA ? result.scoreB : result.scoreA;
      won = scoreMe > scoreOpp;
      if (won) wins++; else losses++;
    }

    rows.push({ week: w.week, dates: w.dates, opp: oppTeam, scoreMe, scoreOpp, won });
  }

  const [expanded, setExpanded] = useState(false);
  const played = rows.filter(r => r.won !== null);
  const remaining = rows.filter(r => r.won === null);

  return (
    <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-header" style={{ cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <User size={13} />
        <span style={{ marginLeft: "0.4rem" }}>My Schedule — {myTeam}</span>
        <span style={{
          marginLeft: "0.75rem",
          fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.82rem",
          color: "oklch(0.78 0.15 85)",
        }}>
          {wins}–{losses}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>
          {played.length}/14 played · {remaining.length} remaining
        </span>
        {expanded ? <ChevronUp size={14} style={{ marginLeft: "0.5rem" }} /> : <ChevronDown size={14} style={{ marginLeft: "0.5rem" }} />}
      </div>

      {expanded && (
        <div style={{ background: "white" }}>
          {rows.map((r, i) => (
            <div
              key={r.week}
              className="wrc-row-hover"
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.55rem 1.25rem",
                borderBottom: i < rows.length - 1 ? "1px solid oklch(0.93 0.005 150)" : "none",
                background: r.won === true ? "oklch(0.97 0.04 150 / 0.5)" : r.won === false ? "oklch(0.98 0.02 25 / 0.4)" : "white",
              }}
            >
              {/* Week badge */}
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.68rem",
                letterSpacing: "0.05em", color: "oklch(0.55 0.04 150)",
                width: 32, flexShrink: 0,
              }}>W{r.week}</div>

              {/* Date */}
              <div style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)", width: 80, flexShrink: 0 }}>{r.dates.replace("Sept.", "Sep")}</div>

              {/* Opponent */}
              <div style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500, color: "oklch(0.28 0.04 150)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                vs {r.opp}
              </div>

              {/* Score / result */}
              {r.won !== null && r.scoreMe !== null && r.scoreOpp !== null ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem",
                    color: r.won ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)",
                  }}>{r.scoreMe.toFixed(1)}</span>
                  <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", color: "oklch(0.65 0.04 150)" }}>–</span>
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem",
                    color: !r.won ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)",
                  }}>{r.scoreOpp.toFixed(1)}</span>
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.72rem",
                    padding: "1px 6px", borderRadius: 3,
                    background: r.won ? "oklch(0.92 0.08 150)" : "oklch(0.94 0.06 25)",
                    color: r.won ? "oklch(0.35 0.14 150)" : "oklch(0.45 0.18 25)",
                  }}>{r.won ? "W" : "L"}</span>
                </div>
              ) : (
                <div style={{ fontSize: "0.72rem", color: "oklch(0.65 0.02 150)", fontStyle: "italic", flexShrink: 0 }}>Upcoming</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Schedule() {
  const { franchise } = useAuth();
  const myTeam = franchise?.team_name;
  const currentWeek = getCurrentWeek();

  const [activeWeek, setActiveWeek] = useState<number | "all">("all");
  const [myOnly, setMyOnly] = useState(false);
  const [seeds, setSeeds] = useState<string[]>([]);
  const weekRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);

  // Load live standings from Supabase to derive playoff seeds
  useEffect(() => {
    supabase.from("teams").select("name, owner, division, wins, losses, points_for")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const teams: StandingsTeam[] = data.map((t: Record<string, unknown>) => ({
            teamName: t.name as string,
            owner: t.owner as string,
            division: t.division as string,
            wins: (t.wins as number) ?? 0,
            losses: (t.losses as number) ?? 0,
            ptsFor: (t.points_for as number) ?? 0,
          }));
          setSeeds(derivePlayoffSeeds(teams));
        } else {
          // Fall back to wrcData static teams
          const fallback: StandingsTeam[] = TEAMS.map(t => ({
            teamName: t.teamName,
            owner: t.owner,
            division: t.division,
            wins: t.wins,
            losses: t.losses,
            ptsFor: t.ptsFor,
          }));
          setSeeds(derivePlayoffSeeds(fallback));
        }
      });
  }, []);

  // Scroll to current week tab on mount
  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-week="${currentWeek}"]`) as HTMLElement;
      if (activeTab) activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentWeek]);

  const visibleWeeks = useMemo(() => {
    if (activeWeek === "all") return SCHEDULE_2026;
    return SCHEDULE_2026.filter(w => w.week === activeWeek);
  }, [activeWeek]);

  function scrollToWeek(weekNum: number) {
    setActiveWeek(weekNum);
    setTimeout(() => {
      weekRefs.current[weekNum]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const regularWeeks = SCHEDULE_2026.filter(w => w.type === "regular");
  const playoffWeeks = SCHEDULE_2026.filter(w => w.type !== "regular");

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={myTeam} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* ── Page header ── */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>2026 Schedule</h1>
          <p>Regular Season — Weeks 1–14 · Playoffs Weeks 15–17</p>
        </div>

        {/* ── My Schedule summary card (collapsible) ── */}
        {myTeam && <MyScheduleSummary myTeam={myTeam} />}

        {/* ── Controls row ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {/* My Games toggle */}
          {myTeam && (
            <button
              onClick={() => setMyOnly(v => !v)}
              style={{
                background: myOnly ? "oklch(0.65 0.14 85)" : "rgba(255,255,255,0.10)",
                color: myOnly ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.75)",
                border: myOnly ? "1.5px solid oklch(0.55 0.14 85)" : "1.5px solid rgba(255,255,255,0.18)",
                borderRadius: 7, padding: "0.35rem 0.9rem",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700,
                letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "0.35rem",
              }}
            >
              <User size={12} />
              {myOnly ? "MY GAMES ONLY" : "MY GAMES ONLY"}
            </button>
          )}

          {/* Playoff seeds summary */}
          {seeds.length === 6 && (
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", marginLeft: "auto" }}>
              Current seeds: {seeds.slice(0, 3).map((s, i) => `#${i+1} ${s.split(" ")[0]}`).join(" · ")}
            </div>
          )}
        </div>

        {/* ── Week jump tabs ── */}
        <div
          ref={tabsRef}
          style={{
            display: "flex", gap: "0.3rem", overflowX: "auto", paddingBottom: "0.5rem",
            marginBottom: "1.25rem", scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setActiveWeek("all")}
            style={{
              flexShrink: 0,
              background: activeWeek === "all" ? "oklch(0.28 0.09 150)" : "rgba(255,255,255,0.08)",
              color: activeWeek === "all" ? "white" : "rgba(255,255,255,0.65)",
              border: activeWeek === "all" ? "1.5px solid oklch(0.45 0.12 150)" : "1.5px solid rgba(255,255,255,0.12)",
              borderRadius: 7, padding: "0.35rem 0.75rem",
              fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.15s",
            }}
          >ALL</button>

          {regularWeeks.map(w => {
            const isActive = activeWeek === w.week;
            const isCur = w.week === currentWeek;
            return (
              <button
                key={w.week}
                data-week={w.week}
                onClick={() => scrollToWeek(w.week)}
                style={{
                  flexShrink: 0,
                  background: isActive ? "oklch(0.28 0.09 150)" : isCur ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.08)",
                  color: isActive ? "white" : isCur ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.65)",
                  border: isActive ? "1.5px solid oklch(0.45 0.12 150)" : isCur ? "1.5px solid oklch(0.65 0.14 85)" : "1.5px solid rgba(255,255,255,0.12)",
                  borderRadius: 7, padding: "0.35rem 0.65rem",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700,
                  letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.15s",
                }}
              >W{w.week}</button>
            );
          })}

          <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "0 0.25rem", flexShrink: 0 }} />

          {playoffWeeks.map(w => {
            const isActive = activeWeek === w.week;
            const colors = PLAYOFF_COLORS[w.type];
            return (
              <button
                key={w.week}
                data-week={w.week}
                onClick={() => scrollToWeek(w.week)}
                style={{
                  flexShrink: 0,
                  background: isActive ? colors.bg : "rgba(255,255,255,0.08)",
                  color: isActive ? colors.badge : "rgba(255,255,255,0.65)",
                  border: `1.5px solid ${isActive ? colors.border : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 7, padding: "0.35rem 0.65rem",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700,
                  letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.15s",
                }}
              >{getPlayoffLabel(w.type).split(" ")[0]}</button>
            );
          })}
        </div>

        {/* ── Schedule weeks ── */}
        {visibleWeeks.map(week => (
          <WeekCard
            key={week.week}
            week={week}
            myTeam={myTeam}
            isCurrent={week.week === currentWeek}
            seeds={seeds}
            isRef={el => { weekRefs.current[week.week] = el; }}
            myOnly={myOnly}
          />
        ))}

        <div style={{ textAlign: "center", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: "0.5rem" }}>
          Playoff seeds determined by final regular season standings · 3 division winners + 3 wild cards · Seeds 1–2 receive first-round bye
        </div>
      </div>
    </div>
  );
}
