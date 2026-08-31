/**
 * WRC Fantasy Football - Draft Recap Page
 * Shows each team's full draft board from Supabase draft_picks,
 * with ADP value grades (reach/value/steal) and best/worst pick analysis.
 * Falls back to a "Draft not yet complete" state when no picks exist.
 */
import { useState, useEffect, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026 } from "@shared/draftPlayerUniverse";
import { normalizePlayerName } from "@shared/playerNameMatch";
import { TEAMS } from "@/lib/wrcData";
import { TEAM_ID_TO_NAME } from "@/pages/Lineup";
import { Trophy, TrendingUp, TrendingDown, Star, ChevronDown, ChevronUp, Award, Lock } from "lucide-react";

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

interface PickWithGrade extends DbDraftPick {
  adp: number | null;
  adpDiff: number | null; // positive = steal (picked later than ADP), negative = reach
  grade: "steal" | "value" | "slight-reach" | "reach" | "unknown";
  isProtection?: boolean;
}

const POS_COLORS: Record<string, { bg: string; text: string }> = {
  QB:  { bg: "oklch(0.93 0.08 25)",  text: "oklch(0.35 0.18 25)"  },
  RB:  { bg: "oklch(0.93 0.08 150)", text: "oklch(0.3 0.15 150)"  },
  WR:  { bg: "oklch(0.93 0.08 260)", text: "oklch(0.35 0.18 260)" },
  TE:  { bg: "oklch(0.93 0.08 85)",  text: "oklch(0.35 0.14 85)"  },
  K:   { bg: "oklch(0.93 0.02 150)", text: "oklch(0.45 0.04 150)" },
  DST: { bg: "oklch(0.93 0.06 300)", text: "oklch(0.4 0.14 300)"  },
};

const GRADE_CONFIG = {
  steal:        { label: "STEAL",       color: "oklch(0.38 0.18 150)", bg: "oklch(0.92 0.1 150)",  icon: "🔥" },
  value:        { label: "VALUE",       color: "oklch(0.38 0.14 150)", bg: "oklch(0.94 0.06 150)",  icon: "✓"  },
  "slight-reach": { label: "SLIGHT REACH", color: "oklch(0.5 0.14 60)",  bg: "oklch(0.95 0.06 85)",  icon: "~"  },
  reach:        { label: "REACH",       color: "oklch(0.5 0.2 25)",   bg: "oklch(0.95 0.06 25)",   icon: "⚠"  },
  unknown:      { label: "—",           color: "oklch(0.6 0.02 150)", bg: "oklch(0.95 0.01 150)",  icon: "?"  },
};

function gradePickValue(overall: number, adp: number | null): PickWithGrade["grade"] {
  if (adp === null) return "unknown";
  const diff = overall - adp; // positive = picked later than ADP = steal
  if (diff >= 8)  return "steal";
  if (diff >= 0)  return "value";
  if (diff >= -5) return "slight-reach";
  return "reach";
}

function letterGrade(picks: PickWithGrade[]): string {
  if (picks.length === 0) return "—";
  const scored = picks.filter(p => p.adpDiff !== null);
  if (scored.length === 0) return "—";
  const avg = scored.reduce((s, p) => s + (p.adpDiff ?? 0), 0) / scored.length;
  if (avg >= 6)  return "A+";
  if (avg >= 3)  return "A";
  if (avg >= 1)  return "B+";
  if (avg >= -1) return "B";
  if (avg >= -3) return "C+";
  if (avg >= -6) return "C";
  return "D";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "oklch(0.38 0.18 150)";
  if (grade.startsWith("B")) return "oklch(0.42 0.14 150)";
  if (grade.startsWith("C")) return "oklch(0.5 0.14 60)";
  return "oklch(0.5 0.2 25)";
}

