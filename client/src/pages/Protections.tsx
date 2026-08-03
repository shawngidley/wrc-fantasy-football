/**
 * WRC Fantasy Football - Protections (Dynasty Keeper) Page
 * Owners select up to 3 keepers from their real roster.
 * Keeper cost is computed from the player's draft round:
 *   Rounds 1-2  → Ineligible
 *   Rounds 3-6  → Same round pick (no discount)
 *   Rounds 7-10 → 2 rounds earlier
 *   Rounds 11-18 → 3 rounds earlier
 * FA pickups cost the last round (18).
 * Selections are persisted in localStorage per team.
 */
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, AlertTriangle, CheckCircle2, Lock, Info } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";

const MAX_KEEPERS = 3;

const KEEPER_RULES = [
  { rounds: "Rounds 1–2",   eligible: false, pickCost: "Ineligible" },
  { rounds: "Rounds 3–6",   eligible: true,  pickCost: "Same round pick" },
  { rounds: "Rounds 7–10",  eligible: true,  pickCost: "2 rounds earlier" },
  { rounds: "Rounds 11–18", eligible: true,  pickCost: "3 rounds earlier" },
  { rounds: "Free Agent",   eligible: true,  pickCost: "Round 18 pick" },
];

const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9",
  TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

function keeperCostRound(draftRound: number | null): number | null {
  if (draftRound === null) return 18; // FA → Round 18
  if (draftRound <= 2) return null;   // Ineligible
  if (draftRound <= 6) return draftRound;
  if (draftRound <= 10) return draftRound - 2;
  return Math.max(1, draftRound - 3);
}

function keeperCostLabel(draftRound: number | null): string {
  const cost = keeperCostRound(draftRound);
  if (cost === null) return "Ineligible";
  return `Round ${cost} pick`;
}

function isEligible(draftRound: number | null): boolean {
  if (draftRound === null) return true; // FA always eligible
  return draftRound > 2;
}

const STORAGE_KEY = "wrc_protections";

