/**
 * WRC Fantasy Football — 2027 Draft Order
 *
 * Unlike the 2026 board (a fixed snake from a locked round-1 order + lottery),
 * the 2027 order is DYNAMIC: it's seeded live by the current standings (worst
 * record picks first, ties broken by fewer points-for) and snaked over 18
 * rounds here on the client. Traded 2027 picks are overlaid on top, so a pick
 * that changed hands shows its new owner in the original team's column.
 *
 * Read-only: no draft is happening for 2027 yet, so there's no clock, no
 * lottery, and no pick entry -- just the order as it stands right now.
 */
import { useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import DraftSubNav from "@/components/DraftSubNav";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { OWNER_TO_TEAM } from "@/lib/scheduleData2026";

const TOTAL_ROUNDS = 18;

// Owner chip colors, copied from the 2026 Draft pick list so the 2027 list
// reads the same. Keyed by owner first name.
const OWNER_COLORS: Record<string, string> = {
  "Greg": "oklch(0.55 0.18 260)", "Shawn": "oklch(0.52 0.18 25)",
  "Bill": "oklch(0.50 0.16 150)", "David R.": "oklch(0.52 0.18 85)",
  "Jason": "oklch(0.50 0.16 310)", "Scott N.": "oklch(0.52 0.16 195)",
  "David S.": "oklch(0.50 0.18 45)", "Jonas": "oklch(0.50 0.18 170)",
  "Jamie": "oklch(0.52 0.16 280)", "Keith": "oklch(0.50 0.16 10)",
  "Scott M.": "oklch(0.52 0.16 230)", "Dan": "oklch(0.50 0.16 130)",
};
// Franchise name -> owner first name, so the chip can show the owner (as the
// 2026 list does) and colour reliably. team_standings' team_id doesn't always
// line up with the draft data's ids, so map by the franchise name we display.
const OWNER_BY_TEAM_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(OWNER_TO_TEAM).map(([owner, franchise]) => [franchise, owner]),
);

