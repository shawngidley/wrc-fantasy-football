/**
 * WRC Fantasy Football — Trades Page
 * Background: Field turf
 * Supports trading players, FAAB budget, and future draft picks (current + next year)
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ArrowLeftRight, Plus, X, DollarSign, CalendarDays, Inbox, Check, XCircle, RefreshCw } from "lucide-react";
import { TEAMS as WRC_TEAMS } from "@/lib/wrcData";
import { toast } from "sonner";

const TEAMS = WRC_TEAMS.map(t => t.teamName);

const NEXT_YEAR = 2027;
const ROUNDS = Array.from({ length: 18 }, (_, i) => i + 1);

type TradeAsset =
  | { type: "player"; name: string }
  | { type: "faab"; amount: number }
  | { type: "pick"; year: number; round: number; originalTeamId?: string };

type TradeSide = {
  team: string;
  assets: TradeAsset[];
};

// Incoming trade proposals for the inbox
type IncomingProposal = {
  id: string;
  from: string;
  fromTeamId: string;
  toTeamId: string;
  date: string;
  theySend: string[];
  youSend: string[];
  givePlayers: string[];
  receivePlayers: string[];
  giveFaab: number;
  receiveFaab: number;
  givePicks: {year:number;round:number}[];
  receivePicks: {year:number;round:number}[];
  note?: string;
  status: "pending" | "accepted" | "declined";
};

const SAMPLE_INCOMING: IncomingProposal[] = [];

function AssetTag({ asset, onRemove }: { asset: TradeAsset; onRemove: () => void }) {
  let label = "";
  let bg = "oklch(0.93 0.03 150)";
  let color = "oklch(0.28 0.08 150)";

  if (asset.type === "player") {
    label = asset.name;
  } else if (asset.type === "faab") {
    label = `FAAB $${asset.amount}`;
    bg = "oklch(0.93 0.06 250)";
    color = "oklch(0.32 0.14 250)";
  } else {
    label = `${asset.year} Rd ${asset.round} Pick`;
    bg = "oklch(0.93 0.06 85)";
    color = "oklch(0.35 0.14 85)";
  }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      background: bg, color, borderRadius: 5,
      padding: "3px 8px 3px 10px",
      fontSize: "0.78rem", fontWeight: 600,
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "inherit", opacity: 0.7 }}
      >
        <X size={12} />
      </button>
    </span>
  );
}

// ── Live data hook for a team's roster, FAAB, and picks ──────────────────────
type TeamData = {
  roster: { id: string; name: string; position: string; nfl_team: string }[];
  faab: number;
  teamId: string;
  ownedPicks: { year: number; round: number; originalTeamId: string }[];
};

function useTeamData(teamName: string): TeamData & { loading: boolean } {
  const [data, setData] = useState<TeamData>({ roster: [], faab: 1000, teamId: "", ownedPicks: [] });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (name: string) => {
    if (!name) { setData({ roster: [], faab: 1000, teamId: "", ownedPicks: [] }); return; }
    setLoading(true);
    try {
      // Get team id + faab
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, faab")
        .eq("name", name)
        .limit(1);
      const teamRow = teamRows?.[0];
      if (!teamRow) { setLoading(false); return; }
      // Get roster
      const { data: players } = await supabase
        .from("players")
        .select("id, name, position, nfl_team")
        .eq("team_id", teamRow.id)
        .order("position")
        .order("name");
      // Get owned picks from traded_picks table
      const { data: picksData } = await supabase
        .from("traded_picks")
        .select("year, round, original_team_id")
        .eq("current_owner_team_id", teamRow.id)
        .order("year")
        .order("round");
      setData({
        roster: (players ?? []).map((p: { id: string; name: string; position: string; nfl_team: string }) => p),
        faab: teamRow.faab ?? 1000,
        teamId: teamRow.id,
        ownedPicks: (picksData ?? []).map((p: { year: number; round: number; original_team_id: string }) => ({ year: p.year, round: p.round, originalTeamId: p.original_team_id })),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(teamName); }, [teamName, load]);
  return { ...data, loading };
}

function TradeSideBuilder({
  side, label, onChange, isMyTeam,
}: {
  side: TradeSide;
  label: string;
  onChange: (s: TradeSide) => void;
  isMyTeam?: boolean;
}) {
  const [faabAmount, setFaabAmount] = useState("");
  const [pickYear, setPickYear] = useState(2026);
  const [pickRound, setPickRound] = useState(1);
  const [addMode, setAddMode] = useState<"player" | "faab" | "pick" | null>(null);
  const { roster, faab, ownedPicks, teamId, loading: teamLoading } = useTeamData(side.team);

  // Already-added assets
  const addedPlayerNames = new Set(
    side.assets.filter(a => a.type === "player").map(a => (a as { type: "player"; name: string }).name)
  );
  const totalFaabAdded = side.assets
    .filter(a => a.type === "faab")
    .reduce((s, a) => s + (a as { type: "faab"; amount: number }).amount, 0);
  const addedPicks = new Set(
    side.assets.filter(a => a.type === "pick")
      .map(a => { const p = a as { type: "pick"; year: number; round: number }; return `${p.year}-${p.round}`; })
  );

  const addAsset = (asset: TradeAsset) => {
    onChange({ ...side, assets: [...side.assets, asset] });
    setAddMode(null);
  };

  const removeAsset = (i: number) => {
    onChange({ ...side, assets: side.assets.filter((_, idx) => idx !== i) });
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "0.3rem",
    padding: "0.3rem 0.75rem",
    border: `1.5px solid ${active ? "oklch(0.28 0.09 150)" : "oklch(0.88 0.01 150)"}`,
    background: active ? "oklch(0.28 0.09 150)" : "white",
    color: active ? "white" : "oklch(0.4 0.04 150)",
    borderRadius: 6, fontSize: "0.75rem", fontWeight: 600,
    fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em",
    textTransform: "uppercase" as const, cursor: "pointer",
  });

  const faabRemaining = faab - totalFaabAdded;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Team label */}
      <label style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", display: "block", marginBottom: "0.4rem" }}>
        {label}
      </label>

      {/* Team selector — only shown on "their" side */}
      {!isMyTeam && (
        <select
          value={side.team}
          onChange={e => onChange({ ...side, team: e.target.value, assets: [] })}
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", marginBottom: "0.75rem", background: "white" }}
        >
          <option value="">Select team…</option>
          {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}

      {/* My team name display */}
      {isMyTeam && (
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "oklch(0.22 0.08 150)", marginBottom: "0.5rem" }}>
          {side.team}
          {faab > 0 && (
            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "oklch(0.45 0.04 150)", marginLeft: "0.5rem" }}>
              FAAB: ${faab}
            </span>
          )}
        </div>
      )}

      {/* Asset tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", minHeight: 32, marginBottom: "0.75rem" }}>
        {side.assets.length === 0 && (
          <span style={{ fontSize: "0.78rem", color: "oklch(0.65 0.02 150)", fontStyle: "italic" }}>No assets added yet</span>
        )}
        {side.assets.map((a, i) => (
          <AssetTag key={i} asset={a} onRemove={() => removeAsset(i)} />
        ))}
      </div>

      {/* Add asset buttons */}
      {(side.team || isMyTeam) && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <button style={btnStyle(addMode === "player")} onClick={() => setAddMode(addMode === "player" ? null : "player")}>
            <Plus size={11} /> Player
          </button>
          <button style={btnStyle(addMode === "faab")} onClick={() => setAddMode(addMode === "faab" ? null : "faab")}>
            <DollarSign size={11} /> FAAB
          </button>
          <button style={btnStyle(addMode === "pick")} onClick={() => setAddMode(addMode === "pick" ? null : "pick")}>
            <CalendarDays size={11} /> Draft Pick
          </button>
        </div>
      )}

      {/* Player picker — scrollable roster list */}
      {addMode === "player" && (
        <div style={{ border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, marginBottom: "0.5rem", maxHeight: 220, overflowY: "auto", background: "white" }}>
          {teamLoading ? (
            <div style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "oklch(0.55 0.03 150)" }}>Loading roster…</div>
          ) : roster.length === 0 ? (
            <div style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "oklch(0.55 0.03 150)" }}>No players found</div>
          ) : (
            roster.map(p => {
              const alreadyAdded = addedPlayerNames.has(p.name);
              return (
                <button
                  key={p.id}
                  disabled={alreadyAdded}
                  onClick={() => { if (!alreadyAdded) addAsset({ type: "player", name: p.name }); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    width: "100%", padding: "0.5rem 0.75rem",
                    background: alreadyAdded ? "oklch(0.96 0.01 150)" : "white",
                    border: "none", borderBottom: "1px solid oklch(0.94 0.01 150)",
                    cursor: alreadyAdded ? "default" : "pointer", textAlign: "left",
                    opacity: alreadyAdded ? 0.5 : 1,
                  }}
                >
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                    background: p.position === "QB" ? "#3b82f6" : p.position === "RB" ? "#22c55e" : p.position === "WR" ? "#a855f7" : p.position === "TE" ? "#f97316" : "#6b7280",
                    color: "white", minWidth: 26, textAlign: "center",
                  }}>{p.position}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "oklch(0.22 0.06 150)", flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.03 150)" }}>{p.nfl_team}</span>
                  {alreadyAdded && <Check size={12} style={{ color: "oklch(0.45 0.14 150)" }} />}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* FAAB input with balance display */}
      {addMode === "faab" && (
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "oklch(0.45 0.04 150)", marginBottom: "0.35rem" }}>
            Available FAAB: <strong>${faabRemaining}</strong> of ${faab}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "oklch(0.4 0.04 150)" }}>$</span>
            <input
              type="number"
              min={1}
              max={faabRemaining}
              value={faabAmount}
              onChange={e => setFaabAmount(e.target.value)}
              placeholder={`Amount (max $${faabRemaining})`}
              style={{ flex: 1, padding: "0.45rem 0.75rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 6, fontSize: "0.85rem" }}
            />
            <button
              onClick={() => {
                const n = parseInt(faabAmount);
                if (n > 0 && n <= faabRemaining) { addAsset({ type: "faab", amount: n }); setFaabAmount(""); }
                else if (n > faabRemaining) { toast.error(`Max FAAB available: $${faabRemaining}`); }
              }}
              style={{ padding: "0.45rem 0.9rem", background: "oklch(0.32 0.14 250)", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: "0.82rem" }}
            >Add</button>
          </div>
        </div>
      )}

      {/* Pick selector — show only picks this team currently owns from traded_picks */}
      {addMode === "pick" && (
        <div style={{ border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, marginBottom: "0.5rem", background: "white" }}>
          {teamLoading ? (
            <div style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "oklch(0.55 0.03 150)" }}>Loading picks…</div>
          ) : ownedPicks.length === 0 ? (
            <div style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "oklch(0.55 0.03 150)" }}>No tradeable picks available</div>
          ) : (
            <>
              {/* Year filter tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                {Array.from(new Set(ownedPicks.map(p => p.year))).sort().map((yr, i, arr) => (
                  <button
                    key={yr}
                    onClick={() => setPickYear(yr)}
                    style={{
                      flex: 1, padding: "0.4rem", fontSize: "0.78rem", fontWeight: 700,
                      background: pickYear === yr ? "oklch(0.42 0.14 85)" : "white",
                      color: pickYear === yr ? "white" : "oklch(0.4 0.04 150)",
                      border: "none", cursor: "pointer",
                      borderRadius: i === 0 ? "6px 0 0 0" : i === arr.length - 1 ? "0 6px 0 0" : "0",
                    }}
                  >{yr} Draft</button>
                ))}
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {ownedPicks.filter(p => p.year === pickYear).map(p => {
                  const key = `${p.year}-${p.round}-${p.originalTeamId}`;
                  const alreadyAdded = addedPicks.has(key);
                  return (
                    <button
                      key={key}
                      disabled={alreadyAdded}
                      onClick={() => { if (!alreadyAdded) addAsset({ type: "pick", year: p.year, round: p.round, originalTeamId: p.originalTeamId }); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "0.45rem 0.75rem",
                        background: alreadyAdded ? "oklch(0.96 0.01 150)" : "white",
                        border: "none", borderBottom: "1px solid oklch(0.94 0.01 150)",
                        cursor: alreadyAdded ? "default" : "pointer",
                        opacity: alreadyAdded ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "oklch(0.28 0.08 150)" }}>
                        {p.year} Round {p.round}{p.originalTeamId !== teamId ? <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", marginLeft: 4 }}>(via {p.originalTeamId.replace("team-", "")})</span> : null}
                      </span>
                      {alreadyAdded && <Check size={12} style={{ color: "oklch(0.45 0.14 150)" }} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Trades() {
  const { franchise } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [mySide, setMySide] = useState<TradeSide>({ team: franchise?.team_name ?? "", assets: [] });
  const [theirSide, setTheirSide] = useState<TradeSide>({ team: "", assets: [] });
  const [note, setNote] = useState("");
  const [inbox, setInbox] = useState<IncomingProposal[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);

  // Load incoming proposals from Supabase
  const loadInbox = async () => {
    if (!franchise?.id) return;
    setInboxLoading(true);
    const { data, error } = await supabase
      .from("trade_proposals")
      .select("id, from_team_id, to_team_id, give_player_ids, receive_player_ids, faab_amount, receive_faab_amount, give_picks, receive_picks, note, status, created_at")
      .eq("to_team_id", franchise.id)
      .order("created_at", { ascending: false });
    setInboxLoading(false);
    if (error || !data) return;
    setInbox(data.map((r: { id: string; from_team_id: string; to_team_id: string; give_player_ids: string[]; receive_player_ids: string[]; faab_amount: number; receive_faab_amount: number; give_picks: {year:number;round:number}[]; receive_picks: {year:number;round:number}[]; note: string; status: string; created_at: string }) => ({
      id: r.id,
      from: r.from_team_id,
      fromTeamId: r.from_team_id,
      toTeamId: r.to_team_id,
      date: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      theySend: [
        ...(r.give_player_ids ?? []),
        ...(r.faab_amount > 0 ? [`FAAB $${r.faab_amount}`] : []),
        ...((r.give_picks ?? []).map((p: {year:number;round:number}) => `${p.year} Rd ${p.round} Pick`)),
      ],
      youSend: [
        ...(r.receive_player_ids ?? []),
        ...(r.receive_faab_amount > 0 ? [`FAAB $${r.receive_faab_amount}`] : []),
        ...((r.receive_picks ?? []).map((p: {year:number;round:number}) => `${p.year} Rd ${p.round} Pick`)),
      ],
      givePlayers: r.give_player_ids ?? [],
      receivePlayers: r.receive_player_ids ?? [],
      giveFaab: r.faab_amount ?? 0,
      receiveFaab: r.receive_faab_amount ?? 0,
      givePicks: r.give_picks ?? [],
      receivePicks: r.receive_picks ?? [],
      note: r.note || undefined,
      status: r.status as "pending" | "accepted" | "declined",
    })));
  };

  useEffect(() => { loadInbox(); }, [franchise?.id]);

  const resetForm = () => {
    setMySide({ team: franchise?.team_name ?? "", assets: [] });
    setTheirSide({ team: "", assets: [] });
    setNote("");
    setShowForm(false);
  };

  const sendProposal = async () => {
    if (!franchise?.id || !theirSide.team) { toast.error("Select a team to trade with"); return; }
    const toTeam = WRC_TEAMS.find(t => t.teamName === theirSide.team);
    if (!toTeam) { toast.error("Team not found"); return; }
    const givePlayers = mySide.assets.filter(a => a.type === "player").map(a => (a as { type: "player"; name: string }).name);
    const receivePlayers = theirSide.assets.filter(a => a.type === "player").map(a => (a as { type: "player"; name: string }).name);
    const faabGiven = mySide.assets.filter(a => a.type === "faab").reduce((s, a) => s + (a as { type: "faab"; amount: number }).amount, 0);
    const faabReceived = theirSide.assets.filter(a => a.type === "faab").reduce((s, a) => s + (a as { type: "faab"; amount: number }).amount, 0);
    const givePicks = mySide.assets.filter(a => a.type === "pick").map(a => { const p = a as { type: "pick"; year: number; round: number }; return { year: p.year, round: p.round }; });
    const receivePicks = theirSide.assets.filter(a => a.type === "pick").map(a => { const p = a as { type: "pick"; year: number; round: number }; return { year: p.year, round: p.round }; });
    const { error } = await supabase.from("trade_proposals").insert({
      from_team_id: franchise.id,
      to_team_id: toTeam.id,
      give_player_ids: givePlayers,
      receive_player_ids: receivePlayers,
      faab_amount: faabGiven,
      receive_faab_amount: faabReceived,
      give_picks: givePicks,
      receive_picks: receivePicks,
      note: note.trim(),
      status: "pending",
    });
    if (error) { toast.error("Failed to send proposal"); return; }
    toast.success(`Trade proposal sent to ${theirSide.team}!`);
    resetForm();
  };

  const respondToProposal = async (id: string, action: "accepted" | "declined") => {
    if (action === "declined") {
      const { error } = await supabase.from("trade_proposals").update({ status: "declined" }).eq("id", id);
      if (error) { toast.error("Failed to decline trade"); return; }
      setInbox(prev => prev.map(p => p.id === id ? { ...p, status: "declined" } : p));
      toast.success("Trade declined");
      return;
    }

    // Accept: execute the trade
    const proposal = inbox.find(p => p.id === id);
    if (!proposal) { toast.error("Proposal not found"); return; }

    try {
      // 0. Resolve team IDs to friendly names and player positions
      const { data: teamsData } = await supabase.from("teams").select("id, name");
      const teamNameMap: Record<string, string> = {};
      (teamsData ?? []).forEach((t: { id: string; name: string }) => { teamNameMap[t.id] = t.name; });
      const fromName = teamNameMap[proposal.fromTeamId] ?? proposal.fromTeamId;
      const toName = teamNameMap[proposal.toTeamId] ?? proposal.toTeamId;
      const allPlayerNames = [...(proposal.givePlayers ?? []), ...(proposal.receivePlayers ?? [])];
      const { data: playerData } = await supabase.from("players").select("name, position, nfl_team").in("name", allPlayerNames);
      const playerMap: Record<string, { pos: string; nflTeam: string }> = {};
      (playerData ?? []).forEach((p: { name: string; position: string; nfl_team: string }) => {
        playerMap[p.name] = { pos: p.position, nflTeam: p.nfl_team };
      });

      // 1. Move sender's players to receiver's team
      for (const playerName of (proposal.givePlayers ?? [])) {
        await supabase.from("players")
          .update({ team_id: proposal.toTeamId })
          .eq("name", playerName)
          .eq("team_id", proposal.fromTeamId);
      }
      // 2. Move receiver's players to sender's team
      for (const playerName of (proposal.receivePlayers ?? [])) {
        await supabase.from("players")
          .update({ team_id: proposal.fromTeamId })
          .eq("name", playerName)
          .eq("team_id", proposal.toTeamId);
      }
      // 3. FAAB: sender gives FAAB to receiver
      if ((proposal.giveFaab ?? 0) > 0) {
        const { data: fromTeam } = await supabase.from("teams").select("faab").eq("id", proposal.fromTeamId).single();
        const { data: toTeam } = await supabase.from("teams").select("faab").eq("id", proposal.toTeamId).single();
        if (fromTeam) await supabase.from("teams").update({ faab: Math.max(0, (fromTeam.faab ?? 0) - proposal.giveFaab) }).eq("id", proposal.fromTeamId);
        if (toTeam) await supabase.from("teams").update({ faab: (toTeam.faab ?? 0) + proposal.giveFaab }).eq("id", proposal.toTeamId);
      }
      // 4. FAAB: receiver gives FAAB to sender
      if ((proposal.receiveFaab ?? 0) > 0) {
        const { data: fromTeam } = await supabase.from("teams").select("faab").eq("id", proposal.fromTeamId).single();
        const { data: toTeam } = await supabase.from("teams").select("faab").eq("id", proposal.toTeamId).single();
        if (toTeam) await supabase.from("teams").update({ faab: Math.max(0, (toTeam.faab ?? 0) - proposal.receiveFaab) }).eq("id", proposal.toTeamId);
        if (fromTeam) await supabase.from("teams").update({ faab: (fromTeam.faab ?? 0) + proposal.receiveFaab }).eq("id", proposal.fromTeamId);
      }
      // 5. Transfer sender's picks to receiver
      for (const pick of (proposal.givePicks ?? [])) {
        await supabase.from("traded_picks")
          .update({ current_owner_team_id: proposal.toTeamId })
          .eq("year", pick.year)
          .eq("round", pick.round)
          .eq("current_owner_team_id", proposal.fromTeamId);
      }
      // 6. Transfer receiver's picks to sender
      for (const pick of (proposal.receivePicks ?? [])) {
        await supabase.from("traded_picks")
          .update({ current_owner_team_id: proposal.fromTeamId })
          .eq("year", pick.year)
          .eq("round", pick.round)
          .eq("current_owner_team_id", proposal.toTeamId);
      }
      // 7. Mark proposal as accepted
      await supabase.from("trade_proposals").update({ status: "accepted" }).eq("id", id);
      setInbox(prev => prev.map(p => p.id === id ? { ...p, status: "accepted" } : p));
      // 8. Write TRADE rows to roster_moves for the activity log
      const tradeNote = [
        ...(proposal.givePlayers ?? []).map(p => `${p} → ${toName}`),
        ...(proposal.receivePlayers ?? []).map(p => `${p} → ${fromName}`),
        ...(proposal.givePicks ?? []).map(p => `${p.year} Rd ${p.round} pick → ${toName}`),
        ...(proposal.receivePicks ?? []).map(p => `${p.year} Rd ${p.round} pick → ${fromName}`),
      ].join(" | ");
      // One TRADE row per player on each side
      const tradeRows = [
        ...(proposal.givePlayers ?? []).map(playerName => ({
          move_type: "TRADE",
          team_name: fromName,
          owner: fromName,
          player_name: playerName,
          player_pos: playerMap[playerName]?.pos ?? "—",
          player_nfl_team: playerMap[playerName]?.nflTeam ?? "—",
          faab_spent: null,
          note: `Traded to ${toName}${(proposal.giveFaab ?? 0) > 0 ? ` + FAAB $${proposal.giveFaab}` : ""}`,
        })),
        ...(proposal.receivePlayers ?? []).map(playerName => ({
          move_type: "TRADE",
          team_name: toName,
          owner: toName,
          player_name: playerName,
          player_pos: playerMap[playerName]?.pos ?? "—",
          player_nfl_team: playerMap[playerName]?.nflTeam ?? "—",
          faab_spent: null,
          note: `Traded to ${fromName}${(proposal.receiveFaab ?? 0) > 0 ? ` + FAAB $${proposal.receiveFaab}` : ""}`,
        })),
      ];
      if (tradeRows.length > 0) {
        await supabase.from("roster_moves").insert(tradeRows);
      }
      // Write pick trade rows
      const pickRows = [
        ...(proposal.givePicks ?? []).map(p => ({
          move_type: "TRADE",
          team_name: fromName,
          owner: fromName,
          player_name: `${p.year} Rd ${p.round} Pick`,
          player_pos: "PICK",
          player_nfl_team: "—",
          faab_spent: null,
          note: `Pick traded to ${toName}`,
        })),
        ...(proposal.receivePicks ?? []).map(p => ({
          move_type: "TRADE",
          team_name: toName,
          owner: toName,
          player_name: `${p.year} Rd ${p.round} Pick`,
          player_pos: "PICK",
          player_nfl_team: "—",
          faab_spent: null,
          note: `Pick traded to ${fromName}`,
        })),
      ];
      if (pickRows.length > 0) {
        await supabase.from("roster_moves").insert(pickRows);
      }
      toast.success("Trade accepted! Rosters, FAAB, and picks updated.");
    } catch (err) {
      console.error("Trade execution error:", err);
      toast.error("Trade accepted but some updates may have failed. Please verify rosters.");
      await supabase.from("trade_proposals").update({ status: "accepted" }).eq("id", id);
      setInbox(prev => prev.map(p => p.id === id ? { ...p, status: "accepted" } : p));
    }
  };

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>Trades</h1>
            <p>Trade deadline: Nov 26, 2026 · 12:00pm ET · Players, FAAB, and draft picks (2026 &amp; 2027) are all tradeable</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Plus size={14} /> Propose Trade
          </button>
        </div>

        {/* Trade Proposal Form */}
        {showForm && (
          <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header"><ArrowLeftRight size={14} /> New Trade Proposal</div>
            <div className="wrc-card-body" style={{ padding: "1.25rem" }}>

              <p style={{ color: "oklch(0.45 0.04 150)", fontSize: "0.85rem", margin: "0 0 1.25rem" }}>
                Build your trade by adding players, FAAB budget, and/or draft picks to each side. You can trade picks for the <strong>2026</strong> and <strong>{NEXT_YEAR}</strong> drafts.
              </p>

              {/* Two-column trade builder */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "start" }}>
                <TradeSideBuilder side={mySide} label="You Send" onChange={setMySide} isMyTeam />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "2.5rem" }}>
                  <ArrowLeftRight size={22} color="oklch(0.6 0.04 150)" />
                </div>
                <TradeSideBuilder side={theirSide} label="You Receive" onChange={setTheirSide} />
              </div>

              {/* Optional note */}
              <div style={{ marginTop: "1rem" }}>
                <label style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", display: "block", marginBottom: "0.4rem" }}>
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a message to the other owner..."
                  style={{ width: "100%", padding: "0.6rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", outline: "none", resize: "vertical", minHeight: 60, boxSizing: "border-box" }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                <button
                  onClick={sendProposal}
                  style={{ background: "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 8, padding: "0.5rem 1.5rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  Send Proposal
                </button>
                <button
                  onClick={resetForm}
                  style={{ background: "oklch(0.94 0.01 150)", color: "oklch(0.4 0.04 150)", border: "1px solid oklch(0.88 0.01 150)", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trade Inbox */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Inbox size={14} />
            Incoming Proposals
            {inbox.length > 0 && (
              <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", borderRadius: 10, padding: "1px 8px" }}>
                {inbox.filter(p => p.status === "pending").length} pending
              </span>
            )}
            <button
              onClick={loadInbox}
              title="Refresh inbox"
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.04 150)", display: "flex", alignItems: "center", padding: "2px" }}
            >
              <RefreshCw size={13} style={{ animation: inboxLoading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
          {inbox.length === 0 ? (
            <div style={{ padding: "2rem 1.25rem", textAlign: "center", color: "oklch(0.6 0.03 150)", fontSize: "0.85rem" }}>
              <Inbox size={28} style={{ margin: "0 auto 0.5rem", opacity: 0.35 }} />
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, letterSpacing: "0.04em" }}>No incoming proposals</div>
              <div style={{ fontSize: "0.78rem", marginTop: "0.25rem", opacity: 0.7 }}>When another owner sends you a trade, it will appear here.</div>
            </div>
          ) : (
            <div>
              {inbox.map(proposal => (
                <div key={proposal.id} style={{
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid oklch(0.92 0.005 150)",
                  background: proposal.status !== "pending" ? "oklch(0.97 0.005 150)" : "white",
                  opacity: proposal.status !== "pending" ? 0.65 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.22 0.08 150)" }}>{proposal.from}</span>
                      <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.03 150)" }}>{proposal.date}</span>
                    </div>
                    {proposal.status === "pending" ? (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => respondToProposal(proposal.id, "accepted")}
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.85rem", background: "oklch(0.38 0.15 150)", color: "white", border: "none", borderRadius: 6, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer" }}
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          onClick={() => respondToProposal(proposal.id, "declined")}
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.85rem", background: "oklch(0.95 0.03 25)", color: "oklch(0.45 0.18 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 6, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer" }}
                        >
                          <XCircle size={12} /> Decline
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, borderRadius: 4, padding: "2px 8px",
                        background: proposal.status === "accepted" ? "oklch(0.93 0.06 150)" : "oklch(0.94 0.04 25)",
                        color: proposal.status === "accepted" ? "oklch(0.35 0.15 150)" : "oklch(0.45 0.18 25)"
                      }}>{proposal.status === "accepted" ? "✓ Accepted" : "✕ Declined"}</span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.75rem", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "oklch(0.5 0.04 150)", marginBottom: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>They send</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                        {proposal.theySend.map((s, j) => {
                          const isFaab = s.startsWith("FAAB");
                          const isPick = s.includes("Pick") || s.includes("Rd");
                          return <span key={j} style={{ fontSize: "0.75rem", fontWeight: 600, borderRadius: 4, padding: "2px 8px", background: isFaab ? "oklch(0.93 0.06 250)" : isPick ? "oklch(0.93 0.06 85)" : "oklch(0.93 0.03 150)", color: isFaab ? "oklch(0.32 0.14 250)" : isPick ? "oklch(0.35 0.14 85)" : "oklch(0.28 0.08 150)" }}>{s}</span>;
                        })}
                      </div>
                    </div>
                    <ArrowLeftRight size={16} color="oklch(0.6 0.04 150)" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "oklch(0.5 0.04 150)", marginBottom: "0.3rem", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>You send</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                        {proposal.youSend.map((s, j) => {
                          const isFaab = s.startsWith("FAAB");
                          const isPick = s.includes("Pick") || s.includes("Rd");
                          return <span key={j} style={{ fontSize: "0.75rem", fontWeight: 600, borderRadius: 4, padding: "2px 8px", background: isFaab ? "oklch(0.93 0.06 250)" : isPick ? "oklch(0.93 0.06 85)" : "oklch(0.93 0.03 150)", color: isFaab ? "oklch(0.32 0.14 250)" : isPick ? "oklch(0.35 0.14 85)" : "oklch(0.28 0.08 150)" }}>{s}</span>;
                        })}
                      </div>
                    </div>
                  </div>

                  {proposal.note && (
                    <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", background: "oklch(0.96 0.01 150)", borderRadius: 6, fontSize: "0.8rem", color: "oklch(0.4 0.04 150)", fontStyle: "italic" }}>
                      "{proposal.note}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trade History */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">Trade History — 2026 Season</div>
          <div>
            <div style={{ padding: "2rem 1.25rem", textAlign: "center", color: "oklch(0.55 0.04 150)" }}>
              <ArrowLeftRight size={28} style={{ margin: "0 auto 0.75rem", opacity: 0.25 }} />
              <p style={{ margin: 0, fontSize: "0.88rem" }}>No completed trades yet for the 2026 season.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
