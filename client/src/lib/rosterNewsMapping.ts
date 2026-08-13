export type RosterNewsSource = {
  playerName: string;
  team: string;
  title: string;
  description: string;
  impact: string;
  published: string;
  link: string;
};

export type RosterNewsPlayer = { name: string; pos: string; nflTeam: string };

export type RosterNewsDisplay = {
  playerName: string;
  pos: string;
  nflTeam: string;
  headline: string;
  description: string;
  published: string;
  url: string;
  source: "FantasyPros";
};

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapRosterNewsForDisplay(news: RosterNewsSource[], roster: RosterNewsPlayer[]): RosterNewsDisplay[] {
  const rosterByName = new Map(roster.map(player => [normalize(player.name), player]));
  return news
    .map(article => {
      const player = rosterByName.get(normalize(article.playerName));
      if (!player) return null;
      return {
        playerName: article.playerName,
        pos: player.pos,
        nflTeam: player.nflTeam || article.team,
        headline: article.title,
        description: article.impact || article.description || article.title,
        published: article.published,
        url: article.link,
        source: "FantasyPros" as const,
      };
    })
    .filter((item): item is RosterNewsDisplay => item !== null)
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
}
