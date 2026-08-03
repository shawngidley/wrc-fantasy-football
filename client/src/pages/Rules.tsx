import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Rules() {
  const { franchise } = useAuth();
  const sections = [
    { title: "League Format", content: "12 teams in 3 divisions of 4 (East, Central, West). 14-week regular season, 6-team playoffs (Weeks 15-17). Top 2 seeds receive a first-round bye." },
    { title: "Roster & Lineup", content: "18-player rosters. 10 starters: QB, 2 RB, 2 WR, TE, Super Flex (QB/RB/WR/TE), Flex (RB/WR/TE), K, DST. No IR or taxi squad." },
    { title: "Scoring — Passing", content: "Passing TD: +4 pts. Passing yards: +0.04/yd (25 yds = 1 pt). Interception thrown: -2 pts. 2-pt conversion: +2 pts." },
    { title: "Scoring — Rushing", content: "Rushing TD: +6 pts. Rushing yards: +0.1/yd (10 yds = 1 pt). 2-pt conversion: +2 pts." },
    { title: "Scoring — Receiving", content: "Receiving TD: +6 pts. Receiving yards: +0.1/yd. Reception: +1 pt (PPR). TE Premium: +1.5 pts/reception (based on player position, not lineup slot). 2-pt conversion: +2 pts." },
    { title: "Scoring — Kicking", content: "FG 0-39 yds: +3 pts. FG 40-49 yds: +4 pts. FG 50+ yds: +5 pts. PAT: +1 pt. Missed FG: -1 pt." },
    { title: "Scoring — DST", content: "Sack: +1 pt. INT: +2 pts. Fumble recovery: +2 pts. Safety: +2 pts. Defensive TD: +6 pts. Points allowed 0: +10 pts. 1-6: +7 pts. 7-13: +4 pts. 14-20: +1 pt. 21-27: 0 pts. 28-34: -1 pt. 35+: -4 pts." },
    { title: "Double Result System", content: "Each team earns two results per week. Head-to-head result: 2W (win) or 2L (loss). League median result: 1W if your score is in the top 6, 1L if in the bottom 6. Maximum 3W or 3L per week." },
    { title: "FAAB Waivers", content: "$1,000 starting budget. Waiver runs: Thursday 11am ET and Sunday 11am ET (exceptions: Weeks 4, 5, 6, 7, 10, 11 run at 9am ET). Blind bidding — minimum bid $0." },
    { title: "Dynasty Keepers (Protections)", content: "Maximum 3 keepers. Rounds 1-2 ineligible. Rounds 3-6: max 1 keeper, forfeits same-round pick. Rounds 7-10: forfeits pick 2 rounds earlier. Rounds 11-18: forfeits pick 3 rounds earlier." },
    { title: "Draft Format", content: "18 rounds. Rounds 1-2: Picks 1-6 determined by weighted lottery, picks 7-12 snake. Rounds 3-18: Full snake draft. Timer: 1 minute 30 seconds per pick. Commissioner may skip or pick for any owner." },
    { title: "Trade Deadline", content: "Trade deadline: November 26, 2026 at 12:00pm ET. Trades may include players, FAAB budget, and future draft picks." },
    { title: "Playoffs", content: "6 teams qualify: 3 division winners + 3 wild cards. Seeds 1-2 receive a bye in Wild Card Round (Week 15). Semifinals Week 16, Championship Week 17. Highest seed hosts each round." },
  ];

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}><h1>League Rules</h1><p>WRC Fantasy Football 2025 Official Rules</p></div>
        {sections.map((s, i) => (
          <div key={i} className="wrc-card" style={{ marginBottom: "1rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header">{s.title}</div>
            <div className="wrc-card-body"><p style={{ margin: 0, fontSize: "0.9rem", color: "oklch(0.3 0.04 150)", lineHeight: 1.7 }}>{s.content}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
