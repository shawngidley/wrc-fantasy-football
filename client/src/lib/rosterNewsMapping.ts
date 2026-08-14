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
const suffixes = new Set(["jr", "sr", "ii", "iii", "iv"]);

function matchesRosterPlayer(sourceName: string, player: RosterNewsPlayer): boolean {
  if (normalize(sourceName) === normalize(player.name)) return true;
  const sourceParts = sourceName.toLowerCase().replace(/\./g, "").split(/\s+/).filter(Boolean);
  const rosterParts = player.name.toLowerCase().replace(/\./g, "").split(/\s+/).filter(Boolean);
  const sourceFamilyName = [...sourceParts].reverse().find(part => !suffixes.has(part));
  const rosterFamilyName = [...rosterParts].reverse().find(part => !suffixes.has(part));
  return Boolean(
    sourceParts.length >= 2 &&
    sourceParts[0].length === 1 &&
    sourceParts[0] === rosterParts[0]?.[0] &&
    sourceFamilyName === rosterFamilyName,
  );
}

export function mapRosterNewsForDisplay(news: RosterNewsSource[], roster: RosterNewsPlayer[]): RosterNewsDisplay[] {
  return news
    .map(article => {
      const player = roster.find(candidate => matchesRosterPlayer(article.playerName, candidate));
      if (!player) return null;
      return {
        // The roster is the source of truth for the display label, so a source
        // abbreviation or variant never shortens the owner's player name.
        playerName: player.name,
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
