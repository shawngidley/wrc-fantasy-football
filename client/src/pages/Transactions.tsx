/**
 * WRC Fantasy Football - Transactions Page
 * Live feed of all adds, drops, and trades from Supabase roster_moves table.
 * Owners can submit waiver claims (ADD + DROP) directly from this page.
 * Commissioner can log any transaction on behalf of any team.
 */
import { useState, useEffect, useRef } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Plus, X, RefreshCw, Search } from "lucide-react";
import { NFL_PLAYERS_2026 } from "@/lib/nflPlayers2026";
import { TEAMS } from "@/lib/wrcData";
import { toast } from "sonner";

interface RosterMove {
  id: number;
  move_type: "ADD" | "DROP" | "TRADE";
  team_name: string;
  owner: string;
  player_name: string;
  player_pos: string;
  player_nfl_team: string;
  faab_spent: number | null;
  note: string | null;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ADD:   <ArrowUpCircle   size={15} color="oklch(0.42 0.15 150)" />,
  DROP:  <ArrowDownCircle size={15} color="oklch(0.55 0.22 25)"  />,
  TRADE: <ArrowLeftRight  size={15} color="oklch(0.55 0.18 260)" />,
};
const TYPE_COLORS: Record<string, string> = {
  ADD:   "oklch(0.42 0.15 150)",
  DROP:  "oklch(0.55 0.22 25)",
  TRADE: "oklch(0.55 0.18 260)",
};
const TYPE_BG: Record<string, string> = {
  ADD:   "oklch(0.94 0.06 150)",
  DROP:  "oklch(0.96 0.04 25)",
  TRADE: "oklch(0.94 0.06 260)",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Add/Drop Modal ────────────────────────────────────────────────────────────
function AddDropModal({ onClose, onSubmit, franchise, isCommissioner }: {
  onClose: () => void;
  onSubmit: (data: { addPlayer: typeof NFL_PLAYERS_2026[0]; dropPlayerName: string; faab: number; teamName: string; owner: string }) => Promise<void>;
  franchise: { team_name: string; owner: string; faab?: number } | null;
  isCommissioner: boolean;
}) {
  const [addSearch, setAddSearch] = useState("");
  const [dropSearch, setDropSearch] = useState("");
  const [selectedAdd, setSelectedAdd] = useState<typeof NFL_PLAYERS_2026[0] | null>(null);
  const [dropPlayerName, setDropPlayerName] = useState("");
  const [faab, setFaab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(franchise?.team_name ?? "");
  const [selectedOwner, setSelectedOwner] = useState(franchise?.owner ?? "");

  const addResults = addSearch.length >= 2
    ? NFL_PLAYERS_2026.filter(p =>
        p.name.toLowerCase().includes(addSearch.toLowerCase()) ||
        p.nflTeam.toLowerCase().includes(addSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleTeamChange = (teamName: string) => {
    setSelectedTeam(teamName);
    const team = TEAMS.find(t => t.teamName === teamName);
    setSelectedOwner(team?.owner ?? "");
  };

  const handleSubmit = async () => {
    if (!selectedAdd) { toast.error("Select a player to add."); return; }
    if (!dropPlayerName.trim()) { toast.error("Enter the player you are dropping."); return; }
    if (!selectedTeam) { toast.error("Select a team."); return; }
    setSubmitting(true);
    await onSubmit({ addPlayer: selectedAdd, dropPlayerName: dropPlayerName.trim(), faab, teamName: selectedTeam, owner: selectedOwner });
    setSubmitting(false);
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem",
    fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.875rem", border: "1.5px solid oklch(0.85 0.01 150)",
    borderRadius: 8, fontSize: "0.9rem", color: "oklch(0.2 0.03 150)", background: "white",
    outline: "none", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "oklch(0.22 0.08 150)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.06em", color: "white" }}>
            WAIVER CLAIM / ADD-DROP
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Team selector (commissioner only) */}
          {isCommissioner && (
            <div>
              <label style={labelStyle}>Team</label>
              <select value={selectedTeam} onChange={e => handleTeamChange(e.target.value)} style={inputStyle}>
                <option value="">Select team…</option>
                {TEAMS.map(t => <option key={t.id} value={t.teamName}>{t.teamName} ({t.owner})</option>)}
              </select>
            </div>
          )}

          {/* Add player search */}
          <div>
            <label style={labelStyle}>Player to Add</label>
            {selectedAdd ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "oklch(0.94 0.06 150)", border: "1.5px solid oklch(0.82 0.1 150)", borderRadius: 8, padding: "0.6rem 0.875rem" }}>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.75rem", background: "oklch(0.42 0.15 150)", color: "white", borderRadius: 4, padding: "2px 6px" }}>{selectedAdd.pos}</span>
                <span style={{ flex: 1, fontWeight: 600, color: "oklch(0.22 0.08 150)" }}>{selectedAdd.name}</span>
                <span style={{ fontSize: "0.8rem", color: "oklch(0.5 0.04 150)" }}>{selectedAdd.nflTeam}</span>
                <button onClick={() => { setSelectedAdd(null); setAddSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.04 150)", padding: 0 }}><X size={14} /></button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "oklch(0.6 0.04 150)" }}><Search size={14} /></div>
                <input
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  placeholder="Search player name or NFL team…"
                  style={{ ...inputStyle, paddingLeft: "2rem" }}
                />
                {addResults.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1.5px solid oklch(0.85 0.01 150)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10, maxHeight: 220, overflowY: "auto" }}>
                    {addResults.map(p => (
                      <button key={p.name} onClick={() => { setSelectedAdd(p); setAddSearch(""); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.875rem", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.97 0.02 150)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.7rem", background: "oklch(0.92 0.04 150)", color: "oklch(0.35 0.1 150)", borderRadius: 4, padding: "1px 5px", minWidth: 28, textAlign: "center" }}>{p.pos}</span>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: "0.88rem", color: "oklch(0.22 0.08 150)" }}>{p.name}</span>
                        <span style={{ fontSize: "0.78rem", color: "oklch(0.55 0.04 150)" }}>{p.nflTeam}</span>
                        <span style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)" }}>ADP {p.adp}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drop player */}
          <div>
            <label style={labelStyle}>Player to Drop</label>
            <input
              value={dropPlayerName}
              onChange={e => setDropPlayerName(e.target.value)}
              placeholder="Enter player name to drop…"
              style={inputStyle}
            />
          </div>

          {/* FAAB bid */}
          <div>
            <label style={labelStyle}>FAAB Bid ($)</label>
            <input
              type="number"
              min={0}
              max={franchise?.faab ?? 1000}
              value={faab}
              onChange={e => setFaab(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ ...inputStyle, width: 120 }}
            />
            {franchise?.faab !== undefined && (
              <span style={{ marginLeft: "0.75rem", fontSize: "0.78rem", color: "oklch(0.5 0.04 150)" }}>
                Budget remaining: ${franchise.faab}
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: submitting ? "oklch(0.88 0.01 150)" : "oklch(0.28 0.09 150)",
              color: "white", border: "none", borderRadius: 8, padding: "0.7rem 1.5rem",
              fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.88rem", fontWeight: 700,
              letterSpacing: "0.06em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer",
              width: "100%",
            }}
          >
            {submitting ? "Submitting…" : "Submit Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Transactions() {
  const { franchise, isCommissioner } = useAuth();
  const [moves, setMoves] = useState<RosterMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | "ADD" | "DROP" | "TRADE">("ALL");
  const [filterTeam, setFilterTeam] = useState("ALL");

  const loadMoves = async () => {
    const { data } = await supabase
      .from("roster_moves")
      .select("*")
      .order("created_at", { ascending: false });
    setMoves((data as RosterMove[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadMoves();
    const channel = supabase
      .channel("transactions-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roster_moves" }, payload => {
        setMoves(prev => [payload.new as RosterMove, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmitClaim = async ({ addPlayer, dropPlayerName, faab, teamName, owner }: {
    addPlayer: typeof NFL_PLAYERS_2026[0];
    dropPlayerName: string;
    faab: number;
    teamName: string;
    owner: string;
  }) => {
    // Insert ADD move
    const { error: addErr } = await supabase.from("roster_moves").insert({
      move_type: "ADD",
      team_name: teamName,
      owner,
      player_name: addPlayer.name,
      player_pos: addPlayer.pos,
      player_nfl_team: addPlayer.nflTeam,
      faab_spent: faab,
    });
    if (addErr) { toast.error("Failed to submit add: " + addErr.message); return; }

    // Insert DROP move
    const { error: dropErr } = await supabase.from("roster_moves").insert({
      move_type: "DROP",
      team_name: teamName,
      owner,
      player_name: dropPlayerName,
      player_pos: "—",
      player_nfl_team: "FA",
      faab_spent: null,
    });
    if (dropErr) { toast.error("Failed to submit drop: " + dropErr.message); return; }

    // Deduct FAAB from teams table
    if (faab > 0) {
      const team = TEAMS.find(t => t.teamName === teamName);
      if (team) {
        const currentFaab = team.faabRemaining ?? 1000;
        await supabase.from("teams").update({ faab_remaining: Math.max(0, currentFaab - faab) }).eq("teamName", teamName);
      }
    }

    toast.success(`${addPlayer.name} added, ${dropPlayerName} dropped!`);
    setShowModal(false);
    loadMoves();
  };

  const filtered = moves.filter(m => {
    const matchType = filterType === "ALL" || m.move_type === filterType;
    const matchTeam = filterTeam === "ALL" || m.team_name === filterTeam;
    return matchType && matchTeam;
  });

  const uniqueTeams = Array.from(new Set(moves.map(m => m.team_name))).sort();

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1>Transactions</h1>
            <p>All adds, drops, and trades — 2026 Season</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button onClick={loadMoves} title="Refresh" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "0.5rem", cursor: "pointer", color: "white", display: "flex" }}>
              <RefreshCw size={15} />
            </button>
            {(franchise || isCommissioner) && (
              <button
                onClick={() => setShowModal(true)}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "oklch(0.78 0.15 85)", color: "oklch(0.18 0.05 85)", border: "none", borderRadius: 8, padding: "0.55rem 1.1rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
              >
                <Plus size={14} /> Add / Drop
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {(["ALL", "ADD", "DROP", "TRADE"] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{
              padding: "0.35rem 0.9rem", borderRadius: 20, border: "1.5px solid",
              borderColor: filterType === t ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.25)",
              background: filterType === t ? "oklch(0.78 0.15 85)" : "rgba(0,0,0,0.3)",
              color: filterType === t ? "oklch(0.18 0.05 85)" : "white",
              fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.06em", cursor: "pointer",
            }}>{t}</button>
          ))}
          {uniqueTeams.length > 0 && (
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{
              padding: "0.35rem 0.75rem", borderRadius: 20, border: "1.5px solid rgba(255,255,255,0.25)",
              background: "rgba(0,0,0,0.3)", color: "white", fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", outline: "none",
            }}>
              <option value="ALL">All Teams</option>
              {uniqueTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* Transaction Feed */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", letterSpacing: "0.06em" }}>
              Loading transactions…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <ArrowLeftRight size={32} color="oklch(0.75 0.04 150)" style={{ marginBottom: "0.75rem" }} />
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.4 0.06 150)", marginBottom: "0.35rem" }}>No Transactions Yet</div>
              <div style={{ fontSize: "0.82rem", color: "oklch(0.6 0.04 150)" }}>Waiver claims and trades will appear here once submitted.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="wrc-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Team</th>
                    <th>Player</th>
                    <th>Pos</th>
                    <th>FAAB</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} className="wrc-row-hover">
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {TYPE_ICONS[m.move_type]}
                          <span style={{
                            fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700,
                            color: TYPE_COLORS[m.move_type], background: TYPE_BG[m.move_type],
                            borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em",
                          }}>{m.move_type}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: "0.88rem" }}>{m.team_name}</td>
                      <td style={{ fontWeight: 500 }}>{m.player_name}</td>
                      <td>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "oklch(0.35 0.06 150)", background: "oklch(0.92 0.01 150)", borderRadius: 4, padding: "1px 6px" }}>
                          {m.player_pos}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: "oklch(0.28 0.09 150)" }}>
                        {m.faab_spent != null ? `$${m.faab_spent}` : "—"}
                      </td>
                      <td style={{ color: "oklch(0.55 0.04 150)", fontSize: "0.82rem" }}>{fmt(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddDropModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitClaim}
          franchise={franchise ? { team_name: franchise.team_name, owner: franchise.owner, faab: franchise.faab } : null}
          isCommissioner={!!isCommissioner}
        />
      )}
    </div>
  );
}
