/**
 * WRC Fantasy Football — News Page
 *
 * Clean ESPN NFL news feed for all fantasy-relevant players.
 * No player browser, no search filters, no FAAB balance.
 * Just the news list with a My Team toggle.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerNewsRow, type PlayerNewsItem } from "@/components/PlayerNewsRow";
import { supabase } from "@/lib/supabase";
import { RefreshCw, Newspaper } from "lucide-react";
import { fetchTank01News } from "@/hooks/useNFLNews";
import { trpc } from "@/lib/trpc";
import { NFL_PLAYERS_2026 } from "@/lib/nflPlayers2026";
import { filterFantasyPositionNews, filterNewsBySource, inferFantasyProsPlayerName, isEligibleFantasyNewsPosition, type NewsSourceFilter } from "@/lib/newsSourceFilter";
import { getFantasyProsFeedState, retainLastSuccessfulItems } from "@/lib/fantasyProsFeedState";

// ── ESPN types ────────────────────────────────────────────────────────────────
interface ESPNArticle {
  headline: string;
  description?: string;
  published: string;
  links?: { web?: { href?: string } };
  categories?: { type?: string; athleteId?: number; description: string }[];
}

function getAthleteId(cats?: { type?: string; athleteId?: number }[]): number | undefined {
  return (cats ?? []).find(c => c.type === "athlete" && c.athleteId)?.athleteId;
}

function normalizeNewsPlayerName(name: string): string {
  return name.toLowerCase().replace(/\./g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/\s+/g, " ").trim();
}

function findFantasyPlayer(name: string) {
  const normalized = normalizeNewsPlayerName(name);
  return NFL_PLAYERS_2026.find(player => normalizeNewsPlayerName(player.name) === normalized);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PlayerNews() {
  const { franchise } = useAuth();

  const [nonFantasyProsItems, setNonFantasyProsItems] = useState<PlayerNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTeamOnly, setMyTeamOnly] = useState(false);
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<NewsSourceFilter>("FANTASYPROS");
  const [myPlayers, setMyPlayers] = useState<{ name: string; pos: string; nflTeam: string }[]>([]);
  const newsRequestId = useRef(0);
  const lastSuccessfulFantasyProsItems = useRef<PlayerNewsItem[]>([]);
  const fantasyProsNews = trpc.fantasyPros.news.useQuery(
    { limit: 100, feedVersion: 4 },
    {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: 3,
      retryDelay: attempt => Math.min(1_000 * 2 ** attempt, 8_000),
    },
  );

  // Load the logged-in owner's players for "My Team" filter
  useEffect(() => {
    if (!franchise?.id) return;
    supabase
      .from("players")
      .select("name,position,nfl_team")
      .eq("team_id", franchise.id)
      .then(({ data }) => {
        if (data) setMyPlayers(data.map((p: { name: string; position: string; nfl_team: string }) => ({
          name: p.name,
          pos: p.position,
          nflTeam: p.nfl_team,
        })));
      });
  }, [franchise?.id]);

  const fetchNews = useCallback(async () => {
    const requestId = ++newsRequestId.current;
    setLoading(true);
    try {
      // Fetch non-FantasyPros sources in parallel. FantasyPros renders directly from its query below.
      const [espnResult, tank01Result] = await Promise.allSettled([
        fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=200").then(r => r.json()),
        fetchTank01News(),
      ]);
      const allArticles: ESPNArticle[] = espnResult.status === "fulfilled" ? (espnResult.value.articles ?? []) : [];
      const tank01News = tank01Result.status === "fulfilled" ? tank01Result.value : [];

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
          // Allow first-initial + last name match (e.g. ESPN "J. Williams" → "Javonte Williams")
          // but require at least 5 chars to avoid "Williams" matching "C. Williams"
          (p.name.split(" ").slice(-1)[0].length >= 5 &&
           playerName.toLowerCase() === `${p.name[0].toLowerCase()}. ${p.name.split(" ").slice(-1)[0].toLowerCase()}`)
        );
        const fantasyPlayer = myP ?? findFantasyPlayer(playerName);
        if (!fantasyPlayer || !isEligibleFantasyNewsPosition(fantasyPlayer.pos)) continue;

        const injuryKeywords = ["injured","injury","questionable","doubtful","out","ir","placed on","ruled out","limited","missed","surgery","knee","hamstring","ankle","shoulder","concussion","rib","back","wrist","hip","illness"];
        const text = (a.headline + " " + (a.description ?? "")).toLowerCase();
        const isInjury = injuryKeywords.some(kw => text.includes(kw));

        found.push({
          playerName,
          pos: fantasyPlayer.pos,
          nflTeam: fantasyPlayer.nflTeam,
          headline: a.headline,
          description: a.description,
          published: a.published,
          url: a.links?.web?.href,
          athleteId,
          isInjury,
          source: "ESPN",
        });
      }

      // Add Tank01 news items not already seen in ESPN feed
      const injuryKeywords = ["injured","injury","questionable","doubtful","out","ir","placed on","ruled out","limited","missed","surgery","knee","hamstring","ankle","shoulder","concussion","rib","back","wrist","hip","illness"];
      for (const t of tank01News) {
        if (!t.title || seen.has(t.title)) continue;
        const playerName = inferFantasyProsPlayerName(t.title);
        const fantasyPlayer = findFantasyPlayer(playerName);
        if (!fantasyPlayer || !isEligibleFantasyNewsPosition(fantasyPlayer.pos)) continue;
        seen.add(t.title);
        const isInjury = injuryKeywords.some(kw => t.title.toLowerCase().includes(kw));
        found.push({
          playerName,
          pos: fantasyPlayer.pos,
          nflTeam: fantasyPlayer.nflTeam,
          headline: t.title,
          description: undefined,
          published: new Date().toISOString(),
          url: t.link,
          athleteId: t.playerIDs?.[0] ? parseInt(t.playerIDs[0]) : undefined,
          isInjury,
          source: "Tank01",
        });
      }

      if (newsRequestId.current === requestId) {
        setNonFantasyProsItems(found.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()));
      }
    } catch {
      if (newsRequestId.current === requestId) setNonFantasyProsItems([]);
    } finally {
      if (newsRequestId.current === requestId) setLoading(false);
    }
  }, [myPlayers]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const fantasyProsItems = useMemo<PlayerNewsItem[]>(() => {
    const injuryKeywords = ["injured","injury","questionable","doubtful","out","ir","placed on","ruled out","limited","missed","surgery","knee","hamstring","ankle","shoulder","concussion","rib","back","wrist","hip","illness"];
    return (fantasyProsNews.data ?? []).filter(fp => fp.title).map<PlayerNewsItem | null>(fp => {
      const playerName = fp.playerName || inferFantasyProsPlayerName(fp.title);
      const myP = myPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
      const fantasyPlayer = myP ?? findFantasyPlayer(playerName);
      const pos = fp.position || fantasyPlayer?.pos || "";
      if (!isEligibleFantasyNewsPosition(pos)) return null;
      const text = `${fp.title} ${fp.description} ${fp.impact}`.toLowerCase();
      const description = fp.impact || fp.description || undefined;
      return {
        playerName,
        pos,
        nflTeam: fp.team || fantasyPlayer?.nflTeam || "",
        headline: fp.title,
        ...(description ? { description } : {}),
        published: fp.published,
        url: fp.link,
        isInjury: injuryKeywords.some(kw => text.includes(kw)),
        source: "FantasyPros" as const,
      };
    }).filter((item): item is PlayerNewsItem => item !== null);
  }, [fantasyProsNews.data, myPlayers]);

  useEffect(() => {
    if (fantasyProsItems.length > 0) lastSuccessfulFantasyProsItems.current = fantasyProsItems;
  }, [fantasyProsItems]);

  const visibleFantasyProsItems = retainLastSuccessfulItems(fantasyProsItems, lastSuccessfulFantasyProsItems.current);

  const items = useMemo(
    () => [...nonFantasyProsItems, ...visibleFantasyProsItems].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()),
    [nonFantasyProsItems, visibleFantasyProsItems],
  );
  const fantasyProsFeedState = getFantasyProsFeedState({
    itemCount: visibleFantasyProsItems.length,
    isLoading: fantasyProsNews.isLoading,
    isError: fantasyProsNews.isError,
  });
  const isSourceLoading = loading || (sourceFilter === "FANTASYPROS" && fantasyProsFeedState === "loading");
  const isSourceUnavailable = sourceFilter === "FANTASYPROS" && fantasyProsFeedState === "unavailable";

  // My Team filter
  const myPlayerNames = new Set(myPlayers.map(p => p.name.toLowerCase()));
  const displayed = myTeamOnly && franchise
    ? items.filter(it =>
        myPlayerNames.has(it.playerName.toLowerCase()) ||
        myPlayers.some(p => {
          const espnName = it.playerName.toLowerCase();
          const rosterName = p.name.toLowerCase();
          // Exact full-name match only — no last-name fallback to avoid false positives
          // e.g. "Caleb Williams" should NOT match "Javonte Williams"
          return espnName === rosterName;
        })
      )
    : items;

  // Source and position filters are applied after the roster filter.
  const POS_COLORS: Record<string, string> = {
    QB: "oklch(0.42 0.18 260)", RB: "oklch(0.38 0.15 150)",
    WR: "oklch(0.42 0.18 220)", TE: "oklch(0.55 0.16 85)",
    K:  "oklch(0.50 0.04 150)",
  };
  const sourceFiltered = filterFantasyPositionNews(filterNewsBySource(displayed, sourceFilter));
  const posFiltered = posFilter === "ALL"
    ? sourceFiltered
    : sourceFiltered.filter(it => it.pos === posFilter);

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>News</h1>
          <p>NFL news — ESPN, Tank01 & FantasyPros updates</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {franchise && (
              <button
                onClick={() => setMyTeamOnly(v => !v)}
                style={{
                  padding: "0.4rem 1rem", borderRadius: 20,
                  border: myTeamOnly ? "1.5px solid oklch(0.42 0.15 150)" : "1.5px solid oklch(0.82 0.04 150)",
                  background: myTeamOnly ? "oklch(0.42 0.15 150)" : "white",
                  color: myTeamOnly ? "white" : "oklch(0.35 0.06 150)",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s",
                }}
              >
                {myTeamOnly ? "✓ MY TEAM" : "MY TEAM"}
              </button>
            )}
            <button
              onClick={() => { void fantasyProsNews.refetch(); void fetchNews(); }}
              style={{ background: "white", border: "1.5px solid oklch(0.82 0.04 150)", borderRadius: 20, padding: "0.4rem 0.75rem", cursor: "pointer", color: "oklch(0.45 0.06 150)", display: "flex", alignItems: "center", gap: "0.3rem" }}
              title="Refresh news"
            >
              <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
        </div>

        {/* Source filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
          <label htmlFor="news-source" style={{ fontFamily: "Barlow Condensed, sans-serif", color: "white", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            NEWS SOURCE
          </label>
          <select
            id="news-source"
            value={sourceFilter}
            onChange={event => setSourceFilter(event.target.value as NewsSourceFilter)}
            style={{ flex: 1, maxWidth: 240, minHeight: 38, borderRadius: 10, border: "1.5px solid oklch(0.82 0.04 150)", background: "white", color: "oklch(0.28 0.06 150)", padding: "0.35rem 0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.03em" }}
          >
            <option value="FANTASYPROS">FantasyPros</option>
            <option value="TANK01">Tank01</option>
            <option value="ALL">All News</option>
          </select>
        </div>

        {/* Position filter pills */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {["ALL", "QB", "RB", "WR", "TE", "K"].map(pos => {
            const isActive = posFilter === pos;
            const color = pos === "ALL" ? "oklch(0.28 0.09 150)" : POS_COLORS[pos];
            return (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                style={{
                  padding: "0.3rem 0.85rem", borderRadius: 20,
                  border: isActive ? `1.5px solid ${color}` : "1.5px solid oklch(0.82 0.04 150)",
                  background: isActive ? color : "white",
                  color: isActive ? "white" : "oklch(0.35 0.06 150)",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s",
                }}
              >
                {pos}
              </button>
            );
          })}
        </div>

        {/* News feed */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.875rem 1rem 0.6rem" }}>
            <Newspaper size={14} color="oklch(0.55 0.16 85)" />
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 800, color: "oklch(0.18 0.06 150)", flex: 1, letterSpacing: "0.04em" }}>
              NFL PLAYER NEWS
            </span>
            <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>
            {isSourceLoading ? "Loading…" : `${posFiltered.length} articles`}
            </span>
          </div>

          {isSourceLoading ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
              <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid oklch(0.88 0.04 150)", borderTopColor: "oklch(0.42 0.15 150)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "oklch(0.55 0.04 150)" }}>Loading player news…</p>
            </div>
          ) : isSourceUnavailable ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "oklch(0.48 0.04 150)" }}>
              <Newspaper size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.35 }} />
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>FantasyPros news is temporarily unavailable.</p>
              <p style={{ margin: "0.45rem 0 0", fontSize: "0.78rem" }}>Tap refresh to try again. Your last loaded updates will remain visible when available.</p>
            </div>
          ) : posFiltered.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "oklch(0.55 0.04 150)" }}>
              <Newspaper size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                {myTeamOnly ? "No recent news for your team players." : `No ${sourceFilter === "ALL" ? "" : sourceFilter === "FANTASYPROS" ? "FantasyPros " : "Tank01 "}news articles found.`}
              </p>
            </div>
          ) : (
            <div>
              {posFiltered.map((item, i) => (
                <PlayerNewsRow key={`${item.playerName}-${item.published}`} item={item} isFirst={i === 0} />
              ))}
            </div>
          )}
          <div style={{ borderTop: "1px solid oklch(0.93 0.005 150)", padding: "0.55rem 1rem", fontSize: "0.62rem", color: "oklch(0.52 0.04 150)" }}>
            FantasyPros data is used under its personal, non-commercial API license.
          </div>
        </div>

      </div>
    </div>
  );
}
