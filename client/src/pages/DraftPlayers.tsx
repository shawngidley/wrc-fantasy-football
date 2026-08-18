import { useEffect, useMemo, useState } from "react";
import { Check, ListPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useDraftQueue } from "@/hooks/useDraftQueue";
import { useNFLADP } from "@/hooks/useNFLADP";
import { supabase } from "@/lib/supabase";
import { resolve2026Adp, sortDraftBoardPlayers, type DraftBoardSortDirection, type DraftBoardSortKey } from "@/lib/draftBoardPlayerBoard";
import { getAvailableDraftUniversePlayers, type DraftUniversePlayer } from "@shared/draftPlayerUniverse";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"] as const;

const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

export default function DraftPlayers() {
  const { franchise } = useAuth();
  const [rosteredNames, setRosteredNames] = useState<Set<string>>(new Set());
  const [draftedNames, setDraftedNames] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<(typeof POSITIONS)[number]>("ALL");
  const [sortKey, setSortKey] = useState<DraftBoardSortKey>("adp");
  const [sortDirection, setSortDirection] = useState<DraftBoardSortDirection>("asc");
  const [addingPlayerName, setAddingPlayerName] = useState<string | null>(null);
  const { adpMap, loading: adpLoading, adpDate } = useNFLADP();
  const franchiseId = franchise?.id ?? null;
  const { addToQueue, isQueued } = useDraftQueue(franchiseId);

  useEffect(() => {
    let active = true;
    async function loadAvailability() {
      const [{ data: players }, { data: picks }] = await Promise.all([
        supabase.from("players").select("name").not("team_id", "is", null),
        supabase.from("draft_picks").select("player_name"),
      ]);
      if (!active) return;
      setRosteredNames(new Set((players ?? []).map((player: { name: string }) => player.name)));
      setDraftedNames(new Set((picks ?? []).map((pick: { player_name: string }) => pick.player_name)));
    }

    void loadAvailability();
    const channel = supabase
      .channel("draft-players-availability")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "draft_picks" }, payload => {
        const playerName = (payload.new as { player_name?: string }).player_name;
        if (playerName) setDraftedNames(previous => new Set(Array.from(previous).concat(playerName)));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const availablePlayers = useMemo(
    () => getAvailableDraftUniversePlayers({ draftedNames, rosteredNames }),
    [draftedNames, rosteredNames],
  );

  const visiblePlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = availablePlayers.filter(player => {
      if (posFilter !== "ALL" && player.pos !== posFilter) return false;
      return !term || player.name.toLowerCase().includes(term) || player.nflTeam.toLowerCase().includes(term);
    });
    return sortDraftBoardPlayers(matches, adpMap, sortKey, sortDirection);
  }, [adpMap, availablePlayers, posFilter, search, sortDirection, sortKey]);

  const formatADP = (player: DraftUniversePlayer) => {
    const adp = resolve2026Adp(player, adpMap);
    return adp === null ? "—" : adp.toFixed(1);
  };

  const toggleSort = (key: DraftBoardSortKey) => {
    if (sortKey === key) {
      setSortDirection(direction => direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const handleQueuePlayer = async (player: DraftUniversePlayer) => {
    if (!franchise) {
      toast.error("Sign in to add players to your draft queue.");
      return;
    }
    if (isQueued(player.name)) return;

    setAddingPlayerName(player.name);
    try {
      await addToQueue({ name: player.name, pos: player.pos, nflTeam: player.nflTeam });
      toast.success(`${player.name} added to ${franchise.team_name}'s queue.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add this player to your queue.");
    } finally {
      setAddingPlayerName(null);
    }
  };

  const sortLabel = (key: DraftBoardSortKey) => sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : "↕";
  const adpSourceLabel = adpLoading
    ? "Refreshing 2026 ADP…"
    : adpDate
      ? `Tank01 PPR ADP · ${adpDate.slice(0, 4)}-${adpDate.slice(4, 6)}-${adpDate.slice(6, 8)}`
      : "Validated 2026 ADP unavailable";

  return (
    <main className="bg-stadium-night bg-overlay" style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "1rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: 0, marginBottom: "1rem" }}>
          <h1>Draft Players</h1>
          <p>Search, compare 2026 ADP, and build your private draft queue.</p>
        </div>

        <section className="wrc-card" aria-label="Available 2026 draft players" style={{ overflow: "hidden" }}>
          <div className="wrc-card-gold-stripe" />
          <div style={{ padding: "1rem 1.25rem 0.875rem", borderBottom: "1px solid oklch(0.9 0.005 150)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "oklch(0.22 0.08 150)", letterSpacing: "0.06em" }}>AVAILABLE PLAYER BOARD</div>
                <div style={{ fontSize: "0.78rem", color: "oklch(0.5 0.04 150)", marginTop: "0.2rem" }}>
                  {visiblePlayers.length.toLocaleString()} available · 2026 PPR ADP · drafted and WRC-rostered players excluded
                </div>
              </div>
              <div style={{ fontSize: "0.7rem", color: adpLoading ? "oklch(0.55 0.14 85)" : adpDate ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.16 25)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {adpSourceLabel}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "0.6rem", marginTop: "0.9rem", alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search players or NFL team..." aria-label="Search available draft players" style={{ width: "100%", padding: "0.55rem 0.6rem 0.55rem 2rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
              </div>
              <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", whiteSpace: "nowrap" }}>Sort any column</span>
            </div>

            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
              {POSITIONS.map(position => (
                <button key={position} type="button" onClick={() => setPosFilter(position)} aria-pressed={posFilter === position} style={{ padding: "0.25rem 0.6rem", borderRadius: 6, border: "1.5px solid", borderColor: posFilter === position ? "oklch(0.28 0.09 150)" : "oklch(0.88 0.01 150)", background: posFilter === position ? "oklch(0.28 0.09 150)" : "white", color: posFilter === position ? "white" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>{position}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.55rem" }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em", color: "oklch(0.5 0.04 150)" }}>SORT</span>
              {(["adp", "pos", "name"] as const).map(key => {
                const label = key === "adp" ? "ADP" : key === "pos" ? "Position" : "Name";
                const active = sortKey === key;
                return <button key={key} type="button" onClick={() => toggleSort(key)} aria-pressed={active} style={{ padding: "0.22rem 0.55rem", borderRadius: 5, border: "1.5px solid", borderColor: active ? "oklch(0.65 0.14 85)" : "oklch(0.88 0.01 150)", background: active ? "oklch(0.95 0.08 85)" : "white", color: "oklch(0.32 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>{label} {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</button>;
              })}
            </div>
          </div>

          <div style={{ maxHeight: 700, overflow: "auto" }}>
            <table className="wrc-table" style={{ minWidth: 730, width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}><tr>
                <th style={{ width: 52, textAlign: "center" }}>#</th>
                <th><button type="button" onClick={() => toggleSort("name")} aria-label="Sort by player name" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>PLAYER {sortLabel("name")}</button></th>
                <th style={{ width: 72 }}><button type="button" onClick={() => toggleSort("pos")} aria-label="Sort by position" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>POS {sortLabel("pos")}</button></th>
                <th style={{ width: 76 }}><button type="button" onClick={() => toggleSort("team")} aria-label="Sort by NFL team" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>NFL {sortLabel("team")}</button></th>
                <th style={{ width: 82, textAlign: "right" }}><button type="button" onClick={() => toggleSort("adp")} aria-label="Sort by 2026 ADP" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>ADP {sortLabel("adp")}</button></th>
                <th style={{ width: 136, textAlign: "right", position: "sticky", right: 0, zIndex: 3, background: "oklch(0.22 0.08 150)" }}>MY QUEUE</th>
              </tr></thead>
              <tbody>
                {visiblePlayers.length === 0 ? <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "oklch(0.55 0.04 150)" }}>No available players match the current search and position selection.</td></tr> : visiblePlayers.map((player, index) => {
                  const queued = isQueued(player.name);
                  const adding = addingPlayerName === player.name;
                  return <tr key={player.id} className="wrc-row-hover">
                    <td style={{ textAlign: "center", color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700 }}>{index + 1}</td>
                    <td><div style={{ fontWeight: 700, color: "oklch(0.18 0.05 150)" }}>{player.name}</div><div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)", marginTop: 1 }}>{player.bye ? `Bye ${player.bye}` : "Bye —"}</div></td>
                    <td><span style={{ display: "inline-block", minWidth: 31, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 4, padding: "2px 4px" }}>{player.pos}</span></td>
                    <td style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.4 0.04 150)" }}>{player.nflTeam}</td>
                    <td style={{ textAlign: "right", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, color: formatADP(player) === "—" ? "oklch(0.6 0.02 150)" : "oklch(0.22 0.08 150)" }}>{formatADP(player)}</td>
                    <td style={{ textAlign: "right", position: "sticky", right: 0, zIndex: 1, background: index % 2 === 0 ? "white" : "oklch(0.96 0.008 150)" }}>
                      {!franchise ? <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700 }}>SIGN IN TO QUEUE</span>
                        : queued ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "oklch(0.42 0.15 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 800 }}><Check size={13} /> QUEUED</span>
                          : <button type="button" onClick={() => void handleQueuePlayer(player)} disabled={adding} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 5, padding: "0.3rem 0.55rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.04em", cursor: adding ? "not-allowed" : "pointer", opacity: adding ? 0.6 : 1 }}><ListPlus size={13} /> {adding ? "ADDING…" : "ADD TO QUEUE"}</button>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
