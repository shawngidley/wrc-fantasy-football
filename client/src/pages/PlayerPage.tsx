/**
 * WRC Fantasy Football — Player Page
 * Design: Dark-forest premium card layout
 * - Hero: headshot, name, position badge, NFL team logo, injury tag
 * - Ownership: WRC team owner or "Free Agent — Available for FAAB bid"
 * - Season Stats: real Tank01 data → WRC fantasy points via scoringEngine
 * - Injury / News: Tank01 injury designation + description
 * - This week's matchup: NFL opponent + week number
 */
import { useParams, useLocation } from "wouter";
import { useTank01PlayerByName, getTeamLogoUrl } from "@/hooks/useTank01Player";
import { useWatchlist } from "@/hooks/useWatchlist";
import { calcFantasyPoints, getStatLine, getPerGameAvg, injuryColor, injuryLabel } from "@/lib/scoringEngine";
import type { Tank01Stats } from "@/lib/scoringEngine";
import { getCurrentWeek } from "@/lib/scheduleData2026";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, TrendingUp, Shield, Zap, AlertCircle, Calendar, User, ListOrdered, BarChart2 } from "lucide-react";
import { useState, useEffect } from "react";
import FAABBidModal from "@/components/FAABBidModal";
import { useAuth } from "@/contexts/AuthContext";
import { useNFLMatchups, formatMatchup, formatGameTime } from "@/hooks/useNFLMatchups";
import { useESPNSeasonStats, type SeasonStatRow } from "@/hooks/useESPNSeasonStats";
import { useNFLTeamSchedule, parseDate, type ScheduleGame } from "@/hooks/useNFLTeamSchedule";
import { useNFLGameLog, type GameLogEntry } from "@/hooks/useNFLGameLog";
import TeamLogo from "@/components/TeamLogo";

// ── Position badge colors ────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB:  "bg-red-600 text-white",
  RB:  "bg-green-600 text-white",
  WR:  "bg-blue-600 text-white",
  TE:  "bg-orange-600 text-white",
  K:   "bg-purple-600 text-white",
  DST: "bg-slate-700 text-white",
};

// ── Stat card component ──────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-[90px]">
      <span className="text-2xl font-bold text-slate-900 tabular-nums">{value}</span>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{label}</span>
      {sub && <span className="text-xs text-slate-400 mt-0.5">{sub}</span>}
    </div>
  );
}

// ── Live ownership lookup via Supabase ──────────────────────────────────────
type OwnershipResult = {
  teamName: string;
  owner: string;
  acquisition: string;
  round: number | null;
} | null;

  function usePlayerOwnership(playerName: string | null): { ownership: OwnershipResult; ownerLoading: boolean } {
  const [ownership, setOwnership] = useState<OwnershipResult>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);

  useEffect(() => {
    if (!playerName) { setOwnerLoading(false); return; }
    setOwnerLoading(true);
    supabase
      .from("players")
      .select("team_id, acquisition, draft_round, teams(name, owner)")
      .ilike("name", playerName)
      .limit(1)
      .then(({ data, error }) => {
        if (error) { console.error("ownership query error:", error); setOwnerLoading(false); return; }
        const row = data?.[0];
        if (row && row.team_id) {
          const t = Array.isArray(row.teams) ? (row.teams[0] as { name: string; owner: string } | undefined) : (row.teams as { name: string; owner: string } | null);
          setOwnership({
            teamName: t?.name ?? row.team_id,
            owner: t?.owner ?? "",
            acquisition: row.acquisition ?? "Draft",
            round: row.draft_round ?? null,
          });
        } else {
          setOwnership(null);
        }
        setOwnerLoading(false);
      });
  }, [playerName]);

  return { ownership, ownerLoading };
}

// getThisWeekMatchup stub removed — replaced by live useNFLMatchups hook

