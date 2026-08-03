/**
 * WRC Fantasy Football - Lineup Page
 * Layout: Starters on top (full width), Bench below (full width)
 * Clicking any player opens an inline replacement panel showing eligible swap candidates
 * TE Premium: 1.5x PPR for TE position regardless of slot
 */
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, CheckCircle2, ChevronDown, ArrowLeftRight, X } from "lucide-react";

const STARTER_SLOTS = [
  { slot: "QB",    label: "Quarterback",   eligible: ["QB"] },
  { slot: "RB1",   label: "Running Back",  eligible: ["RB"] },
  { slot: "RB2",   label: "Running Back",  eligible: ["RB"] },
  { slot: "WR1",   label: "Wide Receiver", eligible: ["WR"] },
  { slot: "WR2",   label: "Wide Receiver", eligible: ["WR"] },
  { slot: "TE",    label: "Tight End",     eligible: ["TE"] },
  { slot: "SFLEX", label: "Super Flex",    eligible: ["QB","RB","WR","TE"] },
  { slot: "FLEX",  label: "Flex",          eligible: ["RB","WR","TE"] },
  { slot: "K",     label: "Kicker",        eligible: ["K"] },
  { slot: "DST",   label: "Defense / ST",  eligible: ["DST"] },
];

interface Player {
  id: string;
  name: string;
  nflTeam: string;
  pos: string;
  pts: number;
  proj: number;
  status: string;
  slot?: string;
  isBench?: boolean;
}

const MOCK_STARTERS: Player[] = [
  { id: "s1",  slot: "QB",    name: "Josh Allen",        nflTeam: "BUF", pos: "QB",  pts: 34.2, proj: 38.0, status: "Active" },
  { id: "s2",  slot: "RB1",   name: "Derrick Henry",     nflTeam: "BAL", pos: "RB",  pts: 18.6, proj: 22.0, status: "Active" },
  { id: "s3",  slot: "RB2",   name: "Saquon Barkley",    nflTeam: "PHI", pos: "RB",  pts: 22.4, proj: 24.5, status: "Active" },
  { id: "s4",  slot: "WR1",   name: "Tyreek Hill",       nflTeam: "MIA", pos: "WR",  pts: 14.8, proj: 18.0, status: "Active" },
  { id: "s5",  slot: "WR2",   name: "CeeDee Lamb",       nflTeam: "DAL", pos: "WR",  pts: 28.6, proj: 26.0, status: "Active" },
  { id: "s6",  slot: "TE",    name: "Sam LaPorta",       nflTeam: "DET", pos: "TE",  pts: 16.5, proj: 14.0, status: "Active" },
  { id: "s7",  slot: "SFLEX", name: "Lamar Jackson",     nflTeam: "BAL", pos: "QB",  pts: 42.1, proj: 40.0, status: "Active" },
  { id: "s8",  slot: "FLEX",  name: "Jahmyr Gibbs",      nflTeam: "DET", pos: "RB",  pts: 19.8, proj: 21.0, status: "Active" },
  { id: "s9",  slot: "K",     name: "Harrison Butker",   nflTeam: "KC",  pos: "K",   pts: 8.0,  proj: 9.0,  status: "Active" },
  { id: "s10", slot: "DST",   name: "San Francisco 49ers", nflTeam: "SF", pos: "DST", pts: 12.0, proj: 11.0, status: "Active" },
];

