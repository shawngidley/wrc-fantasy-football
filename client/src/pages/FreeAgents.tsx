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
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { NFL_PLAYERS_2026, type NFLPlayer } from "@/lib/nflPlayers2026";
import { getTeamLogoUrl } from "@/hooks/useTank01Player";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeek } from "@/lib/scheduleData2026";
import { useNFLProjections, getProjectedPoints } from "@/hooks/useNFLProjections";
import FAABBidModal from "@/components/FAABBidModal";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Search, DollarSign, ChevronRight, Trophy, Clock, ArrowUpDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";

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
type SortKey = "proj" | "adp" | "name";

// ── Main FreeAgents page ─────────────────────────────────────────────────────
export default function FreeAgents() {
  const { franchise } = useAuth();
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("proj");
  const [bidPlayer, setBidPlayer] = useState<NFLPlayer | null>(null);
  const [activeTab, setActiveTab] = useState<"pool" | "bids">("pool");
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());
  const [loadingOwned, setLoadingOwned] = useState(true);

  const currentWeek = getCurrentWeek();
  const week = currentWeek > 0 ? currentWeek : 1;

  // Load owned player names from Supabase
  useEffect(() => {
    supabase
      .from("players")
      .select("name")
      .not("team_id", "is", null)
      .then(({ data }) => {
        if (data) {
          setOwnedNames(new Set(data.map((p: { name: string }) => p.name.toLowerCase())));
        }
        setLoadingOwned(false);
      });
  }, []);

  // Live projections for sorting
  const { projections } = useNFLProjections(week);

  // Free agents = players in NFL_PLAYERS_2026 not owned
  const freeAgents = useMemo(() => {
    if (loadingOwned) return [];
    return NFL_PLAYERS_2026.filter((p) => !ownedNames.has(p.name.toLowerCase()));
  }, [ownedNames, loadingOwned]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = freeAgents;
    if (posFilter !== "ALL") {
      list = list.filter((p) => p.pos === posFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.nflTeam.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === "proj") {
        const pa = getProjectedPoints(projections, a.name, a.pos, a.nflTeam);
        const pb = getProjectedPoints(projections, b.name, b.pos, b.nflTeam);
        return pb - pa;
      }
      if (sortKey === "adp") return a.adp - b.adp;
      return a.name.localeCompare(b.name);
    });
  }, [freeAgents, posFilter, search, sortKey, projections]);

  const positions = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
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
          {isCommissioner && (
            <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.75rem" }}>
              {[
                { key: "pool", label: "Player Pool" },
                { key: "bids", label: "Manage Bids" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as "pool" | "bids")}
                  style={{
                    padding: "0.4rem 0.875rem", borderRadius: 8,
                    border: activeTab === key ? "2px solid oklch(0.55 0.16 85)" : "2px solid oklch(0.88 0.04 150)",
                    background: activeTab === key ? "oklch(0.22 0.08 150)" : "white",
                    color: activeTab === key ? "white" : "oklch(0.4 0.04 150)",
                    fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700,
                    letterSpacing: "0.04em", cursor: "pointer",
                  }}
                >
                  {key === "bids" && <Trophy size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === "bids" && isCommissioner ? (
          <CommissionerBids week={week} />
        ) : (
          <>
            {/* ── Filters ── */}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.6rem", marginBottom: "1rem" }}>
              {/* Search + sort row */}
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
                {/* Sort selector */}
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <ArrowUpDown size={13} color="rgba(255,255,255,0.6)" />
                  {([["proj", "Projected"], ["adp", "ADP"], ["name", "Name"]] as [SortKey, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSortKey(key)}
                      style={{
                        padding: "0.35rem 0.65rem", borderRadius: 7,
                        border: sortKey === key ? "2px solid oklch(0.55 0.16 85)" : "2px solid rgba(255,255,255,0.2)",
                        background: sortKey === key ? "oklch(0.55 0.16 85)" : "rgba(255,255,255,0.1)",
                        color: sortKey === key ? "white" : "rgba(255,255,255,0.75)",
                        fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700,
                        letterSpacing: "0.04em", cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
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
              Showing <strong style={{ color: "rgba(255,255,255,0.85)" }}>{filtered.length}</strong> free agent{filtered.length !== 1 ? "s" : ""}
              {posFilter !== "ALL" ? ` at ${posFilter}` : ""}
              {search ? ` matching "${search}"` : ""}
            </p>

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
                <>
                  {/* Header row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", gap: "0.5rem", padding: "0.5rem 1rem", background: "oklch(0.96 0.02 150)", borderBottom: "1px solid oklch(0.9 0.04 150)" }}>
                    {["Player", "Bye", sortKey === "proj" ? "Proj" : "ADP", ""].map((h, i) => (
                      <span key={i} style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.55 0.06 150)", textAlign: i > 0 ? "center" as const : "left" as const }}>{h}</span>
                    ))}
                  </div>

                  {filtered.map((player) => {
                    const proj = getProjectedPoints(projections, player.name, player.pos, player.nflTeam);
                    return (
                      <div
                        key={player.id}
                        style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", gap: "0.5rem", padding: "0.6rem 1rem", alignItems: "center", borderBottom: "1px solid oklch(0.94 0.02 150)", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.97 0.02 150)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "white")}
                      >
                        {/* Player info */}
                        <Link
                          href={`/player/${encodeURIComponent(player.name)}`}
                          style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none", minWidth: 0 }}
                        >
                          <img
                            src={getTeamLogoUrl(player.nflTeam)}
                            alt={player.nflTeam}
                            style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "oklch(0.22 0.08 150)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {player.name}
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: 1 }}>
                              <PosBadge pos={player.pos} />
                              <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.06 150)" }}>{player.nflTeam}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} color="oklch(0.75 0.06 150)" style={{ marginLeft: "auto", flexShrink: 0 }} />
                        </Link>

                        {/* Bye week */}
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", color: "oklch(0.5 0.06 150)", textAlign: "center" as const }}>
                          {player.bye ?? "—"}
                        </span>

                        {/* Proj / ADP */}
                        <div style={{ textAlign: "center" as const }}>
                          {sortKey === "proj" ? (
                            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: proj > 0 ? "oklch(0.38 0.14 150)" : "oklch(0.65 0.06 150)" }}>
                              {proj > 0 ? proj.toFixed(1) : "—"}
                            </span>
                          ) : (
                            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.5 0.06 150)" }}>
                              {player.adp.toFixed(1)}
                            </span>
                          )}
                        </div>

                        {/* Bid button */}
                        {franchise ? (
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
                      </div>
                    );
                  })}
                </>
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
