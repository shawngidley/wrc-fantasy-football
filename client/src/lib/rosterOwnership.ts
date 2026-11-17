import { normalizePlayerName } from "@shared/playerNameMatch";

export type RosteredRow = { name: string; teamName?: string | null; teamId: string };

/**
 * Maps a normalized player name to the WRC team that has him. Keyed through
 * normalizePlayerName so a defense stored as "Green Bay Packers" is found by
 * the pool's "GB Packers" (playerNameMatch carries that alias explicitly, for
 * exactly this reason: DST names were shortened in the pool after some teams
 * had already rostered them under the long name), and likewise for Jr/III
 * suffix and nickname variants. A plain lowercase key missed those and showed
 * rostered players as free agents.
 *
 * This also puts the map back in step with the ownedNames set built beside it
 * in FreeAgents, which has always normalized. The two disagreeing is what made
 * the bug look inconsistent: a player could be counted as owned and still be
 * rendered without an owner.
 */
export function buildOwnershipMap(rows: readonly RosteredRow[]): Record<string, string> {
  return Object.fromEntries(rows.map(row => [normalizePlayerName(row.name), row.teamName ?? row.teamId]));
}

export function ownerOf(map: Record<string, string>, playerName: string): string | undefined {
  return map[normalizePlayerName(playerName)];
}
