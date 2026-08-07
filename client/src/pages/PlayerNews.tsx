/**
 * WRC Fantasy Football — News Page
 *
 * Clean ESPN NFL news feed for all fantasy-relevant players.
 * No player browser, no search filters, no FAAB balance.
 * Just the news list with a My Team toggle.
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerNewsRow, type PlayerNewsItem } from "@/components/PlayerNewsRow";
import { supabase } from "@/lib/supabase";
import { RefreshCw, Newspaper } from "lucide-react";

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

// ── Main Component ────────────────────────────────────────────────────────────
export default function PlayerNews() {
  const { franchise } = useAuth();

  const [items, setItems] = useState<PlayerNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTeamOnly, setMyTeamOnly] = useState(false);
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [myPlayers, setMyPlayers] = useState<{ name: string; pos: string; nflTeam: string }[]>([]);

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
    setLoading(true);
    try {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=200"
      );
      const json = await res.json();
      const allArticles: ESPNArticle[] = json.articles ?? [];

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

        const injuryKeywords = ["injured","injury","questionable","doubtful","out","ir","placed on","ruled out","limited","missed","surgery","knee","hamstring","ankle","shoulder","concussion","rib","back","wrist","hip","illness"];
        const text = (a.headline + " " + (a.description ?? "")).toLowerCase();
        const isInjury = injuryKeywords.some(kw => text.includes(kw));

        found.push({
          playerName,
          pos: myP?.pos ?? "",
          nflTeam: myP?.nflTeam ?? "",
          headline: a.headline,
          description: a.description,
          published: a.published,
          url: a.links?.web?.href,
          athleteId,
          isInjury,
        });
      }

      setItems(
        found.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
      );
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [myPlayers]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

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

  // Position filter — applied after My Team filter
  const POS_COLORS: Record<string, string> = {
    QB: "oklch(0.42 0.18 260)", RB: "oklch(0.38 0.15 150)",
    WR: "oklch(0.42 0.18 220)", TE: "oklch(0.55 0.16 85)",
    K:  "oklch(0.50 0.04 150)", DST: "oklch(0.45 0.18 25)",
  };
  const posFiltered = posFilter === "ALL"
    ? displayed
    : displayed.filter(it => it.pos === posFilter);

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>News</h1>
            <p>ESPN NFL news — fantasy-relevant players</p>
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
              onClick={fetchNews}
              style={{ background: "white", border: "1.5px solid oklch(0.82 0.04 150)", borderRadius: 20, padding: "0.4rem 0.75rem", cursor: "pointer", color: "oklch(0.45 0.06 150)", display: "flex", alignItems: "center", gap: "0.3rem" }}
              title="Refresh news"
            >
              <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
        </div>

        {/* Position filter pills */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map(pos => {
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
            {loading ? "Loading…" : `${posFiltered.length} articles`}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
              <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid oklch(0.88 0.04 150)", borderTopColor: "oklch(0.42 0.15 150)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "oklch(0.55 0.04 150)" }}>Loading ESPN news…</p>
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "oklch(0.55 0.04 150)" }}>
              <Newspaper size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                {myTeamOnly ? "No recent news for your team players." : "No news articles found."}
              </p>
            </div>
          ) : (
            <div>
              {posFiltered.map((item, i) => (
                <PlayerNewsRow key={`${item.playerName}-${item.published}`} item={item} isFirst={i === 0} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
