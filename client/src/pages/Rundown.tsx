/**
 * WRC Fantasy Football — Weekly Rundown
 * Loads live matchup scores from Supabase weekly_results table.
 * Shows a week selector so owners can browse any completed week.
 */
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { SCHEDULE_2026, OWNER_TO_TEAM, getCurrentWeek } from "@/lib/scheduleData2026";

interface WeekResult {
  week: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  is_challenge: boolean;
}

export default function Rundown() {
  const { franchise } = useAuth();
  const currentWeek = getCurrentWeek() || 1;
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [results, setResults] = useState<WeekResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("weekly_results")
      .select("week, home_team, away_team, home_score, away_score")
      .eq("week", selectedWeek)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setResults(data.map((r: { week: number; home_team: string; away_team: string; home_score: number; away_score: number }) => ({
            week: r.week,
            home_team: r.home_team,
            away_team: r.away_team,
            home_score: r.home_score ?? 0,
            away_score: r.away_score ?? 0,
            is_challenge: false,
          })));
        } else {
          // No results yet — build matchup grid from schedule with 0 scores
          const weekData = SCHEDULE_2026[selectedWeek];
          if (weekData) {
            const matchups: WeekResult[] = weekData.matchups.map(([ownerA, ownerB]) => ({
              week: selectedWeek,
              home_team: OWNER_TO_TEAM[ownerA] ?? ownerA,
              away_team: OWNER_TO_TEAM[ownerB] ?? ownerB,
              home_score: 0,
              away_score: 0,
              is_challenge: false,
            }));
            setResults(matchups);
          } else {
            setResults([]);
          }
        }
        setLoading(false);
      });
  }, [selectedWeek]);

  // Compute median from non-zero scores
  const allScores = results.flatMap(r => [r.home_score, r.away_score]).filter(s => s > 0);
  const sorted = [...allScores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? 0 :
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const hasScores = results.some(r => r.home_score > 0 || r.away_score > 0);
  const weekStatus = hasScores ? "Final" : `Upcoming`;

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Weekly Rundown</h1>
          <p>Week {selectedWeek} · {weekStatus}{median > 0 ? ` · Median: ${median.toFixed(1)} pts` : ""}</p>
        </div>

        {/* Week selector */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          {Array.from({ length: 14 }, (_, i) => i + 1).map(w => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 6,
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                cursor: "pointer",
                border: "1.5px solid",
                background: selectedWeek === w ? "oklch(0.28 0.09 150)" : "white",
                color: selectedWeek === w ? "white" : "oklch(0.45 0.06 150)",
                borderColor: selectedWeek === w ? "oklch(0.28 0.09 150)" : "oklch(0.85 0.01 150)",
                transition: "all 0.12s",
              }}
            >
              WK {w}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="wrc-card" style={{ height: 100, background: "oklch(0.96 0.005 150)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {results.map((m, i) => {
              const isPending = m.home_score === 0 && m.away_score === 0;
              const homeWon = !isPending && m.home_score > m.away_score;
              const myTeam = franchise?.team_name;
              const isMyGame = myTeam && (m.home_team === myTeam || m.away_team === myTeam);
              return (
                <div key={i} className="wrc-card" style={{ outline: isMyGame ? "2px solid oklch(0.55 0.16 85)" : "none" }}>
                  {m.is_challenge && (
                    <div style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", color: "oklch(0.15 0.02 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.3rem 0.75rem", textAlign: "center" }}>⚔️ Challenge Game</div>
                  )}
                  {isMyGame && (
                    <div style={{ background: "oklch(0.55 0.16 85)", color: "white", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.25rem 0.75rem", textAlign: "center" }}>MY MATCHUP</div>
                  )}
                  <div className="wrc-card-gold-stripe" />
                  <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)" }}>{m.home_team}</div>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.04 150)" }}>
                          {isPending ? "—" : m.home_score.toFixed(1)}
                        </div>
                        {!isPending && median > 0 && (
                          <div style={{ fontSize: "0.72rem", color: m.home_score >= median ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 600 }}>
                            {m.home_score >= median ? "↑ Above Median" : "↓ Below Median"}
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.6 0.04 150)" }}>
                        {isPending ? "UPCOMING" : "FINAL"}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: !homeWon && !isPending ? "oklch(0.22 0.08 150)" : "oklch(0.5 0.04 150)" }}>{m.away_team}</div>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.8rem", color: !homeWon && !isPending ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.04 150)" }}>
                          {isPending ? "—" : m.away_score.toFixed(1)}
                        </div>
                        {!isPending && median > 0 && (
                          <div style={{ fontSize: "0.72rem", color: m.away_score >= median ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 600 }}>
                            {m.away_score >= median ? "↑ Above Median" : "↓ Below Median"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
