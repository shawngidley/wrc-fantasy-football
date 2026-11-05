/**
 * WRC Fantasy Football - Playoffs Page
 *
 * Live playoff picture built from the official weekly results:
 *   1. Seeding table: the six seeds, the playoff line, and everyone else
 *   2. Clinch tracker: clinched division / clinched playoff / eliminated
 *   3. Picture by week: pick any finished week, see seed moves since the week before
 *   4. Bracket: Wild Card (Wk 15), Semifinals (Wk 16), Championship (Wk 17)
 * Seeding is by most wins; see lib/playoffPicture.ts for the rules.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { TEAMS } from "@/lib/wrcData";
import { Trophy } from "lucide-react";
import {
  REGULAR_SEASON_WEEKS,
  buildBracket,
  clinchStatuses,
  finalRegularSeasonWeeks,
  seedField,
  seedMovement,
  standingsThroughWeek,
  type BracketGame,
  type BracketSide,
  type ClinchStatus,
  type ResultRow,
} from "@/lib/playoffPicture";

const PLAYOFF_TEAMS = TEAMS.map(t => ({ owner: t.owner, teamName: t.teamName, division: t.division }));

const labelFont = { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const };

const STATUS_BADGE: Record<ClinchStatus, { text: string; bg: string; color: string } | null> = {
  division: { text: "Clinched division", bg: "oklch(0.88 0.1 150)", color: "oklch(0.25 0.09 150)" },
  playoff: { text: "Clinched playoff", bg: "oklch(0.92 0.07 150)", color: "oklch(0.28 0.08 150)" },
  eliminated: { text: "Eliminated", bg: "oklch(0.92 0.04 25)", color: "oklch(0.42 0.14 25)" },
  alive: null,
};

function StatusBadge({ status }: { status: ClinchStatus }) {
  const badge = STATUS_BADGE[status];
  if (!badge) return <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.02 150)" }}>In the hunt</span>;
  return (
    <span style={{ ...labelFont, fontSize: "0.68rem", background: badge.bg, color: badge.color, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>
      {badge.text}
    </span>
  );
}

function Movement({ change, isNew }: { change: number; isNew: boolean }) {
  if (isNew) return <span style={{ ...labelFont, fontSize: "0.7rem", color: "oklch(0.4 0.12 150)" }}>NEW</span>;
  if (change > 0) return <span style={{ fontWeight: 700, fontSize: "0.78rem", color: "oklch(0.4 0.14 150)" }}>▲{change}</span>;
  if (change < 0) return <span style={{ fontWeight: 700, fontSize: "0.78rem", color: "oklch(0.5 0.17 25)" }}>▼{-change}</span>;
  return <span style={{ fontSize: "0.78rem", color: "oklch(0.65 0.01 150)" }}>–</span>;
}

function BracketTeam({ side, isWinner, divider }: { side: BracketSide; isWinner: boolean; divider: boolean }) {
  const known = side.teamName !== null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "0.5rem 0", borderBottom: divider ? "1px solid oklch(0.9 0.005 150)" : "none" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: isWinner ? 800 : 600, color: known ? "oklch(0.22 0.06 150)" : "oklch(0.6 0.02 150)", fontStyle: known ? "normal" : "italic", minWidth: 0 }}>
        {side.seed !== null && <span style={{ color: "oklch(0.5 0.1 85)", marginRight: 5 }}>({side.seed})</span>}
        {side.label}
      </span>
      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: side.score !== null ? "oklch(0.22 0.08 150)" : "oklch(0.75 0.01 150)" }}>
        {side.score !== null ? side.score.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function BracketCard({ game }: { game: BracketGame }) {
  const isFinalGame = game.id === "final";
  const status = game.final ? "Final" : game.top.score !== null || game.bottom.score !== null ? "In progress" : null;
  return (
    <div className="wrc-card" style={{ minWidth: 0, width: "100%" }}>
      {isFinalGame ? (
        <div style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Trophy size={16} color="oklch(0.15 0.02 150)" />
          <span style={{ ...labelFont, fontSize: "0.78rem", color: "oklch(0.15 0.02 150)" }}>{game.title} · Wk {game.week}</span>
        </div>
      ) : (
        <>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ fontSize: "0.72rem" }}>{game.title} · Wk {game.week}</div>
        </>
      )}
      <div className="wrc-card-body" style={{ padding: "0.75rem 1rem" }}>
        <BracketTeam side={game.top} isWinner={game.winnerSeed !== null && game.winnerSeed === game.top.seed} divider />
        <BracketTeam side={game.bottom} isWinner={game.winnerSeed !== null && game.winnerSeed === game.bottom.seed} divider={false} />
        {status && <div style={{ ...labelFont, fontSize: "0.66rem", color: "oklch(0.5 0.03 150)", marginTop: 4 }}>{status}</div>}
      </div>
    </div>
  );
}

function RoundHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ ...labelFont, fontSize: "0.8rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.8)", marginBottom: "0.6rem" }}>{children}</div>;
}

function Bracket({ games }: { games: BracketGame[] }) {
  const by = (id: BracketGame["id"]) => games.find(g => g.id === id);
  const rounds: { heading: string; ids: BracketGame["id"][] }[] = [
    { heading: "Wild Card · Week 15", ids: ["wc1", "wc2"] },
    { heading: "Semifinals · Week 16", ids: ["sf1", "sf2"] },
    { heading: "Championship · Week 17", ids: ["final"] },
  ];
  return (
    <>
      <div className="bracket-desktop">
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          {rounds.map((round, i) => (
            <div key={round.heading} style={{ display: "contents" }}>
              {i > 0 && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.5rem" }}>→</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <RoundHeading>{round.heading}</RoundHeading>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {round.ids.map(id => { const g = by(id); return g ? <BracketCard key={id} game={g} /> : null; })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bracket-mobile">
        {rounds.map((round, i) => (
          <div key={round.heading} style={{ marginBottom: "1.25rem" }}>
            {i > 0 && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "1.5rem", marginBottom: "0.75rem" }}>↓</div>}
            <RoundHeading>{round.heading}</RoundHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {round.ids.map(id => { const g = by(id); return g ? <BracketCard key={id} game={g} /> : null; })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Playoffs() {
  const { franchise } = useAuth();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("weekly_results")
      .select("week, home_owner, away_owner, home_score, away_score, is_final")
      .eq("season", 2026)
      .order("week", { ascending: true });
    if (data) setRows(data as ResultRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("playoffs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_results" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const finalWeeks = useMemo(() => finalRegularSeasonWeeks(rows), [rows]);
  const latestWeek = finalWeeks.length ? finalWeeks[finalWeeks.length - 1] : 0;
  const seasonOver = finalWeeks.length >= REGULAR_SEASON_WEEKS;
  const viewWeek = pickedWeek !== null && pickedWeek <= latestWeek ? pickedWeek : latestWeek;

  const picture = useMemo(() => {
    const lines = standingsThroughWeek(PLAYOFF_TEAMS, rows, viewWeek);
    const field = seedField(lines);
    const status = clinchStatuses(lines, REGULAR_SEASON_WEEKS - viewWeek);
    const before = viewWeek > 1 ? seedField(standingsThroughWeek(PLAYOFF_TEAMS, rows, viewWeek - 1)).seeds : null;
    return { field, status, movement: seedMovement(before, field.seeds), hasBefore: before !== null };
  }, [rows, viewWeek]);

  // The bracket always follows the newest standings, not the week being browsed.
  const bracketGames = useMemo(
    () => buildBracket(seedField(standingsThroughWeek(PLAYOFF_TEAMS, rows, latestWeek)).seeds, rows),
    [rows, latestWeek],
  );

  const myTeam = franchise?.team_name;
  const gamesLeft = REGULAR_SEASON_WEEKS - viewWeek;

  const th = { ...labelFont, fontSize: "0.72rem", padding: "0.5rem 0.5rem", textAlign: "left" as const, color: "white" };
  const td = { padding: "0.55rem 0.5rem", fontSize: "0.85rem", color: "oklch(0.2 0.03 150)", borderBottom: "1px solid oklch(0.92 0.005 150)" };

  const teamRow = (line: { owner: string; teamName: string; wins: number; losses: number; ptsFor: number }, seedLabel: string, tag: string, bye: boolean, key: string) => {
    const status = picture.status.get(line.owner) ?? "alive";
    const move = picture.movement.get(line.owner);
    const mine = myTeam === line.teamName;
    return (
      <tr key={key} style={mine ? { background: "oklch(0.95 0.06 85)" } : undefined}>
        <td style={{ ...td, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "1.05rem", textAlign: "center" }}>{seedLabel}</td>
        <td style={{ ...td, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "oklch(0.22 0.08 150)", lineHeight: 1.15 }}>{line.teamName}</div>
          <div style={{ fontSize: "0.72rem", color: "oklch(0.5 0.02 150)" }}>
            {line.owner}{tag && ` · ${tag}`}{bye && " · Bye"}
          </div>
          <div style={{ marginTop: 3 }}><StatusBadge status={status} /></div>
        </td>
        <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>{line.wins}-{line.losses}</td>
        <td style={{ ...td, color: "oklch(0.4 0.1 85)", fontWeight: 600, whiteSpace: "nowrap" }}>{line.ptsFor.toFixed(1)}</td>
        <td style={{ ...td, textAlign: "center" }}>
          {move && picture.hasBefore ? <Movement change={move.change} isNew={move.previousSeed === null} /> : <span style={{ color: "oklch(0.65 0.01 150)" }}>–</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.5rem" }}>
          <h1>2026 WRC Playoffs</h1>
          <p>6 teams · Weeks 15, 16 &amp; 17</p>
        </div>

        {/* Status banner */}
        <div className="wrc-card" style={{ marginBottom: "1.5rem", background: "oklch(0.22 0.04 150 / 0.85)", border: "1px solid oklch(0.75 0.12 85 / 0.6)" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-body" style={{ padding: "0.875rem 1.25rem", textAlign: "center" }}>
            <div style={{ ...labelFont, fontSize: "0.88rem", color: "oklch(0.82 0.16 85)", marginBottom: "0.35rem" }}>
              {latestWeek === 0 ? "No weeks are final yet" : seasonOver ? "Regular season complete · seeds are set" : `Through Week ${latestWeek} · ${REGULAR_SEASON_WEEKS - latestWeek} regular season ${REGULAR_SEASON_WEEKS - latestWeek === 1 ? "week" : "weeks"} left`}
            </div>
            <div style={{ fontSize: "0.84rem", color: "rgba(255,255,255,0.82)" }}>
              Seeded by most wins: 2 for beating your opponent, 1 for beating the league median. Ties go to points for.
              Three division winners are seeds 1 to 3, the next three best records are seeds 4 to 6, and seeds 1 and 2 get a Week 15 bye.
            </div>
          </div>
        </div>

        {/* Week picker */}
        {latestWeek > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            <span style={{ ...labelFont, fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", marginRight: 4 }}>Picture after</span>
            {finalWeeks.map(week => {
              const on = week === viewWeek;
              return (
                <button
                  key={week}
                  onClick={() => setPickedWeek(week)}
                  aria-pressed={on}
                  style={{
                    ...labelFont, fontSize: "0.78rem", padding: "0.3rem 0.6rem", borderRadius: 7, cursor: "pointer",
                    border: on ? "2px solid oklch(0.55 0.16 85)" : "2px solid rgba(255,255,255,0.2)",
                    background: on ? "oklch(0.22 0.08 150)" : "rgba(255,255,255,0.08)",
                    color: on ? "oklch(0.82 0.16 85)" : "rgba(255,255,255,0.8)",
                  }}
                >
                  Wk {week}
                </button>
              );
            })}
          </div>
        )}

        {/* Seeding table */}
        <div className="wrc-card" style={{ marginBottom: "1.5rem", overflow: "hidden" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            {latestWeek === 0 ? "Playoff Seeds" : seasonOver && viewWeek === latestWeek ? "Playoff Seeds" : `If the season ended after Week ${viewWeek}`}
          </div>
          {latestWeek === 0 ? (
            <div className="wrc-card-body" style={{ padding: "1rem 1.25rem", fontSize: "0.88rem", color: "oklch(0.35 0.04 150)" }}>
              {loading ? "Loading…" : "Seeds appear once the first week of scores is final."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 340, borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 44 }} />
                  <col />
                  <col style={{ width: 58 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 50 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "oklch(0.22 0.08 150)", color: "white" }}>
                    <th style={{ ...th, textAlign: "center" }}>Seed</th>
                    <th style={th}>Team</th>
                    <th style={th}>W-L</th>
                    <th style={th}>FPts</th>
                    <th style={{ ...th, textAlign: "center" }}>Move</th>
                  </tr>
                </thead>
                <tbody>
                  {picture.field.seeds.map(s =>
                    teamRow(s.line, String(s.seed), s.kind === "division" ? `${s.line.division} winner` : "Wild card", s.bye, s.line.owner))}
                  <tr>
                    <td colSpan={5} style={{ ...labelFont, fontSize: "0.68rem", textAlign: "center", padding: "0.3rem", background: "oklch(0.93 0.04 85)", color: "oklch(0.4 0.1 85)", borderTop: "2px solid oklch(0.65 0.14 85)", borderBottom: "2px solid oklch(0.65 0.14 85)" }}>
                      Playoff line
                    </td>
                  </tr>
                  {picture.field.rest.map(line => teamRow(line, "–", `${line.division}`, false, line.owner))}
                </tbody>
              </table>
            </div>
          )}
          {latestWeek > 0 && (
            <div style={{ fontSize: "0.74rem", color: "oklch(0.4 0.03 150)", padding: "0.6rem 0.9rem 0.8rem", lineHeight: 1.5, background: "oklch(0.97 0.005 150)" }}>
              {gamesLeft > 0
                ? `A team shows as clinched or eliminated only when nothing in the ${gamesLeft} remaining ${gamesLeft === 1 ? "week" : "weeks"} (up to 3 wins a week) can change it, with every tie going the wrong way. A clinch can appear a week after the real math allows it.`
                : "The regular season is over, so these are final."}
            </div>
          )}
        </div>

        {/* Bracket */}
        <div style={{ background: "oklch(0.18 0.04 150 / 0.88)", borderRadius: 12, padding: "1rem 1rem 1.1rem", border: "1px solid oklch(0.75 0.12 85 / 0.4)" }}>
          <div style={{ ...labelFont, fontSize: "1rem", color: "oklch(0.82 0.16 85)", marginBottom: "0.9rem" }}>
            {seasonOver ? "Bracket" : "Bracket if the season ended today"}
          </div>
          {bracketGames.length > 0 ? <Bracket games={bracketGames} /> : (
            <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.8)" }}>The bracket appears once the first week of scores is final.</div>
          )}
          <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.72)", marginTop: "0.5rem", lineHeight: 1.5 }}>
            The highest seed is the home team in each game. In Week 16 the top seed plays the lowest remaining seed. A tied playoff game goes to the higher seed.
          </div>
        </div>
      </div>
    </div>
  );
}
