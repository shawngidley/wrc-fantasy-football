/**
 * WRC Fantasy Football - Protections (Dynasty Keeper) Page
 *
 * OFFICIAL WRC RULES (Section 5):
 * - Max 3 players total kept per team
 * - Rounds 1-2: INELIGIBLE — cannot be protected
 * - Rounds 3-6: Max ONE player from this tier
 *     Cost: forfeit one round HIGHER than player's draft/protection round
 *     e.g. drafted Rd 4 → forfeit Rd 3 pick
 * - Rounds 7-18 and Free Agents: Max THREE players (combined with Rd 3-6 slot)
 *     Cost: forfeit 6th, 7th, or 8th round pick (owner assigns which)
 *     - If 2+ players protected from this tier, owner assigns protection rounds
 *       starting from Round 6 (6th first, then 7th, then 8th)
 *     - If 6th/7th/8th not available (traded away), use next highest available pick
 * - Forfeited pick must ALWAYS be higher (earlier round #) than player's draft status
 *
 * DEADLINE: Monday August 24, 2026 at 8:00 PM ET
 */
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, AlertTriangle, CheckCircle2, Lock, Info, Clock, ChevronDown, ChevronUp, X } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";

// ── Deadline ─────────────────────────────────────────────────────────────────
const DEADLINE = new Date("2026-08-24T20:00:00-04:00"); // Mon Aug 24 8pm ET

