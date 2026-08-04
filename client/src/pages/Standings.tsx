/**
 * WRC Fantasy Football - Standings Page
 * Background: Field turf
 * Double Result standings by division with:
 *   - Games Back (from division leader)
 *   - Head-to-Head W / L
 *   - League Median W / L
 *   - Division Record
 *   - PF, PA, Streak
 */
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Megaphone, X, ChevronDown, ChevronUp } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type TeamRow = {
  rank: number;
  team: string;
  owner: string;
  logo?: string; // URL to team logo — uploaded per franchise
  // Combined (H2H + Median) record
  w: number;
  l: number;
  // Head-to-head only
  h2hW: number;
  h2hL: number;
  // League median only
  medW: number;
  medL: number;
  // Division record
  divW: number;
  divL: number;
  pf: number;
  pa: number;
  streak: string;
};

// Build standings from real wrcData
function buildDivisions(): { name: string; teams: TeamRow[] }[] {
  const divNames = ["East", "Central", "West"] as const;
  return divNames.map(div => {
    const divTeams = TEAMS.filter(t => t.division === div)
      .sort((a, b) => b.wins - a.wins || b.ptsFor - a.ptsFor);
    return {
      name: `${div} Division`,
      teams: divTeams.map((t, i) => ({
        rank: i + 1,
        team: t.teamName,
        owner: t.owner,
        logo: undefined,
        w: t.wins,
        l: t.losses,
        h2hW: t.wins,
        h2hL: t.losses,
        medW: 0,
        medL: 0,
        divW: 0,
        divL: 0,
        pf: t.ptsFor,
        pa: t.ptsAgainst,
        streak: "—",
      })),
    };
  });
}

const DIVISIONS: { name: string; teams: TeamRow[] }[] = buildDivisions();

/** Calculate games back from division leader */
function gamesBack(leaderW: number, leaderL: number, teamW: number, teamL: number): string {
  const gb = ((leaderW - teamW) + (teamL - leaderL)) / 2;
  if (gb === 0) return "—";
  return gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1);
}

function StreakBadge({ streak }: { streak: string }) {
  const isWin = streak.startsWith("W");
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      fontWeight: 700,
      color: isWin ? "oklch(0.38 0.15 150)" : "oklch(0.52 0.22 25)",
      fontSize: "0.82rem",
    }}>
      {isWin ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {streak}
    </span>
  );
}

// Column header style
const TH: React.CSSProperties = {
  textAlign: "center",
  whiteSpace: "nowrap",
  padding: "0.55rem 0.5rem",
};

// Cell style
const TD_CENTER: React.CSSProperties = { textAlign: "center", padding: "0.55rem 0.4rem", fontSize: "0.82rem" };

// ── Commissioner Announcement Banner ────────────────────────────────────────
const STORAGE_KEY = "wrc_announcements_dismissed";

