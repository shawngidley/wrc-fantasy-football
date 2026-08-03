/**
 * WRC Fantasy Football — Schedule Page
 * Design: Dark forest green / gold WRC palette
 * Features:
 *   - Full 17-week 2026 schedule (Weeks 1-14 regular + Playoffs)
 *   - Current week auto-highlighted
 *   - Owner's matchups highlighted in gold
 *   - Week jump tabs (scrollable)
 *   - Team name shown below owner name
 *   - Playoff bracket placeholder with TBD slots
 */
import { useState, useRef, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { SCHEDULE_2026, OWNER_TO_TEAM, ownerToTeam, getCurrentWeek, type ScheduleWeek } from "@/lib/scheduleData2026";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isMyMatchup(matchup: [string, string], myTeam: string | undefined): boolean {
  if (!myTeam) return false;
  return matchup.some(owner => ownerToTeam(owner) === myTeam || owner === myTeam);
}

function getPlayoffLabel(type: ScheduleWeek["type"]): string {
  if (type === "wildcard")    return "WILD CARD";
  if (type === "divisional")  return "DIVISIONAL";
  if (type === "superbowl")   return "SUPER BOWL";
  return "";
}

const PLAYOFF_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  wildcard:   { bg: "oklch(0.20 0.06 260)", border: "oklch(0.50 0.18 260)", badge: "oklch(0.55 0.18 260)" },
  divisional: { bg: "oklch(0.20 0.06 85)",  border: "oklch(0.60 0.16 85)",  badge: "oklch(0.65 0.14 85)"  },
  superbowl:  { bg: "oklch(0.18 0.08 150)", border: "oklch(0.78 0.15 85)",  badge: "oklch(0.78 0.15 85)"  },
};

// ── Matchup Card ─────────────────────────────────────────────────────────────