// ── Team Draft Card ───────────────────────────────────────────────────────────
function TeamDraftCard({ teamName, owner, picks }: { teamName: string; owner: string; picks: PickWithGrade[] }) {
  const [expanded, setExpanded] = useState(false);
  const grade = letterGrade(picks);

  const bestPick = picks.filter(p => p.adpDiff !== null).sort((a, b) => (b.adpDiff ?? 0) - (a.adpDiff ?? 0))[0];
  const worstPick = picks.filter(p => p.adpDiff !== null).sort((a, b) => (a.adpDiff ?? 0) - (b.adpDiff ?? 0))[0];

  const posCounts = picks.reduce((acc, p) => { acc[p.player_pos] = (acc[p.player_pos] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="wrc-card" style={{ marginBottom: "1rem", overflow: "hidden" }}>
      <div className="wrc-card-gold-stripe" />
      {/* Card Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", cursor: "pointer", userSelect: "none" }}
      >
        {/* Grade badge */}
        <div style={{
          width: 52, height: 52, borderRadius: 10, background: "oklch(0.22 0.08 150)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.4rem", fontWeight: 900, color: gradeColor(grade) }}>{grade}</span>
        </div>

        {/* Team info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.04em", color: "oklch(0.18 0.06 150)", lineHeight: 1.2 }}>{teamName}</div>
          <div style={{ fontSize: "0.8rem", color: "oklch(0.5 0.04 150)" }}>{owner} · {picks.length} picks</div>
          {/* Position breakdown */}
          <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
            {Object.entries(posCounts).sort((a, b) => b[1] - a[1]).map(([pos, count]) => {
              const c = POS_COLORS[pos] ?? { bg: "oklch(0.93 0.02 150)", text: "oklch(0.45 0.04 150)" };
              return (
                <span key={pos} style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, background: c.bg, color: c.text, borderRadius: 4, padding: "1px 5px", letterSpacing: "0.04em" }}>
                  {pos} ×{count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Best/Worst */}
        <div style={{ display: "flex", gap: "1.5rem", flexShrink: 0 }}>
          {bestPick && (
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "oklch(0.38 0.18 150)", fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "0.2rem" }}>
                <TrendingUp size={12} /> BEST VALUE
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "oklch(0.22 0.08 150)" }}>{bestPick.player_name}</div>
              <div style={{ fontSize: "0.7rem", color: "oklch(0.5 0.04 150)" }}>+{bestPick.adpDiff?.toFixed(1)} vs ADP</div>
            </div>
          )}
          {worstPick && worstPick !== bestPick && (
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "oklch(0.5 0.2 25)", fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "0.2rem" }}>
                <TrendingDown size={12} /> BIGGEST REACH
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "oklch(0.22 0.08 150)" }}>{worstPick.player_name}</div>
              <div style={{ fontSize: "0.7rem", color: "oklch(0.5 0.04 150)" }}>{worstPick.adpDiff?.toFixed(1)} vs ADP</div>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <div style={{ color: "oklch(0.55 0.04 150)", flexShrink: 0 }}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded pick list */}
      {expanded && (
        <div style={{ borderTop: "1px solid oklch(0.9 0.01 150)", overflowX: "auto" }}>
          <table className="wrc-table" style={{ minWidth: 500 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Pick / Protected</th>
                <th>Player</th>
                <th style={{ width: 60 }}>Pos</th>
                <th style={{ width: 60 }}>NFL</th>
                <th style={{ width: 70 }}>ADP</th>
                <th style={{ width: 80 }}>Diff</th>
                <th style={{ width: 110 }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {picks.map(p => {
                const gc = GRADE_CONFIG[p.grade];
                const pc = POS_COLORS[p.player_pos] ?? { bg: "oklch(0.93 0.02 150)", text: "oklch(0.45 0.04 150)" };
                return (
                  <tr key={p.id} className="wrc-row-hover" style={p.isProtection ? { background: "oklch(0.97 0.02 85 / 0.5)" } : undefined}>
                    <td style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.45 0.06 150)", fontSize: "0.85rem" }}>
                      {p.isProtection ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "oklch(0.55 0.14 85)" }}>
                          <Lock size={11} /> Rd {p.round}
                        </span>
                      ) : (
                        `R${p.round}.${p.pick}`
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.player_name}</td>
                    <td>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, background: pc.bg, color: pc.text, borderRadius: 4, padding: "1px 5px" }}>
                        {p.player_pos}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "oklch(0.5 0.04 150)" }}>{p.player_nfl_team}</td>
                    <td style={{ fontSize: "0.82rem", color: "oklch(0.5 0.04 150)" }}>{p.adp?.toFixed(1) ?? "—"}</td>
                    <td style={{ fontSize: "0.82rem", fontWeight: 600, color: p.adpDiff == null ? "oklch(0.6 0.02 150)" : p.adpDiff >= 0 ? "oklch(0.38 0.18 150)" : "oklch(0.5 0.2 25)" }}>
                      {p.adpDiff == null ? "—" : p.adpDiff >= 0 ? `+${p.adpDiff.toFixed(1)}` : p.adpDiff.toFixed(1)}
                    </td>
                    <td>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, background: gc.bg, color: gc.color, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.04em" }}>
                        {gc.icon} {gc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DraftRecap() {
  const { franchise } = useAuth();
  const [rawPicks, setRawPicks] = useState<DbDraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"grade" | "team">("grade");
  const protectionsQuery = trpc.league.allProtections.useQuery();

  useEffect(() => {
    supabase
      .from("draft_picks")
      .select("*")
      .order("overall", { ascending: true })
      .then(({ data }) => {
        setRawPicks((data as DbDraftPick[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Enrich picks with ADP data
  const enrichedPicks: PickWithGrade[] = useMemo(() =>
    rawPicks.map(p => {
      const poolPlayer = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(
        pl => normalizePlayerName(pl.name) === normalizePlayerName(p.player_name)
      );
      const adp = poolPlayer && poolPlayer.adp < 9999 ? poolPlayer.adp : null;
      const adpDiff = adp !== null ? p.overall - adp : null;
      return { ...p, adp, adpDiff, grade: gradePickValue(p.overall, adp) };
    }),
    [rawPicks]
  );

  // Enrich protections the same way as picks, so keeping a great player for
  // a late-round cost grades as a "steal" exactly like drafting one would --
  // a protection's forfeited_round is its "cost", the round the team gave
  // up to keep that player instead of drafting fresh there. Since ADP is
  // expressed as an overall pick number, the round gets converted to its
  // midpoint overall-pick equivalent (12-team league) for a fair comparison.
  const enrichedProtections: PickWithGrade[] = useMemo(() => {
    const rows = protectionsQuery.data ?? [];
    return rows.map((row, i) => {
      const playerInfo = Array.isArray(row.players) ? row.players[0] : row.players;
      const teamName = TEAM_ID_TO_NAME[row.team_id] ?? row.team_id;
      const team = TEAMS.find(t => t.teamName === teamName);
      const overallEquivalent = (row.forfeited_round - 1) * 12 + 6.5;
      const poolPlayer = playerInfo
        ? CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(pl => normalizePlayerName(pl.name) === normalizePlayerName(playerInfo.name))
        : undefined;
      const adp = poolPlayer && poolPlayer.adp < 9999 ? poolPlayer.adp : null;
      const adpDiff = adp !== null ? overallEquivalent - adp : null;
      return {
        id: -1000 - i, // synthetic id, guaranteed not to collide with real draft_picks ids
        round: row.forfeited_round,
        pick: 0,
        overall: overallEquivalent,
        team_name: teamName,
        owner: team?.owner ?? "",
        player_name: playerInfo?.name ?? "Unknown",
        player_pos: playerInfo?.position ?? "",
        player_nfl_team: playerInfo?.nfl_team ?? "",
        picked_at: "",
        adp,
        adpDiff,
        grade: gradePickValue(overallEquivalent, adp),
        isProtection: true,
      };
    });
  }, [protectionsQuery.data]);

  // Group by team -- protections and picks merged together so each team's
  // grade reflects their true full roster, not just their live draft picks
  const byTeam = useMemo(() => {
    const map: Record<string, PickWithGrade[]> = {};
    for (const entry of [...enrichedProtections, ...enrichedPicks]) {
      if (!map[entry.team_name]) map[entry.team_name] = [];
      map[entry.team_name].push(entry);
    }
    for (const teamName of Object.keys(map)) {
      map[teamName].sort((a, b) => a.round - b.round || (a.isProtection ? -1 : 1) - (b.isProtection ? -1 : 1) || a.pick - b.pick);
    }
    return map;
  }, [enrichedPicks, enrichedProtections]);

  // League-wide stats (picks + protections combined)
  const allEntries = useMemo(() => [...enrichedProtections, ...enrichedPicks], [enrichedProtections, enrichedPicks]);
  const totalPicks = allEntries.length;
  const steals = allEntries.filter(p => p.grade === "steal").length;
  const reaches = allEntries.filter(p => p.grade === "reach").length;
  const avgAdpDiff = allEntries.filter(p => p.adpDiff !== null).reduce((s, p) => s + (p.adpDiff ?? 0), 0) / (allEntries.filter(p => p.adpDiff !== null).length || 1);

  // Sort teams
  const sortedTeams = useMemo(() => {
    const teams = TEAMS.map(t => ({ teamName: t.teamName, owner: t.owner, picks: byTeam[t.teamName] ?? [] }));
    if (sortBy === "grade") {
      return teams.sort((a, b) => {
        const gradeA = letterGrade(a.picks);
        const gradeB = letterGrade(b.picks);
        return gradeA.localeCompare(gradeB);
      });
    }
    return teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [byTeam, sortBy]);

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Draft Recap</h1>
          <p>2026 WRC Fantasy Football Draft — ADP Value Analysis</p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
          </div>
        ) : totalPicks === 0 ? (
          /* Pre-draft state */
          <div className="wrc-card" style={{ textAlign: "center", padding: "3.5rem 2rem" }}>
            <div className="wrc-card-gold-stripe" />
            <Trophy size={48} color="oklch(0.78 0.15 85)" style={{ marginBottom: "1rem" }} />
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.4rem", letterSpacing: "0.04em", color: "oklch(0.22 0.08 150)", marginBottom: "0.5rem" }}>
              Draft Recap Not Yet Available
            </div>
            <div style={{ fontSize: "0.9rem", color: "oklch(0.5 0.04 150)", maxWidth: 400, margin: "0 auto" }}>
              The draft recap will appear here once picks have been made on the Draft Board. Check back after your draft is complete.
            </div>
          </div>
        ) : (
          <>
            {/* League Summary Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Total Picks", value: totalPicks, icon: <Award size={18} color="oklch(0.78 0.15 85)" /> },
                { label: "Steals", value: steals, icon: <TrendingUp size={18} color="oklch(0.38 0.18 150)" /> },
                { label: "Reaches", value: reaches, icon: <TrendingDown size={18} color="oklch(0.5 0.2 25)" /> },
                { label: "Avg ADP Diff", value: avgAdpDiff >= 0 ? `+${avgAdpDiff.toFixed(1)}` : avgAdpDiff.toFixed(1), icon: <Star size={18} color="oklch(0.55 0.18 260)" /> },
              ].map(stat => (
                <div key={stat.label} className="wrc-card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div className="wrc-card-gold-stripe" />
                  {stat.icon}
                  <div>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.4rem", fontWeight: 900, color: "oklch(0.22 0.08 150)", lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sort controls */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em" }}>SORT BY:</span>
              {(["grade", "team"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  padding: "0.3rem 0.8rem", borderRadius: 20, border: "1.5px solid",
                  borderColor: sortBy === s ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.25)",
                  background: sortBy === s ? "oklch(0.78 0.15 85)" : "rgba(0,0,0,0.3)",
                  color: sortBy === s ? "oklch(0.18 0.05 85)" : "white",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700,
                  letterSpacing: "0.06em", cursor: "pointer", textTransform: "uppercase",
                }}>{s === "grade" ? "Draft Grade" : "Team Name"}</button>
              ))}
            </div>

            {/* Team Cards */}
            {sortedTeams.map(({ teamName, owner, picks }) => (
              <TeamDraftCard key={teamName} teamName={teamName} owner={owner} picks={picks} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
