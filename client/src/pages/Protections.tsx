/**
 * WRC Fantasy Football - Protections (Dynasty Keeper) Page
 *
 * OFFICIAL WRC RULES (Section 5):
 * - Max 3 keepers total per team
 * - Rounds 1-2: INELIGIBLE — cannot be protected
 * - Rounds 3-6 (Tier 1): Max ONE player, fixed cost = one round higher (Rd 4 → forfeit Rd 3)
 * - Round 7 (Tier 2 fixed): Always forfeits Rd 6 — no choice
 * - Rounds 8-18 & FA (Tier 2 choice): Forfeit Rd 6, 7, or 8 — owner assigns
 *     - If only 1 such player: auto Rd 6 (no selector shown)
 *     - If 2+ such players: selector shown, rounds consumed by fixed-cost players removed from pool
 *     - Rd 7 player always consumes Rd 6 from the pool first
 *
 * DEADLINE: Monday August 24, 2026 at 8:00 PM ET
 *
 * TRADED PICKS (from 2025 Transactions):
 * - Shawn: traded away own Rd 3; received Scott M.'s Rd 8 → owns Rd 6, 7, Rd 8 (Scott M.'s)
 * - David S.: traded away own Rd 3 & 10; received Greg's Rd 6 & 13 → owns Greg's Rd 6, own Rd 7 & 8
 * - Greg: traded away own Rd 6 & 13; received David S.'s Rd 3 & 10 → does NOT own Rd 6, falls back to Rd 5
 * - Jason: traded away own Rd 12; received David S.'s Rd 8 → owns Rd 6, 7, David S.'s Rd 8
 * - Jamie: traded away own Rd 1; received David R.'s Rd 12 → owns Rd 6, 7, 8 (no impact)
 */
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Shield, AlertTriangle, CheckCircle2, Lock, Info, Clock,
  ChevronDown, ChevronUp, X, ArrowUpDown
} from "lucide-react";
// AlertTriangle already imported above — used in Submit button validation
import { TEAMS, type RosterPlayer } from "@/lib/wrcData";
import { useDraftedRoster } from "@/hooks/useDraftedRoster";
import { trpc } from "@/lib/trpc";
import { WRC_PROTECTION_DEADLINE, WRC_PROTECTION_DEADLINE_DISPLAY } from "@shared/protectionSchedule";

// ── Deadline ─────────────────────────────────────────────────────────────────
const DEADLINE = WRC_PROTECTION_DEADLINE;

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

// ── Traded pick data (from 2025 transactions) ─────────────────────────────────
// Maps teamId → which Rd 6/7/8 picks they own (may include picks from other teams)
// and which of their own picks they've traded away.
// Format: { available: number[], note: string }
// "available" = the actual rounds they can use for tier-2 protections, in order.
// If they traded away Rd 6, the list starts at Rd 7 (or lower if also traded Rd 7).
const TEAM_PICK_STATUS: Record<string, { available: number[]; tradedAway: number[]; notes: string[] }> = {
  // Greg: traded away own Rd 6 & 13 to David S. → no Rd 6, falls back to Rd 5
  "greg-akagi": {
    available: [5, 7, 8],
    tradedAway: [6],
    notes: ["Rd 6 traded to David S. — protection falls back to Rd 5 for first slot"]
  },
  // David S.: traded away own Rd 3 & 10; received Greg's Rd 6 & 13
  // For tier-2 protections: owns Greg's Rd 6, own Rd 7, own Rd 8
  "david-sotka": {
    available: [6, 7, 8],
    tradedAway: [],
    notes: ["Rd 6 is Greg's pick (received in trade) — still counts as Rd 6 for protection cost"]
  },
  // Shawn: traded away own Rd 3; received Scott M.'s Rd 8
  // Owns own Rd 6, own Rd 7, Scott M.'s Rd 8
  "shawn-gidley": {
    available: [6, 7, 8],
    tradedAway: [],
    notes: ["Rd 8 is Scott M.'s pick (received in trade) — still counts as Rd 8 for protection cost"]
  },
  // Jason: traded away own Rd 12; received David S.'s Rd 8
  // Owns own Rd 6, own Rd 7, David S.'s Rd 8
  "jason-heiden": {
    available: [6, 7, 8],
    tradedAway: [],
    notes: ["Rd 8 is David S.'s pick (received in trade) — still counts as Rd 8 for protection cost"]
  },
  // Jamie: traded away own Rd 1; received David R.'s Rd 12 — no impact on Rd 6/7/8
  "james-yane": {
    available: [6, 7, 8],
    tradedAway: [],
    notes: []
  },
};