function MatchupRow({
  matchup,
  myTeam,
  isPlayoff,
}: {
  matchup: [string, string];
  myTeam: string | undefined;
  isPlayoff: boolean;
}) {
  const [home, away] = matchup;
  const isTBD = home === "TBD";
  const mine = isMyMatchup(matchup, myTeam);

  const homeTeam = isTBD ? "TBD" : ownerToTeam(home);
  const awayTeam = isTBD ? "TBD" : ownerToTeam(away);
  const isHomeMe = myTeam && (homeTeam === myTeam || home === myTeam);
  const isAwayMe = myTeam && (awayTeam === myTeam || away === myTeam);

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

      {/* Home team */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: isHomeMe ? 700 : 500,
          fontSize: "0.875rem",
          color: isHomeMe ? "oklch(0.22 0.08 150)" : isTBD ? "oklch(0.65 0.02 150)" : "oklch(0.28 0.04 150)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {isTBD ? "TBD" : homeTeam}
        </div>
        {!isTBD && (
          <div style={{ fontSize: "0.7rem", color: "oklch(0.58 0.04 150)", marginTop: 1 }}>
            {home}
          </div>
        )}
      </div>

      {/* VS badge */}
      <div style={{
        fontFamily: "Barlow Condensed, sans-serif",
        fontSize: "0.68rem", fontWeight: 700,
        letterSpacing: "0.06em",
        color: isPlayoff ? "oklch(0.65 0.14 85)" : "oklch(0.65 0.04 150)",
        padding: "0 0.4rem", flexShrink: 0,
      }}>
        VS
      </div>

      {/* Away team */}
      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
        <div style={{
          fontWeight: isAwayMe ? 700 : 500,
          fontSize: "0.875rem",
          color: isAwayMe ? "oklch(0.22 0.08 150)" : isTBD ? "oklch(0.65 0.02 150)" : "oklch(0.28 0.04 150)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {isTBD ? "TBD" : awayTeam}
        </div>
        {!isTBD && (
          <div style={{ fontSize: "0.7rem", color: "oklch(0.58 0.04 150)", marginTop: 1 }}>
            {away}
          </div>
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
  isRef,
}: {
  week: ScheduleWeek;
  myTeam: string | undefined;
  isCurrent: boolean;
  isRef?: (el: HTMLDivElement | null) => void;
}) {
  const isPlayoff = week.type !== "regular";
  const playoffStyle = isPlayoff ? PLAYOFF_COLORS[week.type] : null;

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
      {/* Gold stripe / playoff stripe */}
      <div className="wrc-card-gold-stripe" style={isPlayoff ? { background: playoffStyle?.badge } : undefined} />

      {/* Header */}
      <div
        className="wrc-card-header"
        style={isPlayoff ? { background: playoffStyle?.bg, borderBottom: `1px solid ${playoffStyle?.border}30` } : undefined}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isPlayoff ? (
            <Trophy size={13} color={playoffStyle?.badge} />
          ) : (
            <Calendar size={13} />
          )}
          <span>
            {isPlayoff ? (
              <span style={{ color: playoffStyle?.badge }}>{getPlayoffLabel(week.type)}</span>
            ) : (
              `Week ${week.week}`
            )}
          </span>
          {isCurrent && (
            <span style={{
              fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700,
              letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 3,
              background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)",
              textTransform: "uppercase",
            }}>
              CURRENT
            </span>
          )}
          {hasMyGame && !isCurrent && (
            <span style={{
              fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700,
              letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 3,
              background: "oklch(0.94 0.06 85)", color: "oklch(0.38 0.14 85)",
              border: "1px solid oklch(0.84 0.08 85)",
              textTransform: "uppercase",
            }}>
              MY GAME
            </span>
          )}
        </div>
        <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: "0.78rem", color: isPlayoff ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.65)" }}>
          {week.dates}
        </span>
      </div>

      {/* Matchups */}
      <div style={{ background: isPlayoff ? "rgba(255,255,255,0.97)" : "white" }}>
        {week.matchups.map((matchup, i) => (
          <MatchupRow
            key={i}
            matchup={matchup}
            myTeam={myTeam}
            isPlayoff={isPlayoff}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Schedule() {
  const { franchise } = useAuth();
  const myTeam = franchise?.team_name;
  const currentWeek = getCurrentWeek();

  const [activeWeek, setActiveWeek] = useState<number | "all">("all");
  const weekRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);

  // Scroll to current week tab on mount
  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-week="${currentWeek}"]`) as HTMLElement;
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [currentWeek]);

  const visibleWeeks = activeWeek === "all"
    ? SCHEDULE_2026
    : SCHEDULE_2026.filter(w => w.week === activeWeek);

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

        {/* ── My season summary ── */}
        {myTeam && (
          <div style={{
            background: "oklch(0.18 0.06 150)",
            border: "1px solid oklch(0.35 0.1 150)",
            borderRadius: 10,
            padding: "0.75rem 1.25rem",
            marginBottom: "1.25rem",
            display: "flex", alignItems: "center", gap: "0.75rem",
          }}>
            <Trophy size={16} color="oklch(0.78 0.15 85)" />
            <div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", color: "oklch(0.78 0.15 85)", textTransform: "uppercase" }}>
                {myTeam}
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", marginTop: 1 }}>
                Your matchups are highlighted in gold throughout the schedule.
              </div>
            </div>
          </div>
        )}

        {/* ── Week jump tabs ── */}
        <div
          ref={tabsRef}
          style={{
            display: "flex", gap: "0.3rem", overflowX: "auto", paddingBottom: "0.5rem",
            marginBottom: "1.25rem", scrollbarWidth: "none",
          }}
        >
          {/* "All" tab */}
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
          >
            ALL
          </button>

          {/* Regular season week tabs */}
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
              >
                W{w.week}
              </button>
            );
          })}

          {/* Divider */}
          <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "0 0.25rem", flexShrink: 0 }} />

          {/* Playoff tabs */}
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
              >
                {getPlayoffLabel(w.type).split(" ")[0]}
              </button>
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
            isRef={el => { weekRefs.current[week.week] = el; }}
          />
        ))}

        {/* ── Footer note ── */}
        <div style={{ textAlign: "center", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: "0.5rem" }}>
          Playoff seeds determined by final regular season standings · TBD matchups updated after Week 14
        </div>
      </div>
    </div>
  );
}
