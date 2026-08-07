/**
 * WRC Fantasy Football - Standings Page
 * Background: Field turf
 * Layout (top to bottom):
 *   1. Weekly Matchup widget (logged-in owner vs opponent + league median)
 *   2. Division standings tables (compact, mobile-first: W-L, GB, FPts)
 *   3. Injury report for logged-in owner's players
 *   4. Player news for logged-in owner's players
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, AlertTriangle, Newspaper, RefreshCw, ChevronDown } from "lucide-react";
import { PlayerNewsRow, type PlayerNewsItem } from "@/components/PlayerNewsRow";
import { supabase } from "@/lib/supabase";
import { SCHEDULE_2026, OWNER_TO_TEAM, getCurrentWeek } from "@/lib/scheduleData2026";
import { Link } from "wouter";
import { TEAM_NAME_TO_ID } from "@/pages/Lineup";
import TeamLogo from "@/components/TeamLogo";

// ── Types ────────────────────────────────────────────────────────────────────

type TeamRow = {
  rank: number;
  team: string;
  owner: string;
  w: number;
  l: number;
  h2hW: number;
  h2hL: number;
  medW: number;
  medL: number;
  divW: number;
  divL: number;
  pf: number;
  pa: number;
  streak: string;
};

interface ESPNArticle {
  headline: string;
  description?: string;
  published: string;
  links?: { web?: { href?: string } };
  images?: { url: string }[];
  categories?: { description: string; type?: string; athleteId?: number }[];
  type?: string;
}

// Extract ESPN athlete ID from article categories for headshot URL
function getAthleteId(categories?: { type?: string; athleteId?: number }[]): number | undefined {
  return (categories ?? []).find(c => c.type === "athlete" && c.athleteId)?.athleteId;
}

// ── Standings helpers ────────────────────────────────────────────────────────

type DbStanding = {
  team_id: string;
  team_name: string;
  owner: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pts_for: number;
  pts_against: number;
  h2h_wins: number;
  h2h_losses: number;
  median_wins: number;
  median_losses: number;
  div_wins: number;
  div_losses: number;
  streak: string;
};

function buildDivisionsFromDb(rows: DbStanding[]): { name: string; teams: TeamRow[] }[] {
  const divNames = ["East", "Central", "West"] as const;
  return divNames.map(div => {
    const divTeams = rows
      .filter(t => t.division === div)
      .sort((a, b) => (b.wins - a.wins) || (b.pts_for - a.pts_for));
    return {
      name: `${div} Division`,
      teams: divTeams.map((t, i) => ({
        rank: i + 1,
        team: t.team_name,
        owner: t.owner,
        w: t.wins,
        l: t.losses,
        h2hW: t.h2h_wins,
        h2hL: t.h2h_losses,
        medW: t.median_wins,
        medL: t.median_losses,
        divW: t.div_wins,
        divL: t.div_losses,
        pf: t.pts_for,
        pa: t.pts_against,
        streak: t.streak || "—",
      })),
    };
  });
}

function gamesBack(leaderW: number, leaderL: number, teamW: number, teamL: number): string {
  const gb = ((leaderW - teamW) + (teamL - leaderL)) / 2;
  if (gb === 0) return "—";
  return gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1);
}

function StreakBadge({ streak }: { streak: string }) {
  const isWin = streak.startsWith("W");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 700, color: isWin ? "oklch(0.38 0.15 150)" : "oklch(0.52 0.22 25)", fontSize: "0.75rem" }}>
      {isWin ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {streak}
    </span>
  );
}

// ── Matchup Widget ────────────────────────────────────────────────────────────

function MatchupWidget({ ownerKey, standings }: { ownerKey: string; standings: DbStanding[] }) {
  const currentWeek = getCurrentWeek();
  const weekData = SCHEDULE_2026.find(w => w.week === currentWeek);
  if (!weekData) return null;

  const matchup = weekData.matchups.find(m => m[0] === ownerKey || m[1] === ownerKey);
  if (!matchup) return null;

  const myTeam = OWNER_TO_TEAM[ownerKey] ?? ownerKey;
  const oppKey = matchup[0] === ownerKey ? matchup[1] : matchup[0];
  const oppTeam = OWNER_TO_TEAM[oppKey] ?? oppKey;

  // League median from live standings
  const allPts = standings.map(t => t.pts_for);
  const sorted = [...allPts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const myTeamData = standings.find(t => t.team_name === myTeam);
  const oppTeamData = standings.find(t => t.team_name === oppTeam);

  return (
    <Link href={`/live?week=${currentWeek}`} style={{ textDecoration: "none", display: "block" }}>
    <div className="wrc-card" style={{ marginBottom: "1.25rem", cursor: "pointer", transition: "box-shadow 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.13)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.08)")}
    >
      <div className="wrc-card-gold-stripe" />
      <div style={{ padding: "0.875rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.55 0.16 85)" }}>
            Week {currentWeek} Matchup · {weekData.dates}
          </span>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.42 0.15 150)", textTransform: "uppercase" as const }}>
            View Live →
          </span>
        </div>

        {/* H2H Matchup */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ flex: 1, textAlign: "center" as const }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.05rem", fontWeight: 800, color: "oklch(0.18 0.06 150)", letterSpacing: "0.02em" }}>{myTeam}</div>
            <div style={{ fontSize: "0.68rem", color: "oklch(0.5 0.04 150)", marginTop: 2 }}>{myTeamData ? `${myTeamData.wins}-${myTeamData.losses}` : ""}</div>
          </div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.2rem", fontWeight: 900, color: "oklch(0.55 0.16 85)", padding: "0.2rem 0.75rem", background: "oklch(0.97 0.04 85)", borderRadius: 8, border: "1.5px solid oklch(0.85 0.12 85)" }}>VS</div>
          <div style={{ flex: 1, textAlign: "center" as const }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.05rem", fontWeight: 800, color: "oklch(0.18 0.06 150)", letterSpacing: "0.02em" }}>{oppTeam}</div>
            <div style={{ fontSize: "0.68rem", color: "oklch(0.5 0.04 150)", marginTop: 2 }}>{oppTeamData ? `${oppTeamData.wins}-${oppTeamData.losses}` : ""}</div>
          </div>
        </div>

        {/* League Median */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "oklch(0.96 0.02 150)", borderRadius: 8, border: "1px solid oklch(0.88 0.04 150)" }}>
          <span style={{ fontSize: "0.68rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" as const }}>League Median</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.28 0.09 150)" }}>{median.toFixed(1)} pts</span>
          <span style={{ fontSize: "0.65rem", color: "oklch(0.55 0.04 150)" }}>· Beat median = +1W</span>
        </div>
      </div>
    </div>
    </Link>
  );
}