// ── Stat rows by position ────────────────────────────────────────────────────
function StatsSection({ player }: { player: { pos: string; stats?: Tank01Stats; longName: string } }) {
  const stats = player.stats;
  const pos = player.pos;
  if (!stats) return null;

  const totalPts = calcFantasyPoints(stats, pos);
  const perGame = getPerGameAvg(stats, pos);
  const gp = parseInt(String(stats.gamesPlayed ?? "0"), 10);
  const statLine = getStatLine(stats, pos);

  const renderStatRows = () => {
    switch (pos) {
      case "QB": {
        const p = stats.Passing ?? {};
        const r = stats.Rushing ?? {};
        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Pass Yds" value={Number(p.passYds ?? 0).toLocaleString()} />
              <StatCard label="Pass TD" value={String(p.passTD ?? 0)} />
              <StatCard label="INT" value={String(p.int ?? 0)} />
              <StatCard label="Rush Yds" value={String(r.rushYds ?? 0)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Rush TD" value={String(r.rushTD ?? 0)} />
              <StatCard label="Comp" value={`${p.passCompletions ?? 0}/${p.passAttempts ?? 0}`} />
              <StatCard label="Games" value={String(gp)} />
              <StatCard label="Pts/Gm" value={perGame} />
            </div>
          </>
        );
      }
      case "RB": {
        const r = stats.Rushing ?? {};
        const rec = stats.Receiving ?? {};
        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Rush Yds" value={Number(r.rushYds ?? 0).toLocaleString()} />
              <StatCard label="Rush TD" value={String(r.rushTD ?? 0)} />
              <StatCard label="Carries" value={String(r.carries ?? 0)} />
              <StatCard label="Rec" value={String(rec.receptions ?? 0)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Rec Yds" value={String(rec.recYds ?? 0)} />
              <StatCard label="Rec TD" value={String(rec.recTD ?? 0)} />
              <StatCard label="Games" value={String(gp)} />
              <StatCard label="Pts/Gm" value={perGame} />
            </div>
          </>
        );
      }
      case "WR":
      case "TE": {
        const rec = stats.Receiving ?? {};
        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Rec" value={String(rec.receptions ?? 0)} />
              <StatCard label="Targets" value={String(rec.targets ?? 0)} />
              <StatCard label="Rec Yds" value={Number(rec.recYds ?? 0).toLocaleString()} />
              <StatCard label="Rec TD" value={String(rec.recTD ?? 0)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Yds/Rec" value={rec.receptions && Number(rec.receptions) > 0 ? Math.round(Number(rec.recYds ?? 0) / Number(rec.receptions)).toString() : "—"} />
              <StatCard label="Games" value={String(gp)} />
              <StatCard label="Pts/Gm" value={perGame} />
              <StatCard label="Total Pts" value={totalPts} />
            </div>
          </>
        );
      }
      case "K": {
        const k = stats.Kicking ?? {};
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="FG Made" value={String(k.fgMade ?? 0)} sub={`of ${k.fgAttempts ?? 0}`} />
            <StatCard label="XP Made" value={String(k.xpMade ?? 0)} sub={`of ${k.xpAttempts ?? 0}`} />
            <StatCard label="Games" value={String(gp)} />
            <StatCard label="Pts/Gm" value={perGame} />
          </div>
        );
      }
      case "DST": {
        const d = stats.Defense ?? {};
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Sacks" value={String(d.sacks ?? 0)} />
            <StatCard label="INT" value={String(d.defensiveInterceptions ?? 0)} />
            <StatCard label="Fum Rec" value={String(d.fumblesRecovered ?? 0)} />
            <StatCard label="DST TD" value={String(d.defTD ?? 0)} />
          </div>
        );
      }
      default:
        return <p className="text-slate-500 text-sm">{statLine}</p>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">2025 Season Stats</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{gp} games</span>
          <span className="text-lg font-bold text-emerald-700">{totalPts} pts</span>
        </div>
      </div>
      {renderStatRows()}
    </div>
  );
}

// ── Multi-season stats table ─────────────────────────────────────────────────
function n(v: number | undefined, decimals = 0): string {
  if (v === undefined || v === 0) return "—";
  return decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
}