function AnnouncementBanner({ isCommissioner }: { isCommissioner: boolean }) {
  type Ann = { id: string; text: string; date: string };
  const [announcements, setAnnouncements] = useState<Ann[]>([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // Load announcements from Supabase on mount
  useEffect(() => {
    supabase.from("announcements").select("id, message, created_at").eq("active", true).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setAnnouncements(data.map((r: { id: string; message: string; created_at: string }) => ({
          id: r.id,
          text: r.message,
          date: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        })));
        setAnnLoading(false);
      });
  }, []);

  const visible = announcements.filter(a => !dismissed.includes(a.id));

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function post() {
    if (!draft.trim()) return;
    const { data, error } = await supabase.from("announcements").insert({ message: draft.trim(), created_by: "commissioner", active: true }).select().single();
    if (error) { toast.error("Failed to post announcement"); return; }
    const newAnn = { id: data.id, text: data.message, date: new Date(data.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    setAnnouncements(prev => [newAnn, ...prev]);
    setDraft("");
    setEditing(false);
    toast.success("Announcement posted to all owners");
  }

  async function deleteAnnouncement(id: string) {
    await supabase.from("announcements").update({ active: false }).eq("id", id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    toast.success("Announcement removed");
  }

  if (annLoading) return null; // Don't flash empty state while loading
  if (visible.length === 0 && !isCommissioner) return null;

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {/* Commissioner compose panel */}
      {isCommissioner && (
        <div style={{ background: "oklch(0.18 0.06 85)", border: "1.5px solid oklch(0.55 0.16 85)", borderRadius: 10, padding: "0.875rem 1.25rem", marginBottom: visible.length > 0 ? "0.75rem" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: editing ? "0.75rem" : 0 }}>
            <Megaphone size={14} color="oklch(0.75 0.16 85)" />
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.75 0.16 85)", textTransform: "uppercase" as const, flex: 1 }}>Commissioner Broadcast</span>
            <button
              onClick={() => setEditing(e => !e)}
              style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.75rem", borderRadius: 6, border: "1px solid oklch(0.55 0.16 85)", background: "transparent", color: "oklch(0.75 0.16 85)", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700 }}
            >
              {editing ? <><ChevronUp size={11} /> Cancel</> : <><ChevronDown size={11} /> Post Message</>}
            </button>
          </div>
          {editing && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === "Enter" && post()}
                placeholder="Type your announcement for all 12 owners…"
                autoFocus
                style={{ flex: 1, minWidth: 200, padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid oklch(0.45 0.12 85)", background: "oklch(0.12 0.04 85)", color: "oklch(0.92 0.02 85)", fontSize: "0.875rem", outline: "none" }}
              />
              <button
                onClick={post}
                style={{ padding: "0.5rem 1.25rem", borderRadius: 6, border: "none", background: "oklch(0.55 0.16 85)", color: "oklch(0.12 0.04 85)", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700 }}
              >Post</button>
            </div>
          )}
        </div>
      )}

      {/* Visible announcements */}
      {visible.map(a => (
        <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: "oklch(0.96 0.04 85)", border: "1.5px solid oklch(0.82 0.12 85)", borderRadius: 10, padding: "0.875rem 1.25rem", marginBottom: "0.5rem" }}>
          <Megaphone size={16} color="oklch(0.55 0.16 85)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.22 0.06 85)", lineHeight: 1.4 }}>{a.text}</div>
            <div style={{ fontSize: "0.68rem", color: "oklch(0.55 0.08 85)", marginTop: "0.2rem" }}>Commissioner · {a.date}</div>
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
            {isCommissioner && (
              <button onClick={() => deleteAnnouncement(a.id)} style={{ padding: "0.25rem 0.5rem", borderRadius: 5, border: "1px solid oklch(0.72 0.12 85)", background: "transparent", color: "oklch(0.52 0.22 25)", cursor: "pointer", fontSize: "0.68rem" }}>Delete</button>
            )}
            <button onClick={() => dismiss(a.id)} style={{ display: "flex", alignItems: "center", padding: "0.25rem", borderRadius: 5, border: "none", background: "transparent", color: "oklch(0.6 0.08 85)", cursor: "pointer" }}><X size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Standings() {
  const { franchise } = useAuth();

  const tickerMessages = [
    "⚔️ CHALLENGE GAME — Week 14: Team Gidley vs. Team Pattie",
    "🏆 PLAYOFF PICTURE: Top 6 teams qualify — Division winners + 3 Wild Cards",
    "📅 REGULAR SEASON FINAL — Through Week 14",
  ];

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={true} tickerMessages={tickerMessages} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>WRC Fantasy Football 2026</h1>
          <p>Regular Season Standings — Through Week 14</p>
        </div>

        {/* Commissioner Announcement Banner */}
        <AnnouncementBanner isCommissioner={franchise?.is_commissioner === true} />

        {/* Division Tables */}
        {DIVISIONS.map((division) => {
          const leader = division.teams[0];
          return (
            <div key={division.name} className="wrc-card" style={{ marginBottom: "1.5rem" }}>
              <div className="wrc-card-gold-stripe" />
              <div className="wrc-division-header">{division.name}</div>
              <div style={{ overflowX: "auto" }}>
                <table className="wrc-table" style={{ minWidth: 780 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 48, padding: "0.55rem 0.4rem" }}></th>
                      <th style={{ textAlign: "left", minWidth: 160, padding: "0.55rem 0.75rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", letterSpacing: "0.06em" }}>Team</th>
                      <th style={TH}>W-L</th>
                      <th style={TH}>GB</th>
                      <th style={{ ...TH, borderLeft: "2px solid oklch(0.82 0.06 150)", borderBottom: "2px solid oklch(0.82 0.06 150)" }} colSpan={2}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>Head to Head</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.68rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>Win</span><span>Loss</span></div>
                      </th>
                      <th style={{ ...TH, borderLeft: "2px solid oklch(0.82 0.06 150)", borderBottom: "2px solid oklch(0.82 0.06 150)" }} colSpan={2}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>League Median</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.68rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>Win</span><span>Loss</span></div>
                      </th>
                      <th style={{ ...TH, borderLeft: "2px solid oklch(0.82 0.06 150)", borderBottom: "2px solid oklch(0.82 0.06 150)" }} colSpan={2}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>Division</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.68rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>Win</span><span>Loss</span></div>
                      </th>
                      <th style={{ ...TH, textAlign: "right" }}>PF</th>
                      <th style={{ ...TH, textAlign: "right" }}>PA</th>
                      <th style={TH}>Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {division.teams.map((team, i) => {
                      const isMyTeam = team.team === franchise?.team_name;
                      const pct = (team.w / (team.w + team.l)).toFixed(3).replace(/^0/, "");
                      const gb = gamesBack(leader.w, leader.l, team.w, team.l);
                      return (
                        <tr key={team.team} className="wrc-row-hover" style={{
                          background: isMyTeam
                            ? "oklch(0.93 0.04 150)"
                            : i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)",
                          fontWeight: isMyTeam ? 600 : 400,
                        }}>
                          <td style={{ textAlign: "center", padding: "0.3rem 0.4rem" }}>
                            {team.logo ? (
                              <img
                                src={team.logo}
                                alt={team.team}
                                style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, display: "block", margin: "0 auto" }}
                              />
                            ) : (
                              <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 4,
                                background: "oklch(0.92 0.02 150)",
                                border: "1.5px dashed oklch(0.75 0.06 150)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto",
                                fontSize: "0.6rem",
                                color: "oklch(0.6 0.04 150)",
                                fontFamily: "Barlow Condensed, sans-serif",
                                letterSpacing: "0.04em",
                                fontWeight: 600,
                              }}>LOGO</div>
                            )}
                          </td>
                          <td style={{ padding: "0.55rem 0.75rem" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.18 0.05 150)" }}>{team.team}</div>
                            <div style={{ fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>{team.owner}</div>
                          </td>
                          {/* Combined W-L */}
                          <td style={TD_CENTER}>
                            <span style={{ fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{team.w}</span>
                            <span style={{ color: "oklch(0.65 0.03 150)", margin: "0 2px" }}>-</span>
                            <span style={{ color: "oklch(0.45 0.04 150)" }}>{team.l}</span>
                          </td>
                          {/* GB */}
                          <td style={{ ...TD_CENTER, fontWeight: gb === "—" ? 400 : 600, color: gb === "—" ? "oklch(0.65 0.03 150)" : "oklch(0.35 0.06 150)" }}>{gb}</td>
                          {/* H2H */}
                          <td style={{ ...TD_CENTER, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.h2hW}</td>
                          <td style={{ ...TD_CENTER, color: "oklch(0.52 0.22 25)" }}>{team.h2hL}</td>
                          {/* Median */}
                          <td style={{ ...TD_CENTER, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.medW}</td>
                          <td style={{ ...TD_CENTER, color: "oklch(0.52 0.22 25)" }}>{team.medL}</td>
                          {/* Division */}
                          <td style={{ ...TD_CENTER, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.divW}</td>
                          <td style={{ ...TD_CENTER, color: "oklch(0.52 0.22 25)" }}>{team.divL}</td>
                          {/* PF / PA */}
                          <td style={{ ...TD_CENTER, borderLeft: "1px solid oklch(0.92 0.005 150)", textAlign: "right", fontWeight: 600, color: "oklch(0.22 0.06 150)" }}>{team.pf.toFixed(1)}</td>
                          <td style={{ ...TD_CENTER, textAlign: "right", color: "oklch(0.5 0.04 150)" }}>{team.pa.toFixed(1)}</td>
                          {/* Streak */}
                          <td style={TD_CENTER}><StreakBadge streak={team.streak} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Double Result Explanation */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>Double Result System</div>
                <p style={{ fontSize: "0.82rem", color: "oklch(0.4 0.04 150)", margin: 0, lineHeight: 1.5 }}>
                  Each week produces 3 total results per team. The head-to-head matchup is worth 2 results — a win counts as 2W, a loss counts as 2L. The league median is worth 1 result — scoring above the median earns 1W, below earns 1L. Maximum possible: 3W (H2H win + above median) or 3L (H2H loss + below median) per week.
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>Playoff Seeding</div>
                <p style={{ fontSize: "0.82rem", color: "oklch(0.4 0.04 150)", margin: 0, lineHeight: 1.5 }}>
                  6 teams qualify: 3 Division Winners + 3 Wild Cards. Top 2 division winners receive a bye in Wild Card Round. Playoffs run Weeks 15–17.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
