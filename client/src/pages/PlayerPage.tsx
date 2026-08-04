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
import { calcFantasyPoints, getStatLine, getPerGameAvg, injuryColor, injuryLabel, type Tank01Stats } from "@/lib/scoringEngine";
import { TEAMS } from "@/lib/wrcData";
import { getCurrentWeek } from "@/lib/scheduleData2026";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, TrendingUp, Shield, Zap, AlertCircle, Calendar, User } from "lucide-react";
import { useState } from "react";
import FAABBidModal from "@/components/FAABBidModal";
import { useAuth } from "@/contexts/AuthContext";

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

// ── Ownership lookup ─────────────────────────────────────────────────────────
function findOwner(playerName: string) {
  for (const team of TEAMS) {
    const found = team.players.find(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (found) return { team, player: found };
  }
  return null;
}

// ── This week's NFL matchup ──────────────────────────────────────────────────
interface NFLMatchup { opponent: string; isHome: boolean; week: number; }
function getThisWeekMatchup(_nflTeamAbv: string): NFLMatchup | null {
  // SCHEDULE_2026 tracks WRC fantasy matchups, not NFL game schedules.
  // NFL game schedule lookup requires a separate API call — return null for now.
  return null;
}

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

// ── Main PlayerPage ──────────────────────────────────────────────────────────
export default function PlayerPage() {
  const params = useParams<{ playerName: string }>();
  const [, navigate] = useLocation();
  const { franchise } = useAuth();
  const [bidModalOpen, setBidModalOpen] = useState(false);

  // Decode the player name from the URL
  const rawName = params.playerName ?? "";
  const playerName = decodeURIComponent(rawName.replace(/-/g, " "));

  const { player, loading, error } = useTank01PlayerByName(playerName || null);

  // Find WRC ownership
  const ownership = playerName ? findOwner(playerName) : null;
  const isFreeAgent = !ownership;

  // NFL matchup this week
  const matchup = player ? getThisWeekMatchup(player.team) : null;
  const currentWeek = getCurrentWeek();

  // Injury info
  const injury = player?.injury;
  const hasInjury = injury && (injury.designation || injury.description);

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
              </div>
            </div>

            {/* ── Ownership card ── */}
            <div className={`rounded-2xl border shadow-sm p-5 ${isFreeAgent ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isFreeAgent ? "bg-amber-200" : "bg-emerald-200"}`}>
                    {isFreeAgent ? <Star className="w-5 h-5 text-amber-700" /> : <User className="w-5 h-5 text-emerald-700" />}
                  </div>
                  <div>
                    {isFreeAgent ? (
                      <>
                        <p className="text-sm font-bold text-amber-800">Free Agent</p>
                        <p className="text-xs text-amber-700">Available for FAAB bid</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-emerald-800">
                          {ownership!.team.teamName}
                        </p>
                        <p className="text-xs text-emerald-700">
                          Owner: {ownership!.team.owner} · {ownership!.player.acquisition === "Draft" ? `Round ${ownership!.player.round ?? "?"}` : "FA Pickup"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* FAAB bid button — only for free agents and signed-in users */}
                {isFreeAgent && franchise && (
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    onClick={() => setBidModalOpen(true)}
                  >
                    Place FAAB Bid
                  </Button>
                )}
              </div>
            </div>

            {/* ── Season stats ── */}
            {player.stats && <StatsSection player={player} />}

            {/* ── This week's matchup ── */}
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
                        {matchup.isHome ? "vs." : "@"}{" "}
                        <span className="text-blue-700">{matchup.opponent.toUpperCase()}</span>
                      </p>
                      <p className="text-xs text-slate-500">{matchup.isHome ? "Home" : "Away"} game</p>
                    </div>
                    <div className="flex-1" />
                    <img src={getTeamLogoUrl(matchup.opponent)} alt={matchup.opponent} className="w-10 h-10 object-contain" />
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">
                    {currentWeek === 0
                      ? "Season starts September 9, 2026"
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
