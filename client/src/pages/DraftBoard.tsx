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
 *   - Player pool: ~250 NFL players sorted by ADP, filtered by position/search
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Pause, SkipForward, Search, Music, ArrowLeftRight, RotateCcw, Wifi, WifiOff, ChevronUp, ChevronDown, ListOrdered, Plus, Check } from "lucide-react";
import { DRAFT_PICKS_2026, getTradedPicks } from "@/lib/draftData2026";
import { OWNER_TO_TEAM } from "@/lib/scheduleData2026";
import { NFL_PLAYERS_2026, getAvailablePlayers, type NFLPlayer } from "@/lib/nflPlayers2026";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { fetchPlayerByName, getTeamLogoUrl } from "@/hooks/useTank01Player";
import { useDraftQueue } from "@/hooks/useDraftQueue";
import { useNFLADP } from "@/hooks/useNFLADP";

// ── Constants ─────────────────────────────────────────────────────────────────
const TIMER_SECONDS = 90;
const TOTAL_ROUNDS = 18;
const TOTAL_TEAMS = 12;
const DRAFT_DATE = new Date("2026-08-27T19:00:00-04:00");

// Round 1 pick order (snake draft — even rounds reverse)
const ROUND1_ORDER = [
  "Greg","Shawn","Bill","David R.","Jason","Scott N.",
  "David S.","Jonas","Jamie","Keith","Scott M.","Dan",
];

const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

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