export default function DraftOrder2027() {
  const { franchise } = useAuth();
  // Live: standings move during the season, so keep the order fresh.
  const query = trpc.league.draftOrder2027.useQuery(undefined, { refetchInterval: 30_000 });
  const order = query.data?.order ?? [];
  const tradedPicks = query.data?.tradedPicks ?? [];
  const totalTeams = order.length;

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of order) map.set(team.teamId, team.teamName);
    return map;
  }, [order]);

  // overrides[round] -> Map(originalTeamId -> currentOwnerTeamId)
  const overrides = useMemo(() => {
    const map = new Map<number, Map<string, string>>();
    for (const pick of tradedPicks) {
      const roundMap = map.get(pick.round) ?? new Map<string, string>();
      roundMap.set(pick.originalTeamId, pick.currentOwnerTeamId);
      map.set(pick.round, roundMap);
    }
    return map;
  }, [tradedPicks]);

  // The pick list is the default, readable view; Grid toggles the full
  // 18-round snake.
  const [view, setView] = useState<"list" | "grid">("list");
  // Team Picks filter (pick list only): "" = all teams (the default),
  // otherwise a specific franchise name.
  const [teamFilter, setTeamFilter] = useState<string>("");

  const shell = (children: React.ReactNode) => (
    <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <DraftSubNav active="order2027" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "0 0 1rem" }}>
          <h1>2027 Draft Order</h1>
          <p>Set by the current standings — worst record picks first — and updates live as records change. Traded picks are shown in their original team's column.</p>
        </div>
        {children}
      </main>
    </div>
  );

  if (query.isLoading) {
    return shell(
      <div className="wrc-card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", color: "oklch(0.55 0.08 150)" }}>Loading the 2027 draft order…</div>
      </div>,
    );
  }
  if (query.isError || totalTeams === 0) {
    return shell(
      <div className="wrc-card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", color: "oklch(0.5 0.1 25)" }}>
          The 2027 draft order isn't available yet. It appears once the standings are populated.
        </div>
      </div>,
    );
  }

  const gridCols = `52px repeat(${totalTeams}, minmax(78px, 1fr))`;

  // "" means all teams (the default); otherwise the chosen franchise.
  const effectiveTeam = teamFilter;
  const teamOptions = [...order].map(t => t.teamName).sort((a, b) => a.localeCompare(b));

  const controls = (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.7)" }}>
        Team Picks
        <select
          value={effectiveTeam}
          onChange={e => { setTeamFilter(e.target.value); setView("list"); }}
          style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "0.35rem 0.5rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}
        >
          <option value="" style={{ color: "black" }}>All Teams</option>
          {teamOptions.map(name => <option key={name} value={name} style={{ color: "black" }}>{name}</option>)}
        </select>
      </label>
      <button
        onClick={() => setView(view === "grid" ? "list" : "grid")}
        aria-pressed={view === "grid"}
        style={{
          border: "none", cursor: "pointer", borderRadius: 6, padding: "0.4rem 0.95rem",
          fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.05em", textTransform: "uppercase" as const,
          background: view === "grid" ? "oklch(0.72 0.15 85)" : "rgba(255,255,255,0.08)",
          color: view === "grid" ? "oklch(0.15 0.02 150)" : "rgba(255,255,255,0.7)",
        }}
      >
        Grid
      </button>
    </div>
  );

  // Pick List: modeled on the 2026 Draft pick list -- a scrollable dark list
  // with a header per round and, for each pick, the overall number, the
  // round.pick, and the owning team as a colored chip (with the original team
  // noted when the pick was traded). All 18 rounds, snaked on even rounds.
  const pickListView = (
    <div style={{ maxHeight: 720, overflowY: "auto", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, marginBottom: "1.5rem", background: "rgba(8,10,16,0.88)" }}>
      {Array.from({ length: TOTAL_ROUNDS }, (_, r) => r + 1).flatMap(round => {
        const picks = Array.from({ length: totalTeams }, (_, physicalPick) => {
          const pickInRound = physicalPick + 1;
          const overall = (round - 1) * totalTeams + pickInRound;
          // Snake: worst-first order in odd rounds, reversed in even rounds.
          const teamIndex = round % 2 === 1 ? physicalPick : (totalTeams - 1 - physicalPick);
          const team = order[teamIndex];
          const currentOwnerId = overrides.get(round)?.get(team.teamId) ?? team.teamId;
          const isTraded = currentOwnerId !== team.teamId;
          const franchise = teamNameById.get(currentOwnerId) ?? currentOwnerId;
          const owner = OWNER_BY_TEAM_NAME[franchise] ?? franchise;
          const originalOwner = OWNER_BY_TEAM_NAME[team.teamName] ?? team.teamName;
          const chipColor = OWNER_COLORS[owner];
          return { pickInRound, overall, franchise, owner, originalOwner, isTraded, chipColor };
        });
        // Team Picks filter: show only the selected team's picks, and drop the
        // round header for a round they hold no pick in (e.g. traded away).
        const shown = effectiveTeam ? picks.filter(p => p.franchise === effectiveTeam) : picks;
        if (shown.length === 0) return [];
        return [
          <div
            key={`round-header-${round}`}
            style={{
              padding: "0.5rem 0.9rem", background: "oklch(0.18 0.06 150)",
              borderBottom: "2px solid oklch(0.78 0.15 85 / 0.45)",
              borderTop: round > 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.92rem",
              letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.78 0.15 85)",
            }}
          >
            Round {round}
          </div>,
          ...shown.map(p => (
            <div
              key={p.overall}
              style={{
                display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.6rem 0.9rem",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: p.overall % 2 === 0 ? "rgba(255,255,255,0.05)" : "transparent",
              }}
            >
              <span style={{ width: 46, flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>#{p.overall}</span>
              <span style={{ width: 50, flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{round}.{String(p.pickInRound).padStart(2, "0")}</span>
              {/* Compact fixed-width owner chip, colored by owner -- the 2026 look. */}
              <span
                title={p.isTraded ? `Originally ${p.originalOwner}'s pick` : undefined}
                style={{
                  width: 150, flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.86rem", fontWeight: 700,
                  color: p.chipColor ? "white" : "rgba(255,255,255,0.6)",
                  background: p.chipColor ?? "transparent", borderRadius: 4, padding: "3px 7px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {p.owner}{p.isTraded ? ` (${p.originalOwner})` : ""}
              </span>
              {/* Franchise name fills the rest, where the 2026 list shows the drafted player. */}
              <span style={{ flex: 1, minWidth: 0, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.9rem", fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.franchise}
              </span>
            </div>
          )),
        ];
      })}
    </div>
  );

  return shell(
    <>
      {controls}
      {view === "list" ? pickListView : (
      <>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.75)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: "1.5px solid oklch(0.78 0.15 85)", background: "oklch(0.28 0.09 85 / 0.5)", display: "inline-block" }} />
          Traded pick (shows the new owner)
        </span>
        <span>Columns are in first-round order (pick 1.01 on the left).</span>
      </div>

      <div style={{ overflowX: "auto", background: "rgba(8,10,16,0.72)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem" }}>
        <div style={{ minWidth: totalTeams * 84 + 52 }}>
          {/* Header: team names in first-round (worst-first) order */}
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 2, marginBottom: 2 }}>
            <div style={{ background: "rgba(0,0,0,0.5)", padding: "0.4rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.66rem", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>RD</div>
            {order.map((team, i) => (
              <div key={team.teamId} style={{ background: "oklch(0.22 0.08 150)", padding: "0.4rem 0.3rem", borderRadius: "3px 3px 0 0", textAlign: "center", overflow: "hidden" }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.62rem", fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{team.teamName}</div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.56rem", color: "rgba(255,255,255,0.5)" }}>
                  {i + 1}{i === 0 ? " · 1.01" : ""} · {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}
                </div>
              </div>
            ))}
          </div>

          {/* One row per round, snaking on even rounds */}
          {Array.from({ length: TOTAL_ROUNDS }, (_, r) => {
            const round = r + 1;
            return (
              <div key={round} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 2, marginBottom: 2 }}>
                <div style={{ background: "rgba(0,0,0,0.4)", padding: "0.4rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>{round}</div>
                {order.map((team, colIndex) => {
                  // Fixed column per team; the physical pick position within the
                  // row reverses on even rounds (the snake).
                  const physicalPick = round % 2 === 1 ? colIndex : (totalTeams - 1 - colIndex);
                  const pickInRound = physicalPick + 1;
                  const pickLabel = `${round}.${String(pickInRound).padStart(2, "0")}`;
                  const currentOwnerId = overrides.get(round)?.get(team.teamId) ?? team.teamId;
                  const isTraded = currentOwnerId !== team.teamId;
                  const currentOwnerName = teamNameById.get(currentOwnerId) ?? currentOwnerId;
                  return (
                    <div
                      key={team.teamId}
                      title={isTraded ? `${pickLabel} — originally ${team.teamName}, now ${currentOwnerName}` : `${pickLabel} — ${team.teamName}`}
                      style={{
                        background: isTraded ? "oklch(0.28 0.09 85 / 0.5)" : "rgba(255,255,255,0.06)",
                        border: isTraded ? "1.5px solid oklch(0.78 0.15 85 / 0.7)" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 4, padding: "0.3rem 0.2rem", minHeight: 46,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                      }}
                    >
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.6rem", fontWeight: 700, color: isTraded ? "oklch(0.85 0.13 85)" : "rgba(255,255,255,0.45)" }}>{pickLabel}</div>
                      {isTraded && (
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.58rem", fontWeight: 800, color: "white", textAlign: "center", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", padding: "0 2px" }}>
                          {currentOwnerName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
    </>,
  );
}
