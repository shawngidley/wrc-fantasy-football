import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { findDraftQueueItemByPlayerName, useDraftQueue } from "@/hooks/useDraftQueue";
import { useNFLADP } from "@/hooks/useNFLADP";
import { useNFLSeasonStats } from "@/hooks/useNFLSeasonStats";
import { supabase } from "@/lib/supabase";
import { filterDraftBoardPlayers, formatDraftBoardSeasonStat, resolve2026Adp, sortDraftBoardPlayers, type DraftBoardPlayerFilter, type DraftBoardSortDirection, type DraftBoardSortKey } from "@/lib/draftBoardPlayerBoard";
import { getNflTeamLogoUrl } from "@/lib/nflTeamLogo";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";
import { getAvailableDraftUniversePlayers, type DraftUniversePlayer } from "@shared/draftPlayerUniverse";

const PLAYER_FILTERS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST", "QUE"] as const;

const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

function DraftPlayerAvatar({ player }: { player: DraftUniversePlayer }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isDefense = player.pos === "DST";
  const imageUrl = isDefense ? getNflTeamLogoUrl(player.nflTeam) : getEspnHeadshotUrl(player.sourcePlayerId);
  const initials = isDefense
    ? player.nflTeam.slice(0, 3)
    : player.name.split(" ").filter(Boolean).map(part => part[0]).slice(0, 2).join("");

  return (
    <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: isDefense ? 5 : "50%", overflow: "hidden", background: "oklch(0.93 0.02 150)", border: "1.5px solid oklch(0.86 0.03 150)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {imageUrl && !imageFailed ? (
        <img src={imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: isDefense ? "contain" : "cover" }} onError={() => setImageFailed(true)} />
      ) : (
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 800, color: "oklch(0.45 0.06 150)" }}>{initials}</span>
      )}
    </div>
  );
}