type BoardView = "live" | "order" | "traded" | "queue";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getOwnerForSlot(round: number, pickIdx: number): string {
  // Find the pick in DRAFT_PICKS_2026 that matches round + pickInRound
  const match = DRAFT_PICKS_2026.find(p => p.round === round && p.pickInRound === pickIdx + 1);
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
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Thu Aug 27, 2026 · 7:00 PM ET</span>
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
  const [showPlayerPool, setShowPlayerPool] = useState(false);
  const [boardView, setBoardView] = useState<BoardView>("live");
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
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
  // Tracks which pick IDs have been revealed (shown in board after overlay)
  const [revealedPickIds, setRevealedPickIds] = useState<Set<number>>(new Set());

  // Draft queue hook
  const franchiseId = franchise?.id ?? null;
  const { queue, addToQueue, removeFromQueue, moveItem, isQueued } = useDraftQueue(franchiseId);

  // Live ADP from Tank01
  const { adpMap } = useNFLADP();

  // Helper: get ADP for a player (falls back to static adp field)
  const getADP = (name: string, staticAdp: number) =>
    adpMap.get(name.toLowerCase()) ?? staticAdp;

  // Load rostered player names from Supabase to exclude from queue browser
  const [rosteredNames, setRosteredNames] = useState<Set<string>>(new Set());
  useEffect(() => {
    supabase
      .from("players")
      .select("name")
      .not("team_id", "is", null)
      .then(({ data }) => {
        if (data) setRosteredNames(new Set(data.map((p: { name: string }) => p.name.toLowerCase())));
      });
  }, []);

  // Drafted player names (for graying out in queue)
  const draftedNames = useMemo(() => new Set(dbPicks.map(p => p.player_name)), [dbPicks]);
  const draftedNamesLower = useMemo(() => new Set(dbPicks.map(p => p.player_name.toLowerCase())), [dbPicks]);

  // Queue browser filtered players
  const queueFilteredPlayers = useMemo(() => {
    return NFL_PLAYERS_2026.filter(p => {
      // Only show undrafted players not already in the queue
      if (draftedNames.has(p.name)) return false;
      // Exclude players already on a WRC roster
      if (rosteredNames.has(p.name.toLowerCase())) return false;
      if (queue.some(q => q.player_name.toLowerCase() === p.name.toLowerCase())) return false;
      if (queuePosFilter !== "ALL" && p.pos !== queuePosFilter) return false;
      if (queueSearch) {
        const q = queueSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.nflTeam.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => getADP(a.name, a.adp) - getADP(b.name, b.adp));
  }, [queueSearch, queuePosFilter, draftedNames, queue, rosteredNames, adpMap]);

  // Pre-load the chime audio on mount
  useEffect(() => {
    const audio = new Audio("/manus-storage/nfl-draft-chime_9c48384a.mp3");
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

  // Current owner on the clock
  const currentOwner = getOwnerForSlot(curRound, curPick);
  const currentTeamName = getTeamForOwner(currentOwner);
  const isMyTurn = franchise?.team_name === currentTeamName || franchise?.owner === currentOwner;

  // Available player pool
  const availablePlayers = useMemo(() => getAvailablePlayers(draftedNames), [draftedNames]);
  const filteredPlayers = useMemo(() => {
    return availablePlayers.filter(p => {
      const matchPos = posFilter === "ALL" || p.pos === posFilter;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.nflTeam.toLowerCase().includes(search.toLowerCase());
      return matchPos && matchSearch;
    }).sort((a, b) => getADP(a.name, a.adp) - getADP(b.name, b.adp));
  }, [availablePlayers, posFilter, search, adpMap]);

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

  // ── Commissioner actions ──
  async function updateDraftState(patch: Partial<DbDraftState>) {
    const { error } = await supabase
      .from("draft_state")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) toast.error("Failed to update draft state: " + error.message);
  }

  async function handleStartDraft() {
    await updateDraftState({ started: true, paused: false, complete: false, current_round: 1, current_pick: 0, timer_seconds: TIMER_SECONDS });
    setTimer(TIMER_SECONDS);
    toast.success("Draft started! 🏈");
  }

  async function handlePauseResume() {
    await updateDraftState({ paused: !paused });
  }

  async function handleSkip() {
    if (!isCommissioner) return;
    const nextPick = curPick + 1 >= TOTAL_TEAMS ? 0 : curPick + 1;
    const nextRound = curPick + 1 >= TOTAL_TEAMS ? curRound + 1 : curRound;
    if (nextRound > TOTAL_ROUNDS) {
      await updateDraftState({ complete: true });
      toast.success("Draft complete! 🏆");
      return;
    }
    await updateDraftState({ current_round: nextRound, current_pick: nextPick, paused: false, timer_seconds: TIMER_SECONDS });
    setTimer(TIMER_SECONDS);
  }

  async function handleReset() {
    if (!isCommissioner) return;
    if (!confirm("Reset the entire draft? This will delete all picks and cannot be undone.")) return;
    await supabase.from("draft_picks").delete().neq("id", 0);
    await updateDraftState({ started: false, paused: false, complete: false, current_round: 1, current_pick: 0, timer_seconds: TIMER_SECONDS });
    setDbPicks([]);
    setTimer(TIMER_SECONDS);
    toast.success("Draft reset.");
  }

  // ── Make a pick ──
  const handlePickPlayer = useCallback(async (player: NFLPlayer) => {
    if (!started || complete || submitting) return;
    if (!isMyTurn && !isCommissioner) return;

    setSubmitting(true);
    const overall = (curRound - 1) * TOTAL_TEAMS + curPick + 1;

    const { error: pickError } = await supabase.from("draft_picks").insert({
      round: curRound,
      pick: curPick,
      overall,
      team_name: currentTeamName,
      owner: currentOwner,
      player_name: player.name,
      player_pos: player.pos,
      player_nfl_team: player.nflTeam,
    });

    if (pickError) {
      toast.error("Pick failed: " + pickError.message);
      setSubmitting(false);
      return;
    }

    // Update players table: assign player to drafting team so roster/lineup pages update immediately
    const draftingTeamId = OWNER_TO_TEAM_ID[currentOwner];
    if (draftingTeamId) {
      // Try to find the player by name in the players table and update their team_id
      const { error: rosterError } = await supabase
        .from("players")
        .update({
          team_id: draftingTeamId,
          acquisition: `Rd ${curRound}`,
          draft_round: curRound,
        })
        .ilike("name", player.name);
      if (rosterError) {
        console.warn("[Draft] Could not update players table for", player.name, rosterError.message);
      }
    }

    // Advance to next pick
    const nextPick = curPick + 1 >= TOTAL_TEAMS ? 0 : curPick + 1;
    const nextRound = curPick + 1 >= TOTAL_TEAMS ? curRound + 1 : curRound;
    const isDraftComplete = nextRound > TOTAL_ROUNDS;

    await updateDraftState({
      current_round: isDraftComplete ? curRound : nextRound,
      current_pick: isDraftComplete ? curPick : nextPick,
      complete: isDraftComplete,
      paused: false,
      timer_seconds: TIMER_SECONDS,
    });

    setShowPlayerPool(false);
    setSubmitting(false);
    toast.success(`${player.name} drafted by ${currentTeamName}!`);

    if (isDraftComplete) toast.success("Draft complete! 🏆");
  }, [started, complete, submitting, isMyTurn, isCommissioner, curRound, curPick, currentTeamName, currentOwner]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-stadium-night bg-overlay" style={{ minHeight: "100vh" }}>
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
    <div className="bg-stadium-night bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "1rem 1rem 3rem" }}>

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
                  const topQueued = queue.find(q => !draftedNamesLower.has(q.player_name.toLowerCase()));
                  if (!topQueued) return null;
                  const qPlayer = NFL_PLAYERS_2026.find(p => p.name.toLowerCase() === topQueued.player_name.toLowerCase());
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
                <button
                  onClick={() => setShowPlayerPool(true)}
                  disabled={submitting}
                  style={{ background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Saving..." : "Make Pick"}
                </button>
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

        {/* Draft Grid */}
        <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
          <div style={{ minWidth: TOTAL_TEAMS * 110 + 60 }}>
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
              // For even rounds, column order reverses (snake)
              const colOwners = round % 2 === 1 ? ROUND1_ORDER : [...ROUND1_ORDER].reverse();
              return (
                <div key={r} style={{ display: "grid", gridTemplateColumns: `60px repeat(${TOTAL_TEAMS}, 1fr)`, gap: 2, marginBottom: 2 }}>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: "0.4rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {round}
                    {round <= 2 && <span style={{ fontSize: "0.5rem", color: "oklch(0.78 0.15 85)", marginLeft: 2 }}>L</span>}
                  </div>
                  {colOwners.map((colOwner, p) => {
                    // Find the actual pick for this cell using DRAFT_PICKS_2026 order
                    const pickInRound = p + 1;
                    const draftOrderPick = DRAFT_PICKS_2026.find(dp => dp.round === round && dp.pickInRound === pickInRound);
                    const cellOwner = draftOrderPick?.owner ?? colOwner;
                    const cellKey = `${round}-${p}`;
                    const dbPick = picksMap[cellKey];
                    const isCurrent = started && !complete && round === curRound && p === curPick;
                    const isTraded = draftOrderPick?.isTraded ?? false;

                    return (
                      <div key={p} style={{
                        background: isCurrent ? "oklch(0.78 0.15 85)" : dbPick ? "oklch(0.94 0.01 150)" : "rgba(255,255,255,0.06)",
                        border: isCurrent ? "2px solid oklch(0.65 0.14 85)" : isTraded ? "1.5px solid oklch(0.78 0.15 85 / 0.6)" : "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 4, padding: "0.3rem 0.2rem", minHeight: 52,
                        display: "flex", flexDirection: "column", justifyContent: "center",
                        transition: "background 0.2s",
                        animation: isCurrent ? "gold-pulse 1.4s ease-in-out infinite" : dbPick ? "fadeInUp 0.25s ease both" : "none",
                        cursor: isCurrent && (isMyTurn || isCommissioner) ? "pointer" : "default",
                      }}
                        onClick={() => { if (isCurrent && (isMyTurn || isCommissioner)) setShowPlayerPool(true); }}
                      >
                        {dbPick ? (
                          <>
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

        {/* View Tabs */}
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem", background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 4, width: "fit-content" }}>
          {(["live","order","traded","queue"] as BoardView[]).map(v => (
            <button key={v} onClick={() => setBoardView(v)} style={{ background: boardView === v ? "oklch(0.78 0.15 85)" : "transparent", color: boardView === v ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.65)", border: "none", borderRadius: 6, padding: "0.4rem 0.9rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}>
              {v === "live" ? `Live Board (${dbPicks.length}/${TOTAL_ROUNDS * TOTAL_TEAMS})` : v === "order" ? "Draft Order" : v === "traded" ? `Traded (${tradedPicks.length})` : `My Queue (${queue.filter(q => !draftedNamesLower.has(q.player_name.toLowerCase())).length})`}
            </button>
          ))}
        </div>

        {/* Draft Order View */}
        {boardView === "order" && (
          <div style={{ marginBottom: "1.5rem" }}>
            {Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map(round => {
              const rPicks = DRAFT_PICKS_2026.filter(p => p.round === round);
              const isExp = expandedRound === round;
              return (
                <div key={round} className="wrc-card" style={{ marginBottom: "0.6rem" }}>
                  <div onClick={() => setExpandedRound(isExp ? null : round)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 1rem", cursor: "pointer", borderBottom: isExp ? "1px solid oklch(0.88 0.02 150)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.22 0.08 150)" }}>ROUND {round}</span>
                      <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>Picks {(round-1)*12+1}–{round*12}</span>
                      {rPicks.some(p => p.isTraded) && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "oklch(0.45 0.14 85)", background: "oklch(0.97 0.08 85)", border: "1px solid oklch(0.85 0.12 85)", borderRadius: 4, padding: "1px 6px" }}>{rPicks.filter(p=>p.isTraded).length} traded</span>}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "oklch(0.55 0.04 150)" }}>{isExp ? "▲" : "▼"}</span>
                  </div>
                  {isExp && (
                    <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {rPicks.map(pick => {
                        const made = dbPicks.find(d => d.round === pick.round && d.pick === pick.pickInRound - 1);
                        return (
                          <div key={pick.overall} style={{ background: made ? "oklch(0.94 0.01 150)" : pick.isTraded ? "oklch(0.97 0.08 85)" : "oklch(0.95 0.02 150)", border: `1.5px solid ${pick.isTraded ? "oklch(0.78 0.15 85)" : (OWNER_COLORS[pick.owner] ?? "oklch(0.8 0.04 150)")}`, borderRadius: 5, padding: "3px 8px" }}>
                            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: OWNER_COLORS[pick.owner] ?? "oklch(0.35 0.06 150)" }}>{pick.owner}</span>
                            {pick.isTraded && <span style={{ fontSize: "0.6rem", color: "oklch(0.45 0.14 85)", marginLeft: 4 }}>via {pick.originalOwner}</span>}
                            <div style={{ fontSize: "0.6rem", color: "oklch(0.55 0.04 150)" }}>#{pick.overall}</div>
                            {made && <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "oklch(0.35 0.1 150)" }}>{made.player_name} ({made.player_pos})</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Traded Picks View */}
        {boardView === "traded" && (
          <div className="wrc-card" style={{ marginBottom: "1.5rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ArrowLeftRight size={14} /> Traded Picks ({tradedPicks.length})
            </div>
            <div style={{ padding: "1rem", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid oklch(0.88 0.02 150)" }}>
                    {["#","Round","Pick","Current Owner","Original Owner"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.75rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradedPicks.map((pick, i) => (
                    <tr key={pick.overall} style={{ background: i%2===0?"white":"oklch(0.97 0.005 150)", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                      <td style={{ padding: "0.45rem 0.75rem", fontWeight: 700, color: "oklch(0.35 0.06 150)" }}>#{pick.overall}</td>
                      <td style={{ padding: "0.45rem 0.75rem", color: "oklch(0.45 0.04 150)" }}>Rd {pick.round}</td>
                      <td style={{ padding: "0.45rem 0.75rem", color: "oklch(0.45 0.04 150)" }}>Pick {pick.pickInRound}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}><span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: OWNER_COLORS[pick.owner]??"oklch(0.35 0.06 150)", fontSize: "0.78rem" }}>{pick.owner}</span></td>
                      <td style={{ padding: "0.45rem 0.75rem" }}><span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: OWNER_COLORS[pick.originalOwner!]??"oklch(0.5 0.04 150)", fontSize: "0.78rem" }}>{pick.originalOwner}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── My Queue View ── */}
        {boardView === "queue" && (
          <div style={{ marginBottom: "1.5rem" }}>
            {!franchise ? (
              <div className="wrc-card" style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                <ListOrdered size={28} style={{ margin: "0 auto 0.5rem", display: "block", opacity: 0.4 }} />
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem" }}>Sign in to manage your draft queue</div>
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
                    style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 7, padding: "0.4rem 0.85rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
                  >
                    <Plus size={13} /> Add Players
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
                          style={{ width: "100%", padding: "0.45rem 0.5rem 0.45rem 1.9rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 7, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }}
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
                        const drafted = draftedNamesLower.has(player.name.toLowerCase());
                        const queued = isQueued(player.name);
                        return (
                          <div key={player.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 1rem", borderBottom: "1px solid oklch(0.95 0.003 150)", opacity: drafted ? 0.4 : 1 }}>
                            <span style={{ width: 30, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.66rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 4, padding: "2px 0", flexShrink: 0 }}>{player.pos}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.18 0.05 150)" }}>{player.name}</div>
                              <div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>{player.nflTeam} · ADP {getADP(player.name, player.adp).toFixed(1)}</div>
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
                  <div className="wrc-card">
                    <div className="wrc-card-gold-stripe" />
                    <div className="wrc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>My Queue ({queue.length} players · {queue.filter(q => !draftedNamesLower.has(q.player_name.toLowerCase())).length} available)</span>
                    </div>
                    <div>
                      {queue.map((item, idx) => {
                        const isDrafted = draftedNamesLower.has(item.player_name.toLowerCase());
                        return (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.65rem 1rem", borderBottom: "1px solid oklch(0.95 0.003 150)", opacity: isDrafted ? 0.4 : 1, background: isDrafted ? "oklch(0.97 0.005 150)" : "white" }}>
                            {/* Rank number */}
                            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "oklch(0.55 0.04 150)", width: 20, textAlign: "center", flexShrink: 0 }}>{idx + 1}</span>
                            {/* Pos badge */}
                            <span style={{ width: 30, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.66rem", fontWeight: 700, color: "white", background: POS_COLORS[item.player_pos] || "#64748b", borderRadius: 4, padding: "2px 0", flexShrink: 0 }}>{item.player_pos}</span>
                            {/* Name + team */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: isDrafted ? "oklch(0.55 0.04 150)" : "oklch(0.18 0.05 150)", textDecoration: isDrafted ? "line-through" : "none" }}>{item.player_name}</div>
                              <div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>{item.player_nfl_team ?? ""}{isDrafted ? " · Drafted" : ""}</div>
                            </div>
                            {/* Up/Down buttons */}
                            {!isDrafted && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                                <button onClick={() => moveItem(item.id, "up")} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "oklch(0.85 0.01 150)" : "oklch(0.45 0.06 150)", padding: "1px 3px", display: "flex" }}>
                                  <ChevronUp size={14} />
                                </button>
                                <button onClick={() => moveItem(item.id, "down")} disabled={idx === queue.length - 1} style={{ background: "none", border: "none", cursor: idx === queue.length - 1 ? "default" : "pointer", color: idx === queue.length - 1 ? "oklch(0.85 0.01 150)" : "oklch(0.45 0.06 150)", padding: "1px 3px", display: "flex" }}>
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                            )}
                            {/* Remove button */}
                            <button onClick={() => removeFromQueue(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.22 25)", padding: "2px 4px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Theme Song Note */}
        <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Music size={18} color="oklch(0.78 0.15 85)" />
          <div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "white", letterSpacing: "0.04em" }}>Theme Songs</div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>Each owner can upload their theme song in Account Settings. It plays automatically when they go on the clock.</div>
          </div>
        </div>
      </div>

      {/* Player Pool Modal */}
      {showPlayerPool && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 620, maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
            {/* Modal header */}
            <div style={{ background: "oklch(0.22 0.08 150)", padding: "1rem 1.25rem", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "white", letterSpacing: "0.06em" }}>SELECT A PLAYER</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                  Round {curRound}, Pick {curPick + 1} — {currentTeamName}
                  <span style={{ marginLeft: "0.5rem", color: "oklch(0.78 0.15 85)" }}>{availablePlayers.length} available</span>
                </div>
              </div>
              <button onClick={() => setShowPlayerPool(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "1.2rem", padding: "0.25rem" }}>✕</button>
            </div>

            {/* Search + Position filter */}
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid oklch(0.9 0.005 150)" }}>
              <div style={{ position: "relative", marginBottom: "0.5rem" }}>
                <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or NFL team..."
                  autoFocus
                  style={{ width: "100%", padding: "0.5rem 0.5rem 0.5rem 2rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {["ALL","QB","RB","WR","TE","K","DST"].map(pos => (
                  <button key={pos} onClick={() => setPosFilter(pos)} style={{ padding: "0.25rem 0.6rem", borderRadius: 6, border: "1.5px solid", borderColor: posFilter === pos ? "oklch(0.28 0.09 150)" : "oklch(0.88 0.01 150)", background: posFilter === pos ? "oklch(0.28 0.09 150)" : "white", color: posFilter === pos ? "white" : "oklch(0.4 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Player list */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filteredPlayers.length === 0 ? (
                <div style={{ padding: "2.5rem 1.25rem", textAlign: "center", color: "oklch(0.6 0.04 150)" }}>
                  <Search size={28} style={{ margin: "0 auto 0.5rem", opacity: 0.3, display: "block" }} />
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem" }}>No players found</div>
                  <div style={{ fontSize: "0.78rem", marginTop: "0.25rem", opacity: 0.7 }}>Try a different position or search term.</div>
                </div>
              ) : (
                filteredPlayers.map((player, i) => (
                  <div
                    key={player.id}
                    onClick={() => handlePickPlayer(player)}
                    className="wrc-row-hover"
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1.25rem", borderBottom: "1px solid oklch(0.95 0.003 150)", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1 }}
                  >
                    <span style={{ width: 34, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 4, padding: "2px 0", flexShrink: 0 }}>{player.pos}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)" }}>{player.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>
                        {player.nflTeam}
                        {player.bye && <span style={{ marginLeft: "0.4rem" }}>· Bye {player.bye}</span>}
                        <span style={{ marginLeft: "0.4rem" }}>· ADP {getADP(player.name, player.adp).toFixed(1)}</span>
                      </div>
                    </div>
                    <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, color: "oklch(0.28 0.09 150)", flexShrink: 0 }}>Draft →</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