const MOCK_BENCH: Player[] = [
  { id: "b1", name: "Jaylen Waddle",    nflTeam: "MIA", pos: "WR",  pts: 11.2, proj: 13.0, status: "Active", isBench: true },
  { id: "b2", name: "Tony Pollard",     nflTeam: "TEN", pos: "RB",  pts: 8.4,  proj: 10.0, status: "Active", isBench: true },
  { id: "b3", name: "Kyle Pitts",       nflTeam: "ATL", pos: "TE",  pts: 7.6,  proj: 9.5,  status: "Q",      isBench: true },
  { id: "b4", name: "Gus Edwards",      nflTeam: "LAC", pos: "RB",  pts: 4.2,  proj: 6.0,  status: "Active", isBench: true },
  { id: "b5", name: "Elijah Moore",     nflTeam: "CLE", pos: "WR",  pts: 6.8,  proj: 8.0,  status: "Active", isBench: true },
  { id: "b6", name: "Evan McPherson",   nflTeam: "CIN", pos: "K",   pts: 5.0,  proj: 7.0,  status: "Active", isBench: true },
  { id: "b7", name: "Pittsburgh Steelers", nflTeam: "PIT", pos: "DST", pts: 9.0, proj: 8.5, status: "Active", isBench: true },
  { id: "b8", name: "Tyjae Spears",     nflTeam: "TEN", pos: "RB",  pts: 3.6,  proj: 5.0,  status: "Active", isBench: true },
];

const STATUS_COLORS: Record<string, string> = {
  Active: "oklch(0.42 0.15 150)",
  Q:      "oklch(0.60 0.18 85)",
  D:      "oklch(0.55 0.22 25)",
  OUT:    "oklch(0.50 0.22 25)",
  IR:     "oklch(0.50 0.22 25)",
};

const STATUS_BG: Record<string, string> = {
  Active: "oklch(0.94 0.05 150)",
  Q:      "oklch(0.97 0.08 85)",
  D:      "oklch(0.95 0.06 25)",
  OUT:    "oklch(0.95 0.06 25)",
  IR:     "oklch(0.95 0.06 25)",
};

const POS_COLORS: Record<string, string> = {
  QB:  "oklch(0.42 0.18 260)",
  RB:  "oklch(0.38 0.15 150)",
  WR:  "oklch(0.42 0.18 220)",
  TE:  "oklch(0.55 0.16 85)",
  K:   "oklch(0.50 0.04 150)",
  DST: "oklch(0.45 0.18 25)",
};