// ── Injury Report ─────────────────────────────────────────────────────────────

interface InjuryItem {
  playerName: string;
  pos: string;
  nflTeam: string;
  headline: string;
  published: string;
  url?: string;
}

// ownerKey (e.g. "Shawn") → Supabase team_id (e.g. "team-shawn")
const OWNER_TO_TEAM_ID: Record<string, string> = {
  "Jonas":    "team-jonas",
  "David R.": "team-davidr",
  "Jason":    "team-jason",
  "Keith":    "team-keith",
  "Dan":      "team-dan",
  "Scott N.": "team-scottn",
  "Bill":     "team-bill",
  "Jamie":    "team-jamie",
  "Scott M.": "team-scottm",
  "David S.": "team-davids",
  "Shawn":    "team-shawn",
  "Greg":     "team-greg",
};

function InjuryReport({ ownerKey }: { ownerKey: string }) {
  const [items, setItems] = useState<PlayerNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTeamOnly, setMyTeamOnly] = useState(true);

  const teamId = OWNER_TO_TEAM_ID[ownerKey] ?? `team-${ownerKey.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const [myPlayers, setMyPlayers] = useState<{ name: string; pos: string; nflTeam: string }[]>([]);
  useEffect(() => {
    supabase.from("players").select("name,position,nfl_team").eq("team_id", teamId).then(({ data }) => {
      if (data) setMyPlayers(data.map((p: { name: string; position: string; nfl_team: string }) => ({ name: p.name, pos: p.position, nflTeam: p.nfl_team })));
    });
  }, [teamId]);

  const fetchInjuries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=100");
      const json = await res.json();
      const articles: (ESPNArticle & { categories?: { type?: string; athleteId?: number; description: string }[] })[] = json.articles ?? [];

      const injuryKeywords = ["injur", "questionable", "doubtful", "out ", "ir ", "placed on", "ruled out", "limited", "missed practice", "did not practice", "dnp", "hamstring", "knee", "ankle", "shoulder", "concussion", "rib", "surgery"];

      // Build injury items for all NFL players (for "All League" view)
      // and filter to myPlayers for "My Team" view
      const found: PlayerNewsItem[] = [];
      const seen = new Set<string>();

      // Process articles that match injury keywords
      for (const a of articles) {
        const text = (a.headline + " " + (a.description ?? "")).toLowerCase();
        if (!injuryKeywords.some(kw => text.includes(kw))) continue;
        const athleteId = getAthleteId(a.categories);
        // Try to match to a known player name from article categories
        const athleteCat = (a.categories ?? []).find(c => c.type === "athlete");
        const playerName = athleteCat?.description ?? "";
        if (!playerName) continue;
        if (seen.has(a.headline)) continue;
        seen.add(a.headline);
        // Find pos/team from myPlayers if available
        const myP = myPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        found.push({
          playerName,
          pos: myP?.pos ?? "",
          nflTeam: myP?.nflTeam ?? "",
          headline: a.headline,
          description: a.description,
          published: a.published,
          url: a.links?.web?.href,
          athleteId,
          isInjury: true,
        });
      }

      setItems(found.slice(0, 30));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [myPlayers]);

  useEffect(() => { fetchInjuries(); }, [fetchInjuries]);

  // Filter to my team if toggle is on
  const myPlayerNames = new Set(myPlayers.map(p => p.name.toLowerCase()));
  const displayed = myTeamOnly
    ? items.filter(it => myPlayerNames.has(it.playerName.toLowerCase()))
    : items;

  return (
    <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
      <div className="wrc-card-gold-stripe" />
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.875rem 1rem 0.6rem" }}>
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", fontWeight: 800, color: "oklch(0.18 0.06 150)", flex: 1 }}>Injuries</span>
        <button
          onClick={() => setMyTeamOnly(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.75rem", borderRadius: 20, border: "1.5px solid oklch(0.82 0.04 150)", background: "white", color: "oklch(0.35 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" }}
        >
          <ChevronDown size={12} />
          {myTeamOnly ? "My Team" : "All League"}
        </button>
        <button onClick={fetchInjuries} style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.06 150)", padding: "0.2rem", borderRadius: 4, display: "flex", alignItems: "center" }} title="Refresh">
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "1rem 1.25rem" }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 44, borderRadius: 8, marginBottom: "0.5rem" }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: "1.25rem 1.25rem 1rem", textAlign: "center" as const, color: "oklch(0.55 0.04 150)", fontSize: "0.82rem" }}>
          <AlertTriangle size={20} style={{ margin: "0 auto 0.4rem", display: "block", opacity: 0.35 }} />
          {myTeamOnly ? "No injury news found for your players" : "No injury news found"}
        </div>
      ) : (
        <div style={{ paddingBottom: "0.25rem" }}>
          {displayed.map((item, i) => (
            <PlayerNewsRow key={i} item={item} isFirst={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Player News ───────────────────────────────────────────────────────────────

function MyTeamNews({ ownerKey }: { ownerKey: string }) {
  const [items, setItems] = useState<PlayerNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTeamOnly, setMyTeamOnly] = useState(true);

  const teamId = OWNER_TO_TEAM_ID[ownerKey] ?? `team-${ownerKey.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const [myPlayers, setMyPlayers] = useState<{ name: string; pos: string; nflTeam: string }[]>([]);
  useEffect(() => {
    supabase.from("players").select("name,position,nfl_team").eq("team_id", teamId).then(({ data }) => {
      if (data) setMyPlayers(data.map((p: { name: string; position: string; nfl_team: string }) => ({ name: p.name, pos: p.position, nflTeam: p.nfl_team })));
    });
  }, [teamId]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=100");
      const json = await res.json();
      const allArticles: ESPNArticle[] = json.articles ?? [];

      // Build news items from all articles that have an athlete category
      const found: PlayerNewsItem[] = [];
      const seen = new Set<string>();
      for (const a of allArticles) {
        if (seen.has(a.headline)) continue;
        const athleteId = getAthleteId(a.categories);
        const athleteCat = (a.categories ?? []).find(c => c.type === "athlete");
        const playerName = athleteCat?.description ?? "";
        if (!playerName) continue;
        seen.add(a.headline);
        const myP = myPlayers.find(p =>
          p.name.toLowerCase() === playerName.toLowerCase() ||
          // Exact full-name match only — no last-name fallback to avoid false positives
          false
        );
        found.push({
          playerName,
          pos: myP?.pos ?? "",
          nflTeam: myP?.nflTeam ?? "",
          headline: a.headline,
          description: a.description,
          published: a.published,
          url: a.links?.web?.href,
          athleteId,
        });
      }

      setItems(found.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()).slice(0, 50));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [myPlayers]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  // Filter to my team if toggle is on
  const myPlayerNames = new Set(myPlayers.map(p => p.name.toLowerCase()));
  const displayed = myTeamOnly
    ? items.filter(it => myPlayerNames.has(it.playerName.toLowerCase()))
    : items;

  return (
    <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
      <div className="wrc-card-gold-stripe" />
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.875rem 1rem 0.6rem" }}>
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1rem", fontWeight: 800, color: "oklch(0.18 0.06 150)", flex: 1 }}>Player News</span>
        <button
          onClick={() => setMyTeamOnly(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.75rem", borderRadius: 20, border: "1.5px solid oklch(0.82 0.04 150)", background: "white", color: "oklch(0.35 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" }}
        >
          <ChevronDown size={12} />
          {myTeamOnly ? "My Team" : "All League"}
        </button>
        <button onClick={fetchNews} style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.06 150)", padding: "0.2rem", borderRadius: 4, display: "flex", alignItems: "center" }} title="Refresh">
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "1rem 1.25rem" }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 52, borderRadius: 8, marginBottom: "0.5rem" }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: "1.25rem 1.25rem 1rem", textAlign: "center" as const, color: "oklch(0.55 0.04 150)", fontSize: "0.82rem" }}>
          <Newspaper size={20} style={{ margin: "0 auto 0.4rem", display: "block", opacity: 0.35 }} />
          {myTeamOnly ? "No recent news found for your players" : "No recent news found"}
        </div>
      ) : (
        <div style={{ paddingBottom: "0.25rem" }}>
          {displayed.map((item, i) => (
            <PlayerNewsRow key={i} item={item} isFirst={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Standings Page ───────────────────────────────────────────────────────

export default function Standings() {
  const { franchise, authLoading } = useAuth();
  const [dbStandings, setDbStandings] = useState<DbStanding[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);

  useEffect(() => {
    async function loadStandings() {
      setStandingsLoading(true);
      const { data } = await supabase.from("team_standings").select("*");
      if (data && data.length > 0) setDbStandings(data as DbStanding[]);
      setStandingsLoading(false);
    }
    loadStandings();
    // Subscribe to realtime updates
    const channel = supabase.channel("standings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_standings" }, () => loadStandings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const DIVISIONS = useMemo(() => {
    if (dbStandings.length === 0) return [];
    return buildDivisionsFromDb(dbStandings);
  }, [dbStandings]);

  // Derive the schedule owner key from franchise owner name
  const ownerKey = franchise?.owner ?? null;

  const tickerMessages = [
    "🏈 2026 WRC FANTASY FOOTBALL — Season kicks off September 9th!",
    "🏆 PLAYOFF PICTURE: Top 6 teams qualify — Division winners + 3 Wild Cards",
    "📅 REGULAR SEASON — 14 weeks across 3 divisions, Sept. 9 – Dec. 15",
  ];

  // Compact table styles (smaller font for mobile)
  const TH_COMPACT: React.CSSProperties = {
    textAlign: "center",
    whiteSpace: "nowrap",
    padding: "0.4rem 0.35rem",
    fontSize: "0.68rem",
    fontFamily: "Barlow Condensed, sans-serif",
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
  const TD_COMPACT: React.CSSProperties = {
    textAlign: "center",
    padding: "0.4rem 0.35rem",
    fontSize: "0.75rem",
  };
  const TH_GROUP: React.CSSProperties = {
    ...TH_COMPACT,
    borderLeft: "2px solid oklch(0.82 0.06 150)",
    borderBottom: "2px solid oklch(0.82 0.06 150)",
  };

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={true} tickerMessages={tickerMessages} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 0.75rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>WRC Fantasy Football 2026</h1>
          <p>Regular Season Standings — 2026 Pre-Season</p>
        </div>

        {/* Weekly Matchup Widget — only when logged in */}
        {!authLoading && ownerKey && (
          <MatchupWidget ownerKey={ownerKey} standings={dbStandings} />
        )}

        {/* Division Standings Tables */}
        {standingsLoading ? (
          <div style={{ padding: "1rem 0" }}>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton-shimmer" style={{ height: 180, borderRadius: 12, marginBottom: "1.25rem" }} />
            ))}
          </div>
        ) : DIVISIONS.map((division) => {
          const leader = division.teams[0];
          return (
            <div key={division.name} className="wrc-card" style={{ marginBottom: "1.25rem" }}>
              <div className="wrc-card-gold-stripe" />
              <div className="wrc-division-header">{division.name}</div>
              <div style={{ overflowX: "auto" }}>
                <table className="wrc-table" style={{ minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 28, padding: "0.4rem 0.25rem", fontSize: "0.65rem" }}></th>
                      <th style={{ textAlign: "left", minWidth: 140, padding: "0.4rem 0.5rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", letterSpacing: "0.06em", fontWeight: 700 }}>Team</th>
                      <th style={TH_COMPACT}>W-L</th>
                      <th style={TH_COMPACT}>GB</th>
                      <th style={{ ...TH_COMPACT, color: "oklch(0.42 0.18 85)" }}>FPts</th>
                      <th style={{ ...TH_GROUP }} colSpan={2}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>Head to Head</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.62rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>W</span><span>L</span></div>
                      </th>
                      <th style={{ ...TH_GROUP }} colSpan={2}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>Median</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.62rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>W</span><span>L</span></div>
                      </th>
                      <th style={{ ...TH_GROUP }} colSpan={2}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>Division</div>
                        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.62rem", fontWeight: 400, color: "oklch(0.45 0.04 150)" }}><span>W</span><span>L</span></div>
                      </th>
                      <th style={{ ...TH_COMPACT, textAlign: "right" }}>PA</th>
                      <th style={TH_COMPACT}>Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {division.teams.map((team, i) => {
                      const isMyTeam = team.team === franchise?.team_name;
                      const gb = gamesBack(leader.w, leader.l, team.w, team.l);
                      return (
                        <tr key={team.team} className="wrc-row-hover" style={{
                          background: isMyTeam
                            ? "oklch(0.93 0.04 150)"
                            : i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)",
                          fontWeight: isMyTeam ? 600 : 400,
                        }}>
                          {/* Rank */}
                          <td style={{ textAlign: "center", padding: "0.35rem 0.25rem", fontSize: "0.7rem", color: "oklch(0.55 0.04 150)", fontWeight: 600 }}>{team.rank}</td>
                          {/* Team name — links to lineup page */}
                          <td style={{ padding: "0.4rem 0.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <TeamLogo teamName={team.team} size={28} />
                              <div>
                                {TEAM_NAME_TO_ID[team.team] ? (
                                  <Link href={`/lineup/${TEAM_NAME_TO_ID[team.team]}`}>
                                    <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "oklch(0.25 0.12 220)", lineHeight: 1.2, cursor: "pointer", textDecoration: "underline", textDecorationColor: "oklch(0.65 0.08 220)" }}>{team.team}</div>
                                  </Link>
                                ) : (
                                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "oklch(0.18 0.05 150)", lineHeight: 1.2 }}>{team.team}</div>
                                )}
                                <div style={{ fontSize: "0.62rem", color: "oklch(0.5 0.04 150)" }}>{team.owner}</div>
                              </div>
                            </div>
                          </td>
                          {/* W-L */}
                          <td style={TD_COMPACT}>
                            <span style={{ fontWeight: 700, color: "oklch(0.28 0.09 150)", fontSize: "0.78rem" }}>{team.w}</span>
                            <span style={{ color: "oklch(0.65 0.03 150)", margin: "0 1px", fontSize: "0.7rem" }}>-</span>
                            <span style={{ color: "oklch(0.45 0.04 150)", fontSize: "0.78rem" }}>{team.l}</span>
                          </td>
                          {/* GB */}
                          <td style={{ ...TD_COMPACT, fontWeight: gb === "—" ? 400 : 600, color: gb === "—" ? "oklch(0.65 0.03 150)" : "oklch(0.35 0.06 150)" }}>{gb}</td>
                          {/* FPts */}
                          <td style={{ ...TD_COMPACT, fontWeight: 700, color: "oklch(0.38 0.16 85)" }}>{team.pf.toFixed(1)}</td>
                          {/* H2H */}
                          <td style={{ ...TD_COMPACT, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.h2hW}</td>
                          <td style={{ ...TD_COMPACT, color: "oklch(0.52 0.22 25)" }}>{team.h2hL}</td>
                          {/* Median */}
                          <td style={{ ...TD_COMPACT, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.medW}</td>
                          <td style={{ ...TD_COMPACT, color: "oklch(0.52 0.22 25)" }}>{team.medL}</td>
                          {/* Division */}
                          <td style={{ ...TD_COMPACT, borderLeft: "2px solid oklch(0.82 0.06 150)", color: "oklch(0.38 0.15 150)", fontWeight: 700 }}>{team.divW}</td>
                          <td style={{ ...TD_COMPACT, color: "oklch(0.52 0.22 25)" }}>{team.divL}</td>
                          {/* PA */}
                          <td style={{ ...TD_COMPACT, borderLeft: "1px solid oklch(0.92 0.005 150)", textAlign: "right", color: "oklch(0.5 0.04 150)" }}>{team.pa.toFixed(1)}</td>
                          {/* Streak */}
                          <td style={TD_COMPACT}><StreakBadge streak={team.streak} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Injury Report + Player News — only when logged in */}
        {!authLoading && ownerKey && (
          <>
            <InjuryReport ownerKey={ownerKey} />
            <MyTeamNews ownerKey={ownerKey} />
          </>
        )}

        {/* Not logged in prompt */}
        {!authLoading && !ownerKey && (
          <div className="wrc-card" style={{ textAlign: "center", padding: "1.5rem", color: "oklch(0.5 0.04 150)", fontSize: "0.82rem" }}>
            Sign in to see your weekly matchup, injury report, and player news.
          </div>
        )}
      </div>
    </div>
  );
}
