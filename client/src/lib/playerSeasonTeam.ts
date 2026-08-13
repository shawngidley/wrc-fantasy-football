type SeasonTeamRow = { season: number; team?: string };

export function getHistoricalSeasonTeam(rows: SeasonTeamRow[], season: number): string | null {
  return rows.find(row => row.season === season)?.team ?? null;
}
