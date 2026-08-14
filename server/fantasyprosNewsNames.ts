type NewsIdentity = { playerId: number | null; playerName: string; team: string; position?: string };
type RankIdentity = { playerId: number; name: string; team: string; position: string };

/** Enriches generic-news player metadata using FantasyPros' own player IDs. */
export function attachFantasyProsPlayerNames<T extends NewsIdentity>(items: T[], ranks: RankIdentity[]): T[] {
  const ranksById = new Map(ranks.filter(rank => rank.playerId && rank.name).map(rank => [rank.playerId, rank]));
  return items.map(item => {
    const rank = item.playerId == null ? undefined : ranksById.get(item.playerId);
    if (!rank) return item;
    return {
      ...item,
      playerName: item.playerName || rank.name,
      team: item.team || rank.team,
      position: item.position || rank.position,
    } as T;
  });
}
