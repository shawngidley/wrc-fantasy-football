/**
 * WRC Fantasy Football - Draft Reveal
 * Commissioner-only pre-draft hype sequence: teams appear in random order,
 * one at a time, with their full theme song playing, their logo popping in,
 * and their protected players listed below. Auto-advances to the next team
 * once the song ends (or after a fixed delay if that team has no song).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import TeamLogo from "@/components/TeamLogo";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { Play, SkipForward, RotateCcw, Lock, ArrowRight } from "lucide-react";

const TEAM_META: Record<string, { team_name: string; owner: string }> = {
  "team-jonas":   { team_name: "The Super Snuffleupagus",  owner: "Jonas" },
  "team-davidr":  { team_name: "The Boys of Fall",         owner: "David R." },
  "team-jason":   { team_name: "Heiden's Hardtimes",       owner: "Jason" },
  "team-keith":   { team_name: "HamSandwich",              owner: "Keith" },
  "team-dan":     { team_name: "Legion of Doom",           owner: "Dan" },
  "team-jamie":   { team_name: "The Four Horsemen",        owner: "Jamie" },
  "team-bill":    { team_name: "Billy Goats Gruff",        owner: "Bill" },
  "team-scottn":  { team_name: "Millertime",               owner: "Scott N." },
  "team-shawn":   { team_name: "Vipers",                   owner: "Shawn" },
  "team-davids":  { team_name: "Legends",                  owner: "David S." },
  "team-greg":    { team_name: 'Larry "Bud" Melman123',    owner: "Greg" },
  "team-scottm":  { team_name: "Xavier Musketeers",        owner: "Scott M." },
};

const NO_SONG_DISPLAY_MS = 6000;

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function DraftReveal() {
  const { franchise } = useAuth();
  const [, navigate] = useLocation();
  const themeSongsQuery = trpc.league.teamThemeSongs.useQuery();
  const protectionsQuery = trpc.league.allProtections.useQuery();
  const draftActionMutation = trpc.league.commissionerDraftAction.useMutation();
  const [startingDraft, setStartingDraft] = useState(false);

  const [order, setOrder] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [draftAlreadyStarted, setDraftAlreadyStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const noSongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check whether the live draft has already been started (e.g. the
  // commissioner already clicked Start Draft earlier and is just
  // revisiting this page) -- if so, the initial screen should offer to
  // jump straight into the draft board instead of implying the reveal
  // hasn't happened yet.
  useEffect(() => {
    let mounted = true;
    supabase.from("draft_state").select("started").eq("id", 1).single().then(({ data }) => {
      if (mounted && data) setDraftAlreadyStarted(data.started === true);
    });
    return () => { mounted = false; };
  }, []);

  const songByTeamId: Record<string, string> = {};
  for (const t of themeSongsQuery.data ?? []) {
    if (t.theme_song_url) songByTeamId[t.id] = t.theme_song_url;
  }

  const protectionsByTeamId: Record<string, { name: string; position: string; forfeited_round: number }[]> = {};
  for (const p of protectionsQuery.data ?? []) {
    const playerInfo = Array.isArray(p.players) ? p.players[0] : p.players;
    if (!playerInfo) continue;
    if (!protectionsByTeamId[p.team_id]) protectionsByTeamId[p.team_id] = [];
    protectionsByTeamId[p.team_id].push({ name: playerInfo.name, position: playerInfo.position, forfeited_round: p.forfeited_round });
  }
  for (const teamId of Object.keys(protectionsByTeamId)) {
    protectionsByTeamId[teamId].sort((a, b) => a.forfeited_round - b.forfeited_round);
  }

  const currentTeamId = order[index];
  const currentTeam = currentTeamId ? TEAM_META[currentTeamId] : null;
  const currentProtections = currentTeamId ? protectionsByTeamId[currentTeamId] ?? [] : [];
  const currentSongUrl = currentTeamId ? songByTeamId[currentTeamId] : undefined;

  const advance = () => {
    setIndex(i => {
      const next = i + 1;
      if (next >= order.length) {
        setDone(true);
        setStarted(false);
        return i;
      }
      return next;
    });
  };

  // Play the current team's song (or auto-advance after a fixed delay if
  // they have no song uploaded), whenever the current team changes.
  useEffect(() => {
    if (!started || !currentTeamId) return;
    if (noSongTimerRef.current) clearTimeout(noSongTimerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (currentSongUrl) {
      const audio = new Audio(currentSongUrl);
      audio.volume = 1;
      audio.onended = () => advance();
      audioRef.current = audio;
      audio.play().catch(() => {
        // Autoplay blocked or file error -- don't leave the reveal stuck
        noSongTimerRef.current = setTimeout(advance, NO_SONG_DISPLAY_MS);
      });
    } else {
      noSongTimerRef.current = setTimeout(advance, NO_SONG_DISPLAY_MS);
    }
    return () => {
      if (noSongTimerRef.current) clearTimeout(noSongTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, currentTeamId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (noSongTimerRef.current) clearTimeout(noSongTimerRef.current);
    };
  }, []);

  const handleStart = () => {
    setOrder(shuffle(Object.keys(TEAM_META)));
    setIndex(0);
    setDone(false);
    setStarted(true);
  };

  const handleStartDraft = async () => {
    setStartingDraft(true);
    try {
      await draftActionMutation.mutateAsync({ action: "start" });
      navigate("/draft-presentation");
    } catch {
      setStartingDraft(false);
    }
  };

  const handleSkip = () => {
    if (audioRef.current) audioRef.current.pause();
    if (noSongTimerRef.current) clearTimeout(noSongTimerRef.current);
    advance();
  };

  if (!franchise?.is_commissioner) {
    return (
      <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
        <Navigation showTicker={false} teamName={franchise?.team_name} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ textAlign: "center", color: "white", background: "rgba(0,0,0,0.55)", borderRadius: 12, padding: "2rem 2.5rem" }}>
            <Lock size={28} style={{ marginBottom: "0.75rem", opacity: 0.7 }} />
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem" }}>Commissioners only</div>
            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.65)", marginTop: "0.35rem" }}>This page is for the commissioner to run before draft day.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem 4rem", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "calc(100vh - 56px)", justifyContent: "center" }}>

        {!started && !done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "2rem", color: "white", letterSpacing: "0.04em", marginBottom: "0.5rem", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              WRC DRAFT REVEAL
            </div>
            <div style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.8)", marginBottom: "2rem", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
              12 teams · random order · full theme songs · protections revealed
            </div>
            {draftAlreadyStarted ? (
              <button
                onClick={() => navigate("/draft?tab=board")}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 10, padding: "0.9rem 2.2rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
              >
                Enter Draft <ArrowRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleStart}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 10, padding: "0.9rem 2.2rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
              >
                <Play size={20} fill="currentColor" /> Start Reveal
              </button>
            )}
          </div>
        )}

        {done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "1.8rem", color: "white", marginBottom: "1.5rem", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              All 12 teams revealed! 🏆
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={handleStart}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "0.75rem 1.5rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.92rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
              >
                <RotateCcw size={17} /> Replay Reveal
              </button>
              <button
                onClick={handleStartDraft}
                disabled={startingDraft}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 10, padding: "0.75rem 1.75rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.92rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: startingDraft ? "not-allowed" : "pointer", opacity: startingDraft ? 0.6 : 1, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
              >
                {startingDraft ? "Starting…" : <>Start Draft <ArrowRight size={17} /></>}
              </button>
            </div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.85rem" }}>
              Starts the live draft clock and opens the projector view — draft your own picks from a separate tab on your regular Draft Board.
            </div>
          </div>
        )}

        {started && currentTeam && (
          <div key={currentTeamId} className="wrc-reveal-pop" style={{ textAlign: "center", width: "100%" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em", marginBottom: "1.25rem", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
              TEAM {index + 1} OF {order.length}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
              <TeamLogo teamName={currentTeam.team_name} size={180} style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.5)", border: "4px solid rgba(255,255,255,0.85)" }} />
            </div>

            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "2rem", color: "white", letterSpacing: "0.03em", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
              {currentTeam.team_name}
            </div>
            <div style={{ fontSize: "1rem", color: "rgba(255,255,255,0.85)", marginTop: "0.2rem", marginBottom: "1.75rem", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
              {currentTeam.owner}
            </div>

            <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 12, padding: "1.25rem 1.5rem", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "oklch(0.78 0.15 85)", letterSpacing: "0.08em", marginBottom: "0.65rem" }}>
                PROTECTED PLAYERS
              </div>
              {currentProtections.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>No protections on record</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {currentProtections.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.9rem", color: "white" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.65rem", background: "rgba(255,255,255,0.15)", borderRadius: 3, padding: "1px 6px" }}>{p.position}</span>
                        {p.name}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>Rd {p.forfeited_round}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSkip}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginTop: "2rem", background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "0.55rem 1.2rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
            >
              <SkipForward size={15} /> Skip to Next Team
            </button>

            <div>
              <button
                onClick={handleStartDraft}
                disabled={startingDraft}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 8, padding: "0.55rem 1.2rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", cursor: startingDraft ? "not-allowed" : "pointer", opacity: startingDraft ? 0.6 : 1 }}
              >
                {startingDraft ? "Starting…" : <>Start Draft <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
