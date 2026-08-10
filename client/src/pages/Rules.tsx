import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

const sections = [
  {
    title: "League Format",
    content: "12 teams in 3 divisions of 4 (East, Central, West). 14-week regular season, 6-team playoffs (Weeks 15–17). Top 2 seeds receive a first-round bye in the Wild Card round.",
  },
  {
    title: "Roster & Lineup",
    content: "18-player rosters. 10 starters: QB, 2 RB, 2 WR, TE, Super Flex (QB/RB/WR/TE), Flex (RB/WR/TE), K, DST. Players lock at their individual game kickoff time.",
  },
  {
    title: "Double Result System",
    content: "Each team earns two results per week. Head-to-head result vs. your opponent (win or loss). League median result: 1W if your score beats the league median, 1L if below. Maximum 3W or 3L per week.",
  },
  {
    title: "Scoring — Passing",
    items: [
      "Passing Yard: +0.04 pts/yd (25 yds = 1 pt)",
      "Passing Touchdown: +4 pts",
      "Interception Thrown: −3 pts",
      "2-Pt Conversion Passing: +1 pt",
    ],
  },
  {
    title: "Scoring — Rushing",
    items: [
      "Rushing Yard: +0.1 pts/yd (10 yds = 1 pt)",
      "Rushing Touchdown: +6 pts",
      "2-Pt Conversion Rushing: +2 pts",
    ],
  },
  {
    title: "Scoring — Receiving",
    items: [
      "Receiving Yard: +0.1 pts/yd (10 yds = 1 pt)",
      "Reception (RB/WR): +1 pt (PPR)",
      "Reception (TE): +1.5 pts — applies when TE is in TE slot, Flex, or Super Flex",
      "Receiving Touchdown: +6 pts",
      "2-Pt Conversion Receiving: +2 pts",
    ],
  },
  {
    title: "Scoring — Turnovers",
    items: [
      "Fumble Lost: −3 pts",
      "Interception Thrown: −3 pts (see Passing above)",
    ],
  },
  {
    title: "Scoring — Return Touchdowns",
    items: [
      "Kickoff Return Touchdown: +6 pts",
      "Punt Return Touchdown: +6 pts",
    ],
  },
  {
    title: "Scoring — Kicking",
    items: [
      "Extra Point Made: +1 pt",
      "Field Goal Made: +0.1 pts/yd",
      "Field Goal 60–64 yds: +1 bonus pt",
      "Field Goal 65+ yds: +2 bonus pts",
      "Extra Point Missed: −2 pts",
      "Field Goal Missed (1–49 yds): −2 pts",
    ],
  },
  {
    title: "Scoring — Defense / Special Teams",
    items: [
      "Sack: +2 pts",
      "Defensive/ST Fumble Recovery or Interception: +3 pts",
      "Defensive/ST Touchdown: +6 pts",
      "Safety: +2 pts",
    ],
  },
  {
    title: "FAAB Waivers",
    content: "$1,000 starting budget. Blind auction bidding — minimum bid $0. Waiver runs Thursday 11am ET and Sunday 11am ET. All transactions (adds, drops, trades) are recorded in the Transactions log.",
  },
  {
    title: "Dynasty Keepers (Protections)",
    items: [
      "Maximum 3 keepers per team",
      "Rounds 1–2: Ineligible for protection",
      "Rounds 3–6 (Tier 1): Max 1 keeper, forfeits the same draft round pick",
      "Rounds 7+ and FA (Tier 2): Keeper costs a Round 6, 7, or 8 pick (owner's choice)",
      "If protecting 2 FA players: may choose Round 6, 7, or 8 for each",
      "If protecting 1 FA player: must forfeit Round 6",
      "If the required pick is already traded away, the next higher available pick is forfeited",
    ],
  },
  {
    title: "Draft Format",
    items: [
      "18 rounds, snake draft",
      "Rounds 1–2: Picks 1–6 by weighted lottery; picks 7–12 snake",
      "Rounds 3–18: Full snake draft",
      "Timer: 90 seconds per pick",
      "Commissioner may skip or pick for any owner",
      "Drafted players immediately appear on the owner's roster",
    ],
  },
  {
    title: "Trade Rules",
    items: [
      "Trades may include players, FAAB budget, and future draft picks (2026 and 2027)",
      "Trade deadline: November 26, 2026 at 12:00pm ET",
      "Owners may submit counter-offers on received trade proposals",
      "All accepted trades are logged in the Transactions page",
    ],
  },
  {
    title: "Playoffs",
    items: [
      "6 teams qualify: 3 division winners + 3 wild cards (by record, then FPts tiebreaker)",
      "Seeds 1–2 receive a bye in Wild Card Round (Week 15)",
      "Semifinals: Week 16 · Championship: Week 17",
      "Highest seed is the home team in each round",
    ],
  },
];

export default function Rules() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>League Rules</h1>
          <p>WRC Fantasy Football 2026 — Official Scoring &amp; Rules</p>
        </div>
        {sections.map((s, i) => (
          <div key={i} className="wrc-card" style={{ marginBottom: "1rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header">{s.title}</div>
            <div className="wrc-card-body">
              {s.content && (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "oklch(0.3 0.04 150)", lineHeight: 1.7 }}>{s.content}</p>
              )}
              {s.items && (
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {s.items.map((item, j) => (
                    <li key={j} style={{ fontSize: "0.9rem", color: "oklch(0.3 0.04 150)", lineHeight: 1.8, marginBottom: "0.1rem" }}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