export default function Lineup() {
  const { franchise } = useAuth();
  const [starters, setStarters] = useState<Player[]>(MOCK_STARTERS);
  const [bench, setBench] = useState<Player[]>(MOCK_BENCH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lineupLocked = false;

  const totalPts = starters.reduce((s, p) => s + p.pts, 0);
  const totalProj = starters.reduce((s, p) => s + p.proj, 0);

  // Find the selected player (starter or bench)
  const selectedPlayer =
    starters.find(p => p.id === selectedId) ||
    bench.find(p => p.id === selectedId) || null;

  // Get eligible bench players to swap with a starter slot
  const getEligibleSwaps = (slotKey: string, currentPlayer: Player | undefined): Player[] => {
    const slotDef = STARTER_SLOTS.find(s => s.slot === slotKey);
    if (!slotDef) return bench;
    return bench.filter(b => slotDef.eligible.includes(b.pos));
  };

  // Get eligible starter slots a bench player can fill
  const getEligibleSlots = (benchPlayer: Player): typeof STARTER_SLOTS => {
    return STARTER_SLOTS.filter(s => s.eligible.includes(benchPlayer.pos));
  };

  // Perform the swap
  const doSwap = (starterId: string, benchId: string) => {
    const starterIdx = starters.findIndex(p => p.id === starterId);
    const benchIdx   = bench.findIndex(p => p.id === benchId);
    if (starterIdx === -1 || benchIdx === -1) return;

    const newStarters = [...starters];
    const newBench    = [...bench];
    const slot        = newStarters[starterIdx].slot;

    // Swap players, preserving slot assignment
    const tmp = { ...newStarters[starterIdx] };
    newStarters[starterIdx] = { ...newBench[benchIdx], slot, isBench: false };
    newBench[benchIdx]      = { ...tmp, slot: undefined, isBench: true };

    setStarters(newStarters);
    setBench(newBench);
    setSelectedId(null);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Determine what the replacement panel shows
  // If a starter is selected: show eligible bench players
  // If a bench player is selected: show eligible starters to replace
  const isStarterSelected = selectedPlayer && !selectedPlayer.isBench;
  const isBenchSelected   = selectedPlayer && selectedPlayer.isBench;

  const replacementOptions: Array<{ label: string; player: Player; swapWith: string }> = [];
  if (isStarterSelected && selectedPlayer.slot) {
    const eligibles = getEligibleSwaps(selectedPlayer.slot, selectedPlayer);
    eligibles.forEach(b => replacementOptions.push({ label: "Move to bench", player: b, swapWith: selectedPlayer.id }));
  } else if (isBenchSelected) {
    const eligibleSlots = getEligibleSlots(selectedPlayer);
    eligibleSlots.forEach(slotDef => {
      const starterInSlot = starters.find(s => s.slot === slotDef.slot);
      if (starterInSlot) {
        replacementOptions.push({ label: slotDef.slot, player: starterInSlot, swapWith: starterInSlot.id });
      }
    });
  }

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>My Lineup</h1>
            <p>{franchise?.team_name || "Select a team"} — Week 14 · Lock: Sun 1:00pm ET</p>
          </div>
          {lineupLocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.4rem 0.875rem" }}>
              <Lock size={14} color="#ef4444" />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", color: "#ef4444", letterSpacing: "0.04em" }}>LINEUP LOCKED</span>
            </div>
          ) : (
            <button onClick={handleSave} style={{
              background: saved ? "oklch(0.42 0.15 150)" : "oklch(0.28 0.09 150)",
              color: "white", border: "none", borderRadius: 8,
              padding: "0.5rem 1.25rem",
              fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase" as const,
              cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem",
              transition: "background 0.2s",
            }}>
              {saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Lineup"}
            </button>
          )}
        </div>

        {/* Points summary bar */}
        <div style={{
          background: "oklch(0.18 0.06 150)",
          borderRadius: 10,
          padding: "0.6rem 1.25rem",
          display: "flex",
          gap: "2rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "0.65rem", color: "oklch(0.75 0.06 150)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Total Points</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "oklch(0.88 0.15 85)", lineHeight: 1 }}>{totalPts.toFixed(1)}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "oklch(0.75 0.06 150)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Projected</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "white", lineHeight: 1 }}>{totalProj.toFixed(1)}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "oklch(0.75 0.06 150)" }}>
              {lineupLocked ? "Lineup is locked" : "Tap a player to see swap options"}
            </span>
          </div>
        </div>

        {/* ── STARTERS ── */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Starting Lineup
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.78 0.15 85)" }}>{totalPts.toFixed(1)} pts · Proj {totalProj.toFixed(1)}</span>
          </div>

          {STARTER_SLOTS.map(({ slot, label }) => {
            const player = starters.find(p => p.slot === slot);
            const isSelected = selectedId === player?.id;

            // Eligible bench swaps for this slot
            const slotDef = STARTER_SLOTS.find(s => s.slot === slot)!;
            const eligibleBench = bench.filter(b => slotDef.eligible.includes(b.pos));

            return (
              <div key={slot}>
                {/* Player row */}
                <div
                  onClick={() => {
                    if (lineupLocked || !player) return;
                    setSelectedId(isSelected ? null : player.id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.65rem 1rem",
                    borderBottom: isSelected ? "none" : "1px solid oklch(0.93 0.005 150)",
                    cursor: lineupLocked ? "default" : "pointer",
                    background: isSelected ? "oklch(0.94 0.04 150)" : "white",
                    transition: "background 0.12s",
                  }}
                >
                  {/* Slot badge */}
                  <div style={{
                    width: 52, textAlign: "center",
                    fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", fontWeight: 700,
                    letterSpacing: "0.06em", color: "white",
                    background: player ? POS_COLORS[player.pos] || "oklch(0.5 0.04 150)" : "oklch(0.75 0.02 150)",
                    borderRadius: 4, padding: "2px 0", flexShrink: 0,
                  }}>
                    {slot}
                  </div>

                  {player ? (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {player.name}
                          {player.pos === "TE" && (
                            <span style={{ marginLeft: 6, fontSize: "0.6rem", background: "oklch(0.92 0.1 85)", color: "oklch(0.35 0.15 85)", borderRadius: 3, padding: "1px 4px", fontWeight: 700 }}>1.5x</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{player.pos} · {player.nflTeam}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, fontFamily: "Oswald, sans-serif",
                          padding: "1px 6px", borderRadius: 3,
                          background: STATUS_BG[player.status] || "oklch(0.94 0.02 150)",
                          color: STATUS_COLORS[player.status] || "oklch(0.5 0.04 150)",
                        }}>{player.status}</span>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                          <div style={{ fontSize: "0.65rem", color: "oklch(0.6 0.04 150)" }}>Proj {player.proj.toFixed(1)}</div>
                        </div>
                        {!lineupLocked && (
                          isSelected
                            ? <X size={14} color="oklch(0.5 0.04 150)" />
                            : <ChevronDown size={14} color="oklch(0.7 0.04 150)" />
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ flex: 1, color: "oklch(0.7 0.02 150)", fontSize: "0.85rem", fontStyle: "italic" }}>Empty — {label}</div>
                  )}
                </div>

                {/* Inline replacement panel — shown when this starter is selected */}
                {isSelected && !lineupLocked && (
                  <div style={{
                    background: "oklch(0.96 0.02 150)",
                    borderBottom: "1px solid oklch(0.88 0.01 150)",
                    padding: "0.5rem 1rem 0.75rem",
                  }}>
                    <div style={{ fontSize: "0.68rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                      Replace with bench player:
                    </div>
                    {eligibleBench.length === 0 ? (
                      <div style={{ fontSize: "0.8rem", color: "oklch(0.6 0.04 150)", fontStyle: "italic" }}>No eligible bench players for this slot</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.35rem" }}>
                        {eligibleBench.map(bp => (
                          <div
                            key={bp.id}
                            onClick={(e) => { e.stopPropagation(); doSwap(player!.id, bp.id); }}
                            style={{
                              display: "flex", alignItems: "center", gap: "0.65rem",
                              padding: "0.5rem 0.75rem",
                              background: "white",
                              borderRadius: 6,
                              border: "1px solid oklch(0.88 0.01 150)",
                              cursor: "pointer",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.92 0.04 150)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "white")}
                          >
                            <div style={{
                              width: 36, textAlign: "center",
                              fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", fontWeight: 700,
                              color: "white", background: POS_COLORS[bp.pos] || "oklch(0.5 0.04 150)",
                              borderRadius: 3, padding: "2px 0", flexShrink: 0,
                            }}>{bp.pos}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bp.name}</div>
                              <div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>{bp.nflTeam}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                              <span style={{
                                fontSize: "0.62rem", fontWeight: 700, fontFamily: "Oswald, sans-serif",
                                padding: "1px 5px", borderRadius: 3,
                                background: STATUS_BG[bp.status] || "oklch(0.94 0.02 150)",
                                color: STATUS_COLORS[bp.status] || "oklch(0.5 0.04 150)",
                              }}>{bp.status}</span>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.08 150)" }}>{bp.pts.toFixed(1)}</div>
                                <div style={{ fontSize: "0.62rem", color: "oklch(0.6 0.04 150)" }}>Proj {bp.proj.toFixed(1)}</div>
                              </div>
                              <ArrowLeftRight size={13} color="oklch(0.28 0.09 150)" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── BENCH ── */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Bench
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.6 0.04 150)" }}>{bench.length} players</span>
          </div>

          {bench.map((player, i) => {
            const isSelected = selectedId === player.id;
            const eligibleSlots = getEligibleSlots(player);

            return (
              <div key={player.id}>
                {/* Bench player row */}
                <div
                  onClick={() => {
                    if (lineupLocked) return;
                    setSelectedId(isSelected ? null : player.id);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.65rem 1rem",
                    borderBottom: isSelected ? "none" : "1px solid oklch(0.93 0.005 150)",
                    cursor: lineupLocked ? "default" : "pointer",
                    background: isSelected ? "oklch(0.94 0.04 150)" : "white",
                    transition: "background 0.12s",
                  }}
                >
                  <div style={{
                    width: 52, textAlign: "center",
                    fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", fontWeight: 700,
                    letterSpacing: "0.06em", color: "white",
                    background: POS_COLORS[player.pos] || "oklch(0.5 0.04 150)",
                    borderRadius: 4, padding: "2px 0", flexShrink: 0,
                  }}>{player.pos}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{player.pos} · {player.nflTeam}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, fontFamily: "Oswald, sans-serif",
                      padding: "1px 6px", borderRadius: 3,
                      background: STATUS_BG[player.status] || "oklch(0.94 0.02 150)",
                      color: STATUS_COLORS[player.status] || "oklch(0.5 0.04 150)",
                    }}>{player.status}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                      <div style={{ fontSize: "0.65rem", color: "oklch(0.6 0.04 150)" }}>Proj {player.proj.toFixed(1)}</div>
                    </div>
                    {!lineupLocked && (
                      isSelected
                        ? <X size={14} color="oklch(0.5 0.04 150)" />
                        : <ChevronDown size={14} color="oklch(0.7 0.04 150)" />
                    )}
                  </div>
                </div>

                {/* Inline replacement panel — shown when this bench player is selected */}
                {isSelected && !lineupLocked && (
                  <div style={{
                    background: "oklch(0.96 0.02 150)",
                    borderBottom: "1px solid oklch(0.88 0.01 150)",
                    padding: "0.5rem 1rem 0.75rem",
                  }}>
                    <div style={{ fontSize: "0.68rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                      Move to starting slot:
                    </div>
                    {eligibleSlots.length === 0 ? (
                      <div style={{ fontSize: "0.8rem", color: "oklch(0.6 0.04 150)", fontStyle: "italic" }}>No eligible starting slots</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.35rem" }}>
                        {eligibleSlots.map(slotDef => {
                          const currentStarter = starters.find(s => s.slot === slotDef.slot);
                          return (
                            <div
                              key={slotDef.slot}
                              onClick={(e) => { e.stopPropagation(); if (currentStarter) doSwap(currentStarter.id, player.id); }}
                              style={{
                                display: "flex", alignItems: "center", gap: "0.65rem",
                                padding: "0.5rem 0.75rem",
                                background: "white", borderRadius: 6,
                                border: "1px solid oklch(0.88 0.01 150)",
                                cursor: "pointer", transition: "background 0.1s",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.92 0.04 150)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "white")}
                            >
                              {/* Slot badge */}
                              <div style={{
                                width: 52, textAlign: "center",
                                fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", fontWeight: 700,
                                color: "white", background: "oklch(0.28 0.09 150)",
                                borderRadius: 3, padding: "2px 0", flexShrink: 0,
                              }}>{slotDef.slot}</div>
                              {/* Current starter in that slot */}
                              {currentStarter ? (
                                <>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentStarter.name}</div>
                                    <div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>moves to bench</div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                                    <div style={{ textAlign: "right" }}>
                                      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.08 150)" }}>{currentStarter.pts.toFixed(1)}</div>
                                      <div style={{ fontSize: "0.62rem", color: "oklch(0.6 0.04 150)" }}>Proj {currentStarter.proj.toFixed(1)}</div>
                                    </div>
                                    <ArrowLeftRight size={13} color="oklch(0.28 0.09 150)" />
                                  </div>
                                </>
                              ) : (
                                <div style={{ flex: 1, color: "oklch(0.6 0.04 150)", fontSize: "0.82rem", fontStyle: "italic" }}>Empty slot — insert {player.name}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
