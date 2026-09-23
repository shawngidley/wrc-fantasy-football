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
import { useMemo } from "react";
import Navigation from "@/components/Navigation";
import DraftSubNav from "@/components/DraftSubNav";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { ArrowRightLeft } from "lucide-react";

const TOTAL_ROUNDS = 18;

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
  const hasTrades = tradedPicks.length > 0;

  return shell(
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

      {/* Traded-pick summary, so the changes read clearly without hunting the grid */}
      {hasTrades && (
        <div className="wrc-card" style={{ marginTop: "1rem", padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "0.9rem", color: "oklch(0.28 0.08 150)" }}>
            <ArrowRightLeft size={16} color="oklch(0.55 0.16 85)" /> Traded 2027 Picks
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {[...tradedPicks].sort((a, b) => a.round - b.round).map((pick, i) => (
              <div key={i} style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", color: "oklch(0.3 0.06 150)" }}>
                <strong>Round {pick.round}</strong>: {teamNameById.get(pick.originalTeamId) ?? pick.originalTeamId} → {teamNameById.get(pick.currentOwnerTeamId) ?? pick.currentOwnerTeamId}
              </div>
            ))}
          </div>
        </div>
      )}
    </>,
  );
}