function MultiSeasonStatsTable({
  pos,
  espnId,
  currentStats,
}: {
  pos: string;
  espnId: string;
  currentStats?: Tank01Stats;
}) {
  const { seasons, loading } = useESPNSeasonStats(espnId, pos);

  // Build current season row from Tank01 data
  const currentRow: SeasonStatRow | null = currentStats
    ? {
        season: 2025,
        gp: parseInt(String(currentStats.gamesPlayed ?? "0"), 10),
        passYds:    Number(currentStats.Passing?.passYds ?? 0),
        passTD:     Number(currentStats.Passing?.passTD ?? 0),
        passInt:    Number(currentStats.Passing?.int ?? 0),
        passAtt:    Number(currentStats.Passing?.passAttempts ?? 0),
        passCmp:    Number(currentStats.Passing?.passCompletions ?? 0),
        rushYds:    Number(currentStats.Rushing?.rushYds ?? 0),
        rushTD:     Number(currentStats.Rushing?.rushTD ?? 0),
        rushAtt:    Number(currentStats.Rushing?.carries ?? 0),
        rec:        Number(currentStats.Receiving?.receptions ?? 0),
        recYds:     Number(currentStats.Receiving?.recYds ?? 0),
        recTD:      Number(currentStats.Receiving?.recTD ?? 0),
        recTargets: Number(currentStats.Receiving?.targets ?? 0),
        fgMade:     Number(currentStats.Kicking?.fgMade ?? 0),
        fgAtt:      Number(currentStats.Kicking?.fgAttempts ?? 0),
        xpMade:     Number(currentStats.Kicking?.xpMade ?? 0),
        sacks:      Number(currentStats.Defense?.sacks ?? 0),
        defInt:     Number(currentStats.Defense?.defensiveInterceptions ?? 0),
        defTD:      Number(currentStats.Defense?.defTD ?? 0),
        fumblesRecovered: Number(currentStats.Defense?.fumblesRecovered ?? 0),
      }
    : null;

  // Compute WRC pts for the current season row
  if (currentRow && currentRow.gp > 0 && currentStats) {
    const wrcPts = calcFantasyPoints(currentStats, pos);
    currentRow.wrcPts = wrcPts;
    currentRow.wrcPtsPerGame = Math.round((wrcPts / currentRow.gp) * 10) / 10;
  }

  // Merge: Tank01 current row is authoritative for its season; ESPN fills prior years.
  // Deduplicate by season (first occurrence wins = Tank01 row), then sort newest-first.
  const merged: SeasonStatRow[] = [
    ...(currentRow && currentRow.gp > 0 ? [currentRow] : []),
    ...seasons.filter(s => !currentRow || s.season !== currentRow.season),
  ];
  const allRows: SeasonStatRow[] = merged.sort((a, b) => b.season - a.season);

  // Define columns per position
  type Col = { label: string; key: keyof SeasonStatRow; dec?: number; highlight?: boolean; gold?: boolean };

  const getColumns = (): Col[] => {
    const base: Col[] = [
      { label: "GP", key: "gp" },
      { label: "PTS/G", key: "wrcPtsPerGame", dec: 1, gold: true },
      { label: "WRC PTS", key: "wrcPts", dec: 1, gold: true },
    ];
    switch (pos) {
      case "QB":
        return [
          ...base,
          { label: "CMP", key: "passCmp" },
          { label: "ATT", key: "passAtt" },
          { label: "CMP%", key: "passCmpPct", dec: 1 },
          { label: "YDS", key: "passYds", highlight: true },
          { label: "TD", key: "passTD", highlight: true },
          { label: "INT", key: "passInt" },
          { label: "RUSH YDS", key: "rushYds" },
          { label: "RUSH TD", key: "rushTD" },
          { label: "FUM", key: "fumbles" },
        ];
      case "RB":
        return [
          ...base,
          { label: "CAR", key: "rushAtt" },
          { label: "RUSH YDS", key: "rushYds", highlight: true },
          { label: "AVG", key: "rushAvg", dec: 1 },
          { label: "RUSH TD", key: "rushTD", highlight: true },
          { label: "REC", key: "rec" },
          { label: "TGTS", key: "recTargets" },
          { label: "REC YDS", key: "recYds" },
          { label: "REC TD", key: "recTD" },
          { label: "FUM", key: "fumbles" },
        ];
      case "WR":
      case "TE":
        return [
          ...base,
          { label: "REC", key: "rec", highlight: true },
          { label: "TGTS", key: "recTargets" },
          { label: "YDS", key: "recYds", highlight: true },
          { label: "AVG", key: "recAvg", dec: 1 },
          { label: "TD", key: "recTD", highlight: true },
          { label: "FUM", key: "fumbles" },
        ];
      case "K":
        return [
          ...base,
          { label: "FGM", key: "fgMade", highlight: true },
          { label: "FGA", key: "fgAtt" },
          { label: "FG%", key: "fgPct", dec: 1 },
          { label: "XPM", key: "xpMade" },
          { label: "XPA", key: "xpAtt" },
        ];
      case "DST":
        return [
          ...base,
          { label: "SACK", key: "sacks", highlight: true },
          { label: "INT", key: "defInt", highlight: true },
          { label: "FR", key: "fumblesRecovered" },
          { label: "TD", key: "defTD", highlight: true },
        ];
      default:
        return base;
    }
  };

  const cols = getColumns();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">Season Stats</h2>
        </div>
        {loading && (
          <span className="text-xs text-slate-400 animate-pulse">Loading history…</span>
        )}
      </div>

      {allRows.length === 0 && !loading ? (
        <div className="px-6 py-8 text-center text-slate-400 text-sm">No stats available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: `${cols.length * 72}px` }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50 z-10 min-w-[56px]">Year</th>
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                      col.gold ? "text-amber-600 bg-amber-50/60" : col.highlight ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, i) => (
                <tr
                  key={row.season}
                  className={`border-b border-slate-50 ${
                    i === 0 ? "bg-emerald-50/60" : i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                  }`}
                >
                  <td className={`px-4 py-2.5 font-bold text-sm sticky left-0 z-10 ${
                    i === 0 ? "bg-emerald-50/60 text-emerald-800" : i % 2 === 0 ? "bg-white text-slate-900" : "bg-slate-50/40 text-slate-900"
                  }`}>
                    {row.season}
                    {i === 0 && <span className="ml-1.5 text-xs font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Latest</span>}
                  </td>
                  {cols.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        col.gold
                          ? "font-bold text-amber-700 bg-amber-50/40"
                          : col.highlight
                          ? "font-bold text-slate-900"
                          : "text-slate-600"
                      }`}
                    >
                      {n(row[col.key] as number | undefined, col.dec)}
                    </td>
                  ))}
                </tr>
              ))}
              {loading && seasons.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="px-4 py-3">
                    <div className="flex gap-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-8 flex-1 bg-slate-100 rounded animate-pulse" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Game Log Table component ─────────────────────────────────────────────────
function GameLogTable({ games, pos }: { games: GameLogEntry[]; pos: string }) {
  function fmt(v: number | undefined, dec = 0): string {
    if (!v) return "—";
    return dec > 0 ? v.toFixed(dec) : String(Math.round(v));
  }

  type GCol = { label: string; render: (g: GameLogEntry) => string; gold?: boolean; highlight?: boolean };

  const getCols = (): GCol[] => {
    const base: GCol[] = [
      { label: "WK",   render: (g) => { const m = g.gameDate.slice(4,6); const d = g.gameDate.slice(6,8); const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}`; } },
      { label: "OPP",  render: (g) => `${g.isHome ? "vs" : "@"} ${g.opponent}` },
      { label: "RESULT", render: (g) => g.result ?? "—" },
      { label: "WRC PTS", render: (g) => fmt(g.wrcPts, 1), gold: true },
    ];
    switch (pos) {
      case "QB": return [...base,
        { label: "CMP/ATT", render: (g) => g.passAtt ? `${g.passCmp}/${g.passAtt}` : "—" },
        { label: "YDS",     render: (g) => fmt(g.passYds), highlight: true },
        { label: "TD",      render: (g) => fmt(g.passTD),  highlight: true },
        { label: "INT",     render: (g) => fmt(g.passInt) },
        { label: "RUSH",    render: (g) => fmt(g.rushYds) },
        { label: "RTD",     render: (g) => fmt(g.rushTD) },
      ];
      case "RB": return [...base,
        { label: "CAR",     render: (g) => fmt(g.rushAtt) },
        { label: "YDS",     render: (g) => fmt(g.rushYds), highlight: true },
        { label: "TD",      render: (g) => fmt(g.rushTD),  highlight: true },
        { label: "REC",     render: (g) => fmt(g.rec) },
        { label: "REC YDS", render: (g) => fmt(g.recYds) },
        { label: "REC TD",  render: (g) => fmt(g.recTD) },
      ];
      case "WR":
      case "TE": return [...base,
        { label: "REC",     render: (g) => fmt(g.rec),    highlight: true },
        { label: "TGTS",    render: (g) => fmt(g.targets) },
        { label: "YDS",     render: (g) => fmt(g.recYds), highlight: true },
        { label: "TD",      render: (g) => fmt(g.recTD),  highlight: true },
      ];
      case "K": return [...base,
        { label: "FGM/A",   render: (g) => g.fgAtt ? `${g.fgMade}/${g.fgAtt}` : "—" },
        { label: "XPM/A",   render: (g) => g.xpAtt ? `${g.xpMade}/${g.xpAtt}` : "—" },
      ];
      case "DST": return [...base,
        { label: "SACK",    render: (g) => fmt(g.sacks),  highlight: true },
        { label: "INT",     render: (g) => fmt(g.defInt), highlight: true },
        { label: "TD",      render: (g) => fmt(g.defTD),  highlight: true },
      ];
      default: return base;
    }
  };

  const cols = getCols();

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {cols.map((col) => (
            <th
              key={col.label}
              className={`px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                col.gold ? "text-amber-600 bg-amber-50/60" : col.highlight ? "text-emerald-700" : "text-slate-500"
              }`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {games.map((game, i) => (
          <tr
            key={game.gameID}
            className={`border-b border-slate-50 ${
              i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
            }`}
          >
            {cols.map((col) => {
              const val = col.render(game);
              const isResult = col.label === "RESULT";
              const isW = isResult && val.startsWith("W");
              const isL = isResult && val.startsWith("L");
              return (
                <td
                  key={col.label}
                  className={`px-3 py-2.5 tabular-nums ${
                    col.gold ? "font-bold text-amber-700 bg-amber-50/40" :
                    col.highlight ? "font-bold text-slate-900" :
                    isW ? "font-semibold text-emerald-700" :
                    isL ? "font-semibold text-red-600" :
                    "text-slate-600"
                  }`}
                >
                  {val}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main PlayerPage ──────────────────────────────────────────────────────────
export default function PlayerPage() {
  const params = useParams<{ playerName: string }>();
  const [, navigate] = useLocation();
  const { franchise } = useAuth();
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const { isWatched, toggleWatch } = useWatchlist(franchise?.id);
  const [activeTab, setActiveTab] = useState<"stats" | "schedule" | "gamelog">("stats");
  const [gameLogSeason, setGameLogSeason] = useState(2026);

  // Decode the player name from the URL
  const rawName = params.playerName ?? "";
  const playerName = decodeURIComponent(rawName.replace(/-/g, " "));

  const { player, loading, error } = useTank01PlayerByName(playerName || null);

  // Find WRC ownership via live Supabase query
  const { ownership, ownerLoading: _ownerLoading } = usePlayerOwnership(playerName || null);
  const isFreeAgent = !ownership;

  // Live NFL matchup data for the current week
  const currentWeek = getCurrentWeek();
  const nflWeek = currentWeek > 0 ? currentWeek : 1; // default to week 1 pre-season
  const { matchups: matchupMap, loading: matchupLoading } = useNFLMatchups(nflWeek);
  const matchup = player?.team ? matchupMap[player.team] : undefined;

  // Schedule and game log
  const { schedule, loading: scheduleLoading } = useNFLTeamSchedule(player?.team ?? null, 2026);
  const { games: gameLog, loading: gameLogLoading } = useNFLGameLog(
    player?.playerID ?? null,
    player?.pos ?? "",
    gameLogSeason
  );

  // Injury info
  const injury = player?.injury;
  const hasInjury = injury && (injury.designation || injury.description);
  // suppress unused-var warnings
  void matchupLoading;
  void scheduleLoading;
  void gameLogLoading;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top nav bar ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-500 truncate">
            {playerName || "Player"}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* ── Loading state ── */}
        {loading && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex gap-5">
                <Skeleton className="w-28 h-28 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </div>
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-700 mb-1">Player not found</h2>
            <p className="text-slate-500 text-sm mb-4">
              Could not find stats for <strong>{playerName}</strong>. They may not be in the Tank01 database yet.
            </p>
            <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
          </div>
        )}

        {/* ── Player found ── */}
        {!loading && player && (
          <>
            {/* ── Hero card ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Dark header band */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-0">
                <div className="flex gap-5 items-end">
                  {/* Headshot */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={player.espnHeadshot}
                      alt={player.longName}
                      className="w-28 h-28 rounded-t-xl object-cover object-top bg-slate-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://a.espncdn.com/i/headshots/nfl/players/full/default.png";
                      }}
                    />
                    {/* Position badge */}
                    <span className={`absolute -top-2 -right-2 text-xs font-bold px-2 py-0.5 rounded-full ${POS_COLORS[player.pos] ?? "bg-slate-600 text-white"}`}>
                      {player.pos}
                    </span>
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-extrabold text-white leading-tight">
                        {player.longName}
                      </h1>
                      {player.jerseyNum && (
                        <span className="text-slate-400 text-lg font-semibold">#{player.jerseyNum}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {/* NFL team logo + name */}
                      <div className="flex items-center gap-1.5">
                        <img
                          src={getTeamLogoUrl(player.team)}
                          alt={player.team}
                          className="w-5 h-5 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <span className="text-slate-300 text-sm font-medium">{player.team}</span>
                      </div>
                      {/* Physical */}
                      {player.height && (
                        <span className="text-slate-400 text-sm">{player.height}, {player.weight} lbs</span>
                      )}
                      {/* Age / Exp */}
                      {player.age && (
                        <span className="text-slate-400 text-sm">Age {player.age} · {player.exp === "R" ? "Rookie" : `${player.exp} yr${Number(player.exp) !== 1 ? "s" : ""}`}</span>
                      )}
                    </div>
                  </div>

                  {/* Team logo large */}
                  <div className="hidden sm:block pb-2 opacity-20">
                    <img
                      src={getTeamLogoUrl(player.team)}
                      alt={player.team}
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Lower card: injury + ownership */}
              <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Injury tag */}
                {hasInjury ? (
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${injuryColor(injury.designation)}`}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    {injuryLabel(injury.designation)}
                    {injury.description && (
                      <span className="font-normal ml-1">— {injury.description}</span>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-green-700 bg-green-50">
                    <Zap className="w-3.5 h-3.5" />
                    Active
                  </div>
                )}

                <div className="flex-1" />

                {/* ESPN link */}
                <a
                  href={player.espnLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  View on ESPN →
                </a>
                {/* Watchlist star */}
                {franchise && (
                  <button
                    onClick={() => toggleWatch({ name: player.longName, pos: player.pos, nflTeam: player.team })}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
                    style={{
                      background: isWatched(player.longName) ? "oklch(0.96 0.06 85)" : "white",
                      borderColor: isWatched(player.longName) ? "oklch(0.75 0.14 85)" : "oklch(0.88 0.02 150)",
                      color: isWatched(player.longName) ? "oklch(0.45 0.16 85)" : "oklch(0.55 0.06 150)",
                    }}
                    title={isWatched(player.longName) ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={isWatched(player.longName) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {isWatched(player.longName) ? "Watching" : "Watch"}
                  </button>
                )}
              </div>
            </div>

            {/* ── Ownership card ── */}
            <div className={`rounded-2xl border shadow-sm px-4 py-3 ${isFreeAgent ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Logo or star icon */}
                  {isFreeAgent ? (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-200 shrink-0">
                      <Star className="w-5 h-5 text-amber-700" />
                    </div>
                  ) : (
                    <div className="shrink-0">
                      <TeamLogo teamName={ownership!.teamName} size={40} round />
                    </div>
                  )}
                  {/* Text info */}
                  <div className="min-w-0">
                    {isFreeAgent ? (
                      <>
                        <p className="text-sm font-bold text-amber-800 leading-tight">Free Agent</p>
                        <p className="text-xs text-amber-700 leading-tight">Available for FAAB bid</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-emerald-800 leading-tight truncate">{ownership!.teamName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-emerald-700">{ownership!.owner}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                            ownership!.acquisition === "Draft"
                              ? "bg-emerald-200 text-emerald-800"
                              : "bg-sky-100 text-sky-700"
                          }`}>
                            {ownership!.acquisition === "Draft" ? `Rd ${ownership!.round ?? "?"}` : "FA"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* FAAB bid button — only for free agents and signed-in users */}
                {isFreeAgent && franchise && (
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0"
                    onClick={() => setBidModalOpen(true)}
                  >
                    Bid
                  </Button>
                )}
              </div>
            </div>

            {/* ── Tab bar ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Tab buttons */}
              <div className="flex border-b border-slate-100">
                {([
                  { id: "stats",    label: "Stats",    icon: <BarChart2 className="w-4 h-4" /> },
                  { id: "schedule", label: "Schedule", icon: <Calendar className="w-4 h-4" /> },
                  { id: "gamelog",  label: "Game Log", icon: <ListOrdered className="w-4 h-4" /> },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Stats tab ── */}
              {activeTab === "stats" && (
                <div className="p-0">
                  <MultiSeasonStatsTable
                    pos={player.pos}
                    espnId={player.espnID || player.playerID}
                    currentStats={player.stats}
                  />
                </div>
              )}

              {/* ── Schedule tab ── */}
              {activeTab === "schedule" && (
                <div className="overflow-x-auto">
                  {schedule.length === 0 ? (
                    <div className="px-6 py-8 text-center text-slate-400 text-sm">
                      {scheduleLoading ? "Loading schedule…" : "Schedule not available"}
                    </div>
                  ) : (() => {
                    // Build a full 18-week list, inserting BYE rows for missing weeks
                    const gameByWeek = new Map(schedule.map((g) => [g.weekNum, g]));
                    const allWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
                    return (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Wk</th>
                            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Date</th>
                            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Opponent</th>
                            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Time</th>
                            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allWeeks.map((wk) => {
                            const game = gameByWeek.get(wk);
                            const isCurrentWeek = wk === currentWeek;
                            // BYE row
                            if (!game) {
                              return (
                                <tr key={`bye-${wk}`} className="border-b border-slate-50 bg-amber-50/40">
                                  <td className="px-4 py-2.5 font-bold text-amber-700 text-sm">{wk}</td>
                                  <td colSpan={4} className="px-3 py-2.5">
                                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">BYE WEEK</span>
                                  </td>
                                </tr>
                              );
                            }
                            const isFinal = game.gameStatus === "Final" || game.gameStatus === "Completed";
                            const result = isFinal && game.homeScore !== undefined
                              ? (() => {
                                  const myScore = game.isHome ? Number(game.homeScore) : Number(game.awayScore);
                                  const oppScore = game.isHome ? Number(game.awayScore) : Number(game.homeScore);
                                  const outcome = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T";
                                  return { outcome, myScore, oppScore };
                                })()
                              : null;
                            return (
                              <tr
                                key={game.gameID}
                                onClick={() => navigate(`/live?week=${wk}`)}
                                className={`border-b border-slate-50 cursor-pointer hover:bg-blue-50/60 transition-colors ${
                                  isCurrentWeek ? "bg-emerald-50/60" : wk % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                                }`}
                              >
                                <td className="px-4 py-2.5 font-bold text-slate-700 text-sm">
                                  {wk}
                                  {isCurrentWeek && <span className="ml-1.5 text-xs text-emerald-600 font-semibold">▶</span>}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{parseDate(game.gameDate)}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={getTeamLogoUrl(game.opponent)}
                                      alt={game.opponent}
                                      className="w-5 h-5 object-contain"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                    <span className="font-semibold text-slate-800">
                                      {game.isHome ? "vs" : "@"} {game.opponent}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{game.gameTime}</td>
                                <td className="px-3 py-2.5">
                                  {result ? (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                      result.outcome === "W" ? "bg-emerald-100 text-emerald-700" :
                                      result.outcome === "L" ? "bg-red-100 text-red-700" :
                                      "bg-slate-100 text-slate-600"
                                    }`}>
                                      {result.outcome} {result.myScore}–{result.oppScore}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">{game.gameStatus === "Scheduled" ? "—" : game.gameStatus}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}

              {/* ── Game Log tab ── */}
              {activeTab === "gamelog" && (
                <div>
                  {/* Season selector */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Season</span>
                    <div className="flex gap-1">
                      {[2026, 2025, 2024, 2023, 2022].map((yr) => (
                        <button
                          key={yr}
                          onClick={() => setGameLogSeason(yr)}
                          className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                            gameLogSeason === yr
                              ? "bg-emerald-600 text-white"
                              : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {gameLog.length === 0 ? (
                      <div className="px-6 py-8 text-center text-slate-400 text-sm">
                        {gameLogLoading
                          ? `Loading ${gameLogSeason} game log…`
                          : gameLogSeason === 2026
                          ? "No 2026 game log yet — check back once the season starts on September 9, 2026."
                          : `No game log found for ${gameLogSeason}.`}
                      </div>
                    ) : (
                      <GameLogTable games={gameLog} pos={player.pos} />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── This week's matchup (outside tabs, always visible) ── */}
            {currentWeek >= 1 && currentWeek <= 17 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">Week {currentWeek} Matchup</h2>
                </div>
                {matchup ? (
                  <div className="flex items-center gap-4">
                    <img src={getTeamLogoUrl(player.team)} alt={player.team} className="w-10 h-10 object-contain" />
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatMatchup(matchup)}
                      </p>
                      <p className="text-xs text-slate-500">{formatGameTime(matchup)}</p>
                    </div>
                    <div className="flex-1" />
                    <img src={getTeamLogoUrl(matchup.opponent)} alt={matchup.opponent} className="w-10 h-10 object-contain" />
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">
                    {currentWeek === 0
                      ? "Season starts September 9, 2026 — Week 1 schedule loading..."
                      : `${player.team} has a bye this week`}
                  </p>
                )}
              </div>
            )}

            {/* ── Pre-season notice ── */}
            {currentWeek === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">Pre-Season</span>
                </div>
                <p className="text-sm text-blue-700">
                  Stats shown are from the 2025 NFL season. 2026 stats will update automatically once the season begins on September 9, 2026.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FAAB Bid Modal ── */}
      {bidModalOpen && player && franchise && (
        <FAABBidModal
          player={{
            id: player.playerID,
            name: player.longName,
            pos: player.pos,
            nflTeam: player.team,
          }}
          onClose={() => setBidModalOpen(false)}
        />
      )}
    </div>
  );
}
