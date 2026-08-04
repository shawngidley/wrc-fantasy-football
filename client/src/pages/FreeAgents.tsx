/**
 * WRC Fantasy Football — Free Agents / FAAB Page
 * Design: Clean data-table layout with position filter tabs and FAAB bid flow
 *
 * - Shows all NFL_PLAYERS_2026 players NOT on any WRC roster
 * - Position filter tabs: ALL | QB | RB | WR | TE | K | DST
 * - Sort by: ADP (default), Name, Position
 * - Each row links to /player/:name for the full player page
 * - "Bid" button opens FAABBidModal for signed-in users
 * - Commissioner sees all pending bids in a separate tab
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { NFL_PLAYERS_2026, type NFLPlayer } from "@/lib/nflPlayers2026";
import { TEAMS } from "@/lib/wrcData";
import { getTeamLogoUrl } from "@/hooks/useTank01Player";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeek } from "@/lib/scheduleData2026";
import FAABBidModal from "@/components/FAABBidModal";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, DollarSign, ChevronRight, Trophy, Clock } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

// ── Position badge colors ────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB:  "bg-red-100 text-red-700 border-red-200",
  RB:  "bg-green-100 text-green-700 border-green-200",
  WR:  "bg-blue-100 text-blue-700 border-blue-200",
  TE:  "bg-orange-100 text-orange-700 border-orange-200",
  K:   "bg-purple-100 text-purple-700 border-purple-200",
  DST: "bg-slate-100 text-slate-700 border-slate-200",
};

// ── Build the set of owned player names ─────────────────────────────────────
function buildOwnedSet(): Map<string, { teamName: string; owner: string }> {
  const owned = new Map<string, { teamName: string; owner: string }>();
  for (const team of TEAMS) {
    for (const player of team.players) {
      owned.set(player.name.toLowerCase(), { teamName: team.teamName, owner: team.owner });
    }
  }
  return owned;
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
function CommissionerBids() {
  const [bids, setBids] = useState<FaabBid[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWeek = getCurrentWeek();
  const week = currentWeek > 0 ? currentWeek : 1;

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
    // Mark this bid as won, all others for same player as lost
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

    if (winErr || loseErr) {
      toast.error("Failed to process bid.");
    } else {
      toast.success(`${bid.player_name} awarded to ${bid.team_name}!`);
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
    return <div className="text-center py-12 text-slate-500">Loading bids...</div>;
  }

  if (bids.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No FAAB bids for Week {week} yet.</p>
        <p className="text-slate-400 text-sm mt-1">Bids will appear here as managers submit them.</p>
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
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Commissioner View</strong> — All bids are visible. Click "Award" to assign a player to the winning bidder. Other bids for the same player will be automatically marked as lost.
      </div>
      {Object.entries(byPlayer).map(([playerName, playerBids]) => (
        <div key={playerName} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${POS_COLORS[playerBids[0].player_pos] ?? "bg-slate-100 text-slate-700"}`}>
                {playerBids[0].player_pos}
              </Badge>
              <span className="font-semibold text-slate-900">{playerName}</span>
              <span className="text-slate-400 text-sm">· {playerBids[0].player_nfl_team}</span>
            </div>
            <span className="text-xs text-slate-500">{playerBids.length} bid{playerBids.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {playerBids.map((bid) => (
              <div key={bid.id} className={`px-4 py-3 flex items-center gap-3 ${bid.status === "won" ? "bg-green-50" : bid.status === "lost" ? "bg-red-50 opacity-60" : ""}`}>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">{bid.team_name}</p>
                  {bid.drop_player_name && (
                    <p className="text-xs text-slate-500">Drops: {bid.drop_player_name}</p>
                  )}
                </div>
                <span className="text-lg font-bold text-emerald-700">${bid.bid_amount}</span>
                {bid.status === "pending" ? (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    onClick={() => handleAward(bid)}
                  >
                    Award
                  </Button>
                ) : (
                  <Badge className={bid.status === "won" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {bid.status === "won" ? "Won" : "Lost"}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main FreeAgents page ─────────────────────────────────────────────────────
export default function FreeAgents() {
  const { franchise } = useAuth();
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [bidPlayer, setBidPlayer] = useState<NFLPlayer | null>(null);
  const [activeTab, setActiveTab] = useState<"pool" | "bids">("pool");

  const ownedMap = useMemo(() => buildOwnedSet(), []);

  // Free agents = players in NFL_PLAYERS_2026 not in any WRC roster
  const freeAgents = useMemo(() => {
    return NFL_PLAYERS_2026.filter((p) => !ownedMap.has(p.name.toLowerCase()));
  }, [ownedMap]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = freeAgents;
    if (posFilter !== "ALL") {
      list = list.filter((p) => p.pos === posFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nflTeam.toLowerCase().includes(q)
      );
    }
    // Sort by ADP ascending (lower ADP = higher ranked)
    return [...list].sort((a, b) => a.adp - b.adp);
  }, [freeAgents, posFilter, search]);

  const positions = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
  const isCommissioner = franchise?.is_commissioner;
  const currentWeek = getCurrentWeek();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Free Agents</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {freeAgents.length} available players · FAAB blind auction
                {currentWeek > 0 ? ` · Week ${currentWeek}` : " · Pre-Season"}
              </p>
            </div>
            {franchise && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-700 font-medium">FAAB Balance</p>
                  <p className="text-lg font-bold text-emerald-800">
                    ${TEAMS.find((t) => t.id === franchise.id)?.faabRemaining ?? 1000}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tab switcher (commissioner sees bids tab) */}
          {isCommissioner && (
            <div className="flex gap-1 mt-4">
              <button
                onClick={() => setActiveTab("pool")}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === "pool" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Player Pool
              </button>
              <button
                onClick={() => setActiveTab("bids")}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === "bids" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  Manage Bids
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {activeTab === "bids" && isCommissioner ? (
          <CommissionerBids />
        ) : (
          <>
            {/* ── Filters ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search players or teams..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Position tabs */}
              <div className="flex gap-1 flex-wrap">
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPosFilter(pos)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      posFilter === pos
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Pre-season notice ── */}
            {currentWeek === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
                <strong>Pre-Season:</strong> Player pool shows 2026 ADP rankings. FAAB bidding opens when the season starts on September 9, 2026. You can submit bids now and they will be held until the first waiver period.
              </div>
            )}

            {/* ── Player count ── */}
            <p className="text-sm text-slate-500 mb-3">
              Showing <strong>{filtered.length}</strong> free agent{filtered.length !== 1 ? "s" : ""}
              {posFilter !== "ALL" ? ` at ${posFilter}` : ""}
              {search ? ` matching "${search}"` : ""}
            </p>

            {/* ── Player list ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No players found</p>
                  <p className="text-slate-400 text-sm mt-1">Try a different search or position filter</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Player</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center hidden sm:block">Bye</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">ADP</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Action</span>
                  </div>

                  {filtered.map((player) => (
                    <div
                      key={player.id}
                      className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-slate-50 transition-colors"
                    >
                      {/* Player info */}
                      <Link
                        href={`/player/${encodeURIComponent(player.name)}`}
                        className="flex items-center gap-3 min-w-0 group"
                      >
                        {/* Team logo */}
                        <img
                          src={getTeamLogoUrl(player.nflTeam)}
                          alt={player.nflTeam}
                          className="w-8 h-8 object-contain flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                            {player.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${POS_COLORS[player.pos] ?? "bg-slate-100 text-slate-700"}`}>
                              {player.pos}
                            </span>
                            <span className="text-xs text-slate-500">{player.nflTeam}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 flex-shrink-0 ml-auto hidden sm:block" />
                      </Link>

                      {/* Bye week */}
                      <span className="text-sm text-slate-500 text-center hidden sm:block">
                        {player.bye ?? "—"}
                      </span>

                      {/* ADP */}
                      <span className="text-sm font-medium text-slate-700 text-center">
                        {player.adp.toFixed(1)}
                      </span>

                      {/* Bid button */}
                      {franchise ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs font-semibold border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500"
                          onClick={() => setBidPlayer(player)}
                        >
                          <DollarSign className="w-3 h-3 mr-0.5" />
                          Bid
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 text-right">Sign in to bid</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
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
