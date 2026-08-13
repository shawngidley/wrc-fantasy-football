type NewsIdentity = { playerId: number | null; playerName: string };
type RankIdentity = { playerId: number; name: string };

/** Fills omitted generic-news player names using FantasyPros' own player IDs. */
export function attachFantasyProsPlayerNames<T extends NewsIdentity>(items: T[], ranks: RankIdentity[]): T[] {
  const namesById = new Map(ranks.filter(rank => rank.playerId && rank.name).map(rank => [rank.playerId, rank.name]));
  return items.map(item => item.playerName || item.playerId == null
    ? item
    : { ...item, playerName: namesById.get(item.playerId) ?? "" });
}
