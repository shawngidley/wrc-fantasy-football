/**
 * ScheduleResults.tsx — WRC Fantasy Football 2026
 * Combined Schedule + Results page.
 * - Past weeks: final scores from Supabase weekly_results
 * - Current week: live/projected scores with link to /live
 * - Future weeks: scheduled opponent from SCHEDULE_2026
 * - Commissioner: click any past matchup to edit score; auto-score button
 * - My Schedule filter: shows only the logged-in owner's matchups
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  SCHEDULE_2026, OWNER_TO_TEAM, ownerToTeam, getCurrentWeek,
  derivePlayoffSeeds,
} from "@/lib/scheduleData2026";
import { useNFLMatchups } from "@/hooks/useNFLMatchups";
import { useWeeklyResultsWriter } from "@/hooks/useWeeklyResultsWriter";
import { CheckCircle2, Clock, Edit3, Trophy, X, Zap, RefreshCw, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import TeamLogo from "@/components/TeamLogo";

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

const OWNER_DIVISION: Record<string, string> = {
  "Jonas": "East", "David R.": "East", "Jason": "East", "Jamie": "East",
  "Keith": "Central", "Dan": "Central", "Scott N.": "Central", "Bill": "Central",
  "Scott M.": "West", "David S.": "West", "Shawn": "West", "Greg": "West",
};

function newStreak(current: string, won: boolean): string {
  const letter = won ? "W" : "L";
  const match = current?.match(/^([WL])(\d+)$/);
  if (match && match[1] === letter) return `${letter}${parseInt(match[2]) + 1}`;
  return `${letter}1`;
}

// ── Score Entry Modal ─────────────────────────────────────────────────────────

function ScoreModal({ result, onClose, onSaved }: {
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
    if (isNaN(hs) || isNaN(as_)) { toast.error("Enter valid scores"); return; }
    setSaving(true);
    try {
      const homeWon = hs > as_;
      const { error: resErr } = await supabase.from("weekly_results").update({
        home_score: hs, away_score: as_, is_final: true,
      }).eq("id", result.id);
      if (resErr) throw resErr;

      const { data: weekRows } = await supabase.from("weekly_results")
        .select("home_score,away_score,home_owner,away_owner,home_team_id,away_team_id,league_median")
        .eq("week", result.week).eq("season", result.season).eq("is_final", true);

      const allScores = (weekRows ?? []).flatMap(r => [r.home_score, r.away_score]).filter(Boolean) as number[];
      const median = allScores.length ? allScores.sort((a, b) => a - b)[Math.floor(allScores.length / 2)] : null;

      const homeDiv = OWNER_DIVISION[result.home_owner] ?? "";
      const awayDiv = OWNER_DIVISION[result.away_owner] ?? "";
      const isDivGame = homeDiv === awayDiv && homeDiv !== "";

      const homeUpdate: Partial<DbStanding> = {
        wins: undefined, losses: undefined, pts_for: undefined, pts_against: undefined,
        h2h_wins: undefined, h2h_losses: undefined,
        median_wins: undefined, median_losses: undefined,
        div_wins: undefined, div_losses: undefined, streak: undefined,
      };
      const awayUpdate: Partial<DbStanding> = { ...homeUpdate };

      const { data: homeStanding } = await supabase.from("team_standings").select("*").eq("team_id", result.home_team_id).single();
      const { data: awayStanding } = await supabase.from("team_standings").select("*").eq("team_id", result.away_team_id).single();

      if (homeStanding && awayStanding) {
        const hWins = (homeStanding.wins ?? 0) + (homeWon ? 1 : 0);
        const hLoss = (homeStanding.losses ?? 0) + (!homeWon ? 1 : 0);
        const aWins = (awayStanding.wins ?? 0) + (!homeWon ? 1 : 0);
        const aLoss = (awayStanding.losses ?? 0) + (homeWon ? 1 : 0);
        const hMedianW = (homeStanding.median_wins ?? 0) + (median !== null && hs > median ? 1 : 0);
        const hMedianL = (homeStanding.median_losses ?? 0) + (median !== null && hs <= median ? 1 : 0);
        const aMedianW = (awayStanding.median_wins ?? 0) + (median !== null && as_ > median ? 1 : 0);
        const aMedianL = (awayStanding.median_losses ?? 0) + (median !== null && as_ <= median ? 1 : 0);

        Object.assign(homeUpdate, {
          wins: hWins, losses: hLoss,
          pts_for: (homeStanding.pts_for ?? 0) + hs,
          pts_against: (homeStanding.pts_against ?? 0) + as_,
          h2h_wins: (homeStanding.h2h_wins ?? 0) + (homeWon ? 1 : 0),
          h2h_losses: (homeStanding.h2h_losses ?? 0) + (!homeWon ? 1 : 0),
          median_wins: hMedianW, median_losses: hMedianL,
          div_wins: (homeStanding.div_wins ?? 0) + (isDivGame && homeWon ? 1 : 0),
          div_losses: (homeStanding.div_losses ?? 0) + (isDivGame && !homeWon ? 1 : 0),
          streak: newStreak(homeStanding.streak ?? "", homeWon),
        });
        Object.assign(awayUpdate, {
          wins: aWins, losses: aLoss,
          pts_for: (awayStanding.pts_for ?? 0) + as_,
          pts_against: (awayStanding.pts_against ?? 0) + hs,
          h2h_wins: (awayStanding.h2h_wins ?? 0) + (!homeWon ? 1 : 0),
          h2h_losses: (awayStanding.h2h_losses ?? 0) + (homeWon ? 1 : 0),
          median_wins: aMedianW, median_losses: aMedianL,
          div_wins: (awayStanding.div_wins ?? 0) + (isDivGame && !homeWon ? 1 : 0),
          div_losses: (awayStanding.div_losses ?? 0) + (isDivGame && homeWon ? 1 : 0),
          streak: newStreak(awayStanding.streak ?? "", !homeWon),
        });

        await Promise.all([
          supabase.from("team_standings").update(homeUpdate).eq("team_id", result.home_team_id),
          supabase.from("team_standings").update(awayUpdate).eq("team_id", result.away_team_id),
        ]);
      }

      toast.success("Score saved!");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Failed to save score");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div className="wrc-card" style={{ width: "100%", maxWidth: 420, padding: "1.5rem" }}>
        <div className="wrc-card-gold-stripe" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.9rem", fontWeight: 800, letterSpacing: "0.06em", color: "oklch(0.22 0.08 150)" }}>ENTER SCORE — WK {result.week}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.06 150)", padding: "0.2rem" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1, textAlign: "center" as const }}>
            <TeamLogo teamName={OWNER_TO_TEAM[result.home_owner] ?? result.home_owner} size={36} style={{ borderRadius: 8, margin: "0 auto 0.4rem" }} />
            <div style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: "oklch(0.28 0.08 150)", marginBottom: "0.4rem" }}>{OWNER_TO_TEAM[result.home_owner] ?? result.home_owner}</div>
            <input type="number" step="0.1" value={homeScore} onChange={e => setHomeScore(e.target.value)}
              style={{ width: "100%", textAlign: "center" as const, fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.4rem", fontWeight: 800, border: "2px solid oklch(0.82 0.08 150)", borderRadius: 8, padding: "0.4rem", color: "oklch(0.22 0.08 150)" }} />
          </div>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.2rem", fontWeight: 700, color: "oklch(0.6 0.04 150)" }}>vs</span>
          <div style={{ flex: 1, textAlign: "center" as const }}>
            <TeamLogo teamName={OWNER_TO_TEAM[result.away_owner] ?? result.away_owner} size={36} style={{ borderRadius: 8, margin: "0 auto 0.4rem" }} />
            <div style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: "oklch(0.28 0.08 150)", marginBottom: "0.4rem" }}>{OWNER_TO_TEAM[result.away_owner] ?? result.away_owner}</div>
            <input type="number" step="0.1" value={awayScore} onChange={e => setAwayScore(e.target.value)}
              style={{ width: "100%", textAlign: "center" as const, fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.4rem", fontWeight: 800, border: "2px solid oklch(0.82 0.08 150)", borderRadius: 8, padding: "0.4rem", color: "oklch(0.22 0.08 150)" }} />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", background: "oklch(0.22 0.08 150)", color: "white", border: "none", borderRadius: 8, padding: "0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Score"}
        </button>
      </div>
    </div>
  );
}

// ── Matchup Card ──────────────────────────────────────────────────────────────

function MatchupCard({
  weekNum, ownerA, ownerB, result, isCommissioner, myOwner, isCurrent, isFuture, onEdit, seeds,
}: {
  weekNum: number;
  ownerA: string;
  ownerB: string;
  result: WeeklyResult | undefined;
  isCommissioner: boolean;
  myOwner: string | null;
  isCurrent: boolean;
  isFuture: boolean;
  onEdit: (r: WeeklyResult) => void;
  seeds: string[];
}) {
  // Resolve team names
  const teamA = ownerA === "TBD" ? "TBD" : (ownerToTeam(ownerA) ?? ownerA);
  const teamB = ownerB === "TBD" ? "TBD" : (ownerToTeam(ownerB) ?? ownerB);

  const isMyMatchup = myOwner && (ownerA === myOwner || ownerB === myOwner);
  const isFinal = result?.is_final ?? false;
  const homeScore = result?.home_score;
  const awayScore = result?.away_score;
  const homeWon = isFinal && homeScore != null && awayScore != null && homeScore > awayScore;
  const awayWon = isFinal && homeScore != null && awayScore != null && awayScore > homeScore;

  // For display: home = ownerA, away = ownerB (matches weekly_results convention)
  const displayHome = result ? (OWNER_TO_TEAM[result.home_owner] ?? result.home_owner) : teamA;
  const displayAway = result ? (OWNER_TO_TEAM[result.away_owner] ?? result.away_owner) : teamB;
  const homeOwner = result?.home_owner ?? ownerA;
  const awayOwner = result?.away_owner ?? ownerB;

  const cardBorder = isMyMatchup
    ? "2px solid oklch(0.65 0.18 85)"
    : "1px solid oklch(0.93 0.01 150)";
  const cardBg = isMyMatchup ? "oklch(0.99 0.02 85)" : "white";

  return (
    <div
      style={{ background: cardBg, border: cardBorder, borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", cursor: (isCommissioner && isFinal) ? "pointer" : "default", transition: "background 0.15s" }}
      onClick={() => isCommissioner && result && onEdit(result)}
      onMouseEnter={e => { if (isCommissioner && result) (e.currentTarget as HTMLElement).style.background = isMyMatchup ? "oklch(0.97 0.04 85)" : "oklch(0.97 0.01 150)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = cardBg; }}
    >
      {/* Home team */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <TeamLogo teamName={displayHome} size={28} style={{ borderRadius: 5, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: homeWon ? 800 : 500, color: homeWon ? "oklch(0.22 0.08 150)" : awayWon ? "oklch(0.65 0.04 150)" : "oklch(0.28 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {homeWon && <Trophy size={10} style={{ display: "inline", marginRight: 3, color: "oklch(0.55 0.18 85)", verticalAlign: "middle" }} />}
            {displayHome}
          </div>
          <div style={{ fontSize: "0.6rem", color: "oklch(0.55 0.04 150)" }}>{homeOwner}</div>
        </div>
      </div>

      {/* Score / status */}
      <div style={{ textAlign: "center" as const, minWidth: 90, flexShrink: 0 }}>
        {isFinal && homeScore != null ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", fontWeight: homeWon ? 900 : 600, color: homeWon ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)" }}>{homeScore.toFixed(1)}</span>
              <span style={{ fontSize: "0.6rem", color: "oklch(0.65 0.03 150)" }}>–</span>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", fontWeight: awayWon ? 900 : 600, color: awayWon ? "oklch(0.22 0.08 150)" : "oklch(0.55 0.04 150)" }}>{awayScore!.toFixed(1)}</span>
            </div>
            <div style={{ fontSize: "0.56rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.5 0.06 150)", marginTop: 1 }}>FINAL</div>
          </>
        ) : isCurrent ? (
          <Link href="/live" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "oklch(0.22 0.08 150)", color: "white", borderRadius: 6, padding: "0.25rem 0.5rem", fontSize: "0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.05em", textDecoration: "none" }}>
            LIVE
          </Link>
        ) : isFuture ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", color: "oklch(0.65 0.04 150)", fontSize: "0.65rem" }}>
            <Calendar size={11} />
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600 }}>Scheduled</span>
          </div>
        ) : (
          <div style={{ fontSize: "0.65rem", color: "oklch(0.65 0.04 150)", fontStyle: "italic" }}>
            {isCommissioner ? "Enter score" : "Pending"}
          </div>
        )}
      </div>

      {/* Away team */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 0, textAlign: "right" as const }}>
          <div style={{ fontSize: "0.78rem", fontWeight: awayWon ? 800 : 500, color: awayWon ? "oklch(0.22 0.08 150)" : homeWon ? "oklch(0.65 0.04 150)" : "oklch(0.28 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {awayWon && <Trophy size={10} style={{ display: "inline", marginRight: 3, color: "oklch(0.55 0.18 85)", verticalAlign: "middle" }} />}
            {displayAway}
          </div>
          <div style={{ fontSize: "0.6rem", color: "oklch(0.55 0.04 150)" }}>{awayOwner}</div>
        </div>
        <TeamLogo teamName={displayAway} size={28} style={{ borderRadius: 5, flexShrink: 0 }} />
      </div>

      {isCommissioner && result && <Edit3 size={12} style={{ color: "oklch(0.65 0.04 150)", flexShrink: 0, marginLeft: 2 }} />}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScheduleResults() {
  const { franchise, authLoading } = useAuth();
  const isCommissioner = franchise?.is_commissioner === true;
  const myOwner = franchise?.owner ?? null;
  const myTeam = myOwner ? (ownerToTeam(myOwner) ?? myOwner) : null;

  const currentWeek = getCurrentWeek() || 1;
  const { matchups: matchupMap } = useNFLMatchups(currentWeek);
  const { autoWriteStatus, autoWriteError, forceWriteResults } = useWeeklyResultsWriter(
    currentWeek, 2026, matchupMap, false
  );
  const [forceWeek, setForceWeek] = useState<number>(currentWeek);
  const [myScheduleOnly, setMyScheduleOnly] = useState(false);

  const [allResults, setAllResults] = useState<WeeklyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<WeeklyResult | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [seeds, setSeeds] = useState<string[]>([]);

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
    const channel = supabase.channel("sr-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_results" }, loadResults)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadResults]);

  // Load playoff seeds from standings
  useEffect(() => {
    supabase.from("team_standings").select("team_name,owner,wins,losses,pts_for,division").then(({ data }) => {
      if (data) setSeeds(derivePlayoffSeeds(
        (data as { team_name: string; owner: string; wins: number; losses: number; pts_for: number; division: string }[])
          .map(d => ({ teamName: d.team_name, owner: d.owner, wins: d.wins, losses: d.losses, ptsFor: d.pts_for, division: d.division }))
      ));
    });
  }, []);

  // All weeks (regular + playoffs)
  const allWeeks = SCHEDULE_2026;

  // Default to current week or last week with results
  const defaultWeek = (() => {
    // Prefer current week
    if (currentWeek >= 1 && currentWeek <= 17) return currentWeek;
    // Fall back to last week with results
    for (let i = allWeeks.length - 1; i >= 0; i--) {
      if (allResults.some(r => r.week === allWeeks[i].week && r.is_final)) return allWeeks[i].week;
    }
    return 1;
  })();

  const displayWeek = activeWeek ?? defaultWeek;
  const displayWeekData = allWeeks.find(w => w.week === displayWeek);
  const isPlayoffWeek = displayWeekData?.type !== "regular";
  const isCurrent = displayWeek === currentWeek;
  const isPast = displayWeek < currentWeek;
  const isFuture = displayWeek > currentWeek;

  const weekResults = allResults.filter(r => r.week === displayWeek);
  const finalGames = allResults.filter(r => r.is_final).length;
  const totalGames = allResults.length;

  // For the week's matchups: use schedule data (includes future weeks) + overlay results
  const weekMatchups = displayWeekData?.matchups ?? [];

  // Filter to my matchups if toggle is on
  const visibleMatchups = myScheduleOnly && myOwner
    ? weekMatchups.filter(m => m[0] === myOwner || m[1] === myOwner)
    : weekMatchups;

  // Running W/L record for "My Schedule" view
  const myRecord = (() => {
    if (!myOwner) return { w: 0, l: 0 };
    let w = 0, l = 0;
    for (const r of allResults) {
      if (!r.is_final) continue;
      if (r.week > displayWeek) continue;
      const isHome = r.home_owner === myOwner;
      const isAway = r.away_owner === myOwner;
      if (!isHome && !isAway) continue;
      const myScore = isHome ? r.home_score : r.away_score;
      const oppScore = isHome ? r.away_score : r.home_score;
      if (myScore != null && oppScore != null) {
        if (myScore > oppScore) w++; else l++;
      }
    }
    return { w, l };
  })();

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 0.75rem 3rem" }}>
        {/* ── Header ── */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "0.5rem" }}>
            <div>
              <h1>Schedule & Results</h1>
              <p>
                {finalGames > 0 ? `${finalGames} of ${totalGames} matchups final · ` : ""}
                2026 Season
              </p>
            </div>
            {/* My Schedule toggle */}
            {myOwner && (
              <button
                onClick={() => setMyScheduleOnly(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.875rem", borderRadius: 8, border: myScheduleOnly ? "2px solid oklch(0.55 0.16 85)" : "2px solid oklch(0.88 0.04 150)", background: myScheduleOnly ? "oklch(0.22 0.08 150)" : "white", color: myScheduleOnly ? "white" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer" }}
              >
                <User size={12} />
                My Schedule
                {myScheduleOnly && <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>{myRecord.w}–{myRecord.l}</span>}
              </button>
            )}
          </div>
        </div>

        {/* ── Commissioner panel ── */}
        {!authLoading && isCommissioner && (
          <div style={{ background: "oklch(0.96 0.04 85)", border: "1.5px solid oklch(0.82 0.12 85)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <Edit3 size={14} color="oklch(0.45 0.18 85)" />
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.38 0.14 85)" }}>
                COMMISSIONER — Click any matchup to enter scores
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" as const }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", color: "oklch(0.45 0.08 85)" }}>Auto-score week:</span>
              <select value={forceWeek} onChange={e => setForceWeek(parseInt(e.target.value))}
                style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, borderRadius: 6, border: "1.5px solid oklch(0.75 0.1 85)", padding: "0.25rem 0.5rem", background: "white", color: "oklch(0.3 0.1 85)", cursor: "pointer" }}>
                {SCHEDULE_2026.filter(w => w.type === "regular").map(w => (
                  <option key={w.week} value={w.week}>Week {w.week}</option>
                ))}
              </select>
              <button onClick={() => forceWriteResults(forceWeek)} disabled={autoWriteStatus === "running"}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: autoWriteStatus === "done" ? "oklch(0.42 0.15 150)" : "oklch(0.38 0.14 85)", color: "white", border: "none", borderRadius: 7, padding: "0.35rem 0.875rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", cursor: autoWriteStatus === "running" ? "wait" : "pointer", opacity: autoWriteStatus === "running" ? 0.7 : 1 }}>
                {autoWriteStatus === "running" ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Scoring...</>
                  : autoWriteStatus === "done" ? <><CheckCircle2 size={12} /> Scores Written!</>
                  : <><Zap size={12} /> Auto-Score Week {forceWeek}</>}
              </button>
              {autoWriteError && <span style={{ fontSize: "0.7rem", color: "#ef4444" }}>{autoWriteError}</span>}
            </div>
          </div>
        )}

        {/* ── Week selector ── */}
        <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", gap: "0.35rem", paddingBottom: "0.25rem", minWidth: "max-content" }}>
            {allWeeks.map(w => {
              const weekRes = allResults.filter(r => r.week === w.week);
              const done = weekRes.length > 0 && weekRes.every(r => r.is_final);
              const isThisWeek = w.week === currentWeek;
              const active = w.week === displayWeek;
              const isPlayoff = w.type !== "regular";
              return (
                <button key={w.week} onClick={() => setActiveWeek(w.week)}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: 8, border: active ? "2px solid oklch(0.55 0.16 85)" : isThisWeek ? "2px solid oklch(0.65 0.14 85)" : "2px solid oklch(0.88 0.04 150)", background: active ? "oklch(0.22 0.08 150)" : done ? "oklch(0.94 0.04 150)" : isThisWeek ? "oklch(0.97 0.04 85)" : "white", color: active ? "white" : done ? "oklch(0.35 0.08 150)" : isThisWeek ? "oklch(0.38 0.14 85)" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", whiteSpace: "nowrap" as const }}>
                  {isPlayoff ? w.label.replace("Week ", "").split(" ")[0].substring(0, 2).toUpperCase() : `W${w.week}`}
                  {done && <CheckCircle2 size={8} style={{ display: "inline", marginLeft: 3, verticalAlign: "middle" }} />}
                  {isThisWeek && !done && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "oklch(0.55 0.18 85)", marginLeft: 3, verticalAlign: "middle" }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Week header ── */}
        {displayWeekData && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.04em", color: "oklch(0.22 0.08 150)" }}>{displayWeekData.label}</span>
              <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>{displayWeekData.dates}</span>
            </div>
            <div>
              {isCurrent && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "oklch(0.38 0.14 85)", background: "oklch(0.96 0.04 85)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.55 0.18 85)", display: "inline-block" }} />
                  Current Week
                </span>
              )}
              {isPast && weekResults.every(r => r.is_final) && weekResults.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "oklch(0.38 0.14 150)", background: "oklch(0.93 0.06 150)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>
                  <CheckCircle2 size={10} /> Final
                </span>
              )}
              {isFuture && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "oklch(0.5 0.06 150)", background: "oklch(0.95 0.02 150)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>
                  <Clock size={10} /> Upcoming
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Matchup cards ── */}
        {loading ? (
          <div>{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 10, marginBottom: "0.5rem" }} />)}</div>
        ) : (
          <div className="wrc-card" style={{ overflow: "hidden", marginBottom: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div style={{ padding: "0.5rem 0.75rem 0.75rem" }}>
              {visibleMatchups.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center" as const, color: "oklch(0.55 0.04 150)", fontSize: "0.82rem" }}>
                  No matchups to display
                </div>
              ) : (
                visibleMatchups.map((m, i) => {
                  const [ownerA, ownerB] = m;
                  // Find result: check both home/away orientations
                  const result = weekResults.find(r =>
                    (r.home_owner === ownerA && r.away_owner === ownerB) ||
                    (r.home_owner === ownerB && r.away_owner === ownerA)
                  );
                  return (
                    <MatchupCard
                      key={i}
                      weekNum={displayWeek}
                      ownerA={ownerA}
                      ownerB={ownerB}
                      result={result}
                      isCommissioner={isCommissioner}
                      myOwner={myOwner}
                      isCurrent={isCurrent}
                      isFuture={isFuture}
                      onEdit={setEditTarget}
                      seeds={seeds}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Season summary ── */}
        {!loading && finalGames > 0 && (
          <div className="wrc-card" style={{ padding: "1rem 1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" as const, padding: "0.5rem 0" }}>
              {[
                { label: "Weeks Complete", value: `${allWeeks.filter(w => { const wr = allResults.filter(r => r.week === w.week); return wr.length > 0 && wr.every(r => r.is_final); }).length} / 14` },
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
        <ScoreModal result={editTarget} onClose={() => setEditTarget(null)} onSaved={loadResults} />
      )}
    </div>
  );
}
