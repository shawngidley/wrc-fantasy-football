import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ExternalLink } from "lucide-react";

const LINKS = [
  { category: "Official NFL", sites: [
    { name: "NFL.com", url: "https://www.nfl.com", desc: "Official NFL website — scores, news, standings" },
    { name: "NFL Network", url: "https://www.nfl.com/network", desc: "NFL Network live streaming and schedule" },
    { name: "NFL RedZone", url: "https://www.nfl.com/redzone", desc: "RedZone channel information" },
  ]},
  { category: "Fantasy & Stats", sites: [
    { name: "ESPN Fantasy", url: "https://www.espn.com/fantasy/football/", desc: "ESPN fantasy football tools and analysis" },
    { name: "Pro Football Reference", url: "https://www.pro-football-reference.com", desc: "Complete NFL statistics and history" },
    { name: "FantasyPros", url: "https://www.fantasypros.com", desc: "Rankings, projections, and waiver wire advice" },
    { name: "Rotowire", url: "https://www.rotowire.com/football/", desc: "Injury reports and player news" },
    { name: "4for4", url: "https://www.4for4.com", desc: "Advanced fantasy football analytics" },
  ]},
  { category: "News & Analysis", sites: [
    { name: "The Athletic NFL", url: "https://theathletic.com/nfl/", desc: "In-depth NFL reporting and analysis" },
    { name: "PFF", url: "https://www.pff.com", desc: "Pro Football Focus grades and analytics" },
    { name: "Next Gen Stats", url: "https://nextgenstats.nfl.com", desc: "NFL's official advanced tracking stats" },
  ]},
  { category: "Other CVC Sites", sites: [
    { name: "CVC Fantasy Baseball", url: "https://www.cvcfantasybaseball.com", desc: "CVC Fantasy Baseball — sister league" },
    { name: "CVC Fantasy Golf", url: "https://golf.cvcfantasysports.com", desc: "CVC Fantasy Golf — sister league" },
  ]},
];

export default function NFLSites() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}><h1>NFL Sites</h1><p>Useful links for NFL news, stats, and fantasy resources</p></div>
        {LINKS.map(cat => (
          <div key={cat.category} className="wrc-card" style={{ marginBottom: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header">{cat.category}</div>
            <div>
              {cat.sites.map((site, i) => (
                <a key={i} href={site.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.875rem 1.25rem", borderBottom: i < cat.sites.length - 1 ? "1px solid oklch(0.92 0.005 150)" : "none", textDecoration: "none", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.97 0.005 150)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  <ExternalLink size={15} color="oklch(0.28 0.09 150)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.08 150)" }}>{site.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "oklch(0.55 0.04 150)" }}>{site.desc}</div>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)", flexShrink: 0 }}>{site.url.replace("https://", "").replace("www.", "")}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
