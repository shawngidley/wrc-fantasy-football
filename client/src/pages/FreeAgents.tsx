/**
 * WRC Fantasy Football — Free Agents / FAAB Waiver Wire
 * Design: WRC dark-green/gold aesthetic matching the rest of the app
 *
 * - Loads all WRC-owned players from Supabase `players` table (team_id != null)
 * - Free agents = NFL_PLAYERS_2026 players NOT in the owned set
 * - Position filter tabs: ALL | QB | RB | WR | TE | K | DST
 * - Sort by: Projected Pts (default), ADP, Name
 * - Each row links to /player/:name for the full player page
 * - "Bid" button opens FAABBidModal for signed-in users
 * - Commissioner sees all pending bids in a separate tab
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { NFL_PLAYERS_2026, type NFLPlayer } from "@/lib/nflPlayers2026";
import { getTeamLogoUrl } from "@/hooks/useTank01Player";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeek } from "@/lib/scheduleData2026";
import { useNFLProjections, getProjectedPoints } from "@/hooks/useNFLProjections";
import { useNFLInjuries, getInjuryDesignation, getInjuryColor, getInjuryLabel } from "@/hooks/useNFLInjuries";
import FAABBidModal from "@/components/FAABBidModal";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Search, DollarSign, ChevronRight, Trophy, Clock, ArrowUpDown, ArrowUp, ArrowDown, Users, ArrowLeftRight, Star, Bookmark } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { useNFLDepthCharts } from "@/hooks/useNFLDepthCharts";
import { useNFLSeasonStats } from "@/hooks/useNFLSeasonStats";
import { formatSeasonStatColumn, getSeasonStatColumns, type SeasonStatColumn, type SeasonStatKey } from "@/lib/playerSeasonStats";

// ── Position badge colors ────────────────────────────────────────────────────
const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  QB:  { bg: "oklch(0.95 0.04 25)",  text: "oklch(0.45 0.18 25)",  border: "oklch(0.82 0.1 25)" },
  RB:  { bg: "oklch(0.95 0.04 150)", text: "oklch(0.38 0.14 150)", border: "oklch(0.80 0.1 150)" },
  WR:  { bg: "oklch(0.94 0.04 240)", text: "oklch(0.40 0.14 240)", border: "oklch(0.78 0.1 240)" },
  TE:  { bg: "oklch(0.95 0.04 60)",  text: "oklch(0.45 0.16 60)",  border: "oklch(0.82 0.1 60)" },
  K:   { bg: "oklch(0.94 0.04 300)", text: "oklch(0.42 0.14 300)", border: "oklch(0.80 0.1 300)" },
  DST: { bg: "oklch(0.94 0.02 200)", text: "oklch(0.40 0.08 200)", border: "oklch(0.78 0.06 200)" },
};

function PosBadge({ pos }: { pos: string }) {
  const c = POS_COLORS[pos] ?? { bg: "oklch(0.94 0.02 200)", text: "oklch(0.4 0.06 200)", border: "oklch(0.78 0.04 200)" };
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 5, padding: "1px 6px", fontFamily: "Barlow Condensed, sans-serif",
      fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.06em",
    }}>{pos}</span>
  );
}

// ── Pending bid interface ────────────────────────────────────────────────────
interface FaabBid {
  id: string;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  player_pos: string;
  player_nfl_team: string;
  bid_amount: number;
  drop_player_name: string | null;
  status: string;
  week: number;
  created_at: string;
}

// ── Commissioner bid management ──────────────────────────────────────────────
function CommissionerBids({ week }: { week: number }) {
  const [bids, setBids] = useState<FaabBid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("faab_bids")
      .select("*")
      .eq("week", week)
      .order("player_name", { ascending: true })
      .order("bid_amount", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setBids(data as FaabBid[]);
        setLoading(false);
      });
  }, [week]);

  const handleAward = async (bid: FaabBid) => {
    const { error: winErr } = await supabase
      .from("faab_bids")
      .update({ status: "won", resolved_at: new Date().toISOString() })
      .eq("id", bid.id);

    const { error: loseErr } = await supabase
      .from("faab_bids")
      .update({ status: "lost", resolved_at: new Date().toISOString() })
      .eq("player_id", bid.player_id)
      .eq("week", week)
      .neq("id", bid.id);

    // Deduct FAAB from winning team
    const { data: teamData } = await supabase
      .from("teams")
      .select("faab")
      .eq("id", bid.team_id)
      .single();

    if (teamData) {
      await supabase
        .from("teams")
        .update({ faab: Math.max(0, (teamData.faab ?? 1000) - bid.bid_amount) })
        .eq("id", bid.team_id);
    }

    // Add player to team's roster in players table
    const { error: addErr } = await supabase
      .from("players")
      .update({ team_id: bid.team_id, acquisition: "FA" })
      .eq("name", bid.player_name);

    // Drop player if specified
    if (bid.drop_player_name) {
      await supabase
        .from("players")
        .update({ team_id: null, acquisition: "FA" })
        .eq("name", bid.drop_player_name)
        .eq("team_id", bid.team_id);
    }

    if (winErr || loseErr || addErr) {
      toast.error("Failed to process bid.");
    } else {
      toast.success(`${bid.player_name} awarded to ${bid.team_name}!`);
      // Write ADD transaction to roster_moves
      await supabase.from("roster_moves").insert({
        move_type: "ADD",
        team_name: bid.team_name,
        owner: bid.team_name,
        player_name: bid.player_name,
        player_pos: bid.player_pos,
        player_nfl_team: bid.player_nfl_team,
        faab_spent: bid.bid_amount,
        note: `FAAB $${bid.bid_amount} — Week ${bid.week}`,
      });
      // Write DROP transaction if a player was dropped
      if (bid.drop_player_name) {
        await supabase.from("roster_moves").insert({
          move_type: "DROP",
          team_name: bid.team_name,
          owner: bid.team_name,
          player_name: bid.drop_player_name,
          player_pos: "—",
          player_nfl_team: "FA",
          faab_spent: null,
          note: `Dropped to make room for ${bid.player_name}`,
        });
      }
      setBids((prev) =>
        prev.map((b) =>
          b.id === bid.id
            ? { ...b, status: "won" }
            : b.player_id === bid.player_id
            ? { ...b, status: "lost" }
            : b
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="wrc-card" style={{ padding: "2rem", textAlign: "center" as const }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", color: "oklch(0.55 0.08 150)" }}>Loading bids...</div>
      </div>
    );
  }

  if (bids.length === 0) {
    return (
      <div className="wrc-card" style={{ padding: "3rem 2rem", textAlign: "center" as const }}>
        <div className="wrc-card-gold-stripe" />
        <Clock size={36} color="oklch(0.75 0.08 150)" style={{ margin: "0 auto 0.75rem" }} />
        <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.35 0.08 150)" }}>No FAAB bids for Week {week} yet.</p>
        <p style={{ fontSize: "0.8rem", color: "oklch(0.55 0.06 150)", marginTop: "0.25rem" }}>Bids will appear here as managers submit them.</p>
      </div>
    );
  }

  // Group by player
  const byPlayer: Record<string, FaabBid[]> = {};
  for (const bid of bids) {
    if (!byPlayer[bid.player_name]) byPlayer[bid.player_name] = [];
    byPlayer[bid.player_name].push(bid);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
      <div style={{ background: "oklch(0.96 0.04 85)", border: "1.5px solid oklch(0.82 0.12 85)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.8rem", color: "oklch(0.38 0.14 85)", fontFamily: "Barlow Condensed, sans-serif" }}>
        <strong>COMMISSIONER VIEW</strong> — All bids are visible. Click "Award" to assign a player. Other bids for the same player will be marked as lost and FAAB deducted from the winner.
      </div>
      {Object.entries(byPlayer).map(([playerName, playerBids]) => (
        <div key={playerName} className="wrc-card" style={{ overflow: "hidden" }}>
          <div className="wrc-card-gold-stripe" />
          <div style={{ background: "oklch(0.96 0.02 150)", padding: "0.6rem 1rem", borderBottom: "1px solid oklch(0.9 0.04 150)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <PosBadge pos={playerBids[0].player_pos} />
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{playerName}</span>
              <span style={{ fontSize: "0.75rem", color: "oklch(0.55 0.06 150)" }}>· {playerBids[0].player_nfl_team}</span>
            </div>
            <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.06 150)", fontFamily: "Barlow Condensed, sans-serif" }}>{playerBids.length} bid{playerBids.length !== 1 ? "s" : ""}</span>
          </div>
          <div>
            {playerBids.map((bid) => (
              <div key={bid.id} style={{
                padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem",
                borderBottom: "1px solid oklch(0.94 0.02 150)",
                background: bid.status === "won" ? "oklch(0.96 0.04 150)" : bid.status === "lost" ? "oklch(0.97 0.01 25)" : "white",
                opacity: bid.status === "lost" ? 0.6 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.08 150)", margin: 0 }}>{bid.team_name}</p>
                  {bid.drop_player_name && (
                    <p style={{ fontSize: "0.72rem", color: "oklch(0.55 0.06 150)", margin: 0 }}>Drops: {bid.drop_player_name}</p>
                  )}
                </div>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "oklch(0.42 0.15 150)" }}>${bid.bid_amount}</span>
                {bid.status === "pending" ? (
                  <button
                    onClick={() => handleAward(bid)}
                    style={{ background: "oklch(0.42 0.15 150)", color: "white", border: "none", borderRadius: 7, padding: "0.3rem 0.75rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", letterSpacing: "0.04em" }}
                  >
                    Award
                  </button>
                ) : (
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.72rem",
                    padding: "0.2rem 0.5rem", borderRadius: 5,
                    background: bid.status === "won" ? "oklch(0.88 0.1 150)" : "oklch(0.92 0.04 25)",
                    color: bid.status === "won" ? "oklch(0.35 0.12 150)" : "oklch(0.45 0.1 25)",
                  }}>
                    {bid.status === "won" ? "WON" : "LOST"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sort options ─────────────────────────────────────────────────────────────
type SortKey = "name" | "bye" | "proj" | "adp" | SeasonStatKey;
type SortDirection = "asc" | "desc";

const SFLEX_COLUMNS: SeasonStatColumn[] = [
  { label: "GP", key: "gp" },
  { label: "PASS YDS", key: "passYds" },
  { label: "PASS TD", key: "passTD" },
  { label: "INT", key: "passInt" },
  { label: "RUSH YDS", key: "rushYds" },
  { label: "RUSH TD", key: "rushTD" },
  { label: "REC", key: "receptions" },
  { label: "TGT", key: "targets" },
  { label: "REC YDS", key: "recYds" },
  { label: "REC TD", key: "recTD" },
  { label: "WRC PTS", key: "wrcPts", decimals: 1, gold: true },
  { label: "PTS/G", key: "ptsPerGame", decimals: 1, gold: true },
];

// ── Main FreeAgents page ─────────────────────────────────────────────────────
export default function FreeAgents() {
  const { franchise } = useAuth();
  const [posFilter, setPosFilter] = useState<string>("SFLEX");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("proj");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [bidPlayer, setBidPlayer] = useState<NFLPlayer | null>(null);
  const [activeTab, setActiveTab] = useState<"pool" | "bids">("pool");
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());
  const [loadingOwned, setLoadingOwned] = useState(true);
  const [playerScope, setPlayerScope] = useState<"fa" | "all">("fa");
  const [ownershipMap, setOwnershipMap] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<"pool" | "watchlist">("pool");
  const tableStatsScrollRef = useRef<HTMLDivElement>(null);
  const [statsScrollPercent, setStatsScrollPercent] = useState(0);

  // Watchlist hook
  const { watchlist, isWatched, toggleWatch } = useWatchlist(franchise?.id);

  const currentWeek = getCurrentWeek();
  const week = currentWeek > 0 ? currentWeek : 1;

  // Load owned player names from Supabase
  useEffect(() => {
    supabase
      .from("players")
      .select("name, team_id, teams(name)")
      .not("team_id", "is", null)
      .then(({ data }) => {
        if (data) {
          const names = new Set<string>();
          const ownerMap: Record<string, string> = {};
          for (const p of (data as unknown) as Array<{ name: string; team_id: string; teams: { name: string } | { name: string }[] | null }>) {
            names.add(p.name.toLowerCase());
            const teamName = Array.isArray(p.teams) ? (p.teams[0]?.name ?? p.team_id) : (p.teams?.name ?? p.team_id);
            ownerMap[p.name.toLowerCase()] = teamName;
          }
          setOwnedNames(names);
          setOwnershipMap(ownerMap);
        }
        setLoadingOwned(false);
      });
  }, []);

  // Live projections for sorting
  const { projections, loading: projectionsLoading } = useNFLProjections(week);

  // Injury designations
  const { injuries } = useNFLInjuries();
  const { depthMap } = useNFLDepthCharts();

  // Free agents = players in NFL_PLAYERS_2026 not owned
  const freeAgents = useMemo(() => {
    if (loadingOwned) return [];
    return NFL_PLAYERS_2026.filter((p) => !ownedNames.has(p.name.toLowerCase()));
  }, [ownedNames, loadingOwned]);

  const allPlayers = useMemo(() => NFL_PLAYERS_2026, []);

  // Filter + search. Sorting is applied after Tank01 season stats load so every
  // market and stat column can be used as a sort key.
  const baseFiltered = useMemo(() => {
    let list = playerScope === "fa" ? freeAgents : allPlayers;
    if (posFilter === "SFLEX") {
      list = list.filter((p) => ["QB", "RB", "WR", "TE"].includes(p.pos));
    } else {
      list = list.filter((p) => p.pos === posFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.nflTeam.toLowerCase().includes(q)
      );
    }
    return list;
  }, [freeAgents, allPlayers, playerScope, posFilter, search]);

  const seasonStatPlayers = useMemo(
    () => baseFiltered.map((player) => ({ name: player.name, pos: player.pos })),
    [baseFiltered]
  );
  const { statMap: seasonStatMap, loading: seasonStatsLoading, loadedCount: seasonStatsLoaded } = useNFLSeasonStats(seasonStatPlayers, true);
  const seasonColumns = useMemo(
    () => posFilter === "SFLEX" ? SFLEX_COLUMNS : getSeasonStatColumns(posFilter),
    [posFilter]
  );
  const statsGridColumns = useMemo(
    () => `210px 48px 62px 62px ${seasonColumns.map(() => "minmax(76px, auto)").join(" ")} 76px 30px`,
    [seasonColumns]
  );
  const statsTableMinWidth = useMemo(
    () => 210 + 48 + 62 + 62 + 76 * seasonColumns.length + 76 + 30,
    [seasonColumns]
  );

  const setTableScrollPercent = (percent: number) => {
    const nextPercent = Math.min(100, Math.max(0, percent));
    const table = tableStatsScrollRef.current;
    if (table) table.scrollLeft = (table.scrollWidth - table.clientWidth) * (nextPercent / 100);
    setStatsScrollPercent(nextPercent);
  };

  const handleTableScroll = () => {
    const table = tableStatsScrollRef.current;
    if (!table) return;
    const scrollableWidth = table.scrollWidth - table.clientWidth;
    setStatsScrollPercent(scrollableWidth > 0 ? (table.scrollLeft / scrollableWidth) * 100 : 0);
  };

  const filtered = useMemo(() => {
    const getValue = (player: NFLPlayer): string | number => {
      if (sortKey === "name") return player.name;
      if (sortKey === "bye") return player.bye ?? 99;
      if (sortKey === "proj") return getProjectedPoints(projections, player.name, player.pos, player.nflTeam);
      if (sortKey === "adp") return player.adp;
      return seasonStatMap[player.name.toLowerCase()]?.[sortKey] ?? -1;
    };

    return [...baseFiltered].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      const comparison = typeof aValue === "string" && typeof bValue === "string"
        ? aValue.localeCompare(bValue)
        : Number(aValue) - Number(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [baseFiltered, projections, seasonStatMap, sortDirection, sortKey]);

  const handleSort = (nextKey: SortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "name" || nextKey === "bye" || nextKey === "adp" ? "asc" : "desc");
  };

  const tableHeaders = useMemo(
    () => [
      { label: "Player", key: "name" as SortKey, align: "left" as const },
      { label: "Bye", key: "bye" as SortKey },
      { label: "Proj", key: "proj" as SortKey },
      { label: "ADP", key: "adp" as SortKey },
      ...seasonColumns.map((column) => ({ label: column.label, key: column.key as SortKey, column })),
      { label: "Action" },
      { label: "" },
    ],
    [seasonColumns]
  );

  const positions = ["SFLEX", "QB", "RB", "WR", "TE", "K", "DST"];
  const isCommissioner = franchise?.is_commissioner;
  const faabBalance = franchise?.faab ?? 1000;

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      {/* ── Header ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 0.75rem 0" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "0.75rem" }}>
            <div>
              <h1>Free Agents</h1>
              <p>
                {loadingOwned ? "Loading..." : `${freeAgents.length} available`}
                {" · "}FAAB blind auction
                {currentWeek > 0 ? ` · Week ${currentWeek}` : " · Pre-Season"}
              </p>
            </div>
            {franchise && (
              <div style={{ background: "oklch(0.22 0.08 150)", border: "1.5px solid oklch(0.55 0.16 85)", borderRadius: 12, padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <DollarSign size={16} color="oklch(0.75 0.18 85)" />
                <div>
                  <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.65 0.1 85)", margin: 0 }}>FAAB BALANCE</p>
                  <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.2rem", fontWeight: 800, color: "oklch(0.85 0.18 85)", margin: 0 }}>${faabBalance}</p>
                </div>
              </div>
            )}
          </div>

          {/* Tab switcher (commissioner sees bids tab) */}
          {/* Scope toggle: Free Agents / All Players — always visible */}
          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.75rem", flexWrap: "wrap" as const }}>
            {([
              { key: "fa", label: "Free Agents", icon: null },
              { key: "all", label: "All Players", icon: <Users size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} /> },
              { key: "watchlist" as unknown as "fa" | "all", label: `Watchlist${watchlist.length > 0 ? ` (${watchlist.length})` : ""}`, icon: <Star size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} /> },
            ] as { key: "fa" | "all"; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => {
                  if ((key as string) === "watchlist") { setActiveView("watchlist"); }
                  else { setPlayerScope(key); setActiveView("pool"); }
                }}
                style={{
                  padding: "0.4rem 0.875rem", borderRadius: 8,
                  border: ((key as string) === "watchlist" ? activeView === "watchlist" : activeView === "pool" && playerScope === key) ? "2px solid oklch(0.55 0.16 85)" : "2px solid oklch(0.88 0.04 150)",
                  background: ((key as string) === "watchlist" ? activeView === "watchlist" : activeView === "pool" && playerScope === key) ? "oklch(0.22 0.08 150)" : "white",
                  color: ((key as string) === "watchlist" ? activeView === "watchlist" : activeView === "pool" && playerScope === key) ? "white" : "oklch(0.4 0.04 150)",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700,
                  letterSpacing: "0.04em", cursor: "pointer",
                }}
              >
                {icon}{label}
              </button>
            ))}
            {isCommissioner && (
              <button
                onClick={() => setActiveTab(activeTab === "bids" ? "pool" : "bids")}
                style={{
                  padding: "0.4rem 0.875rem", borderRadius: 8,
                  border: activeTab === "bids" ? "2px solid oklch(0.55 0.16 85)" : "2px solid oklch(0.88 0.04 150)",
                  background: activeTab === "bids" ? "oklch(0.22 0.08 150)" : "white",
                  color: activeTab === "bids" ? "white" : "oklch(0.4 0.04 150)",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700,
                  letterSpacing: "0.04em", cursor: "pointer",
                }}
              >
                <Trophy size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                Manage Bids
              </button>
            )}
          </div>
        </div>

        {activeTab === "bids" && isCommissioner ? (
          <CommissionerBids week={week} />
        ) : (
          activeView === "watchlist" ? (
            /* ── Watchlist Tab ── */
            <div className="wrc-card" style={{ marginTop: "1rem" }}>
              <div className="wrc-card-gold-stripe" />
              <div style={{ padding: "0.875rem 1rem 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Star size={15} color="oklch(0.55 0.16 85)" fill="oklch(0.55 0.16 85)" />
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", fontWeight: 800, color: "oklch(0.18 0.06 150)", flex: 1 }}>My Watchlist</span>
                <span style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)" }}>{watchlist.length} player{watchlist.length !== 1 ? "s" : ""}</span>
              </div>
              {watchlist.length === 0 ? (
                <div style={{ padding: "3rem 2rem", textAlign: "center" as const }}>
                  <Star size={36} color="oklch(0.75 0.06 150)" style={{ margin: "0 auto 0.75rem" }} />
                  <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.4 0.08 150)" }}>No players on your watchlist</p>
                  <p style={{ fontSize: "0.8rem", color: "oklch(0.55 0.06 150)", marginTop: "0.25rem" }}>Tap the ★ star on any player to add them here</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 60px 80px", gap: "0.25rem", padding: "0.5rem 0.75rem", background: "oklch(0.96 0.02 150)", borderBottom: "1px solid oklch(0.9 0.04 150)" }}>
                    {["Player", "Bye", "Proj", "Action"].map((h, i) => (
                      <span key={i} style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.55 0.06 150)", textAlign: i > 0 ? "center" as const : "left" as const }}>{h}</span>
                    ))}
                  </div>
                  {watchlist.map((wp) => {
                    const player = [...(NFL_PLAYERS_2026 as NFLPlayer[])].find(p => p.name.toLowerCase() === wp.player_name.toLowerCase()) ?? {
                      id: wp.player_name, name: wp.player_name, pos: wp.pos, nflTeam: wp.nfl_team, adp: 999, bye: undefined,
                    } as unknown as NFLPlayer;
                    const proj = getProjectedPoints(projections, player.name, player.pos, player.nflTeam);
                    const ownerTeam = ownershipMap[player.name.toLowerCase()];
                    const isOwned = !!ownerTeam;
                    const isMyPlayer = franchise && ownerTeam === franchise.team_name;
                    return (
                      <div key={wp.player_name} style={{ display: "grid", gridTemplateColumns: "1fr 48px 60px 80px", gap: "0.25rem", padding: "0.5rem 0.75rem", alignItems: "center", borderBottom: "1px solid oklch(0.94 0.02 150)", background: "white" }}>
                        <Link href={`/player/${encodeURIComponent(player.name)}`} style={{ display: "flex", alignItems: "center", gap: "0.4rem", textDecoration: "none", minWidth: 0, overflow: "hidden" }}>
                          <img src={getTeamLogoUrl(player.nflTeam)} alt={player.nflTeam} style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.22 0.08 150)", margin: 0, lineHeight: 1.2 }}>{player.name}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: 1 }}>
                              <PosBadge pos={player.pos} />
                              <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.06 150)" }}>{player.nflTeam}</span>
                              {isOwned && <span style={{ fontSize: "0.65rem", color: "oklch(0.42 0.1 240)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, background: "oklch(0.92 0.04 240)", border: "1px solid oklch(0.78 0.08 240)", borderRadius: 4, padding: "0px 4px" }}>{ownerTeam}</span>}
                            </div>
                          </div>
                        </Link>
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", color: "oklch(0.5 0.06 150)", textAlign: "center" as const }}>{player.bye ?? "—"}</span>
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: proj > 0 ? "oklch(0.38 0.14 150)" : "oklch(0.65 0.06 150)", textAlign: "center" as const }}>{proj > 0 ? proj.toFixed(1) : "—"}</span>
                        <div style={{ display: "flex", gap: "0.25rem", justifyContent: "center", alignItems: "center" }}>
                          {/* Star/unstar button */}
                          <button onClick={() => toggleWatch({ name: player.name, pos: player.pos, nflTeam: player.nflTeam })} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.15rem", color: "oklch(0.55 0.16 85)", display: "flex", alignItems: "center" }} title="Remove from watchlist">
                            <Star size={14} fill="oklch(0.55 0.16 85)" />
                          </button>
                          {/* Action button */}
                          {isMyPlayer ? (
                            <span style={{ fontSize: "0.65rem", color: "oklch(0.42 0.14 150)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, background: "oklch(0.92 0.06 150)", border: "1px solid oklch(0.78 0.1 150)", borderRadius: 4, padding: "2px 5px" }}>Roster</span>
                          ) : isOwned ? (
                            <Link href="/trades" style={{ background: "oklch(0.42 0.1 240)", color: "white", border: "none", borderRadius: 6, padding: "0.25rem 0.45rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem", textDecoration: "none" }}>
                              <ArrowLeftRight size={9} />Trade
                            </Link>
                          ) : franchise ? (
                            <button onClick={() => setBidPlayer(player as NFLPlayer)} style={{ background: "oklch(0.55 0.16 85)", color: "white", border: "none", borderRadius: 6, padding: "0.25rem 0.45rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                              <DollarSign size={9} />Bid
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.65rem", color: "oklch(0.6 0.06 150)" }}>Sign in</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
          <>
            {/* ── Filters ── */}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.6rem", marginBottom: "1rem" }}>
              {/* Search row — sorting is controlled from every table header */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
                <div style={{ position: "relative" as const, flex: 1, minWidth: 200 }}>
                  <Search size={14} color="oklch(0.55 0.06 150)" style={{ position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <Input
                    placeholder="Search players or teams..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: "2rem", background: "white", borderColor: "oklch(0.85 0.04 150)" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0 0.2rem", color: "rgba(255,255,255,0.72)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em" }}>
                  <ArrowUpDown size={13} />
                  TAP A COLUMN TO SORT
                </div>
              </div>
              {/* Position tabs */}
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" as const }}>
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPosFilter(pos)}
                    style={{
                      padding: "0.3rem 0.65rem", borderRadius: 7,
                      border: posFilter === pos ? "2px solid oklch(0.55 0.16 85)" : "2px solid rgba(255,255,255,0.2)",
                      background: posFilter === pos ? "oklch(0.22 0.08 150)" : "rgba(255,255,255,0.08)",
                      color: posFilter === pos ? "white" : "rgba(255,255,255,0.7)",
                      fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700,
                      letterSpacing: "0.04em", cursor: "pointer",
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Pre-season notice ── */}
            {currentWeek === 0 && (
              <div style={{ background: "oklch(0.94 0.04 240)", border: "1.5px solid oklch(0.78 0.1 240)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "0.75rem", fontSize: "0.8rem", color: "oklch(0.35 0.12 240)", fontFamily: "Barlow Condensed, sans-serif" }}>
                <strong>PRE-SEASON:</strong> Player pool shows 2026 ADP rankings. FAAB bidding opens when the season starts on September 9, 2026.
              </div>
            )}

            {/* ── Player count ── */}
            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginBottom: "0.5rem" }}>
              Showing <strong style={{ color: "rgba(255,255,255,0.85)" }}>{filtered.length}</strong> {playerScope === "all" ? "player" : "free agent"}{filtered.length !== 1 ? "s" : ""}
              {posFilter === "SFLEX" ? " · Superflex eligible" : ` at ${posFilter}`}
              {search ? ` matching "${search}"` : ""}
            </p>

            <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", margin: "-0.1rem 0 0.65rem" }}>
              <strong style={{ color: "oklch(0.78 0.15 85)" }}>FULL STATS:</strong> Use the scroll rail below or swipe the table to see every stat column.
              {seasonStatsLoading ? ` Loading season totals (${seasonStatsLoaded}/${filtered.length})…` : ""}
            </p>

            {/* ── Top horizontal scroll rail ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem", color: "rgba(255,255,255,0.78)" }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.67rem", fontWeight: 800, letterSpacing: "0.07em", whiteSpace: "nowrap" }}>STATS SCROLL</span>
              <input
                className="wrc-stats-scroll-slider"
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={statsScrollPercent}
                onChange={(event) => setTableScrollPercent(Number(event.target.value))}
                aria-label="Scroll Free Agents stat columns horizontally"
                style={{ flex: 1 }}
              />
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.67rem", fontWeight: 800, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>← MOVE →</span>
            </div>

            {/* ── Player list ── */}
            <div className="wrc-card" style={{ overflow: "hidden", marginBottom: "2rem" }}>
              <div className="wrc-card-gold-stripe" />
              {loadingOwned ? (
                <div style={{ padding: "2rem", textAlign: "center" as const }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="skeleton-shimmer" style={{ height: 52, borderRadius: 8, marginBottom: 6 }} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "3rem 2rem", textAlign: "center" as const }}>
                  <Search size={36} color="oklch(0.75 0.06 150)" style={{ margin: "0 auto 0.75rem" }} />
                  <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.4 0.08 150)" }}>No players found</p>
                  <p style={{ fontSize: "0.8rem", color: "oklch(0.55 0.06 150)", marginTop: "0.25rem" }}>Try a different search or position filter</p>
                </div>
              ) : (
                <div ref={tableStatsScrollRef} onScroll={handleTableScroll} style={{ overflowX: "auto", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}>
                  <div style={{ minWidth: statsTableMinWidth }}>
                    {/* Header row */}
                    <div style={{ display: "grid", gridTemplateColumns: statsGridColumns, gap: "0.25rem", padding: "0.35rem 0.5rem", background: "oklch(0.96 0.02 150)", borderBottom: "1px solid oklch(0.9 0.04 150)", alignItems: "center" }}>
                      {tableHeaders.map((header, index) => {
                        const active = header.key === sortKey;
                        const column = "column" in header ? header.column : undefined;
                        const alignment = ("align" in header ? header.align : undefined) ?? "center";
                        const isPlayerColumn = index === 0;
                        const headerColor = active
                          ? "oklch(0.43 0.16 85)"
                          : column?.gold ? "oklch(0.55 0.16 85)"
                            : column?.highlight ? "oklch(0.36 0.14 150)"
                              : "oklch(0.42 0.06 150)";
                        if (!header.key) return <span key={`empty-${index}`} />;
                        return (
                          <button
                            key={`${header.label}-${index}`}
                            type="button"
                            onClick={() => handleSort(header.key!)}
                            title={`Sort by ${header.label}`}
                            style={{ display: "flex", alignItems: "center", justifyContent: alignment === "left" ? "flex-start" : "center", gap: "0.15rem", minHeight: 26, padding: "0.12rem", border: "none", background: active ? "oklch(0.90 0.06 85)" : isPlayerColumn ? "oklch(0.96 0.02 150)" : "transparent", borderRadius: 4, color: headerColor, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, textAlign: alignment, whiteSpace: "nowrap" as const, cursor: "pointer", position: isPlayerColumn ? "sticky" : "relative", left: isPlayerColumn ? 0 : undefined, zIndex: isPlayerColumn ? 5 : 1, boxShadow: isPlayerColumn ? "7px 0 9px -9px rgb(0 0 0 / 0.72)" : "none" }}
                          >
                            {header.label}
                            {active ? (sortDirection === "asc" ? <ArrowUp size={11} strokeWidth={3} /> : <ArrowDown size={11} strokeWidth={3} />) : <ArrowUpDown size={10} opacity={0.45} />}
                          </button>
                        );
                      })}
                    </div>

                    {filtered.map((player) => {
                    const proj = getProjectedPoints(projections, player.name, player.pos, player.nflTeam);
                    const ownerTeam = ownershipMap[player.name.toLowerCase()];
                    const isOwned = !!ownerTeam;
                    const seasonStats = seasonStatMap[player.name.toLowerCase()];
                    return (
                      <div
                        key={player.id}
                        onMouseEnter={e => (e.currentTarget.style.background = isOwned ? "oklch(0.96 0.03 240)" : "oklch(0.97 0.02 150)")}
                        onMouseLeave={e => (e.currentTarget.style.background = isOwned ? "oklch(0.97 0.02 240)" : "white")}
                        style={{ display: "grid", gridTemplateColumns: statsGridColumns, gap: "0.25rem", padding: "0.45rem 0.5rem", alignItems: "center", borderBottom: "1px solid oklch(0.94 0.02 150)", transition: "background 0.15s", background: isOwned ? "oklch(0.97 0.02 240)" : "white" }}
                      >
                        {/* Player info */}
                        <Link
                          href={`/player/${encodeURIComponent(player.name)}`}
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem", textDecoration: "none", minWidth: 0, overflow: "hidden", position: "sticky", left: 0, zIndex: 3, background: isOwned ? "oklch(0.97 0.02 240)" : "white", boxShadow: "7px 0 9px -9px rgb(0 0 0 / 0.72)" }}
                        >
                          <img
                            src={getTeamLogoUrl(player.nflTeam)}
                            alt={player.nflTeam}
                            style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.84rem", color: "oklch(0.22 0.08 150)", margin: 0, flex: 1, minWidth: 0, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {player.name}
                              </p>
                              {(() => {
                                const designation = getInjuryDesignation(injuries, player.name);
                                const injColor = designation ? getInjuryColor(designation) : null;
                                if (!injColor) return null;
                                return (
                                  <span style={{
                                    fontSize: "0.6rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif",
                                    padding: "1px 4px", borderRadius: 3, flexShrink: 0,
                                    background: injColor.bg, color: injColor.text, border: `1px solid ${injColor.border}`,
                                  }} title={designation}>{getInjuryLabel(designation)}</span>
                                );
                              })()}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: 1 }}>
                              <PosBadge pos={player.pos} />
                              <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.06 150)" }}>{player.nflTeam}</span>
                              {depthMap.get(player.name.toLowerCase())?.depthPosition && (
                                <span style={{
                                  fontSize: "0.62rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif",
                                  padding: "1px 4px", borderRadius: 3, flexShrink: 0,
                                  background: "oklch(0.22 0.08 150)", color: "oklch(0.78 0.15 85)",
                                  border: "1px solid oklch(0.35 0.1 150)",
                                }}>
                                  {depthMap.get(player.name.toLowerCase())?.depthPosition}
                                </span>
                              )}
                              {isOwned && (
                                <span style={{ fontSize: "0.65rem", color: "oklch(0.42 0.1 240)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.03em", background: "oklch(0.92 0.04 240)", border: "1px solid oklch(0.78 0.08 240)", borderRadius: 4, padding: "0px 4px" }}>
                                  {ownerTeam}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={12} color="oklch(0.75 0.06 150)" style={{ flexShrink: 0 }} />
                        </Link>

                        {/* Bye week */}
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", color: "oklch(0.5 0.06 150)", textAlign: "center" as const }}>
                          {player.bye ?? "—"}
                        </span>

                        {/* Projected points */}
                        <div style={{ textAlign: "center" as const }}>
                          {projectionsLoading ? (
                            <span className="skeleton-shimmer" style={{ display: "inline-block", width: 36, height: 16, borderRadius: 4 }} />
                          ) : (
                            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: proj > 0 ? "oklch(0.38 0.14 150)" : "oklch(0.65 0.06 150)" }}>
                              {proj > 0 ? proj.toFixed(1) : "—"}
                            </span>
                          )}
                        </div>

                        {/* ADP */}
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.5 0.06 150)", textAlign: "center" as const }}>
                          {player.adp.toFixed(1)}
                        </span>

                        {/* Position-aware Tank01 season totals */}
                        {seasonColumns.map((column) => (
                          <span key={column.label} style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: column.gold || column.highlight ? 800 : 600, fontSize: "0.84rem", color: column.gold ? "oklch(0.48 0.15 85)" : column.highlight ? "oklch(0.28 0.11 150)" : "oklch(0.38 0.05 150)", textAlign: "center" as const, whiteSpace: "nowrap" as const }}>
                            {seasonStats ? formatSeasonStatColumn(seasonStats, column) : seasonStatsLoading ? "…" : "—"}
                          </span>
                        ))}

                        {/* Bid button */}
                        {isOwned ? (
                          franchise ? (
                            <Link
                              href={`/trades`}
                              style={{ background: "oklch(0.42 0.1 240)", color: "white", border: "none", borderRadius: 7, padding: "0.3rem 0.5rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem", justifyContent: "center", textDecoration: "none" }}
                            >
                              <ArrowLeftRight size={10} />
                              Trade
                            </Link>
                          ) : (
                            <span style={{ fontSize: "0.65rem", color: "oklch(0.55 0.08 240)", textAlign: "center" as const, fontFamily: "Barlow Condensed, sans-serif" }}>Owned</span>
                          )
                        ) : franchise ? (
                          <button
                            onClick={() => setBidPlayer(player)}
                            style={{ background: "oklch(0.55 0.16 85)", color: "white", border: "none", borderRadius: 7, padding: "0.3rem 0.6rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.04em", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "center" }}
                          >
                            <DollarSign size={11} />
                            Bid
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.68rem", color: "oklch(0.6 0.06 150)", textAlign: "center" as const }}>Sign in</span>
                        )}
                        {/* Star / watchlist button */}
                        {franchise && (
                          <button
                            onClick={e => { e.stopPropagation(); toggleWatch({ name: player.name, pos: player.pos, nflTeam: player.nflTeam }); }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "0.15rem 0", color: isWatched(player.name) ? "oklch(0.55 0.16 85)" : "oklch(0.75 0.06 150)", display: "flex", alignItems: "center", justifyContent: "center" }}
                            title={isWatched(player.name) ? "Remove from watchlist" : "Add to watchlist"}
                          >
                            <Star size={13} fill={isWatched(player.name) ? "oklch(0.55 0.16 85)" : "none"} />
                          </button>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
          )
        )}
      </div>

      {/* ── FAAB Bid Modal ── */}
      {bidPlayer && franchise && (
        <FAABBidModal
          player={{
            id: bidPlayer.id,
            name: bidPlayer.name,
            pos: bidPlayer.pos,
            nflTeam: bidPlayer.nflTeam,
          }}
          onClose={() => setBidPlayer(null)}
        />
      )}
    </div>
  );
}