function useDeadlineCountdown() {
  const [ms, setMs] = useState(() => DEADLINE.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setMs(DEADLINE.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const past = ms <= 0;
  const secs = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return { past, d, h, m, s };
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Tier = "ineligible" | "tier1" | "tier2"; // tier1=Rd3-6, tier2=Rd7-18+FA

interface RosterEntry {
  id: string;
  name: string;
  pos: string;
  nflTeam: string;
  byeWeek: number | null;
  acquisition: "Draft" | "FA";
  draftRound: number | null; // null = FA
  tier: Tier;
}

interface ProtectionSlot {
  playerId: string;
  assignedRound: number | null; // for tier2: 6, 7, or 8; for tier1: auto-computed
}

// ── Rules helpers ─────────────────────────────────────────────────────────────
function getTier(draftRound: number | null): Tier {
  if (draftRound === null) return "tier2"; // FA
  if (draftRound <= 2) return "ineligible";
  if (draftRound <= 6) return "tier1";
  return "tier2";
}

function tier1Cost(draftRound: number): number {
  // forfeit one round HIGHER (lower number) than draft round
  return draftRound - 1;
}

const TIER2_ROUNDS = [6, 7, 8]; // assigned in order

// ── Position colors ───────────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

// ── Persistence ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "wrc_protections_v2";
function loadSaved(): Record<string, ProtectionSlot[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}
function saveToDisk(teamId: string, slots: ProtectionSlot[]) {
  const all = loadSaved();
  all[teamId] = slots;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Protections() {
  const { franchise } = useAuth();
  const cd = useDeadlineCountdown();

  const team = TEAMS.find(t => t.id === franchise?.id);

  // Build roster with tier info — use byeWeek column as draft round proxy
  // (In wrcData, byeWeek is the NFL bye week, NOT draft round. Draft round is
  //  stored separately in the 4th arg of p(). We re-use byeWeek as draft round
  //  since the data was entered that way in wrcData.ts.)
  const roster: RosterEntry[] = (team?.players ?? []).map(pl => {
    // byeWeek in wrcData holds the draft round for drafted players
    const draftRound = pl.acquisition === "Draft" ? (pl.byeWeek ?? null) : null;
    return {
      id: pl.id,
      name: pl.name,
      pos: pl.pos,
      nflTeam: pl.nflTeam,
      byeWeek: pl.byeWeek,
      acquisition: pl.acquisition,
      draftRound,
      tier: getTier(draftRound),
    };
  });

  const [slots, setSlots] = useState<ProtectionSlot[]>(() => {
    if (!franchise?.id) return [];
    return loadSaved()[franchise.id] ?? [];
  });
  const [saved, setSaved] = useState(false);
  const [expandRules, setExpandRules] = useState(false);

  useEffect(() => {
    if (franchise?.id) setSlots(loadSaved()[franchise.id] ?? []);
  }, [franchise?.id]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedIds = slots.map(s => s.playerId);
  const tier1Selected = slots.filter(s => {
    const p = roster.find(r => r.id === s.playerId);
    return p?.tier === "tier1";
  });
  const tier2Selected = slots.filter(s => {
    const p = roster.find(r => r.id === s.playerId);
    return p?.tier === "tier2";
  });

  const canAddTier1 = tier1Selected.length < 1;
  const canAddTier2 = tier2Selected.length < 3;
  const totalSelected = slots.length;
  const maxTotal = 3;

  // ── Toggle selection ───────────────────────────────────────────────────────
  const toggle = (entry: RosterEntry) => {
    if (entry.tier === "ineligible") return;
    if (cd.past) return; // deadline passed

    if (selectedIds.includes(entry.id)) {
      // Deselect — remove and re-assign tier2 rounds sequentially
      const newSlots = slots.filter(s => s.playerId !== entry.id);
      setSlots(reassignTier2Rounds(newSlots, roster));
    } else {
      if (totalSelected >= maxTotal) return;
      if (entry.tier === "tier1" && !canAddTier1) return;
      if (entry.tier === "tier2" && !canAddTier2) return;

      const newSlot: ProtectionSlot = {
        playerId: entry.id,
        assignedRound: entry.tier === "tier2" ? null : null, // assigned below
      };
      const newSlots = reassignTier2Rounds([...slots, newSlot], roster);
      setSlots(newSlots);
    }
    setSaved(false);
  };

  // Assign tier2 rounds in order: 6, 7, 8
  function reassignTier2Rounds(s: ProtectionSlot[], r: RosterEntry[]): ProtectionSlot[] {
    let t2idx = 0;
    return s.map(slot => {
      const entry = r.find(x => x.id === slot.playerId);
      if (!entry || entry.tier !== "tier2") return slot;
      const round = TIER2_ROUNDS[t2idx++] ?? 8;
      return { ...slot, assignedRound: round };
    });
  }

  const handleSave = () => {
    if (!franchise?.id || cd.past) return;
    saveToDisk(franchise.id, slots);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Sorted roster: ineligible last, then by tier, then pos ────────────────
  const posOrder = ["QB","RB","WR","TE","K","DST"];
  const sorted = [...roster].sort((a, b) => {
    const tierRank = { tier1: 0, tier2: 1, ineligible: 2 };
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    return posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos);
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>Protections</h1>
            <p>Select up to 3 Dynasty Keepers for the 2026 Draft</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!franchise || cd.past}
            style={{
              background: saved ? "oklch(0.42 0.15 150)" : cd.past ? "rgba(0,0,0,0.3)" : "oklch(0.28 0.09 150)",
              color: "white", border: "none", borderRadius: 8,
              padding: "0.55rem 1.25rem", fontFamily: "Oswald, sans-serif",
              fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", cursor: (franchise && !cd.past) ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: "0.4rem",
              opacity: (franchise && !cd.past) ? 1 : 0.5,
            }}
          >
            {saved ? <><CheckCircle2 size={14} /> Saved!</> : cd.past ? "Deadline Passed" : "Submit Protections"}
          </button>
        </div>

        {/* Deadline Banner */}
        <DeadlineBanner cd={cd} />

        {/* Not logged in */}
        {!franchise && (
          <div style={{ background: "oklch(0.97 0.03 85)", border: "1.5px solid oklch(0.82 0.12 85)", borderRadius: 10, padding: "0.875rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Lock size={16} color="oklch(0.45 0.14 85)" />
            <span style={{ fontSize: "0.88rem", color: "oklch(0.35 0.14 85)", fontWeight: 600 }}>
              Sign in to view your roster and submit protections.
            </span>
          </div>
        )}

        {/* Rules Summary (collapsible) */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <button
            onClick={() => setExpandRules(r => !r)}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.25 0.06 150)" }}>
              <Shield size={14} /> Protection Rules
            </span>
            {expandRules ? <ChevronUp size={16} color="oklch(0.5 0.04 150)" /> : <ChevronDown size={16} color="oklch(0.5 0.04 150)" />}
          </button>
          {expandRules && (
            <div style={{ borderTop: "1px solid oklch(0.92 0.005 150)" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="wrc-table">
                  <thead>
                    <tr>
                      <th>Draft Status</th>
                      <th>Eligible?</th>
                      <th>Max from this tier</th>
                      <th>Forfeited Pick</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Rounds 1–2</td>
                      <td style={{ color: "oklch(0.55 0.22 25)", fontWeight: 700 }}>✗ No</td>
                      <td>0</td>
                      <td>Ineligible</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Rounds 3–6</td>
                      <td style={{ color: "oklch(0.42 0.15 150)", fontWeight: 700 }}>✓ Yes</td>
                      <td>1</td>
                      <td>One round higher than draft round<br /><span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>e.g. Drafted Rd 4 → forfeit Rd 3 pick</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Rounds 7–18 &amp; Free Agents</td>
                      <td style={{ color: "oklch(0.42 0.15 150)", fontWeight: 700 }}>✓ Yes</td>
                      <td>3</td>
                      <td>Rd 6, 7, or 8 pick (assigned in order)<br /><span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>If not available, next highest pick used</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "0.75rem 1.25rem", background: "oklch(0.97 0.01 150)", borderTop: "1px solid oklch(0.92 0.005 150)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <Info size={13} color="oklch(0.5 0.04 150)" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "0.78rem", color: "oklch(0.5 0.04 150)", lineHeight: 1.6 }}>
                  <strong>Max 3 keepers total.</strong> You may protect at most <strong>1 player from Rounds 3–6</strong> and up to <strong>3 players from Rounds 7–18 / Free Agents</strong> (combined total still capped at 3). The forfeited pick must always be a higher (earlier) round than the player's draft status. If you no longer own the required pick (traded away), the next highest available pick is used instead.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Selection Counter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "0.5rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {[1,2,3].map(n => (
              <div key={n} style={{
                width: 28, height: 28, borderRadius: "50%",
                background: totalSelected >= n ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.15)",
                border: "2px solid",
                borderColor: totalSelected >= n ? "oklch(0.65 0.14 85)" : "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", fontWeight: 700,
                color: totalSelected >= n ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.4)",
                transition: "all 0.2s",
              }}>
                {n}
              </div>
            ))}
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" }}>
              {totalSelected}/3 selected
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(255,255,255,0.65)", fontFamily: "Oswald, sans-serif" }}>
              Rd 3–6 slot: {tier1Selected.length}/1
            </span>
            <span style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(255,255,255,0.65)", fontFamily: "Oswald, sans-serif" }}>
              Rd 7–18 / FA slots: {tier2Selected.length}/3
            </span>
          </div>
        </div>

        {/* Roster */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Your Roster — {franchise?.team_name ?? "Sign in to view"}
          </div>

          {!franchise || roster.length === 0 ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "oklch(0.55 0.04 150)" }}>
              <Shield size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: "0.9rem" }}>Sign in to see your roster and select keepers.</p>
            </div>
          ) : (
            <div>
              {sorted.map((entry) => {
                const isSelected = selectedIds.includes(entry.id);
                const slot = slots.find(s => s.playerId === entry.id);
                const isIneligible = entry.tier === "ineligible";
                const isTier1Full = entry.tier === "tier1" && !canAddTier1 && !isSelected;
                const isTier2Full = entry.tier === "tier2" && !canAddTier2 && !isSelected;
                const isTotalFull = totalSelected >= maxTotal && !isSelected;
                const isDisabled = isIneligible || isTier1Full || isTier2Full || isTotalFull || cd.past;

                // Cost label
                let costLabel = "";
                let costNote = "";
                if (entry.tier === "ineligible") {
                  costLabel = "Ineligible";
                } else if (entry.tier === "tier1") {
                  const cost = tier1Cost(entry.draftRound!);
                  costLabel = `Rd ${cost} pick`;
                  costNote = `Drafted Rd ${entry.draftRound} → forfeit Rd ${cost}`;
                } else {
                  // tier2
                  if (isSelected && slot?.assignedRound) {
                    costLabel = `Rd ${slot.assignedRound} pick`;
                    costNote = entry.draftRound ? `Drafted Rd ${entry.draftRound}` : "Free Agent";
                  } else {
                    // Preview what round they'd get if selected
                    const nextRound = TIER2_ROUNDS[tier2Selected.length] ?? 8;
                    costLabel = isSelected ? `Rd ${slot?.assignedRound ?? nextRound} pick` : `~Rd ${nextRound} pick`;
                    costNote = entry.draftRound ? `Drafted Rd ${entry.draftRound}` : "Free Agent";
                  }
                }

                return (
                  <div
                    key={entry.id}
                    onClick={() => !isDisabled && toggle(entry)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.75rem 1.25rem",
                      borderBottom: "1px solid oklch(0.92 0.005 150)",
                      cursor: isDisabled ? "default" : "pointer",
                      background: isSelected
                        ? "oklch(0.93 0.06 150)"
                        : isIneligible ? "oklch(0.97 0.005 150)" : "white",
                      opacity: isDisabled && !isSelected ? 0.4 : 1,
                      transition: "background 0.12s",
                    }}
                  >
                    {/* Pos badge */}
                    <div style={{
                      width: 36, textAlign: "center",
                      fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700,
                      color: "white", background: POS_COLORS[entry.pos] ?? "#64748b",
                      borderRadius: 4, padding: "2px 0", flexShrink: 0,
                    }}>
                      {entry.pos}
                    </div>

                    {/* Name + acquisition */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span>{entry.nflTeam}</span>
                        <span>·</span>
                        <span>{entry.acquisition === "FA" ? "Free Agent" : `Drafted Rd ${entry.draftRound}`}</span>
                        {entry.byeWeek && entry.acquisition === "FA" && <><span>·</span><span>BYE {entry.byeWeek}</span></>}
                      </div>
                    </div>

                    {/* Tier badge */}
                    <div style={{ flexShrink: 0 }}>
                      {entry.tier === "tier1" && (
                        <span style={{ fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.06em", background: "#6366f1", color: "white", borderRadius: 4, padding: "2px 6px" }}>
                          RD 3–6
                        </span>
                      )}
                      {entry.tier === "tier2" && (
                        <span style={{ fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.06em", background: "oklch(0.42 0.15 150)", color: "white", borderRadius: 4, padding: "2px 6px" }}>
                          RD 7+ / FA
                        </span>
                      )}
                      {entry.tier === "ineligible" && (
                        <span style={{ fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.06em", background: "oklch(0.55 0.22 25)", color: "white", borderRadius: 4, padding: "2px 6px" }}>
                          RD 1–2
                        </span>
                      )}
                    </div>

                    {/* Cost + status */}
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 110 }}>
                      {isIneligible ? (
                        <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.22 25)", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                          <AlertTriangle size={12} /> Ineligible
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: isSelected ? "oklch(0.28 0.12 150)" : "oklch(0.35 0.06 150)" }}>
                            {isSelected ? `✓ ${costLabel}` : costLabel}
                          </div>
                          {costNote && (
                            <div style={{ fontSize: "0.68rem", color: "oklch(0.6 0.04 150)" }}>{costNote}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Keepers Summary */}
        {slots.length > 0 && (
          <div className="wrc-card" style={{ marginTop: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={14} /> Protected Players Summary
            </div>
            <div style={{ padding: "1rem 1.25rem" }}>
              <table className="wrc-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pos</th>
                    <th>Acquisition</th>
                    <th>Forfeited Pick</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map(slot => {
                    const entry = roster.find(r => r.id === slot.playerId);
                    if (!entry) return null;
                    let pickLabel = "";
                    if (entry.tier === "tier1") pickLabel = `Round ${tier1Cost(entry.draftRound!)}`;
                    else if (slot.assignedRound) pickLabel = `Round ${slot.assignedRound}`;
                    return (
                      <tr key={slot.playerId}>
                        <td style={{ fontWeight: 700 }}>{entry.name}</td>
                        <td>
                          <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "white", background: POS_COLORS[entry.pos] ?? "#64748b", borderRadius: 3, padding: "1px 6px" }}>
                            {entry.pos}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "oklch(0.45 0.04 150)" }}>
                          {entry.acquisition === "FA" ? "Free Agent" : `Drafted Rd ${entry.draftRound}`}
                        </td>
                        <td style={{ fontWeight: 700, color: "oklch(0.28 0.12 150)" }}>{pickLabel}</td>
                        <td>
                          {!cd.past && (
                            <button
                              onClick={() => toggle(entry)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.22 25)", display: "flex", alignItems: "center" }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Deadline Banner ───────────────────────────────────────────────────────────
function DeadlineBanner({ cd }: { cd: ReturnType<typeof useDeadlineCountdown> }) {
  const urgent = !cd.past && cd.d === 0 && cd.h < 6;
  const bg = cd.past
    ? "oklch(0.97 0.02 25)"
    : urgent
      ? "linear-gradient(90deg, oklch(0.22 0.09 25), oklch(0.28 0.1 25))"
      : "rgba(0,0,0,0.5)";
  const border = cd.past
    ? "1.5px solid oklch(0.82 0.08 25)"
    : urgent
      ? "1.5px solid oklch(0.65 0.18 25)"
      : "1px solid rgba(255,255,255,0.15)";

  return (
    <div style={{
      background: bg, border, borderRadius: 12,
      padding: "0.875rem 1.25rem", marginBottom: "1.25rem",
      display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
    }}>
      <Clock size={18} color={cd.past ? "oklch(0.55 0.22 25)" : urgent ? "oklch(0.78 0.18 25)" : "rgba(255,255,255,0.7)"} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", color: cd.past ? "oklch(0.45 0.22 25)" : urgent ? "oklch(0.78 0.18 25)" : "rgba(255,255,255,0.9)" }}>
          {cd.past ? "Protections Deadline Has Passed" : urgent ? "⚡ Deadline Approaching!" : "Protections Deadline"}
        </div>
        <div style={{ fontSize: "0.78rem", color: cd.past ? "oklch(0.55 0.22 25)" : "rgba(255,255,255,0.55)", marginTop: 2 }}>
          Monday, August 24, 2026 · 8:00 PM ET
        </div>
      </div>
      {!cd.past && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.2rem" }}>
          {[
            { v: cd.d, l: "D" }, { v: cd.h, l: "H" }, { v: cd.m, l: "M" }, { v: cd.s, l: "S" },
          ].map(({ v, l }, i, arr) => (
            <span key={l} style={{ display: "flex", alignItems: "baseline", gap: "1px" }}>
              <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: urgent ? "oklch(0.78 0.18 25)" : "white", minWidth: 24, textAlign: "center" }}>
                {String(v).padStart(2, "0")}
              </span>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em" }}>{l}</span>
              {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem", marginLeft: 1 }}>:</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