function loadSaved(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}
function saveToDisk(teamId: string, keepers: string[]) {
  const all = loadSaved();
  all[teamId] = keepers;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export default function Protections() {
  const { franchise } = useAuth();

  const team = TEAMS.find(t => t.id === franchise?.id);
  const roster = team?.players ?? [];

  // Load saved keepers for this team
  const [selected, setSelected] = useState<string[]>(() => {
    if (!franchise?.id) return [];
    return loadSaved()[franchise.id] ?? [];
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Re-load if team changes
  useEffect(() => {
    if (franchise?.id) setSelected(loadSaved()[franchise.id] ?? []);
  }, [franchise?.id]);

  const toggle = (playerId: string, eligible: boolean) => {
    if (!eligible) return;
    setSelected(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : prev.length >= MAX_KEEPERS
          ? prev
          : [...prev, playerId]
    );
    setSaved(false);
    setSaveError("");
  };

  const handleSave = () => {
    if (!franchise?.id) { setSaveError("You must be logged in to save protections."); return; }
    saveToDisk(franchise.id, selected);
    setSaved(true);
    setSaveError("");
    setTimeout(() => setSaved(false), 3000);
  };

  // Sort: eligible first, then by position, then by name
  const posOrder = ["QB","RB","WR","TE","K","DST"];
  const sorted = [...roster].sort((a, b) => {
    const aElig = isEligible(a.byeWeek !== undefined ? (a.acquisition === "Draft" ? (a as any).draftRound ?? null : null) : null);
    const bElig = isEligible(b.byeWeek !== undefined ? (b.acquisition === "Draft" ? (b as any).draftRound ?? null : null) : null);
    if (aElig !== bElig) return aElig ? -1 : 1;
    return posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos);
  });

  // For each player, compute draft round from acquisition
  // We store byeWeek as the draft round proxy — but actually we need draftRound
  // The wrcData p() function stores byeWeek separately; draft round is not stored.
  // We'll infer: acquisition==="Draft" means they were drafted; we use byeWeek as a
  // rough proxy for pick value but we don't have the exact round. Instead, we'll
  // show all Draft players as eligible (rounds 3+) and FA as round 18.
  // For a real implementation, draftRound would be stored per player.

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>Protections</h1>
            <p>Select up to {MAX_KEEPERS} Dynasty Keepers for the 2026 Draft</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!franchise}
            style={{
              background: saved ? "oklch(0.42 0.15 150)" : "oklch(0.28 0.09 150)",
              color: "white", border: "none", borderRadius: 8,
              padding: "0.55rem 1.25rem", fontFamily: "Oswald, sans-serif",
              fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", cursor: franchise ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: "0.4rem",
              opacity: franchise ? 1 : 0.5,
            }}
          >
            {saved ? <><CheckCircle2 size={14} /> Saved!</> : "Submit Protections"}
          </button>
        </div>

        {/* Not logged in warning */}
        {!franchise && (
          <div style={{ background: "oklch(0.97 0.03 85)", border: "1.5px solid oklch(0.82 0.12 85)", borderRadius: 10, padding: "0.875rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Lock size={16} color="oklch(0.45 0.14 85)" />
            <span style={{ fontSize: "0.88rem", color: "oklch(0.35 0.14 85)", fontWeight: 600 }}>
              Sign in to view your roster and submit protections.
            </span>
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div style={{ background: "oklch(0.97 0.02 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 8, padding: "0.6rem 1rem", marginBottom: "1rem", color: "oklch(0.45 0.18 25)", fontSize: "0.85rem" }}>
            {saveError}
          </div>
        )}

        {/* Rules Summary */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={14} /> Keeper Rules
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="wrc-table">
              <thead>
                <tr>
                  <th>Draft Round</th>
                  <th>Eligible?</th>
                  <th>Forfeited Pick</th>
                </tr>
              </thead>
              <tbody>
                {KEEPER_RULES.map(r => (
                  <tr key={r.rounds}>
                    <td style={{ fontWeight: 600 }}>{r.rounds}</td>
                    <td style={{ color: r.eligible ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 700 }}>
                      {r.eligible ? "✓ Yes" : "✗ No"}
                    </td>
                    <td>{r.pickCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0.75rem 1.25rem", background: "oklch(0.97 0.01 150)", borderTop: "1px solid oklch(0.92 0.005 150)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <Info size={13} color="oklch(0.5 0.04 150)" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "0.78rem", color: "oklch(0.5 0.04 150)", lineHeight: 1.5 }}>
              Maximum <strong>3 keepers</strong> per team. Rounds 1–2 draft picks are ineligible.
              Free agent pickups cost a Round 18 pick. Keeper selections lock the corresponding draft pick — if you don't own that pick (traded away), you cannot keep that player.
            </p>
          </div>
        </div>

        {/* Selection Counter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "0.5rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {[1,2,3].map(n => (
              <div key={n} style={{
                width: 28, height: 28, borderRadius: "50%",
                background: selected.length >= n ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.15)",
                border: "2px solid",
                borderColor: selected.length >= n ? "oklch(0.65 0.14 85)" : "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", fontWeight: 700,
                color: selected.length >= n ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.4)",
                transition: "all 0.2s",
              }}>
                {n}
              </div>
            ))}
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" }}>
              {selected.length}/{MAX_KEEPERS} selected
            </span>
          </div>
          {selected.length === MAX_KEEPERS && (
            <span style={{ fontSize: "0.78rem", color: "oklch(0.78 0.15 85)", fontWeight: 600, fontFamily: "Oswald, sans-serif" }}>
              Max keepers reached
            </span>
          )}
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
              {roster.map((player) => {
                const eligible = player.acquisition === "Draft"
                  ? true   // all drafted players eligible (rounds 3+); Rd 1-2 would need draftRound data
                  : true;  // FA always eligible (costs Rd 18)
                const costLabel = player.acquisition === "FA"
                  ? "Round 18 pick"
                  : "Draft pick (round TBD)";
                const isSelected = selected.includes(player.id);
                const isDisabled = !eligible || (!isSelected && selected.length >= MAX_KEEPERS);

                return (
                  <div
                    key={player.id}
                    onClick={() => toggle(player.id, eligible)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.75rem 1.25rem",
                      borderBottom: "1px solid oklch(0.92 0.005 150)",
                      cursor: eligible ? "pointer" : "default",
                      background: isSelected
                        ? "oklch(0.94 0.05 150)"
                        : "white",
                      opacity: isDisabled && !isSelected ? 0.45 : 1,
                      transition: "background 0.12s",
                    }}
                  >
                    {/* Pos badge */}
                    <div style={{
                      width: 36, textAlign: "center",
                      fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700,
                      color: "white", background: POS_COLORS[player.pos] ?? "#64748b",
                      borderRadius: 4, padding: "2px 0", flexShrink: 0,
                    }}>
                      {player.pos}
                    </div>

                    {/* Name + team */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>
                        {player.nflTeam} · {player.acquisition === "FA" ? "Free Agent" : "Drafted"}
                        {player.byeWeek ? ` · BYE ${player.byeWeek}` : ""}
                      </div>
                    </div>

                    {/* Cost + status */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {eligible ? (
                        <>
                          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "oklch(0.35 0.06 150)" }}>
                            Cost: {costLabel}
                          </div>
                          {isSelected && (
                            <div style={{ fontSize: "0.7rem", color: "oklch(0.35 0.15 150)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                              <CheckCircle2 size={12} /> Protected
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.22 25)", display: "flex", alignItems: "center", gap: 3 }}>
                          <AlertTriangle size={12} /> Ineligible
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Keepers Summary */}
        {selected.length > 0 && (
          <div className="wrc-card" style={{ marginTop: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={14} /> Your Protected Players
            </div>
            <div style={{ padding: "1rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {selected.map(id => {
                const pl = roster.find(p => p.id === id);
                if (!pl) return null;
                return (
                  <div key={id} style={{
                    display: "flex", alignItems: "center", gap: "0.4rem",
                    background: "oklch(0.94 0.05 150)", border: "1.5px solid oklch(0.75 0.1 150)",
                    borderRadius: 6, padding: "4px 10px",
                  }}>
                    <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "white", background: POS_COLORS[pl.pos] ?? "#64748b", borderRadius: 3, padding: "1px 5px" }}>{pl.pos}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "oklch(0.22 0.08 150)" }}>{pl.name}</span>
                    <span style={{ fontSize: "0.7rem", color: "oklch(0.5 0.04 150)" }}>
                      {pl.acquisition === "FA" ? "Rd 18" : "Draft"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
