/**
 * Results.tsx — WRC Fantasy Football 2026
 *
 * Reads all matchup results from Supabase weekly_results table.
 * Commissioner can click any matchup to enter/edit scores.
 * Saving a result also updates team_standings (wins, losses, pts_for,
 * pts_against, h2h_wins/losses, median_wins/losses, div_wins/losses, streak).
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { SCHEDULE_2026, OWNER_TO_TEAM } from "@/lib/scheduleData2026";
import { CheckCircle2, Clock, Edit3, Trophy, X } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type WeeklyResult = {
  id: number;
  week: number;
  season: number;
  home_owner: string;
  away_owner: string;
  home_team_name: string;
  away_team_name: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  is_final: boolean;
  league_median: number | null;
};

type DbStanding = {
  id: number;
  team_id: string;
  team_name: string;
  owner: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pts_for: number;
  pts_against: number;
  h2h_wins: number;
  h2h_losses: number;
  median_wins: number;
  median_losses: number;
  div_wins: number;
  div_losses: number;
  streak: string;
};

// Division lookup for each owner
const OWNER_DIVISION: Record<string, string> = {
  "Jonas":    "East",
  "David R.": "East",
  "Jason":    "East",
  "Jamie":    "East",
  "Keith":    "Central",
  "Dan":      "Central",
  "Scott N.": "Central",
  "Bill":     "Central",
  "Scott M.": "West",
  "David S.": "West",
  "Shawn":    "West",
  "Greg":     "West",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function newStreak(current: string, won: boolean): string {
  const letter = won ? "W" : "L";
  const match = current?.match(/^([WL])(\d+)$/);
  if (match && match[1] === letter) {
    return `${letter}${parseInt(match[2]) + 1}`;
  }
  return `${letter}1`;
}

// ── Score Entry Modal ─────────────────────────────────────────────────────────

function ScoreModal({
  result,
  onClose,
  onSaved,
}: {
  result: WeeklyResult;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [homeScore, setHomeScore] = useState(result.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(result.away_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const hs = parseFloat(homeScore);
    const as_ = parseFloat(awayScore);
    if (isNaN(hs) || isNaN(as_)) {
      toast.error("Please enter valid scores for both teams.");
      return;
    }

    setSaving(true);
    try {
      // 1. Update the weekly_results row
      const { error: resErr } = await supabase
        .from("weekly_results")
        .update({ home_score: hs, away_score: as_, is_final: true })
        .eq("id", result.id);
      if (resErr) throw resErr;

      // 2. Load all results for this week to compute league median
      const { data: weekRows } = await supabase
        .from("weekly_results")
        .select("home_score,away_score,is_final")
        .eq("week", result.week)
        .eq("season", result.season);

      const allScores: number[] = [];
      for (const r of weekRows ?? []) {
        if (r.is_final && r.home_score != null) allScores.push(r.home_score);
        if (r.is_final && r.away_score != null) allScores.push(r.away_score);
      }
      // Include the current scores being saved
      if (!allScores.includes(hs)) allScores.push(hs);
      if (!allScores.includes(as_)) allScores.push(as_);

      const sorted = [...allScores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

      // 3. Load current standings for both teams
      const { data: standings } = await supabase
        .from("team_standings")
        .select("*")
        .in("team_id", [result.home_team_id, result.away_team_id]);

      if (!standings || standings.length < 2) {
        toast.error("Could not load standings for update.");
        setSaving(false);
        return;
      }

      const homeStanding = standings.find((s: DbStanding) => s.team_id === result.home_team_id) as DbStanding;
      const awayStanding = standings.find((s: DbStanding) => s.team_id === result.away_team_id) as DbStanding;

      const homeWon = hs > as_;
      const awayWon = as_ > hs;
      const isDivGame = OWNER_DIVISION[result.home_owner] === OWNER_DIVISION[result.away_owner];

      const homeUpdate: Partial<DbStanding> = {
        wins: homeStanding.wins + (homeWon ? 1 : 0),
        losses: homeStanding.losses + (awayWon ? 1 : 0),
        pts_for: homeStanding.pts_for + hs,
        pts_against: homeStanding.pts_against + as_,
        h2h_wins: homeStanding.h2h_wins + (homeWon ? 1 : 0),
        h2h_losses: homeStanding.h2h_losses + (awayWon ? 1 : 0),
        median_wins: homeStanding.median_wins + (hs > median ? 1 : 0),
        median_losses: homeStanding.median_losses + (hs <= median ? 1 : 0),
        div_wins: homeStanding.div_wins + (isDivGame && homeWon ? 1 : 0),
        div_losses: homeStanding.div_losses + (isDivGame && awayWon ? 1 : 0),
        streak: newStreak(homeStanding.streak, homeWon),
      };

      const awayUpdate: Partial<DbStanding> = {
        wins: awayStanding.wins + (awayWon ? 1 : 0),
        losses: awayStanding.losses + (homeWon ? 1 : 0),
        pts_for: awayStanding.pts_for + as_,
        pts_against: awayStanding.pts_against + hs,
        h2h_wins: awayStanding.h2h_wins + (awayWon ? 1 : 0),
        h2h_losses: awayStanding.h2h_losses + (homeWon ? 1 : 0),
        median_wins: awayStanding.median_wins + (as_ > median ? 1 : 0),
        median_losses: awayStanding.median_losses + (as_ <= median ? 1 : 0),
        div_wins: awayStanding.div_wins + (isDivGame && awayWon ? 1 : 0),
        div_losses: awayStanding.div_losses + (isDivGame && homeWon ? 1 : 0),
        streak: newStreak(awayStanding.streak, awayWon),
      };

      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from("team_standings").update(homeUpdate).eq("team_id", result.home_team_id),
        supabase.from("team_standings").update(awayUpdate).eq("team_id", result.away_team_id),
      ]);
      if (e1 || e2) throw e1 ?? e2;

      toast.success(`Week ${result.week} result saved!`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error("Failed to save: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  const homeTeam = OWNER_TO_TEAM[result.home_owner] ?? result.home_owner;
  const awayTeam = OWNER_TO_TEAM[result.away_owner] ?? result.away_owner;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 16, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden",
      }}>
        <div style={{
          background: "oklch(0.22 0.06 150)", padding: "1rem 1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "oklch(0.65 0.12 85)", marginBottom: 2 }}>
              Week {result.week} · Enter Score
            </div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", fontWeight: 800, color: "white", letterSpacing: "0.02em" }}>
              {homeTeam} vs {awayTeam}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.7 0.04 150)", padding: "0.25rem", borderRadius: 6, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "1.5rem 1.25rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", marginBottom: "1.25rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "oklch(0.35 0.06 150)", marginBottom: "0.4rem" }}>
                {homeTeam}
              </label>
              <input
                type="number" step="0.1" min="0" value={homeScore}
                onChange={e => setHomeScore(e.target.value)} placeholder="0.0"
                style={{ width: "100%", padding: "0.65rem 0.75rem", border: "2px solid oklch(0.85 0.04 150)", borderRadius: 8, fontSize: "1.4rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: "oklch(0.22 0.08 150)", textAlign: "center" as const, outline: "none" }}
              />
            </div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.1rem", fontWeight: 900, color: "oklch(0.55 0.16 85)", paddingBottom: "0.5rem" }}>VS</div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "oklch(0.35 0.06 150)", marginBottom: "0.4rem" }}>
                {awayTeam}
              </label>
              <input
                type="number" step="0.1" min="0" value={awayScore}
                onChange={e => setAwayScore(e.target.value)} placeholder="0.0"
                style={{ width: "100%", padding: "0.65rem 0.75rem", border: "2px solid oklch(0.85 0.04 150)", borderRadius: 8, fontSize: "1.4rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: "oklch(0.22 0.08 150)", textAlign: "center" as const, outline: "none" }}
              />
            </div>
          </div>

          <p style={{ fontSize: "0.72rem", color: "oklch(0.5 0.04 150)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
            Saving marks this matchup as final and auto-updates standings (W/L, FPts, H2H, Median, Division, Streak).
          </p>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={onClose} style={{ flex: 1, padding: "0.7rem", borderRadius: 8, border: "2px solid oklch(0.85 0.04 150)", background: "white", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", color: "oklch(0.4 0.04 150)" }}>
              Cancel
            </button>
            <button
              onClick={handleSave} disabled={saving}
              style={{ flex: 2, padding: "0.7rem", borderRadius: 8, background: saving ? "oklch(0.65 0.12 150)" : "oklch(0.28 0.1 150)", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
            >
              {saving ? "Saving…" : <><CheckCircle2 size={15} /> Save Result</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Week Card ─────────────────────────────────────────────────────────────────

function WeekCard({
  week,
  results,
  isCommissioner,
  onEdit,
}: {
  week: { week: number; label: string; dates: string };
  results: WeeklyResult[];
  isCommissioner: boolean;
  onEdit: (r: WeeklyResult) => void;
}) {
  const completedCount = results.filter(r => r.is_final).length;
  const allDone = completedCount === results.length && results.length > 0;

  return (
    <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
      <div className="wrc-card-gold-stripe" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem 0.5rem" }}>
        <div>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", fontWeight: 800, letterSpacing: "0.04em", color: "oklch(0.22 0.08 150)" }}>{week.label}</span>
          <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>{week.dates}</span>
        </div>
        <div>
          {allDone ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "oklch(0.38 0.14 150)", background: "oklch(0.93 0.06 150)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>
              <CheckCircle2 size={11} /> Final
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "oklch(0.5 0.08 85)", background: "oklch(0.96 0.04 85)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>
              <Clock size={11} /> {completedCount}/{results.length}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "0 0 0.5rem" }}>
        {results.map((r) => {
          const homeWon = r.is_final && r.home_score != null && r.away_score != null && r.home_score > r.away_score;
          const awayWon = r.is_final && r.home_score != null && r.away_score != null && r.away_score > r.home_score;
          const homeTeam = OWNER_TO_TEAM[r.home_owner] ?? r.home_owner;
          const awayTeam = OWNER_TO_TEAM[r.away_owner] ?? r.away_owner;

          return (
            <div
              key={r.id}
              className="wrc-row-hover"
              style={{ padding: "0.6rem 1.25rem", borderTop: "1px solid oklch(0.93 0.01 150)", display: "flex", alignItems: "center", gap: "0.5rem", cursor: isCommissioner ? "pointer" : "default" }}
              onClick={() => isCommissioner && onEdit(r)}
            >
              {/* Home team */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: homeWon ? 800 : 500, color: homeWon ? "oklch(0.28 0.12 150)" : awayWon ? "oklch(0.6 0.04 150)" : "oklch(0.28 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {homeWon && <Trophy size={11} style={{ display: "inline", marginRight: 3, color: "oklch(0.55 0.18 85)", verticalAlign: "middle" }} />}
                  {homeTeam}
                </div>
                <div style={{ fontSize: "0.62rem", color: "oklch(0.55 0.04 150)" }}>{r.home_owner}</div>
              </div>

              {/* Score */}
              <div style={{ textAlign: "center" as const, minWidth: 100 }}>
                {r.is_final && r.home_score != null ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                    <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.05rem", fontWeight: homeWon ? 900 : 600, color: homeWon ? "oklch(0.28 0.12 150)" : "oklch(0.55 0.04 150)" }}>{r.home_score.toFixed(1)}</span>
                    <span style={{ fontSize: "0.65rem", color: "oklch(0.6 0.03 150)" }}>–</span>
                    <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.05rem", fontWeight: awayWon ? 900 : 600, color: awayWon ? "oklch(0.28 0.12 150)" : "oklch(0.55 0.04 150)" }}>{r.away_score!.toFixed(1)}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.7rem", color: "oklch(0.65 0.03 150)", fontStyle: "italic" }}>
                    {isCommissioner ? "Enter score" : "Pending"}
                  </div>
                )}
                {r.is_final && (
                  <div style={{ fontSize: "0.58rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.5 0.06 150)", marginTop: 1 }}>FINAL</div>
                )}
              </div>

              {/* Away team */}
              <div style={{ flex: 1, minWidth: 0, textAlign: "right" as const }}>
                <div style={{ fontSize: "0.78rem", fontWeight: awayWon ? 800 : 500, color: awayWon ? "oklch(0.28 0.12 150)" : homeWon ? "oklch(0.6 0.04 150)" : "oklch(0.28 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {awayWon && <Trophy size={11} style={{ display: "inline", marginRight: 3, color: "oklch(0.55 0.18 85)", verticalAlign: "middle" }} />}
                  {awayTeam}
                </div>
                <div style={{ fontSize: "0.62rem", color: "oklch(0.55 0.04 150)" }}>{r.away_owner}</div>
              </div>

              {isCommissioner && (
                <Edit3 size={13} style={{ color: "oklch(0.65 0.04 150)", flexShrink: 0, marginLeft: 4 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Results Page ─────────────────────────────────────────────────────────

export default function Results() {
  const { franchise, authLoading } = useAuth();
  const isCommissioner = franchise?.is_commissioner === true;

  const [allResults, setAllResults] = useState<WeeklyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<WeeklyResult | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);

  const loadResults = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("weekly_results")
      .select("*")
      .eq("season", 2026)
      .order("week", { ascending: true });
    if (data) setAllResults(data as WeeklyResult[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadResults();
    const channel = supabase.channel("results-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_results" }, loadResults)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadResults]);

  const weekGroups = SCHEDULE_2026
    .filter(w => w.type === "regular")
    .map(w => ({
      week: w.week,
      label: w.label,
      dates: w.dates,
      results: allResults.filter(r => r.week === w.week),
    }));

  const defaultWeek = (() => {
    for (let i = weekGroups.length - 1; i >= 0; i--) {
      if (weekGroups[i].results.some(r => r.is_final)) return weekGroups[i].week;
    }
    return 1;
  })();

  const displayWeek = activeWeek ?? defaultWeek;
  const totalGames = allResults.length;
  const finalGames = allResults.filter(r => r.is_final).length;

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 0.75rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>2026 Season Results</h1>
          <p>
            {finalGames} of {totalGames} matchups final
            {isCommissioner && " · Click any matchup to enter scores"}
          </p>
        </div>

        {!authLoading && isCommissioner && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "oklch(0.96 0.04 85)", border: "1.5px solid oklch(0.82 0.12 85)", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1.25rem" }}>
            <Edit3 size={14} color="oklch(0.45 0.18 85)" />
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.38 0.14 85)" }}>
              COMMISSIONER MODE — Click any matchup to enter or edit the final score
            </span>
          </div>
        )}

        {/* Week selector tabs */}
        <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", gap: "0.4rem", paddingBottom: "0.25rem", minWidth: "max-content" }}>
            {weekGroups.map(wg => {
              const done = wg.results.every(r => r.is_final) && wg.results.length > 0;
              const active = wg.week === displayWeek;
              return (
                <button
                  key={wg.week}
                  onClick={() => setActiveWeek(wg.week)}
                  style={{ padding: "0.4rem 0.75rem", borderRadius: 8, border: active ? "2px solid oklch(0.55 0.16 85)" : "2px solid oklch(0.88 0.04 150)", background: active ? "oklch(0.22 0.08 150)" : done ? "oklch(0.94 0.04 150)" : "white", color: active ? "white" : done ? "oklch(0.35 0.08 150)" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", whiteSpace: "nowrap" as const }}
                >
                  W{wg.week}
                  {done && <CheckCircle2 size={9} style={{ display: "inline", marginLeft: 3, verticalAlign: "middle" }} />}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-shimmer" style={{ height: 200, borderRadius: 12, marginBottom: "1.25rem" }} />
            ))}
          </div>
        ) : (
          weekGroups
            .filter(wg => wg.week === displayWeek)
            .map(wg => (
              <WeekCard
                key={wg.week}
                week={wg}
                results={wg.results}
                isCommissioner={isCommissioner}
                onEdit={setEditTarget}
              />
            ))
        )}

        {!loading && (
          <div className="wrc-card" style={{ padding: "1rem 1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" as const, padding: "0.5rem 0" }}>
              {[
                { label: "Weeks Complete", value: weekGroups.filter(w => w.results.every(r => r.is_final) && w.results.length > 0).length + " / 14" },
                { label: "Games Final", value: `${finalGames} / ${totalGames}` },
                { label: "Season", value: "2026" },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.55 0.08 85)", marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "oklch(0.22 0.08 150)" }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editTarget && (
        <ScoreModal
          result={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={loadResults}
        />
      )}
    </div>
  );
}