function getPickStatus(teamId: string) {
  return TEAM_PICK_STATUS[teamId] ?? { available: [6, 7, 8], tradedAway: [], notes: [] };
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Tier = "ineligible" | "tier1" | "tier2";
// Tier 2 sub-types: "rd7" = fixed Rd 6, "choice" = Rd 8-18 or FA with selector
type Tier2Sub = "rd7" | "choice";

interface RosterEntry {
  id: string;
  name: string;
  pos: string;
  nflTeam: string;
  byeWeek: number | null;
  acquisition: "Draft" | "FA";
  draftRound: number | null;
  tier: Tier;
  tier2Sub?: Tier2Sub; // only set when tier === "tier2"
}

interface ProtectionSlot {
  playerId: string;
  assignedRound: number | null; // tier2: owner-chosen; tier1: auto-computed
}

// ── Rules helpers ─────────────────────────────────────────────────────────────
function getTier(draftRound: number | null): Tier {
  if (draftRound === null) return "tier2";       // FA → Rd 6/7/8 cost
  if (draftRound <= 2) return "ineligible";      // Rd 1-2: cannot protect
  if (draftRound <= 6) return "tier1";           // Rd 3-6: fixed cost (draft_round - 1), max 1
  return "tier2";                                // Rd 7+: Rd 6/7/8 cost, same as FA
}

function draftedCost(draftRound: number): number {
  return draftRound - 1; // always one round higher (earlier)
}

function getTier2Sub(draftRound: number | null): Tier2Sub {
  if (draftRound === 7) return "rd7"; // Rd 7 always forfeits Rd 6, no choice
  return "choice"; // Rd 8-18 or FA: owner assigns from remaining pool
}

// ── Position colors ───────────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function Protections() {
  const { franchise, authLoading } = useAuth();
  const cd = useDeadlineCountdown();
  const { rostersByTeam, loading: rosterLoading } = useDraftedRoster();

  const pickStatus = getPickStatus(franchise?.id ?? "");

  // Get the logged-in owner's players from Supabase (via useDraftedRoster)
  const teamName = franchise?.team_name;
  const livePlayers = teamName ? (rostersByTeam[teamName] ?? []) : [];

  const roster: RosterEntry[] = livePlayers
      .map((pl, i) => {
      const rp = pl as typeof pl & { round?: number };
      // Use round from useDraftedRoster (set from draft_round in Supabase players table)
      // Fall back to parsing acquisition string (e.g. "Rd 6" → 6) if round is not set
      const acqMatch = pl.acquisition?.match(/^Rd\s*(\d+)$/i);
      const draftRound = rp.round != null ? rp.round : (acqMatch ? parseInt(acqMatch[1], 10) : null);
      const tier = getTier(draftRound);
      return {
        id: pl.id || `p-${i}`,
        name: pl.name,
        pos: pl.pos,
        nflTeam: pl.nflTeam,
        byeWeek: pl.byeWeek ?? null,
        acquisition: pl.acquisition,
        draftRound,
        tier,
        tier2Sub: tier === "tier2" ? getTier2Sub(draftRound) : undefined,
      };
    })
    .sort((a, b) => {
      // Drafted players sorted by round ascending; FA players go to the end
      const ra = a.draftRound ?? 999;
      const rb = b.draftRound ?? 999;
      return ra - rb;
    });

  const [slots, setSlots] = useState<ProtectionSlot[]>([]);
  const [saved, setSaved] = useState(false);
  const [expandRules, setExpandRules] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const protectionsQuery = trpc.league.protections.useQuery(undefined, { enabled: Boolean(franchise?.id) });
  const saveProtectionsMutation = trpc.league.saveProtections.useMutation();

  useEffect(() => {
    if (!franchise?.id) { setLoadingSlots(false); return; }
    setLoadingSlots(protectionsQuery.isLoading || protectionsQuery.isFetching);
    if (protectionsQuery.data) setSlots(protectionsQuery.data);
  }, [franchise?.id, protectionsQuery.data, protectionsQuery.isFetching, protectionsQuery.isLoading]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedIds = slots.map(s => s.playerId);
  const draftedSlots = slots.filter(s => roster.find(r => r.id === s.playerId)?.tier === "tier1");
  const faSlots = slots.filter(s => roster.find(r => r.id === s.playerId)?.tier === "tier2");
  const totalSelected = slots.length;

  // ── Round pool logic ─────────────────────────────────────────────────────
  // Compute which rounds are consumed by fixed-cost players already selected.
  // Tier 1 (Rd 3-6): consumes round = draftRound - 1 (e.g. Rd 4 → consumes Rd 3)
  //   BUT only Rd 6/7/8 matter for the pool — so Tier 1 only consumes if cost is 6/7/8.
  // Rd 7 player: always consumes Rd 6.
  const consumedRounds = new Set<number>();
  for (const s of slots) {
    const entry = roster.find(r => r.id === s.playerId);
    if (!entry) continue;
    if (entry.tier === "tier1") {
      const cost = draftedCost(entry.draftRound!);
      if (cost >= 6 && cost <= 8) consumedRounds.add(cost);
    } else if (entry.tier2Sub === "rd7") {
      consumedRounds.add(6); // Rd 7 player always consumes Rd 6
    }
  }

  // Available rounds for "choice" players = pool minus consumed
  const ALL_POOL = [6, 7, 8];
  const availablePool = ALL_POOL.filter(r => !consumedRounds.has(r));

  // Reactively correct stale choice-slot round assignments. A choice player's
  // round is picked greedily at the moment they're selected (see toggle()),
  // based only on what was consumed *so far*. If a fixed-cost player (tier1
  // or Rd 7) is selected afterward and consumes that same round, the earlier
  // choice player's assignment is never revisited — leaving two protections
  // silently pointed at the same round until the save is rejected by the
  // server. This effect re-validates every choice slot on every change and
  // reassigns any now-invalid or duplicated round to the next actually
  // available one, so order of selection can never produce a collision.
  useEffect(() => {
    const usedByChoice = new Set<number>();
    let needsFix = false;
    const next = slots.map(s => {
      const entry = roster.find(r => r.id === s.playerId);
      if (!entry || entry.tier2Sub !== "choice") return s;
      const invalid = s.assignedRound === null || consumedRounds.has(s.assignedRound) || usedByChoice.has(s.assignedRound);
      if (invalid) {
        const replacement = ALL_POOL.find(r => !consumedRounds.has(r) && !usedByChoice.has(r)) ?? null;
        needsFix = true;
        if (replacement !== null) usedByChoice.add(replacement);
        return { ...s, assignedRound: replacement };
      }
      usedByChoice.add(s.assignedRound!);
      return s;
    });
    if (needsFix) setSlots(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // Count of "choice" players currently selected
  const choiceSlots = slots.filter(s => roster.find(r => r.id === s.playerId)?.tier2Sub === "choice");
  const showSelector = choiceSlots.length >= 2; // only show selector when 2+ choice players

  // ── Toggle selection ───────────────────────────────────────────────────────
  const toggle = (entry: RosterEntry) => {
    if (entry.tier === "ineligible" || cd.past) return;

    if (selectedIds.includes(entry.id)) {
      setSlots(prev => {
        const next = prev.filter(s => s.playerId !== entry.id);
        return next;
      });
    } else {
      if (totalSelected >= 3) return;
      if (entry.tier === "tier1" && draftedSlots.length >= 1) return; // max 1 tier1
      if (entry.tier === "tier2" && faSlots.length >= 3) return;

      // Determine initial round assignment
      let nextRound: number | null = null;
      if (entry.tier === "tier2") {
        if (entry.tier2Sub === "rd7") {
          nextRound = 6; // Rd 7 player always forfeits Rd 6
        } else {
          // choice player: assign first available pool round not yet taken
          const taken = new Set(slots.filter(s => roster.find(r => r.id === s.playerId)?.tier2Sub === "choice").map(s => s.assignedRound));
          const newConsumed = new Set(consumedRounds);
          nextRound = ALL_POOL.find(r => !newConsumed.has(r) && !taken.has(r)) ?? null;
        }
      }
      setSlots(prev => [...prev, {
        playerId: entry.id,
        assignedRound: nextRound,
      }]);
    }
    setSaved(false);
  };

  // ── Change round assignment for an FA slot ────────────────────────────────
  const changeRound = (playerId: string, newRound: number) => {
    if (cd.past) return;
    setSlots(prev => prev.map(s => {
      if (s.playerId === playerId) return { ...s, assignedRound: newRound };
      // If another FA slot had this round, swap them
      if (s.assignedRound === newRound) {
        const thisSlot = prev.find(x => x.playerId === playerId);
        return { ...s, assignedRound: thisSlot?.assignedRound ?? null };
      }
      return s;
    }));
    setSaved(false);
  };

  // Validation: all slots have an assigned round
  const isValid = slots.every(s => {
    const entry = roster.find(r => r.id === s.playerId);
    if (!entry) return false;
    if (entry.tier === "tier1") return true; // drafted cost is always valid
    return s.assignedRound !== null;
  });

  const handleSave = async () => {
    if (!franchise?.id || cd.past || !isValid) return;
    setSaveError(null);
    try {
      const result = await saveProtectionsMutation.mutateAsync({ slots });
      setSlots(result.slots);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to submit protections.");
    }
  };

  // ── Sorted roster ─────────────────────────────────────────────────────────
  const posOrder = ["QB","RB","WR","TE","K","DST"];
  const sorted = [...roster].sort((a, b) => {
    // Primary: sort by draft round ascending (FA/null goes to end)
    const ra = a.draftRound ?? 999;
    const rb = b.draftRound ?? 999;
    if (ra !== rb) return ra - rb;
    // Secondary: position order
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
            disabled={!franchise || cd.past || !isValid}
            title={!isValid ? "Some players missing round assignment" : undefined}
            style={{
              background: saved ? "oklch(0.42 0.15 150)" : cd.past ? "rgba(0,0,0,0.3)" : !isValid ? "rgba(0,0,0,0.35)" : "oklch(0.28 0.09 150)",
              color: "white", border: !isValid && !cd.past && franchise ? "2px solid oklch(0.65 0.18 25)" : "none", borderRadius: 8,
              padding: "0.55rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", cursor: (franchise && !cd.past && isValid) ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: "0.4rem",
              opacity: (franchise && !cd.past) ? 1 : 0.5,
            }}
          >
            {saved ? <><CheckCircle2 size={14} /> Saved!</> : cd.past ? "Deadline Passed" : "Submit Protections"}
          </button>
        </div>

        {saveError && (
          <div role="alert" style={{ marginTop: "-0.75rem", marginBottom: "1rem", background: "oklch(0.96 0.04 25)", border: "1px solid oklch(0.78 0.12 25)", borderRadius: 8, padding: "0.65rem 0.9rem", color: "oklch(0.42 0.16 25)", fontSize: "0.8rem", fontWeight: 600 }}>
            {saveError}
          </div>
        )}

        {/* Deadline Banner */}
        <DeadlineBanner cd={cd} />

        {/* Traded pick notice */}
        {franchise && pickStatus.notes.length > 0 && (
          <div style={{ background: "oklch(0.97 0.04 85)", border: "1.5px solid oklch(0.82 0.12 85)", borderRadius: 10, padding: "0.75rem 1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.45 0.14 85)" }}>
              <AlertTriangle size={13} /> Traded Pick Notice
            </div>
            {pickStatus.notes.map((note, i) => (
              <p key={i} style={{ margin: 0, fontSize: "0.8rem", color: "oklch(0.35 0.1 85)", lineHeight: 1.5 }}>{note}</p>
            ))}
            {pickStatus.tradedAway.length > 0 && (
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "oklch(0.45 0.14 85)", fontWeight: 600 }}>
                Picks traded away: {pickStatus.tradedAway.map(r => `Rd ${r}`).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Not logged in */}
        {!authLoading && !franchise && (
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
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.25 0.06 150)" }}>
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
                      <th>Max from tier</th>
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
                      <td>Rd 6, 7, or 8 — <strong>you choose which player gets which round</strong><br /><span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>If a pick is traded away, next highest available is used</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "0.75rem 1.25rem", background: "oklch(0.97 0.01 150)", borderTop: "1px solid oklch(0.92 0.005 150)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <Info size={13} color="oklch(0.5 0.04 150)" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "0.78rem", color: "oklch(0.5 0.04 150)", lineHeight: 1.6 }}>
                  <strong>Max 3 keepers total.</strong> At most <strong>1 from Rounds 3–6</strong> and up to <strong>3 from Rounds 7–18 / Free Agents</strong>. For tier-2 players, use the round selector on each selected player to assign Rd 6, 7, or 8 — you decide which player costs which pick. The forfeited pick must always be an earlier round than the player's draft status.
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
                fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", fontWeight: 700,
                color: totalSelected >= n ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.4)",
                transition: "all 0.2s",
              }}>
                {n}
              </div>
            ))}
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" }}>
              {totalSelected}/3 selected
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(255,255,255,0.65)", fontFamily: "Barlow Condensed, sans-serif" }}>
              Drafted: {draftedSlots.length}
            </span>
            <span style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(255,255,255,0.65)", fontFamily: "Barlow Condensed, sans-serif" }}>
              FA: {faSlots.length}/3
            </span>
          </div>
        </div>

        {/* Roster */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Your Roster — {franchise?.team_name ?? "Sign in to view"}
          </div>

          {authLoading ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "oklch(0.55 0.04 150)" }}>
              <div className="wrc-skeleton" style={{ width: 120, height: 14, margin: "0 auto 0.5rem", borderRadius: 4 }} />
              <div className="wrc-skeleton" style={{ width: 80, height: 14, margin: "0 auto", borderRadius: 4 }} />
            </div>
          ) : !franchise || roster.length === 0 ? (
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
                const isTier1Full = false; // no per-tier cap on drafted beyond total 3
                const isTier2Full = entry.tier === "tier2" && faSlots.length >= 3 && !isSelected;
                const isTotalFull = totalSelected >= 3 && !isSelected;
                const isDisabled = isIneligible || isTier1Full || isTier2Full || isTotalFull || cd.past;

                // Cost label
                let costLabel = "";
                let costNote = "";
                if (entry.tier === "ineligible") {
                  costLabel = "Ineligible";
                } else if (entry.tier === "tier1") {
                  const cost = draftedCost(entry.draftRound!);
                  costLabel = `Rd ${cost} pick`;
                  costNote = `Drafted Rd ${entry.draftRound} → forfeit Rd ${cost}`;
                } else {
                  if (entry.tier2Sub === "rd7") {
                    costLabel = "Rd 6 pick";
                    costNote = "Drafted Rd 7 → forfeit Rd 6";
                  } else if (isSelected && slot?.assignedRound) {
                    costLabel = `Rd ${slot.assignedRound} pick`;
                    costNote = entry.draftRound ? `Drafted Rd ${entry.draftRound}` : "Free Agent";
                  } else {
                    costLabel = "Rd 6–8 pick";
                    costNote = entry.draftRound ? `Drafted Rd ${entry.draftRound}` : "Free Agent";
                  }
                }

                return (
                  <div key={entry.id}>
                    <div
                      onClick={() => !isDisabled && toggle(entry)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        padding: "0.75rem 1.25rem",
                        borderBottom: isSelected ? "none" : "1px solid oklch(0.92 0.005 150)",
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
                        fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700,
                        color: "white", background: POS_COLORS[entry.pos] ?? "#64748b",
                        borderRadius: 4, padding: "2px 0", flexShrink: 0,
                      }}>
                        {entry.pos}
                      </div>

                      {/* Name + acquisition */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)", lineHeight: 1.25 }}>
                          {entry.name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          <span>{entry.nflTeam}</span>
                          <span>·</span>
                          <span>{entry.acquisition === "FA" ? "Free Agent" : `Drafted Rd ${entry.draftRound}`}</span>
                        </div>
                      </div>

                      {/* Tier badge */}
                      <div style={{ flexShrink: 0 }}>
                        {entry.tier === "tier1" && (
                          <span style={{ fontSize: "0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em", background: "#6366f1", color: "white", borderRadius: 4, padding: "2px 6px" }}>
                            RD 3–6
                          </span>
                        )}
                        {entry.tier === "tier2" && (
                          <span style={{ fontSize: "0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em", background: "oklch(0.42 0.15 150)", color: "white", borderRadius: 4, padding: "2px 6px" }}>
                            RD 7+ / FA
                          </span>
                        )}
                        {entry.tier === "ineligible" && (
                          <span style={{ fontSize: "0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em", background: "oklch(0.55 0.22 25)", color: "white", borderRadius: 4, padding: "2px 6px" }}>
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

                    {/* Remove button for tier1 selected */}
                    {isSelected && (
                      <div style={{
                        background: "oklch(0.89 0.07 150)",
                        borderBottom: "1px solid oklch(0.82 0.06 150)",
                        padding: "0.5rem 1.25rem 0.5rem 3.75rem",
                        display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" as const,
                      }}
                        onClick={e => e.stopPropagation()}
                      >
                        {entry.tier === "tier1" ? (
                        <span style={{ fontSize: "0.75rem", color: "oklch(0.35 0.1 150)", fontWeight: 600, flex: 1 }}>
                          Forfeits Rd {draftedCost(entry.draftRound!)} pick (one round higher than Rd {entry.draftRound})
                        </span>
                        ) : entry.tier2Sub === "rd7" ? (
                          <span style={{ fontSize: "0.75rem", color: "oklch(0.35 0.1 150)", fontWeight: 600, flex: 1 }}>
                            Drafted Rd 7 → forfeits Rd 6 pick (fixed)
                          </span>
                        ) : showSelector ? (
                          <>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "oklch(0.28 0.1 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.04em" }}>
                              PICK:
                            </span>
                            <div style={{ display: "flex", gap: "0.35rem" }}>
                              {ALL_POOL.map(round => {
                                const isMe = slot?.assignedRound === round;
                               const consumedFixed = consumedRounds.has(round);
                               const takenByOther = choiceSlots.some(s => s.playerId !== entry.id && s.assignedRound === round);
                                // Only truly block rounds consumed by fixed-cost players (e.g. McBride → Rd 6).
                                // "takenByOther" just means it's currently assigned to another choice player —
                                // tapping it swaps the assignments, so it should remain clickable.
                                const unavailable = consumedFixed;
                                return (
                                  <button
                                    key={round}
                                    onClick={() => !unavailable && changeRound(entry.id, round)}
                                    disabled={cd.past || unavailable}
                                    style={{
                                      padding: "3px 11px", borderRadius: 6,
                                      border: isMe ? "2px solid oklch(0.42 0.15 150)" : "2px solid transparent",
                                      background: isMe ? "oklch(0.42 0.15 150)" : consumedFixed ? "oklch(0.88 0.02 150)" : takenByOther ? "oklch(0.93 0.04 150)" : "white",
                                      color: isMe ? "white" : consumedFixed ? "oklch(0.65 0.04 150)" : takenByOther ? "oklch(0.45 0.08 150)" : "oklch(0.28 0.1 150)",
                                      fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.78rem",
                                      cursor: (cd.past || consumedFixed) ? "not-allowed" : "pointer", transition: "all 0.15s",
                                      textDecoration: consumedFixed ? "line-through" : "none",
                                    }}
                                    title={consumedFixed ? `Rd ${round} consumed by fixed-cost player` : takenByOther ? `Swap: assign Rd ${round} to this player` : `Assign Rd ${round}`}
                                  >
                                    Rd {round}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "oklch(0.35 0.1 150)", fontWeight: 600, flex: 1 }}>
                            Forfeits Rd {slot?.assignedRound ?? availablePool[0] ?? 6} pick
                            {choiceSlots.length < 2 && <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)", marginLeft: 4 }}>(add another Rd 8–18/FA player to choose)</span>}
                          </span>
                        )}
                        {!cd.past && (
                          <button
                            onClick={() => toggle(entry)}
                            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.22 25)", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", fontWeight: 600 }}
                          >
                            <X size={13} /> Remove
                          </button>
                        )}
                      </div>
                    )}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {slots.map((slot, idx) => {
                  const entry = roster.find(r => r.id === slot.playerId);
                  if (!entry) return null;
                  let pickLabel = "";
                  const hasRound = entry.tier === "tier1" || !!slot.assignedRound;
                  if (entry.tier === "tier1") pickLabel = `Rd ${draftedCost(entry.draftRound!)}`;
                  else if (slot.assignedRound) pickLabel = `Rd ${slot.assignedRound}`;
                  else pickLabel = "⚠ Assign";
                  return (
                    <div key={slot.playerId} style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.75rem 0",
                      borderBottom: idx < slots.length - 1 ? "1px solid oklch(0.93 0.005 150)" : "none",
                    }}>
                      {/* Pos badge */}
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.7rem", color: "white", background: POS_COLORS[entry.pos] ?? "#64748b", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>
                        {entry.pos}
                      </span>
                      {/* Player name + acquisition */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {entry.name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>
                          {entry.acquisition === "FA" ? "Free Agent" : `Drafted Rd ${entry.draftRound}`}
                        </div>
                      </div>
                      {/* Forfeited pick */}
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: hasRound ? "oklch(0.28 0.12 150)" : "oklch(0.55 0.22 25)", flexShrink: 0 }}>
                        {pickLabel}
                      </span>
                      {/* Remove button */}
                      {!cd.past && (
                        <button
                          onClick={() => toggle(entry)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.22 25)", display: "flex", alignItems: "center", flexShrink: 0, padding: "2px" }}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
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
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", color: cd.past ? "oklch(0.45 0.22 25)" : urgent ? "oklch(0.78 0.18 25)" : "rgba(255,255,255,0.9)" }}>
          {cd.past ? "Protections Deadline Has Passed" : urgent ? "⚡ Deadline Approaching!" : "Protections Deadline"}
        </div>
        <div style={{ fontSize: "0.78rem", color: cd.past ? "oklch(0.55 0.22 25)" : "rgba(255,255,255,0.55)", marginTop: 2 }}>
          {WRC_PROTECTION_DEADLINE_DISPLAY}
        </div>
      </div>
      {!cd.past && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.2rem" }}>
          {[
            { v: cd.d, l: "D" }, { v: cd.h, l: "H" }, { v: cd.m, l: "M" }, { v: cd.s, l: "S" },
          ].map(({ v, l }, i, arr) => (
            <span key={l} style={{ display: "flex", alignItems: "baseline", gap: "1px" }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: urgent ? "oklch(0.78 0.18 25)" : "white", minWidth: 24, textAlign: "center" }}>
                {String(v).padStart(2, "0")}
              </span>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em" }}>{l}</span>
              {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem", marginLeft: 1 }}>:</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
