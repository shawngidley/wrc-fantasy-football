/**
 * WRC Fantasy Football - Protections (Dynasty Keeper) Page
 * Owners select up to 3 keepers with forfeited pick cost shown in real time
 */
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";

const KEEPER_RULES = [
  { rounds: "Rounds 1-2", eligible: false, maxKeepers: 0, pickCost: "Ineligible" },
  { rounds: "Rounds 3-6", eligible: true, maxKeepers: 1, pickCost: "Same round pick" },
  { rounds: "Rounds 7-10", eligible: true, maxKeepers: 3, pickCost: "2 rounds earlier" },
  { rounds: "Rounds 11-18", eligible: true, maxKeepers: 3, pickCost: "3 rounds earlier" },
];

const MOCK_ROSTER = [
  { name: "Josh Allen", pos: "QB", nflTeam: "BUF", draftRound: 1, eligible: false, keeperCost: null },
  { name: "CeeDee Lamb", pos: "WR", nflTeam: "DAL", draftRound: 2, eligible: false, keeperCost: null },
  { name: "Saquon Barkley", pos: "RB", nflTeam: "PHI", draftRound: 3, eligible: true, keeperCost: "Round 3" },
  { name: "Tyreek Hill", pos: "WR", nflTeam: "MIA", draftRound: 5, eligible: true, keeperCost: "Round 5" },
  { name: "Sam LaPorta", pos: "TE", nflTeam: "DET", draftRound: 8, eligible: true, keeperCost: "Round 6" },
  { name: "Jahmyr Gibbs", pos: "RB", nflTeam: "DET", draftRound: 9, eligible: true, keeperCost: "Round 7" },
  { name: "Jaylen Waddle", pos: "WR", nflTeam: "MIA", draftRound: 11, eligible: true, keeperCost: "Round 8" },
  { name: "Tony Pollard", pos: "RB", nflTeam: "TEN", draftRound: 12, eligible: true, keeperCost: "Round 9" },
];

const POS_COLORS: Record<string, string> = {
  QB: "#6366f1", RB: "oklch(0.42 0.15 150)", WR: "#0ea5e9", TE: "oklch(0.65 0.14 85)", K: "#64748b", DST: "#ef4444",
};

export default function Protections() {
  const { franchise } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const MAX_KEEPERS = 3;

  const toggle = (name: string) => {
    const player = MOCK_ROSTER.find(p => p.name === name);
    if (!player?.eligible) return;
    if (selected.includes(name)) {
      setSelected(prev => prev.filter(n => n !== name));
    } else {
      if (selected.length >= MAX_KEEPERS) return;
      setSelected(prev => [...prev, name]);
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>Protections</h1>
            <p>Select up to 3 Dynasty Keepers for the 2025 Draft</p>
          </div>
          <button onClick={handleSave} style={{ background: saved ? "oklch(0.42 0.15 150)" : "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {saved ? <><CheckCircle2 size={14} /> Saved!</> : "Submit Protections"}
          </button>
        </div>

        {/* Rules Summary */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header"><Shield size={14} /> Keeper Rules</div>
          <div style={{ overflowX: "auto" }}>
            <table className="wrc-table">
              <thead><tr><th>Draft Round</th><th>Eligible?</th><th>Max Keepers</th><th>Forfeited Pick</th></tr></thead>
              <tbody>
                {KEEPER_RULES.map(r => (
                  <tr key={r.rounds}>
                    <td>{r.rounds}</td>
                    <td style={{ color: r.eligible ? "oklch(0.42 0.15 150)" : "oklch(0.55 0.22 25)", fontWeight: 700 }}>{r.eligible ? "Yes" : "No"}</td>
                    <td>{r.maxKeepers}</td>
                    <td>{r.pickCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selection Counter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "0.5rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {[1,2,3].map(n => (
              <div key={n} style={{ width: 28, height: 28, borderRadius: "50%", background: selected.length >= n ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.15)", border: "2px solid", borderColor: selected.length >= n ? "oklch(0.65 0.14 85)" : "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", fontWeight: 700, color: selected.length >= n ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }}>
                {n}
              </div>
            ))}
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" }}>{selected.length}/{MAX_KEEPERS} selected</span>
          </div>
        </div>

        {/* Roster */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">Your Roster — {franchise?.team_name || "Select Team"}</div>
          <div>
            {MOCK_ROSTER.map((player, i) => {
              const isSelected = selected.includes(player.name);
              const isDisabled = !player.eligible || (!isSelected && selected.length >= MAX_KEEPERS);
              return (
                <div key={i} onClick={() => toggle(player.name)} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid oklch(0.92 0.005 150)", cursor: player.eligible ? "pointer" : "default", background: isSelected ? "oklch(0.94 0.03 150)" : "white", opacity: isDisabled && !isSelected ? 0.5 : 1, transition: "background 0.12s" }}>
                  <div style={{ width: 36, textAlign: "center", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "white", background: POS_COLORS[player.pos] || "#64748b", borderRadius: 4, padding: "2px 0" }}>{player.pos}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)" }}>{player.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{player.nflTeam} · Drafted Round {player.draftRound}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {player.eligible ? (
                      <>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "oklch(0.35 0.06 150)" }}>Cost: {player.keeperCost}</div>
                        {isSelected && <div style={{ fontSize: "0.7rem", color: "oklch(0.42 0.15 150)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><CheckCircle2 size={12} /> Protected</div>}
                      </>
                    ) : (
                      <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.22 25)", display: "flex", alignItems: "center", gap: 3 }}><AlertTriangle size={12} /> Ineligible</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