export default function DraftPlayers() {
  const { franchise } = useAuth();
  const [rosteredNames, setRosteredNames] = useState<Set<string>>(new Set());
  const [draftedNames, setDraftedNames] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<DraftBoardPlayerFilter>("ALL");
  const [sortKey, setSortKey] = useState<DraftBoardSortKey>("adp");
  const [sortDirection, setSortDirection] = useState<DraftBoardSortDirection>("asc");
  const [queueActionPlayerName, setQueueActionPlayerName] = useState<string | null>(null);
  const { adpMap, loading: adpLoading, adpDate } = useNFLADP();
  const franchiseId = franchise?.id ?? null;
  const { addToQueue, isQueued, queue, removeFromQueue } = useDraftQueue(franchiseId);

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
  const seasonStatPlayers = useMemo(
    () => availablePlayers.map(player => ({ name: player.name, pos: player.pos, nflTeam: player.nflTeam })),
    [availablePlayers],
  );
  const { statMap: seasonStatMap } = useNFLSeasonStats(seasonStatPlayers, true, false);
  const queuedPlayerNames = useMemo(
    () => new Set(queue.map(item => item.player_name.toLowerCase())),
    [queue],
  );

  const visiblePlayers = useMemo(() => {
    const matches = filterDraftBoardPlayers(availablePlayers, posFilter, queuedPlayerNames, search);
    return sortDraftBoardPlayers(matches, adpMap, sortKey, sortDirection, seasonStatMap, queuedPlayerNames);
  }, [adpMap, availablePlayers, posFilter, queuedPlayerNames, search, seasonStatMap, sortDirection, sortKey]);

  const formatADP = (player: DraftUniversePlayer) => {
    const adp = resolve2026Adp(player, adpMap);
    return adp === null ? "—" : adp.toFixed(1);
  };

  const formatSeasonValue = (player: DraftUniversePlayer, key: "wrcPts" | "ptsPerGame") =>
    formatDraftBoardSeasonStat(seasonStatMap[player.name.toLowerCase()]?.[key], false);

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

    setQueueActionPlayerName(player.name);
    try {
      const queuedItem = findDraftQueueItemByPlayerName(queue, player.name);
      if (queuedItem) {
        await removeFromQueue(queuedItem.id);
        toast.success(`${player.name} removed from ${franchise.team_name}'s queue.`);
      } else {
        await addToQueue({ name: player.name, pos: player.pos, nflTeam: player.nflTeam });
        toast.success(`${player.name} added to ${franchise.team_name}'s queue.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this player in your queue.");
    } finally {
      setQueueActionPlayerName(null);
    }
  };

  const sortLabel = (key: DraftBoardSortKey) => sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : "↕";
  const adpSourceLabel = adpLoading
    ? "Refreshing 2026 ADP…"
    : adpDate
      ? `Tank01 PPR ADP · ${adpDate.slice(0, 4)}-${adpDate.slice(4, 6)}-${adpDate.slice(6, 8)}`
      : "Validated 2026 ADP unavailable";

  return (
    <main className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "1rem 1rem 3rem" }}>
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
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search players or NFL team..." aria-label="Search available draft players" style={{ width: "100%", padding: "0.55rem 0.6rem 0.55rem 2rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.85rem", color: "oklch(0.2 0.03 150)", background: "white", outline: "none", boxSizing: "border-box" }} />
              </div>
              <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", whiteSpace: "nowrap" }}>Sort any column</span>
            </div>

            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
              {PLAYER_FILTERS.map(position => (
                <button key={position} type="button" onClick={() => setPosFilter(position)} aria-pressed={posFilter === position} aria-label={position === "QUE" ? "Show my queued players" : `Show ${position} players`} style={{ padding: "0.25rem 0.6rem", borderRadius: 6, border: "1.5px solid", borderColor: posFilter === position ? "oklch(0.28 0.09 150)" : "oklch(0.88 0.01 150)", background: posFilter === position ? "oklch(0.28 0.09 150)" : "white", color: posFilter === position ? "white" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>{position}</button>
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
            <table className="wrc-table" style={{ minWidth: 660, width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 82 }} />
                <col style={{ width: 82 }} />
                <col style={{ width: 84 }} />
              </colgroup>
              <thead><tr>
                <th style={{ textAlign: "center", position: "sticky", top: 0, left: 0, zIndex: 7, background: "oklch(0.22 0.08 150)" }}>#</th>
                <th style={{ position: "sticky", top: 0, left: 44, zIndex: 8, background: "oklch(0.22 0.08 150)" }}><button type="button" onClick={() => toggleSort("name")} aria-label="Sort by player name" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>PLAYER {sortLabel("name")}</button></th>
                <th style={{ textAlign: "center", position: "sticky", top: 0, left: 304, zIndex: 8, background: "oklch(0.22 0.08 150)", boxShadow: "8px 0 12px -12px oklch(0.05 0.05 150 / 0.9)" }}><button type="button" onClick={() => toggleSort("queue")} aria-label="Sort by queued status" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>QUE {sortLabel("queue")}</button></th>
                <th style={{ textAlign: "center", position: "sticky", top: 0, zIndex: 5, background: "oklch(0.22 0.08 150)" }}><button type="button" onClick={() => toggleSort("bye")} aria-label="Sort by bye week" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>BYE {sortLabel("bye")}</button></th>
                <th style={{ textAlign: "right", position: "sticky", top: 0, zIndex: 5, background: "oklch(0.22 0.08 150)" }}><button type="button" onClick={() => toggleSort("fpts")} aria-label="Sort by season fantasy points" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>FPTS {sortLabel("fpts")}</button></th>
                <th style={{ textAlign: "right", position: "sticky", top: 0, zIndex: 5, background: "oklch(0.22 0.08 150)" }}><button type="button" onClick={() => toggleSort("fpg")} aria-label="Sort by season fantasy points per game" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>FP/G {sortLabel("fpg")}</button></th>
                <th style={{ textAlign: "right", position: "sticky", top: 0, zIndex: 5, background: "oklch(0.22 0.08 150)" }}><button type="button" onClick={() => toggleSort("adp")} aria-label="Sort by 2026 ADP" style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>ADP {sortLabel("adp")}</button></th>
              </tr></thead>
              <tbody>
                {visiblePlayers.length === 0 ? <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "oklch(0.55 0.04 150)" }}>{posFilter === "QUE" ? "No players are in your draft queue yet." : "No available players match the current search and filter selection."}</td></tr> : visiblePlayers.map((player, index) => {
                  const queued = isQueued(player.name);
                  const queueActionInProgress = queueActionPlayerName === player.name;
                  const rowBackground = index % 2 === 0 ? "white" : "oklch(0.96 0.008 150)";
                  return <tr key={player.id} className="wrc-row-hover">
                    <td style={{ textAlign: "center", position: "sticky", left: 0, zIndex: 4, background: rowBackground, color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700 }}>{index + 1}</td>
                    <td style={{ position: "sticky", left: 44, zIndex: 4, background: rowBackground }}>
                      <Link href={`/player/${encodeURIComponent(player.name)}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem", textDecoration: "none", minWidth: 0, overflow: "hidden" }}>
                        <DraftPlayerAvatar player={player} />
                        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.84rem", color: "oklch(0.22 0.08 150)", lineHeight: 1.12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: 2 }}>
                            <span style={{ display: "inline-block", minWidth: 27, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 3, padding: "1px 3px" }}>{player.pos}</span>
                            <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.06 150)", whiteSpace: "nowrap" }}>{player.nflTeam}</span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td style={{ textAlign: "center", position: "sticky", left: 304, zIndex: 4, background: rowBackground, boxShadow: "8px 0 12px -12px oklch(0.2 0.08 150 / 0.55)" }}>
                      <button type="button" onClick={() => void handleQueuePlayer(player)} disabled={queueActionInProgress} aria-label={queued ? `Remove ${player.name} from your draft queue` : `Add ${player.name} to your draft queue`} aria-pressed={queued} title={queued ? "Remove from My Queue" : "Add to My Queue"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "none", borderRadius: 6, background: queued ? "oklch(0.95 0.08 85)" : "transparent", color: queued ? "oklch(0.58 0.14 85)" : "oklch(0.5 0.04 150)", cursor: queueActionInProgress ? "not-allowed" : "pointer", opacity: queueActionInProgress ? 0.55 : 1 }}>
                        <Star size={18} fill={queued ? "currentColor" : "none"} strokeWidth={2.3} />
                      </button>
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.42 0.06 150)" }}>{player.bye ?? "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, color: "oklch(0.48 0.15 85)" }}>{formatSeasonValue(player, "wrcPts")}</td>
                    <td style={{ textAlign: "right", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, color: "oklch(0.48 0.15 85)" }}>{formatSeasonValue(player, "ptsPerGame")}</td>
                    <td style={{ textAlign: "right", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, color: formatADP(player) === "—" ? "oklch(0.6 0.02 150)" : "oklch(0.22 0.08 150)" }}>{formatADP(player)}</td>
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
