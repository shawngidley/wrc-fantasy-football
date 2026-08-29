/**
 * WRC Fantasy Football - Live Draft Board
 * Design: Dark stadium night / gold WRC palette
 *
 * Architecture:
 *   - draft_state (Supabase): single row tracks started/paused/complete/round/pick/timer
 *   - draft_picks (Supabase): one row per pick made (round, pick, team, player, pos)
 *   - Supabase Realtime: broadcasts INSERT on draft_picks and UPDATE on draft_state
 *     so all connected browsers see picks instantly without polling
 *   - Commissioner controls: Start, Pause/Resume, Skip, Reset
 *   - Any owner whose turn it is can open the player pool and make their pick
 *   - Player pool: complete current NFL universe, filtered by position/search
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Pause, SkipForward, Search, ArrowLeftRight, RotateCcw, Wifi, WifiOff, ChevronUp, ChevronDown, ListOrdered, Plus, Check, X } from "lucide-react";
import { DRAFT_PICKS_2026, getTradedPicks } from "@/lib/draftData2026";
import { siteAssetUrl } from "@/lib/siteAssetUrl";
import { applyDraftLottery, isValidDraftLotteryResult } from "@shared/draftLottery";
import { OWNER_TO_TEAM } from "@/lib/scheduleData2026";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026, getAvailableDraftUniversePlayers, getDraftUniversePlayerByName, type DraftUniversePlayer } from "@shared/draftPlayerUniverse";
import { normalizePlayerName } from "@shared/playerNameMatch";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { fetchPlayerByName, getTeamLogoUrl } from "@/hooks/useTank01Player";
import { useDraftQueue } from "@/hooks/useDraftQueue";
import { useNFLADP } from "@/hooks/useNFLADP";
import { useNFLSeasonStats } from "@/hooks/useNFLSeasonStats";
import { trpc } from "@/lib/trpc";
import { WRC_DRAFT_DATE, WRC_DRAFT_DISPLAY } from "@/lib/draftSchedule";
import { formatDraftBoardSeasonStat, resolve2026Adp, sortDraftBoardPlayers, type DraftBoardSortDirection, type DraftBoardSortKey } from "@/lib/draftBoardPlayerBoard";
import { getNflTeamLogoUrl } from "@/lib/nflTeamLogo";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";

// ── Constants ─────────────────────────────────────────────────────────────────
const TIMER_SECONDS = 90;
const TOTAL_ROUNDS = 18;
const TOTAL_TEAMS = 12;
const DRAFT_DATE = WRC_DRAFT_DATE;

// Round 1 pick order (snake draft — even rounds reverse)
const ROUND1_ORDER = [
  "Greg","Shawn","Bill","David R.","Jason","Scott N.",
  "David S.","Jonas","Jamie","Keith","Scott M.","Dan",
];

const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

function DraftQueuePlayerAvatar({ player, playerName, playerPos, nflTeam }: {
  player: DraftUniversePlayer | null;
  playerName: string;
  playerPos: string;
  nflTeam: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const isDefense = playerPos === "DST";
  const imageUrl = isDefense ? getNflTeamLogoUrl(nflTeam) : getEspnHeadshotUrl(player?.sourcePlayerId ?? null);
  const initials = isDefense
    ? nflTeam.slice(0, 3)
    : playerName.split(" ").filter(Boolean).map(part => part[0]).slice(0, 2).join("");

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

const OWNER_COLORS: Record<string, string> = {
  "Greg":"oklch(0.55 0.18 260)","Shawn":"oklch(0.52 0.18 25)",
  "Bill":"oklch(0.50 0.16 150)","David R.":"oklch(0.52 0.18 85)",
  "Jason":"oklch(0.50 0.16 310)","Scott N.":"oklch(0.52 0.16 195)",
  "David S.":"oklch(0.50 0.18 45)","Jonas":"oklch(0.50 0.18 170)",
  "Jamie":"oklch(0.52 0.16 280)","Keith":"oklch(0.50 0.16 10)",
  "Scott M.":"oklch(0.52 0.16 230)","Dan":"oklch(0.50 0.16 130)",
};

// Maps owner first name to Supabase team_id
const OWNER_TO_TEAM_ID: Record<string, string> = {
  "Jonas":    "team-jonas",
  "David R.": "team-davidr",
  "Jason":    "team-jason",
  "Keith":    "team-keith",
  "Dan":      "team-dan",
  "Scott N.": "team-scottn",
  "Bill":     "team-bill",
  "Jamie":    "team-jamie",
  "Scott M.": "team-scottm",
  "David S.": "team-davids",
  "Shawn":    "team-shawn",
  "Greg":     "team-greg",
};

// Reverse of OWNER_TO_TEAM_ID, for placing protected players on the board by team_id
const TEAM_ID_TO_OWNER: Record<string, string> = Object.fromEntries(
  Object.entries(OWNER_TO_TEAM_ID).map(([owner, teamId]) => [teamId, owner]),
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface DbDraftState {
  id: number;
  started: boolean;
  paused: boolean;
  complete: boolean;
  current_round: number;
  current_pick: number;
  timer_seconds: number;
  updated_at: string;
}

interface DbDraftPick {
  id: number;
  round: number;
  pick: number;
  overall: number;
  team_name: string;
  owner: string;
  player_name: string;
  player_pos: string;
  player_nfl_team: string;
  picked_at: string;
}


// ── Helpers ───────────────────────────────────────────────────────────────────
function getOwnerForSlot(round: number, pickIdx: number, picks = DRAFT_PICKS_2026): string {
  // Find the pick in DRAFT_PICKS_2026 that matches round + pickInRound
  const match = picks.find(p => p.round === round && p.pickInRound === pickIdx + 1);
  return match?.owner ?? ROUND1_ORDER[pickIdx] ?? "?";
}

function getTeamForOwner(owner: string): string {
  return OWNER_TO_TEAM[owner] ?? owner;
}

// ── Countdown Banner ──────────────────────────────────────────────────────────
function useDraftCountdown() {
  const [timeLeft, setTimeLeft] = useState(() => DRAFT_DATE.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(DRAFT_DATE.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (timeLeft <= 0) return null;
  const totalSecs = Math.floor(timeLeft / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hrs  = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return { days, hrs, mins, secs };
}

function DraftCountdownBanner() {
  const cd = useDraftCountdown();
  if (!cd) return null;
  const isClose = cd.days < 3;
  return (
    <div style={{
      background: isClose ? "linear-gradient(90deg, oklch(0.22 0.09 150), oklch(0.28 0.1 150))" : "rgba(0,0,0,0.55)",
      border: `1.5px solid ${isClose ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.15)"}`,
      borderRadius: 12, padding: "1rem 1.5rem", marginBottom: "1rem",
      display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.78 0.15 85)" }}>
          {isClose ? "⚡ Draft is almost here!" : "Draft Countdown"}
        </span>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{WRC_DRAFT_DISPLAY}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.25rem" }}>
        {[{ v: cd.days, l: "Days" }, { v: cd.hrs, l: "Hrs" }, { v: cd.mins, l: "Min" }, { v: cd.secs, l: "Sec" }].map((u, i) => (
          <>
            {i > 0 && <span key={`sep${i}`} style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.6rem", color: "rgba(255,255,255,0.3)", alignSelf: "flex-start", marginTop: 2 }}>:</span>}
            <div key={u.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52 }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", color: isClose ? "oklch(0.78 0.15 85)" : "white", lineHeight: 1 }}>{String(u.v).padStart(2,"0")}</span>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 400, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{u.l}</span>
            </div>
          </>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DraftBoard() {
  const { franchise, isCommissioner } = useAuth();

  // ── Supabase state ──
  const [draftState, setDraftState] = useState<DbDraftState | null>(null);
  const [dbPicks, setDbPicks] = useState<DbDraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // ── Local UI state ──
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [boardView, setBoardView] = useState<"grid" | "list">("grid");
  const [playerBoardSort, setPlayerBoardSort] = useState<DraftBoardSortKey>("adp");
  const [playerBoardDirection, setPlayerBoardDirection] = useState<DraftBoardSortDirection>("asc");
  const [submitting, setSubmitting] = useState(false);
  // Draft queue state
  const [queueSearch, setQueueSearch] = useState("");
  const [queuePosFilter, setQueuePosFilter] = useState("ALL");
  const [showQueueBrowser, setShowQueueBrowser] = useState(false);

  // ── Player reveal overlay state ──
  const [revealPick, setRevealPick] = useState<DbDraftPick | null>(null);
  const [revealHeadshot, setRevealHeadshot] = useState<string | null>(null);
  const [revealProgress, setRevealProgress] = useState(100);
  const prevPickCountRef = useRef(0);
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  const currentListRowRef = useRef<HTMLDivElement | null>(null);
  const themeAudioRef = useRef<HTMLAudioElement | null>(null);
  const themeTimersRef = useRef<{ fadeStart?: ReturnType<typeof setTimeout>; fadeInterval?: ReturnType<typeof setInterval> }>({});
  const lastThemeOwnerRef = useRef<string | null>(null);
  const themeProgressRef = useRef<Record<string, number>>({});
  const themePlayingTeamIdRef = useRef<string | null>(null);
  // Tracks which pick IDs have been revealed (shown in board after overlay)
  const [revealedPickIds, setRevealedPickIds] = useState<Set<number>>(new Set());
  const draftActionMutation = trpc.league.commissionerDraftAction.useMutation();
  const makeDraftPickMutation = trpc.league.makeDraftPick.useMutation();
  const lotteryQuery = trpc.league.draftLottery.useQuery(undefined, { refetchInterval: 5000 });
  const resolvedDraftOrder = useMemo(() => applyDraftLottery(DRAFT_PICKS_2026, isValidDraftLotteryResult(lotteryQuery.data?.appliedResultOwners) ? lotteryQuery.data.appliedResultOwners : null), [lotteryQuery.data?.appliedResultOwners]);

  // Draft queue hook
  const franchiseId = franchise?.id ?? null;
  const { queue, addToQueue, removeFromQueue, moveItem, isQueued } = useDraftQueue(franchiseId);

  // Live ADP from Tank01
  const { adpMap, loading: adpLoading } = useNFLADP();

  const formatADP = (player: DraftUniversePlayer) => {
    const adp = resolve2026Adp(player, adpMap);
    return adp === null ? "—" : adp.toFixed(1);
  };

  const queuePlayerDetails = useMemo(
    () => queue.map(item => ({ item, player: getDraftUniversePlayerByName(item.player_name) })),
    [queue],
  );
  const queueSeasonStatPlayers = useMemo(
    () => queuePlayerDetails
      .filter((entry): entry is { item: typeof entry.item; player: DraftUniversePlayer } => entry.player !== null)
      .map(({ player }) => ({ name: player.name, pos: player.pos, nflTeam: player.nflTeam })),
    [queuePlayerDetails],
  );
  const { statMap: queueSeasonStatMap } = useNFLSeasonStats(queueSeasonStatPlayers, true, false);
  const formatQueueSeasonValue = (player: DraftUniversePlayer | null, key: "wrcPts" | "ptsPerGame") =>
    player ? formatDraftBoardSeasonStat(queueSeasonStatMap[player.name.toLowerCase()]?.[key], false) : "—";

  // Load rostered player names from Supabase to exclude from queue browser
  const [rosteredNames, setRosteredNames] = useState<Set<string>>(new Set());
  useEffect(() => {
    supabase
      .from("players")
      .select("name")
      .not("team_id", "is", null)
      .then(({ data }) => {
        if (data) setRosteredNames(new Set(data.map((p: { name: string }) => normalizePlayerName(p.name))));
      });
  }, []);

  // Drafted player names (for graying out in queue)
  const draftedNames = useMemo(() => new Set(dbPicks.map(p => p.player_name)), [dbPicks]);
  const draftedNamesNormalized = useMemo(() => new Set(dbPicks.map(p => normalizePlayerName(p.player_name))), [dbPicks]);

  // Queue browser filtered players
  const queueFilteredPlayers = useMemo(() => {
    return CURRENT_DRAFT_PLAYER_UNIVERSE_2026.filter(p => {
      const normalizedName = normalizePlayerName(p.name);
      // Only show undrafted players not already in the queue
      if (draftedNamesNormalized.has(normalizedName)) return false;
      // Exclude players already on a WRC roster (including protected players)
      if (rosteredNames.has(normalizedName)) return false;
      if (queue.some(q => normalizePlayerName(q.player_name) === normalizedName)) return false;
      if (queuePosFilter !== "ALL" && p.pos !== queuePosFilter) return false;
      if (queueSearch) {
        const q = queueSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.nflTeam.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (resolve2026Adp(a, adpMap) ?? Number.POSITIVE_INFINITY) - (resolve2026Adp(b, adpMap) ?? Number.POSITIVE_INFINITY));
  }, [queueSearch, queuePosFilter, draftedNamesNormalized, queue, rosteredNames, adpMap]);

  // Pre-load the chime audio on mount
  useEffect(() => {
    const audio = new Audio(siteAssetUrl("nfl-draft-chime.mp3"));
    audio.preload = "auto";
    chimeRef.current = audio;
  }, []);

  const tradedPicks = getTradedPicks();

  // ── Derived state ──
  const started   = draftState?.started  ?? false;
  const paused    = draftState?.paused   ?? false;
  const complete  = draftState?.complete ?? false;
  const curRound  = draftState?.current_round ?? 1;
  const curPick   = draftState?.current_pick  ?? 0;

  // Build picks map: "round-pick" → DbDraftPick
  const picksMap = useMemo(() => {
    const m: Record<string, DbDraftPick> = {};
    for (const p of dbPicks) {
      if (revealedPickIds.has(p.id)) m[`${p.round}-${p.pick}`] = p;
    }
    return m;
  }, [dbPicks, revealedPickIds]);

  // Protected players: placed at the physical draft position their team's
  // fixed column translates to for that round. Columns never move (each team
  // keeps the same column all 18 rounds); only the physical pick position
  // within a row reverses on even rounds, same as picksMap's own keying
  // (dbPick.pick), so both maps share one consistent lookup key.
  const protectionsQuery = trpc.league.allProtections.useQuery();
  const protectedMap = useMemo(() => {
    const m: Record<string, { name: string; pos: string; nflTeam: string }> = {};
    for (const p of protectionsQuery.data ?? []) {
      const owner = TEAM_ID_TO_OWNER[p.team_id];
      const rawPlayer = p.players as { name: string; position: string; nfl_team: string } | { name: string; position: string; nfl_team: string }[] | null;
      const player = Array.isArray(rawPlayer) ? rawPlayer[0] : rawPlayer;
      if (!owner || !player || p.forfeited_round == null) continue;
      const columnIndex = ROUND1_ORDER.indexOf(owner);
      if (columnIndex === -1) continue;
      const physicalPick = p.forfeited_round % 2 === 1 ? columnIndex : (TOTAL_TEAMS - 1 - columnIndex);
      m[`${p.forfeited_round}-${physicalPick}`] = { name: player.name, pos: player.position, nflTeam: player.nfl_team };
    }
    return m;
  }, [protectionsQuery.data]);

  // Current owner on the clock
  const currentOwner = getOwnerForSlot(curRound, curPick, resolvedDraftOrder);

  // Pick List owner badge width: measure the actual widest owner/trade label
  // across all 18 rounds (e.g. "Jamie (David R.)") so the badge is exactly
  // wide enough to fit it without truncating -- and no wider than that, so
  // every badge (including short ones like "Dan") shares one uniform width
  // sized to the single longest one, not an arbitrary guessed pixel value.
  const pickListOwnerTextWidth = useMemo(() => {
    if (typeof document === "undefined") return 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.font = "700 13.76px 'Barlow Condensed', sans-serif"; // matches 0.86rem bold used below
    let max = 0;
    for (const dp of resolvedDraftOrder) {
      const label = dp.isTraded ? `${dp.owner} (${dp.originalOwner})` : dp.owner;
      const w = ctx.measureText(label).width;
      if (w > max) max = w;
    }
    return Math.ceil(max);
  }, [resolvedDraftOrder]);
  const pickListOwnerWidthDesktop = pickListOwnerTextWidth ? pickListOwnerTextWidth + 14 + 2 : 170; // +14 = 7px padding each side, +2 rounding buffer
  const pickListOwnerWidthMobile = pickListOwnerTextWidth ? pickListOwnerTextWidth + 8 + 2 : 74; // +8 = 4px padding each side on mobile
  const currentTeamName = getTeamForOwner(currentOwner);
  const isMyTurn = franchise?.team_name === currentTeamName || franchise?.owner === currentOwner;

  // Theme songs: play automatically (for everyone watching) when a new team
  // goes on the clock, for 15 seconds, then fade out over ~1.5s and stop.
  const themeSongsQuery = trpc.league.teamThemeSongs.useQuery();
  const themeSongByTeamId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of themeSongsQuery.data ?? []) {
      if (t.theme_song_url) m[t.id] = t.theme_song_url;
    }
    return m;
  }, [themeSongsQuery.data]);

  useEffect(() => {
    if (!started || complete) return;
    if (currentOwner === lastThemeOwnerRef.current) return;
    // Wait for the pick-reveal overlay (chime + 6s player reveal) to finish
    // before starting the next team's song, so the sequence feels like
    // chime -> reveal -> overlay closes -> theme song, instead of the song
    // starting immediately underneath the reveal while it's still showing.
    // currentOwner is already the new team by this point (draft_state
    // advances immediately server-side for turn-tracking accuracy); this
    // effect just delays when we *act* on that until revealPick clears.
    if (revealPick) return;
    lastThemeOwnerRef.current = currentOwner;

    // Stop whatever was playing for the previous team, but remember exactly
    // where it was so the same team's song resumes from there next time
    // they come on the clock, instead of always restarting at 0:00.
    clearTimeout(themeTimersRef.current.fadeStart);
    clearInterval(themeTimersRef.current.fadeInterval);
    if (themeAudioRef.current && themePlayingTeamIdRef.current) {
      themeProgressRef.current[themePlayingTeamIdRef.current] = themeAudioRef.current.currentTime;
      themeAudioRef.current.pause();
      themeAudioRef.current = null;
    }
    themePlayingTeamIdRef.current = null;

    const teamId = OWNER_TO_TEAM_ID[currentOwner];
    const url = teamId ? themeSongByTeamId[teamId] : undefined;
    if (!url || !teamId) return;

    const audio = new Audio(url);
    audio.volume = 1;
    themeAudioRef.current = audio;
    themePlayingTeamIdRef.current = teamId;

    // Resume from where this team's song left off last time, wrapping back
    // to the start if that position is at or past the song's actual length
    // (e.g. a short song already played through in earlier turns).
    const resumeFrom = themeProgressRef.current[teamId] ?? 0;
    if (resumeFrom > 0) {
      audio.addEventListener("loadedmetadata", () => {
        if (themeAudioRef.current !== audio) return; // superseded by a newer turn already
        audio.currentTime = Number.isFinite(audio.duration) && audio.duration > 0
          ? resumeFrom % audio.duration
          : 0;
      }, { once: true });
    }
    audio.play().catch(() => {});

    // After 15 seconds, fade out over ~1.5s (20 steps of 75ms), then stop.
    themeTimersRef.current.fadeStart = setTimeout(() => {
      const FADE_STEPS = 20;
      const FADE_INTERVAL_MS = 75;
      let step = 0;
      themeTimersRef.current.fadeInterval = setInterval(() => {
        step++;
        if (!themeAudioRef.current) { clearInterval(themeTimersRef.current.fadeInterval); return; }
        themeAudioRef.current.volume = Math.max(0, 1 - step / FADE_STEPS);
        if (step >= FADE_STEPS) {
          clearInterval(themeTimersRef.current.fadeInterval);
          if (themeAudioRef.current && themePlayingTeamIdRef.current) {
            themeProgressRef.current[themePlayingTeamIdRef.current] = themeAudioRef.current.currentTime;
          }
          themeAudioRef.current.pause();
          themeAudioRef.current = null;
          themePlayingTeamIdRef.current = null;
        }
      }, FADE_INTERVAL_MS);
    }, 15_000);
  }, [currentOwner, started, complete, themeSongByTeamId, revealPick]);

  useEffect(() => {
    // Stop any playing theme song if the draft pauses, completes, or this
    // component unmounts, so nothing keeps playing in the background.
    return () => {
      clearTimeout(themeTimersRef.current.fadeStart);
      clearInterval(themeTimersRef.current.fadeInterval);
      themeAudioRef.current?.pause();
    };
  }, []);


  // Available player pool
  const availablePlayers = useMemo(
    () => getAvailableDraftUniversePlayers({ draftedNames, rosteredNames }),
    [draftedNames, rosteredNames],
  );
  const playerBoardPlayers = useMemo(() => {
    const matchingPlayers = availablePlayers.filter(p => {
      const matchPos = posFilter === "ALL" || p.pos === posFilter;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.nflTeam.toLowerCase().includes(search.toLowerCase());
      return matchPos && matchSearch;
    });
    return sortDraftBoardPlayers(matchingPlayers, adpMap, playerBoardSort, playerBoardDirection);
  }, [availablePlayers, posFilter, search, adpMap, playerBoardSort, playerBoardDirection]);

  const togglePlayerBoardSort = (key: DraftBoardSortKey) => {
    if (playerBoardSort === key) {
      setPlayerBoardDirection(direction => direction === "asc" ? "desc" : "asc");
      return;
    }
    setPlayerBoardSort(key);
    setPlayerBoardDirection("asc");
  };

  // Timer display
  const timerColor = timer > 45 ? "oklch(0.42 0.15 150)" : timer > 20 ? "oklch(0.65 0.14 85)" : "#ef4444";
  const timerStr = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`;
  const timerPct = (timer / TIMER_SECONDS) * 100;

  // ── Load initial state + subscribe to realtime ──
  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      const [{ data: stateData }, { data: picksData }] = await Promise.all([
        supabase.from("draft_state").select("*").eq("id", 1).single(),
        supabase.from("draft_picks").select("*").order("overall", { ascending: true }),
      ]);
      if (!mounted) return;
      if (stateData) {
        setDraftState(stateData as DbDraftState);
        setTimer(stateData.timer_seconds ?? TIMER_SECONDS);
      }
      if (picksData) {
        const picks = picksData as DbDraftPick[];
        setDbPicks(picks);
        setRevealedPickIds(new Set(picks.map(p => p.id)));
        prevPickCountRef.current = picks.length;
      }
      setLoading(false);
    }

    loadInitialData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("draft-room")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "draft_state" }, payload => {
        if (!mounted) return;
        const newState = payload.new as DbDraftState;
        setDraftState(newState);
        setTimer(newState.timer_seconds ?? TIMER_SECONDS);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "draft_picks" }, payload => {
        if (!mounted) return;
        setDbPicks(prev => {
          const exists = prev.some(p => p.id === (payload.new as DbDraftPick).id);
          if (exists) return prev;
          return [...prev, payload.new as DbDraftPick].sort((a, b) => a.overall - b.overall);
        });
      })
      .subscribe(status => {
        if (!mounted) return;
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Local timer countdown (client-side only, resets on state change) ──
  useEffect(() => {
    if (!started || paused || complete) return;
    const id = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          // Auto-pause when timer hits 0 — commissioner decides next step
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [started, paused, complete, curRound, curPick]);

  // ── Player reveal overlay — fires when a new pick is added ──
  useEffect(() => {
    if (dbPicks.length === 0) {
      prevPickCountRef.current = 0;
      return;
    }
    if (dbPicks.length <= prevPickCountRef.current) {
      prevPickCountRef.current = dbPicks.length;
      return;
    }
    // New pick detected
    const newPick = dbPicks[dbPicks.length - 1];
    prevPickCountRef.current = dbPicks.length;

    // Step 1: Play the NFL Draft chime immediately
    if (chimeRef.current) {
      chimeRef.current.currentTime = 0;
      chimeRef.current.play().catch(() => {});
    }

    // Step 2: Show reveal overlay 500ms after chime starts
    const overlayDelay = setTimeout(() => {
      setRevealPick(newPick);
      setRevealHeadshot(null);
      setRevealProgress(100);

      // Fetch headshot asynchronously
      fetchPlayerByName(newPick.player_name).then(p => {
        if (p?.espnHeadshot) setRevealHeadshot(p.espnHeadshot);
      }).catch(() => {});

      // Progress bar countdown (6 seconds)
      const REVEAL_MS = 6000;
      const INTERVAL_MS = 50;
      const steps = REVEAL_MS / INTERVAL_MS;
      let step = 0;
      const progressId = setInterval(() => {
        step++;
        setRevealProgress(Math.max(0, 100 - (step / steps) * 100));
        if (step >= steps) {
          clearInterval(progressId);
          setRevealPick(null);
          setRevealHeadshot(null);
          // Step 3: Add pick to revealed set so it appears in the board
          setRevealedPickIds(prev => new Set(Array.from(prev).concat(newPick.id)));
        }
      }, INTERVAL_MS);
    }, 500);

    return () => clearTimeout(overlayDelay);
  }, [dbPicks]);

  // Auto-scroll the current-pick row into view when the Pick List tab is
  // active and the clock advances, so no one has to hunt for it in a
  // 216-row list.
  useEffect(() => {
    if (boardView !== "list") return;
    currentListRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [boardView, curRound, curPick]);

  // ── Commissioner actions ──
  async function handleStartDraft() {
    try {
      await draftActionMutation.mutateAsync({ action: "start" });
      setTimer(TIMER_SECONDS);
      toast.success("Draft started! 🏈");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start draft.");
    }
  }

  async function handlePauseResume() {
    try {
      await draftActionMutation.mutateAsync({ action: "togglePause" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update draft clock.");
    }
  }

  async function handleSkip() {
    if (!isCommissioner) return;
    try {
      await draftActionMutation.mutateAsync({ action: "skip" });
      setTimer(TIMER_SECONDS);
      toast.success("Draft clock advanced.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to skip draft pick.");
    }
  }

  async function handleReset() {
    if (!isCommissioner) return;
    if (!confirm("Reset the entire draft? This will delete all picks and cannot be undone.")) return;
    try {
      await draftActionMutation.mutateAsync({ action: "reset" });
      setDbPicks([]);
      setTimer(TIMER_SECONDS);
      toast.success("Draft reset.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset draft.");
    }
  }

  // ── Make a pick ──
  const handlePickPlayer = useCallback(async (player: DraftUniversePlayer) => {
    if (!started || complete || submitting) return;
    if (!isMyTurn && !isCommissioner) return;

    setSubmitting(true);
    try {
      const result = await makeDraftPickMutation.mutateAsync({
        playerName: player.name,
        playerPos: player.pos,
        playerNflTeam: player.nflTeam,
      });
      setDbPicks(prev => prev.some(pick => pick.id === result.pick.id) ? prev : [...prev, result.pick as DbDraftPick]);
      toast.success(`${player.name} drafted by ${currentTeamName}!`);
      if (result.complete) toast.success("Draft complete! 🏆");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pick failed.");
    } finally {
      setSubmitting(false);
    }
  }, [started, complete, submitting, isMyTurn, isCommissioner, currentTeamName, makeDraftPickMutation]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
        <Navigation showTicker={false} teamName={franchise?.team_name} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ textAlign: "center", color: "white" }}>
            <div className="skeleton" style={{ width: 200, height: 24, borderRadius: 6, margin: "0 auto 0.5rem" }} />
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Loading draft room...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "1rem 1rem 3rem" }}>

        {/* Countdown (pre-draft) */}
        {!started && <DraftCountdownBanner />}

        {/* ── Player Reveal Overlay ── */}
        {revealPick && (
          <div
            onClick={() => { setRevealPick(null); setRevealHeadshot(null); }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.88)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              animation: "revealFadeIn 0.4s cubic-bezier(0.23,1,0.32,1)",
              cursor: "pointer",
            }}
          >
            {/* Pick number badge */}
            <div style={{ fontSize: "0.75rem", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.15em", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
              Round {revealPick.round} · Pick {revealPick.pick + 1} · Overall #{revealPick.overall}
            </div>

            {/* Player headshot */}
            <div style={{
              width: 220, height: 220, borderRadius: "50%",
              border: "4px solid oklch(0.72 0.15 85)",
              overflow: "hidden", background: "oklch(0.18 0.03 150)",
              marginBottom: "1.5rem",
              animation: "revealScaleIn 0.5s cubic-bezier(0.23,1,0.32,1)",
              boxShadow: "0 0 60px oklch(0.72 0.15 85 / 0.4)",
            }}>
              {revealHeadshot ? (
                <img src={revealHeadshot} alt={revealPick.player_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <img
                  src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${revealPick.player_nfl_team?.toLowerCase()}.png&w=200&h=200`}
                  alt={revealPick.player_nfl_team}
                  style={{ width: "100%", height: "100%", objectFit: "contain", padding: "2rem", opacity: 0.6 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>

            {/* Player name */}
            <div style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "clamp(2rem, 8vw, 4rem)",
              fontWeight: 900, letterSpacing: "0.04em",
              color: "white", textTransform: "uppercase",
              textAlign: "center", lineHeight: 1,
              marginBottom: "0.75rem",
              textShadow: "0 2px 20px rgba(0,0,0,0.5)",
            }}>
              {revealPick.player_name}
            </div>

            {/* Position + NFL team */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{
                background: POS_COLORS[revealPick.player_pos] ?? "#64748b",
                color: "white", fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.1em",
                padding: "0.25rem 0.75rem", borderRadius: 6,
              }}>
                {revealPick.player_pos}
              </span>
              <img
                src={getTeamLogoUrl(revealPick.player_nfl_team ?? "")}
                alt={revealPick.player_nfl_team}
                style={{ width: 32, height: 32, objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", letterSpacing: "0.08em" }}>
                {revealPick.player_nfl_team}
              </span>
            </div>

            {/* Drafted by */}
            <div style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "1.1rem", letterSpacing: "0.12em",
              color: "oklch(0.72 0.15 85)", textTransform: "uppercase",
              marginBottom: "2rem",
            }}>
              Drafted by {revealPick.team_name}
            </div>

            {/* Progress bar */}
            <div style={{ width: 200, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: "oklch(0.72 0.15 85)",
                width: `${revealProgress}%`,
                transition: "width 0.05s linear",
              }} />
            </div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginTop: "0.5rem", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.1em" }}>
              TAP TO DISMISS
            </div>
          </div>
        )}

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>2026 WRC Draft</h1>
            <p>18 Rounds · 12 Teams · Snake Draft · Live Room</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Connection indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: connected ? "oklch(0.65 0.14 150)" : "rgba(255,255,255,0.4)" }}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? "Live" : "Connecting..."}
            </div>

            {/* Commissioner controls */}
            {isCommissioner && !started && (
              <button onClick={handleStartDraft} style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 8, padding: "0.6rem 1.5rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Play size={16} /> Start Draft
              </button>
            )}
            {isCommissioner && started && !complete && (
              <>
                <button onClick={handlePauseResume} style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "0.5rem 0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem" }}>
                  {paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
                </button>
                <button onClick={handleSkip} style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "0.5rem 0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem" }}>
                  <SkipForward size={13} /> Skip
                </button>
              </>
            )}
            {isCommissioner && (
              <button onClick={handleReset} title="Reset draft" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,100,100,0.8)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 8, padding: "0.5rem 0.6rem", cursor: "pointer" }}>
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>

        {/* On The Clock Banner */}
        {started && !complete && (
          <div style={{
            background: isMyTurn ? "linear-gradient(90deg, oklch(0.28 0.09 150), oklch(0.35 0.1 150))" : "rgba(0,0,0,0.55)",
            border: isMyTurn ? "2px solid oklch(0.78 0.15 85)" : "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12, padding: "0.875rem 1.25rem", marginBottom: "1rem",
            display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>
                On The Clock — Round {curRound}, Pick {curPick + 1} of {TOTAL_TEAMS}
                <span style={{ marginLeft: "0.5rem", color: "rgba(255,255,255,0.35)" }}>
                  (#{(curRound - 1) * TOTAL_TEAMS + curPick + 1} overall)
                </span>
              </div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.3rem", color: isMyTurn ? "oklch(0.78 0.15 85)" : "white" }}>
                {currentTeamName}
                <span style={{ fontWeight: 400, fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginLeft: "0.5rem" }}>({currentOwner})</span>
                {isMyTurn && <span style={{ marginLeft: "0.5rem", fontSize: "0.9rem", color: "oklch(0.78 0.15 85)" }}>— YOUR PICK</span>}
              </div>
            </div>

            {/* Timer */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "2rem", color: paused ? "rgba(255,255,255,0.4)" : timerColor, lineHeight: 1 }}>
                {paused ? "PAUSED" : timerStr}
              </div>
              {!paused && (
                <div style={{ height: 4, width: 80, background: "rgba(255,255,255,0.15)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, transition: "width 1s linear, background 0.5s" }} />
                </div>
              )}
            </div>

            {/* Make Pick button */}
            {(isMyTurn || isCommissioner) && !paused && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
                {/* Queue suggestion — top available player */}
                {(() => {
                  const topQueued = queue.find(q => !draftedNamesNormalized.has(normalizePlayerName(q.player_name)));
                  if (!topQueued) return null;
                  const qPlayer = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(p => p.name.toLowerCase() === topQueued.player_name.toLowerCase());
                  if (!qPlayer) return null;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(0,0,0,0.4)", border: "1px solid oklch(0.78 0.15 85 / 0.4)", borderRadius: 8, padding: "0.4rem 0.75rem" }}>
                      <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.05em" }}>QUEUE #1</span>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "white", background: POS_COLORS[topQueued.player_pos] ?? "#64748b", borderRadius: 3, padding: "1px 5px" }}>{topQueued.player_pos}</span>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white" }}>{topQueued.player_name}</span>
                      <button
                        onClick={() => handlePickPlayer(qPlayer)}
                        disabled={submitting}
                        style={{ background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 6, padding: "0.3rem 0.75rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
                      >
                        Draft →
                      </button>
                    </div>
                  );
                })()}
                <a
                  href="#draft-panel"
                  onClick={e => { e.preventDefault(); document.getElementById("draft-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  style={{ background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", display: "inline-block" }}
                >
                  ↓ Make Pick in Draft Panel
                </a>
              </div>
            )}
          </div>
        )}

        {/* Draft Complete Banner */}
        {complete && (
          <div style={{ background: "linear-gradient(90deg, oklch(0.22 0.09 150), oklch(0.28 0.1 150))", border: "2px solid oklch(0.78 0.15 85)", borderRadius: 12, padding: "1rem 1.5rem", marginBottom: "1rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.4rem", color: "oklch(0.78 0.15 85)", letterSpacing: "0.08em" }}>🏆 DRAFT COMPLETE</div>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{dbPicks.length} picks made · Good luck this season!</div>
          </div>
        )}

        {/* My Queue + Draft Panel — side by side above the board */}
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "1.5rem" }}>

          {/* Draft Panel — where owners actually submit their pick */}
          <div style={{ flex: "1 1 380px", minWidth: 320, maxWidth: 740 }}>
            {/* Invisible spacer matching the queue's title-row height on the left, so both cards start at the same y position */}
            <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", visibility: "hidden" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem" }}>SPACER</div>
              <button style={{ display: "flex", alignItems: "center", gap: "0.35rem", borderRadius: 7, padding: "0.4rem 0.85rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700 }}>
                <Plus size={13} /> Spacer
              </button>
            </div>
            <div id="draft-panel" className="wrc-card" style={{ overflow: "hidden", scrollMarginTop: "1rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
              <span>DRAFT PANEL</span>
              {started && !complete && (
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: isMyTurn ? "oklch(0.42 0.15 150)" : "oklch(0.5 0.04 150)" }}>
                  Rd {curRound}, Pick {curPick + 1} — {currentTeamName}{isMyTurn ? " (YOU)" : ""}
                </span>
              )}
            </div>

            {!franchise ? (
              <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                <Search size={26} style={{ margin: "0 auto 0.5rem", display: "block", opacity: 0.3 }} />
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.4 0.04 150)" }}>Sign in to draft</div>
              </div>
            ) : !started ? (
              <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                <ListOrdered size={26} style={{ margin: "0 auto 0.5rem", display: "block", opacity: 0.3, color: "oklch(0.45 0.06 150)" }} />
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.45 0.06 150)" }}>The draft hasn't started yet</div>
                <div style={{ fontSize: "0.75rem", color: "oklch(0.6 0.04 150)", marginTop: "0.25rem" }}>Build your queue on the left while you wait.</div>
              </div>
            ) : complete ? (
              <div style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.42 0.15 150)" }}>🏆 Draft complete</div>
              </div>
            ) : (
              <>
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid oklch(0.9 0.005 150)" }}>
                  <div style={{ position: "relative", marginBottom: "0.5rem" }}>
                    <Search size={14} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name or NFL team..."
                      style={{ width: "100%", padding: "0.45rem 0.5rem 0.45rem 1.9rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 7, fontSize: "0.85rem", color: "oklch(0.2 0.03 150)", background: "white", outline: "none", boxSizing: "border-box" as const }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" as const }}>
                    {["ALL","QB","RB","WR","TE","K","DST"].map(pos => (
                      <button key={pos} onClick={() => setPosFilter(pos)} style={{ padding: "0.22rem 0.55rem", borderRadius: 5, border: "1.5px solid", borderColor: posFilter === pos ? "oklch(0.28 0.09 150)" : "oklch(0.88 0.01 150)", background: posFilter === pos ? "oklch(0.28 0.09 150)" : "white", color: posFilter === pos ? "white" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                {!(isMyTurn || isCommissioner) && (
                  <div style={{ padding: "0.6rem 1rem", background: "oklch(0.97 0.02 85)", borderBottom: "1px solid oklch(0.9 0.005 150)", fontSize: "0.75rem", color: "oklch(0.5 0.1 85)", textAlign: "center" }}>
                    Waiting on {currentTeamName} — you'll be able to draft when it's your turn.
                  </div>
                )}

                <div style={{ maxHeight: 480, overflowY: "auto" }}>
                  {playerBoardPlayers.length === 0 ? (
                    <div style={{ padding: "2.5rem 1.25rem", textAlign: "center", color: "oklch(0.6 0.04 150)" }}>
                      <Search size={26} style={{ margin: "0 auto 0.5rem", opacity: 0.3, display: "block" }} />
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>No players found</div>
                      <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", opacity: 0.7 }}>Try a different position or search term.</div>
                    </div>
                  ) : (
                    playerBoardPlayers.map(player => {
                      const canDraft = (isMyTurn || isCommissioner) && started && !paused && !complete;
                      return (
                        <div key={player.id} className="wrc-row-hover" style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 1rem", borderBottom: "1px solid oklch(0.95 0.003 150)" }}>
                          <span style={{ width: 32, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.66rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 4, padding: "2px 0", flexShrink: 0 }}>{player.pos}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.18 0.05 150)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.name}</div>
                            <div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>
                              {player.nflTeam}{player.bye ? ` · Bye ${player.bye}` : ""} · ADP {formatADP(player)}
                            </div>
                          </div>
                          {canDraft ? (
                            <button
                              onClick={() => handlePickPlayer(player)}
                              disabled={submitting}
                              style={{ background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 6, padding: "0.32rem 0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.04em", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, flexShrink: 0 }}
                            >
                              DRAFT
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, flexShrink: 0 }}>AVAILABLE</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
          </div>

        <div style={{ flex: "1 1 380px", minWidth: 320, maxWidth: 740 }}>
            {!franchise ? (
              <div className="wrc-card" style={{ padding: "2rem", textAlign: "center", background: "rgba(0,0,0,0.48)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.72)" }}>
                <ListOrdered size={28} style={{ margin: "0 auto 0.5rem", display: "block", opacity: 0.55, color: "oklch(0.78 0.15 85)" }} />
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "white" }}>Sign in to manage your draft queue</div>
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>The full available-player board remains visible below.</div>
              </div>
            ) : (
              <>
                {/* Queue header + add button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "white", letterSpacing: "0.05em" }}>
                    MY DRAFT QUEUE — {franchise.team_name}
                  </div>
                  <button
                    onClick={() => setShowQueueBrowser(v => !v)}
                    style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: showQueueBrowser ? "rgba(255,255,255,0.12)" : "oklch(0.78 0.15 85)", color: showQueueBrowser ? "white" : "oklch(0.15 0.02 150)", border: showQueueBrowser ? "1px solid rgba(255,255,255,0.25)" : "none", borderRadius: 7, padding: "0.4rem 0.85rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
                  >
                    {showQueueBrowser ? <><X size={13} /> Close</> : <><Plus size={13} /> Add Players</>}
                  </button>
                </div>

                {/* Player browser */}
                {showQueueBrowser && (
                  <div className="wrc-card" style={{ marginBottom: "1rem" }}>
                    <div className="wrc-card-gold-stripe" />
                    <div className="wrc-card-header">Add to Queue</div>
                    <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid oklch(0.9 0.005 150)" }}>
                      <div style={{ position: "relative", marginBottom: "0.5rem" }}>
                        <Search size={14} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
                        <input
                          value={queueSearch}
                          onChange={e => setQueueSearch(e.target.value)}
                          placeholder="Search by name or NFL team..."
                          style={{ width: "100%", padding: "0.45rem 0.5rem 0.45rem 1.9rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 7, fontSize: "0.85rem", color: "oklch(0.2 0.03 150)", background: "white", outline: "none", boxSizing: "border-box" as const }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" as const }}>
                        {["ALL","QB","RB","WR","TE","K","DST"].map(pos => (
                          <button key={pos} onClick={() => setQueuePosFilter(pos)} style={{ padding: "0.22rem 0.55rem", borderRadius: 5, border: "1.5px solid", borderColor: queuePosFilter === pos ? "oklch(0.28 0.09 150)" : "oklch(0.88 0.01 150)", background: queuePosFilter === pos ? "oklch(0.28 0.09 150)" : "white", color: queuePosFilter === pos ? "white" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: "auto" }}>
                      {queueFilteredPlayers.map(player => {
                        const drafted = draftedNamesNormalized.has(normalizePlayerName(player.name));
                        const queued = isQueued(player.name);
                        return (
                          <div key={player.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 1rem", borderBottom: "1px solid oklch(0.95 0.003 150)", opacity: drafted ? 0.4 : 1 }}>
                            <span style={{ width: 30, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.66rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 4, padding: "2px 0", flexShrink: 0 }}>{player.pos}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.18 0.05 150)" }}>{player.name}</div>
                              <div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>{player.nflTeam} · ADP {formatADP(player)}</div>
                            </div>
                            <button
                              disabled={drafted || queued}
                              onClick={() => { if (!drafted && !queued) { addToQueue({ name: player.name, pos: player.pos, nflTeam: player.nflTeam }); toast.success(`${player.name} added to queue`); } }}
                              style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: queued ? "oklch(0.42 0.15 150)" : drafted ? "oklch(0.88 0.01 150)" : "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 6, padding: "0.3rem 0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: drafted || queued ? "default" : "pointer", flexShrink: 0 }}
                            >
                              {queued ? <><Check size={11} /> Added</> : drafted ? "Drafted" : <><Plus size={11} /> Queue</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Queue list */}
                {queue.length === 0 ? (
                  <div className="wrc-card" style={{ padding: "2.5rem 1.25rem", textAlign: "center" }}>
                    <ListOrdered size={28} style={{ margin: "0 auto 0.5rem", display: "block", opacity: 0.25, color: "oklch(0.45 0.06 150)" }} />
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "oklch(0.45 0.06 150)" }}>Your queue is empty</div>
                    <div style={{ fontSize: "0.78rem", color: "oklch(0.6 0.04 150)", marginTop: "0.25rem" }}>Tap "Add Players" to build your draft list</div>
                  </div>
                ) : (
                  <div className="wrc-card" style={{ overflow: "hidden" }}>
                    <div className="wrc-card-gold-stripe" />
                    <div className="wrc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>My Queue ({queue.length} players · {queue.filter(q => !draftedNamesNormalized.has(normalizePlayerName(q.player_name))).length} available)</span>
                    </div>
                    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 322 }}>
                      <table className="wrc-table" style={{ minWidth: 600, width: "100%", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: 36 }} />
                          <col style={{ width: 220 }} />
                          <col style={{ width: 44 }} />
                          <col style={{ width: 62 }} />
                          <col style={{ width: 62 }} />
                          <col style={{ width: 58 }} />
                          <col style={{ width: 52 }} />
                          <col style={{ width: 66 }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "center", position: "sticky", top: 0, zIndex: 2 }}>#</th>
                            <th style={{ position: "sticky", top: 0, zIndex: 2 }}>PLAYER</th>
                            <th style={{ textAlign: "center", position: "sticky", top: 0, zIndex: 2 }}>BYE</th>
                            <th style={{ textAlign: "right", position: "sticky", top: 0, zIndex: 2 }}>FPTS</th>
                            <th style={{ textAlign: "right", position: "sticky", top: 0, zIndex: 2 }}>FP/G</th>
                            <th style={{ textAlign: "right", position: "sticky", top: 0, zIndex: 2 }}>ADP</th>
                            <th style={{ textAlign: "center", position: "sticky", top: 0, zIndex: 2 }}>ORDER</th>
                            <th style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.22)", position: "sticky", top: 0, zIndex: 2 }}>REMOVE</th>
                          </tr>
                        </thead>
                        <tbody>
                      {queuePlayerDetails.map(({ item, player }, idx) => {
                        const isDrafted = draftedNamesNormalized.has(normalizePlayerName(item.player_name));
                        const rowBackground = isDrafted ? "oklch(0.97 0.005 150)" : idx % 2 === 0 ? "white" : "oklch(0.96 0.008 150)";
                        return (
                          <tr key={item.id} style={{ opacity: isDrafted ? 0.46 : 1 }}>
                            <td style={{ textAlign: "center", background: rowBackground, color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700 }}>{idx + 1}</td>
                            <td style={{ background: rowBackground }}>
                              <Link href={`/player/${encodeURIComponent(item.player_name)}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem", textDecoration: "none", minWidth: 0, overflow: "hidden" }}>
                                <DraftQueuePlayerAvatar player={player} playerName={item.player_name} playerPos={item.player_pos} nflTeam={item.player_nfl_team ?? ""} />
                                <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.84rem", color: "oklch(0.22 0.08 150)", lineHeight: 1.12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: isDrafted ? "line-through" : "none" }}>{item.player_name}</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: 2 }}>
                                    <span style={{ display: "inline-block", minWidth: 27, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700, color: "white", background: POS_COLORS[item.player_pos] || "#64748b", borderRadius: 3, padding: "1px 3px" }}>{item.player_pos}</span>
                                    <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.06 150)", whiteSpace: "nowrap" }}>{item.player_nfl_team ?? ""}{isDrafted ? " · Drafted" : ""}</span>
                                  </div>
                                </div>
                              </Link>
                            </td>
                            <td style={{ textAlign: "center", background: rowBackground, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.42 0.06 150)" }}>{player?.bye ?? "—"}</td>
                            <td style={{ textAlign: "right", background: rowBackground, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, color: "oklch(0.48 0.15 85)" }}>{formatQueueSeasonValue(player, "wrcPts")}</td>
                            <td style={{ textAlign: "right", background: rowBackground, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, color: "oklch(0.48 0.15 85)" }}>{formatQueueSeasonValue(player, "ptsPerGame")}</td>
                            <td style={{ textAlign: "right", background: rowBackground, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, color: player && formatADP(player) !== "—" ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.02 150)" }}>{player ? formatADP(player) : "—"}</td>
                            <td style={{ textAlign: "center", background: rowBackground }}>
                              {!isDrafted && (
                                <div style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
                                  <button aria-label={`Move ${item.player_name} up`} onClick={() => moveItem(item.id, "up")} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "oklch(0.85 0.01 150)" : "oklch(0.45 0.06 150)", padding: "1px 3px", display: "flex" }}>
                                    <ChevronUp size={14} />
                                  </button>
                                  <button
                                    aria-label={`Select ${item.player_name} in Draft Panel`}
                                    title="Select in Draft Panel"
                                    onClick={() => {
                                      setSearch(item.player_name);
                                      setPosFilter("ALL");
                                      document.getElementById("draft-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.5 0.14 85)", padding: "1px 3px", display: "flex" }}
                                  >
                                    <Search size={13} />
                                  </button>
                                  <button aria-label={`Move ${item.player_name} down`} onClick={() => moveItem(item.id, "down")} disabled={idx === queue.length - 1} style={{ background: "none", border: "none", cursor: idx === queue.length - 1 ? "default" : "pointer", color: idx === queue.length - 1 ? "oklch(0.85 0.01 150)" : "oklch(0.45 0.06 150)", padding: "1px 3px", display: "flex" }}>
                                    <ChevronDown size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: "center", background: rowBackground, borderLeft: "1px solid oklch(0.9 0.005 150)" }}>
                              <button aria-label={`Remove ${item.player_name} from the queue`} onClick={() => removeFromQueue(item.id)} style={{ background: "oklch(0.97 0.03 25)", border: "1px solid oklch(0.84 0.1 25)", borderRadius: 6, cursor: "pointer", color: "oklch(0.5 0.2 25)", width: 28, height: 28, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", lineHeight: 1 }}>
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Board view tabs */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {(["grid", "list"] as const).map(view => (
            <button
              key={view}
              onClick={() => setBoardView(view)}
              style={{
                background: boardView === view ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.08)",
                color: boardView === view ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.7)",
                border: "1px solid " + (boardView === view ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.15)"),
                borderRadius: 7, padding: "0.4rem 0.9rem",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {view === "grid" ? "Board Grid" : "Pick List"}
            </button>
          ))}
        </div>

        {/* Draft Grid */}
        {boardView === "grid" && (
        <div style={{ overflowX: "auto", marginBottom: "1.5rem", background: "rgba(8,10,16,0.72)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem" }}>
          <div style={{ minWidth: TOTAL_TEAMS * 100 + 60 }}>
            {/* Column headers — owner names */}
            <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${TOTAL_TEAMS}, 1fr)`, gap: 2, marginBottom: 2 }}>
              <div style={{ background: "rgba(0,0,0,0.5)", padding: "0.4rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>RD</div>
              {ROUND1_ORDER.map((owner, i) => (
                <div key={i} style={{ background: OWNER_COLORS[owner] ?? "oklch(0.22 0.08 150)", padding: "0.4rem 0.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700, color: "white", textAlign: "center", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: "3px 3px 0 0" }}>
                  {owner}
                </div>
              ))}
            </div>

            {/* Pick rows */}
            {Array.from({ length: TOTAL_ROUNDS }, (_, r) => {
              const round = r + 1;
              return (
                <div key={r} style={{ display: "grid", gridTemplateColumns: `60px repeat(${TOTAL_TEAMS}, 1fr)`, gap: 2, marginBottom: 2 }}>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: "0.4rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {round}
                    {round <= 2 && <span style={{ fontSize: "0.5rem", color: "oklch(0.78 0.15 85)", marginLeft: 2 }}>L</span>}
                  </div>
                  {ROUND1_ORDER.map((colOwner, p) => {
                    // Column identity (p / colOwner) is fixed for every round -- each team
                    // keeps the same visual column all 18 rounds. Only the *physical* pick
                    // position within the row reverses on even rounds (the actual snake),
                    // which is what determines both the DRAFT_PICKS_2026 lookup and the
                    // dbPick/protection key (matching server's current_pick/dbPick.pick,
                    // which are physical-position-based, not column-based).
                    const physicalPick = round % 2 === 1 ? p : (TOTAL_TEAMS - 1 - p);
                    const pickInRound = physicalPick + 1;
                    const draftOrderPick = resolvedDraftOrder.find(dp => dp.round === round && dp.pickInRound === pickInRound);
                    const cellOwner = draftOrderPick?.owner ?? colOwner;
                    const cellKey = `${round}-${physicalPick}`;
                    const dbPick = picksMap[cellKey];
                    const protectedPlayer = protectedMap[cellKey];
                    const isCurrent = started && !complete && round === curRound && physicalPick === curPick && !protectedPlayer;
                    const isTraded = draftOrderPick?.isTraded ?? false;
                    // Rounds 1-2 use the actual lottery result for who's picking, while every
                    // other round (and the column header itself) stays on the fixed placeholder
                    // order. That means a round 1/2 cell can legitimately show a different owner
                    // than its column header -- flag it distinctly so it doesn't read as a bug.
                    const isLotteryPick = (round === 1 || round === 2) && !isTraded && cellOwner !== colOwner;

                    return (
                      <div key={p} style={{
                        position: "relative",
                        background: protectedPlayer ? "oklch(0.93 0.07 85)" : isCurrent ? "oklch(0.78 0.15 85)" : dbPick ? "oklch(0.94 0.01 150)" : "rgba(255,255,255,0.1)",
                        border: protectedPlayer ? "1.5px solid oklch(0.7 0.16 85)" : isCurrent ? "2px solid oklch(0.65 0.14 85)" : isTraded ? "1.5px solid oklch(0.78 0.15 85 / 0.6)" : isLotteryPick ? "1.5px solid oklch(0.6 0.2 300 / 0.7)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, padding: "0.3rem 0.2rem", minHeight: 52,
                        display: "flex", flexDirection: "column", justifyContent: "center",
                        transition: "background 0.2s",
                        animation: isCurrent ? "gold-pulse 1.4s ease-in-out infinite" : dbPick ? "fadeInUp 0.25s ease both" : "none",
                        cursor: isCurrent && (isMyTurn || isCommissioner) ? "pointer" : "default",
                      }}
                        title={protectedPlayer ? `Protected — ${cellOwner} forfeited this round to keep ${protectedPlayer.name}` : isLotteryPick ? `Lottery result — ${cellOwner} holds this pick, not ${colOwner}` : undefined}
                        onClick={() => { if (isCurrent && (isMyTurn || isCommissioner)) document.getElementById("draft-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                      >
                        {protectedPlayer ? (
                          <>
                            <span aria-hidden style={{ position: "absolute", top: 2, right: 3, fontSize: "0.6rem", lineHeight: 1, opacity: 0.75 }}>🔒</span>
                            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 800, color: "oklch(0.16 0.06 150)", textAlign: "center", lineHeight: 1.15, padding: "0 10px", whiteSpace: "normal", wordBreak: "break-word" }}>{protectedPlayer.name}</div>
                            <div style={{ textAlign: "center", marginTop: 3 }}>
                              <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "white", background: POS_COLORS[protectedPlayer.pos] || "#64748b", borderRadius: 3, padding: "1px 4px" }}>{protectedPlayer.pos}</span>
                            </div>
                          </>
                        ) : dbPick ? (
                          <>
                            {isLotteryPick && <div style={{ fontSize: "0.5rem", fontWeight: 800, color: "oklch(0.5 0.2 300)", textAlign: "center", letterSpacing: "0.04em" }}>{cellOwner}</div>}
                            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700, color: "oklch(0.22 0.08 150)", textAlign: "center", lineHeight: 1.2, padding: "0 2px" }}>{dbPick.player_name}</div>
                            <div style={{ textAlign: "center", marginTop: 2 }}>
                              <span style={{ fontSize: "0.55rem", fontWeight: 700, color: "white", background: POS_COLORS[dbPick.player_pos] || "#64748b", borderRadius: 3, padding: "1px 3px" }}>{dbPick.player_pos}</span>
                            </div>
                          </>
                        ) : isCurrent ? (
                          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700, color: "oklch(0.15 0.02 150)", textAlign: "center" }}>ON CLOCK</div>
                        ) : (
                          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
                            {round}.{pickInRound}
                            {isTraded && <div style={{ fontSize: "0.5rem", color: "oklch(0.78 0.15 85 / 0.7)" }}>T</div>}
                            {isLotteryPick && <div style={{ fontSize: "0.48rem", fontWeight: 700, color: "oklch(0.6 0.2 300)" }}>{cellOwner}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Pick List — vertical, scrollable, overall pick order */}
        {boardView === "list" && (
          <div style={{ maxHeight: 720, overflowY: "auto", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, marginBottom: "1.5rem", background: "rgba(8,10,16,0.88)" }}>
            {Array.from({ length: TOTAL_ROUNDS }, (_, r) => r + 1).flatMap(round => [
              <div
                key={`round-header-${round}`}
                style={{
                  padding: "0.5rem 0.9rem",
                  background: "oklch(0.18 0.06 150)",
                  borderBottom: "2px solid oklch(0.78 0.15 85 / 0.45)",
                  borderTop: round > 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontWeight: 800,
                  fontSize: "0.92rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: "oklch(0.78 0.15 85)",
                }}
              >
                Round {round}
              </div>,
              ...Array.from({ length: TOTAL_TEAMS }, (_, physicalPick) => {
                const pickInRound = physicalPick + 1;
                const overall = (round - 1) * TOTAL_TEAMS + pickInRound;
                const draftOrderPick = resolvedDraftOrder.find(dp => dp.round === round && dp.pickInRound === pickInRound);
                const owner = draftOrderPick?.owner ?? "?";
                const cellKey = `${round}-${physicalPick}`;
                const dbPick = picksMap[cellKey];
                const protectedPlayer = protectedMap[cellKey];
                const isRowCurrent = started && !complete && round === curRound && physicalPick === curPick && !protectedPlayer;
                return (
                  <div
                    key={overall}
                    ref={isRowCurrent ? currentListRowRef : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.6rem 0.9rem",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: isRowCurrent ? "oklch(0.78 0.15 85 / 0.18)" : overall % 2 === 0 ? "rgba(255,255,255,0.05)" : "transparent",
                    }}
                  >
                    <span className="pick-list-overall" style={{ width: 46, flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>#{overall}</span>
                    <span className="pick-list-roundpick" style={{ width: 50, flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{round}.{String(pickInRound).padStart(2, "0")}</span>
                    <span
                      className="pick-list-owner"
                      title={draftOrderPick?.isTraded ? `Originally ${draftOrderPick.originalOwner}'s pick` : undefined}
                      style={{
                        width: pickListOwnerWidthDesktop,
                        "--pick-owner-mobile-width": `${pickListOwnerWidthMobile}px`,
                        flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.86rem", fontWeight: 700,
                        color: OWNER_COLORS[owner] ? "white" : "rgba(255,255,255,0.6)",
                        background: OWNER_COLORS[owner] ?? "transparent", borderRadius: 4, padding: "3px 7px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      } as React.CSSProperties}
                    >
                      {owner}{draftOrderPick?.isTraded ? ` (${draftOrderPick.originalOwner})` : ""}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {protectedPlayer ? (
                        <>
                          <span style={{ fontSize: "0.85rem" }}>🔒</span>
                          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.98rem", color: "oklch(0.85 0.1 85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{protectedPlayer.name}</span>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "white", background: POS_COLORS[protectedPlayer.pos] || "#64748b", borderRadius: 3, padding: "2px 5px", flexShrink: 0 }}>{protectedPlayer.pos}</span>
                        </>
                      ) : dbPick ? (
                        <>
                          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.98rem", color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dbPick.player_name}</span>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "white", background: POS_COLORS[dbPick.player_pos] || "#64748b", borderRadius: 3, padding: "2px 5px", flexShrink: 0 }}>{dbPick.player_pos}</span>
                        </>
                      ) : isRowCurrent ? (
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.92rem", color: "oklch(0.78 0.15 85)", letterSpacing: "0.05em" }}>ON THE CLOCK</span>
                      ) : (
                        <span style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.25)" }}>—</span>
                      )}
                    </span>
                  </div>
                );
              }),
            ])}
          </div>
        )}


      </div>
    </div>
  );
}
