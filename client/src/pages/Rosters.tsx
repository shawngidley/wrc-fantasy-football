/**
 * WRC Fantasy Football - Rosters Page
 * Background: Field turf
 * Shows all 12 franchise rosters — data sourced from Supabase `players` table.
 * Falls back to static wrcData only if Supabase is unavailable.
 */
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TEAMS } from "@/lib/wrcData";
import { useSupabaseRosters, type SupabasePlayer } from "@/hooks/useSupabaseRosters";
import { useDraftedRoster } from "@/hooks/useDraftedRoster";
import { Link } from "wouter";
import TeamLogo from "@/components/TeamLogo";
import { trpc } from "@/lib/trpc";

// ── Sort helpers ──────────────────────────────────────────────────────────────
const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DST: 5 };

function sortPlayers(players: SupabasePlayer[]): SupabasePlayer[] {
  return [...players].sort((a, b) => {
    const posDiff = (POS_ORDER[a.position] ?? 99) - (POS_ORDER[b.position] ?? 99);
    if (posDiff !== 0) return posDiff;
    const ra = a.draft_round ?? 999;
    const rb = b.draft_round ?? 999;
    return ra - rb;
  });
}

const POS_COLORS: Record<string, { bg: string; text: string }> = {
  QB:  { bg: "oklch(0.92 0.08 25)",  text: "oklch(0.35 0.15 25)"  },
  RB:  { bg: "oklch(0.92 0.07 150)", text: "oklch(0.3 0.12 150)"  },
  WR:  { bg: "oklch(0.9 0.08 260)",  text: "oklch(0.3 0.12 260)"  },
  TE:  { bg: "oklch(0.92 0.1 85)",   text: "oklch(0.35 0.15 85)"  },
  K:   { bg: "oklch(0.93 0.04 300)", text: "oklch(0.4 0.08 300)"  },
  DST: { bg: "oklch(0.92 0.04 0)",   text: "oklch(0.35 0.08 0)"   },
};

// Division membership from wrcData (source of truth for division assignment)
const TEAM_DIVISION: Record<string, "East" | "Central" | "West"> = {};
for (const t of TEAMS) TEAM_DIVISION[t.id] = t.division;

// team_id → division
const TEAM_ID_DIVISION: Record<string, "East" | "Central" | "West"> = {
  "team-jonas":   "East",
  "team-davidr":  "East",
  "team-jason":   "East",
  "team-jamie":   "East",
  "team-keith":   "Central",
  "team-dan":     "Central",
  "team-bill":    "Central",
  "team-scottn":  "Central",
  "team-shawn":   "West",
  "team-davids":  "West",
  "team-greg":    "West",
  "team-scottm":  "West",
};

const DIVISIONS = ["East", "Central", "West"] as const;

export default function Rosters() {
  const { franchise } = useAuth();
  const [selectedDivision, setSelectedDivision] = useState<"All" | "East" | "Central" | "West">("All");

  // Primary: Supabase players table
  const { rosters, loading: sbLoading, error: sbError } = useSupabaseRosters();

  // Once protections are submitted, a protected player's displayed round should
  // reflect the round they now cost (forfeited_round) rather than the round
  // they were originally drafted in.
  const protectionsQuery = trpc.league.allProtections.useQuery();
  const protectionRoundByPlayerId: Record<string, number> = {};
  for (const p of protectionsQuery.data ?? []) {
    if (p.forfeited_round != null) protectionRoundByPlayerId[p.player_id] = p.forfeited_round;
  }

  // Secondary: if draft has started, live draft picks override the players table
  const { rostersByTeam, hasPicks, loading: draftLoading } = useDraftedRoster();

  const loading = sbLoading || draftLoading;

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>WRC Rosters</h1>
          <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            2026 Season — All 12 Franchises
            {loading && <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.08em" }}>Loading…</span>}
            {!loading && hasPicks && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "oklch(0.93 0.06 85)", color: "oklch(0.35 0.14 85)", borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>
                ⚡ LIVE DRAFT ROSTERS
              </span>
            )}
            {sbError && <span style={{ fontSize: "0.72rem", color: "oklch(0.52 0.22 25)" }}>⚠ {sbError}</span>}
          </p>
        </div>

        {/* Division Filter */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {(["All", "East", "Central", "West"] as const).map(div => (
            <button
              key={div}
              onClick={() => setSelectedDivision(div)}
              style={{
                padding: "0.4rem 1.1rem",
                borderRadius: 20,
                border: "2px solid",
                borderColor: selectedDivision === div ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.25)",
                background: selectedDivision === div ? "oklch(0.78 0.15 85)" : "rgba(0,0,0,0.3)",
                color: selectedDivision === div ? "oklch(0.18 0.05 85)" : "white",
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 700,
                fontSize: "0.78rem",
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition: "all 0.18s ease",
              }}
            >
              {div === "All" ? "All Divisions" : `${div} Division`}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="wrc-card" style={{ padding: "1rem" }}>
                <div className="wrc-skeleton" style={{ width: "60%", height: 16, borderRadius: 4, marginBottom: 8 }} />
                <div className="wrc-skeleton" style={{ width: "40%", height: 12, borderRadius: 4, marginBottom: 16 }} />
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="wrc-skeleton" style={{ width: "100%", height: 28, borderRadius: 4, marginBottom: 4 }} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Roster Cards Grid */}
        {!loading && DIVISIONS.filter(d => selectedDivision === "All" || selectedDivision === d).map(div => {
          const divRosters = rosters.filter(r => TEAM_ID_DIVISION[r.team_id] === div);
          return (
            <div key={div} style={{ marginBottom: "2rem" }}>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 700,
                fontSize: "0.82rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "oklch(0.78 0.15 85)",
                marginBottom: "0.75rem",
                paddingLeft: "0.25rem",
              }}>
                {div} Division
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}>
                {divRosters.map(team => {
                  const isMyTeam = team.team_name === franchise?.team_name;

                  // If draft has started, use live draft picks; else use Supabase players table
                  let displayPlayers: SupabasePlayer[];
                  if (hasPicks) {
                    const liveRoster = rostersByTeam[team.team_name] ?? [];
                    displayPlayers = liveRoster.map(p => ({
                      id: p.id,
                      team_id: team.team_id,
                      name: p.name,
                      position: p.pos,
                      nfl_team: p.nflTeam,
                      acquisition: p.round ? `Rd ${p.round}` : "FA",
                      draft_round: p.round ?? null,
                      bye_week: p.byeWeek ?? 0,
                      status: "Active",
                      season_fpts: 0,
                      fpg: 0,
                    } as SupabasePlayer));
                  } else {
                    displayPlayers = team.players;
                  }

                  const allPlayers = sortPlayers(displayPlayers);

                  return (
                    <div
                      key={team.team_id}
                      className="wrc-card wrc-card-hover wrc-fade-in"
                      style={{ outline: isMyTeam ? "2px solid oklch(0.78 0.15 85)" : "none" }}
                    >
                      <div className="wrc-card-gold-stripe" />

                      {/* Team Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem 0.6rem" }}>
                        <TeamLogo teamName={team.team_name} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
                            fontSize: "0.92rem", letterSpacing: "0.04em",
                            color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis",
                          }}>{team.team_name}</div>
                          <div style={{ fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>
                            {team.owner} · {allPlayers.length} players
                          </div>
                        </div>
                        {isMyTeam && (
                          <span style={{
                            fontSize: "0.6rem", fontFamily: "Barlow Condensed, sans-serif",
                            fontWeight: 700, letterSpacing: "0.06em",
                            background: "oklch(0.78 0.15 85)", color: "oklch(0.18 0.05 85)",
                            borderRadius: 4, padding: "2px 6px",
                          }}>MY TEAM</span>
                        )}
                        <Link
                          href={`/lineup/${team.team_id}`}
                          style={{
                            fontSize: "0.6rem", fontFamily: "Barlow Condensed, sans-serif",
                            fontWeight: 700, letterSpacing: "0.06em",
                            background: "oklch(0.28 0.09 150)", color: "white",
                            borderRadius: 4, padding: "3px 7px",
                            textDecoration: "none", flexShrink: 0,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "oklch(0.38 0.12 150)"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "oklch(0.28 0.09 150)"}
                        >VIEW LINEUP</Link>
                      </div>

                      {/* Player List */}
                      <div style={{ padding: "0 0 0.5rem", borderTop: "1px solid oklch(0.9 0.01 150)" }}>
                        {allPlayers.length === 0 ? (
                          <div style={{ padding: "1.5rem", textAlign: "center", color: "oklch(0.6 0.03 150)", fontSize: "0.8rem" }}>
                            No players yet
                          </div>
                        ) : (
                          allPlayers.map((p, i) => (
                            <PlayerRow key={p.id || i} player={p} alt={i % 2 !== 0} protectedRound={protectionRoundByPlayerId[p.id]} />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerRow({ player, alt, protectedRound }: { player: SupabasePlayer; alt: boolean; protectedRound?: number }) {
  const c = POS_COLORS[player.position] ?? { bg: "oklch(0.93 0.02 150)", text: "oklch(0.4 0.04 150)" };
  const displayRound = protectedRound ?? player.draft_round;
  const isFa = !displayRound;
  const roundLabel = displayRound ? `Rd ${displayRound}` : "FA";
  return (
    <div className="wrc-row-hover" style={{
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      padding: "0.35rem 1rem",
      background: alt ? "oklch(0.975 0.003 150)" : "white",
    }}>
      <span style={{
        background: c.bg, color: c.text,
        borderRadius: 3, padding: "1px 5px",
        fontSize: "0.62rem", fontWeight: 700,
        fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.04em",
        minWidth: 28, textAlign: "center", flexShrink: 0,
      }}>{player.position}</span>
      <a
        href={`/player/${encodeURIComponent(player.name)}`}
        style={{
          flex: 1, fontSize: "0.8rem", fontWeight: 600,
          color: "oklch(0.18 0.05 150)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.38 0.18 260)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.18 0.05 150)")}
      >{player.name}</a>
      <span style={{
        fontSize: "0.68rem", color: "oklch(0.55 0.06 150)",
        fontWeight: 600, fontFamily: "Barlow Condensed, sans-serif",
        letterSpacing: "0.04em", flexShrink: 0,
      }}>{player.nfl_team}</span>
      <span
        title={protectedRound ? "Protected — round shown is the forfeited pick cost, not the original draft round" : undefined}
        style={{
          fontSize: "10.9px", fontFamily: "Barlow Condensed, sans-serif",
          fontWeight: 700, letterSpacing: "0.04em",
          padding: "1px 5px", borderRadius: 3, flexShrink: 0,
          background: protectedRound ? "oklch(0.95 0.06 85)" : isFa ? "oklch(0.93 0.06 250)" : "oklch(0.93 0.03 150)",
          color: protectedRound ? "oklch(0.42 0.15 85)" : isFa ? "oklch(0.32 0.14 250)" : "oklch(0.35 0.08 150)",
          border: protectedRound ? "1px solid oklch(0.78 0.15 85)" : "none",
        }}
      >{roundLabel}</span>
    </div>
  );
}
