/**
 * NFL team defenses (D/ST) for the player card.
 *
 * A D/ST is rostered under a team name and has no Tank01 player record, so the
 * player page can't look it up the way it looks up an individual player. These
 * helpers resolve such a name to the app's team code and back.
 *
 * Both are derived from the 2026 draft universe rather than a hand-written list
 * of 32 names, because the league's D/ST names are not uniformly "City Nickname"
 * -- the universe has "Denver Broncos" but also "GB Packers", "KC Chiefs",
 * "LA Rams", "NE Patriots", "SF 49ers". That dataset is what rosters, draft
 * picks and player-card links all use, and weeklyResultsFinalize names
 * player_weekly_stats rows from it too, so deriving the mapping keeps the name
 * used for the DB stat lookup byte-identical to the name the finalize job wrote.
 * Codes are the APP's codes (Jacksonville is "JAC", not Tank01's "JAX");
 * downstream hooks convert when they call Tank01.
 */
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026, getDraftUniversePlayerByName } from "@shared/draftPlayerUniverse";

const DST_BY_CODE = new Map<string, { name: string; id: string }>(
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026
    .filter(p => p.pos === "DST")
    .map(p => [p.nflTeam, { name: p.name, id: p.id }]),
);

/**
 * Returns the app team code if the given name is an NFL team defense
 * ("Denver Broncos" -> "DEN", "GB Packers" -> "GB"), or null if it isn't one.
 * Name matching goes through the universe's own canonical normalizer, the same
 * one every other roster lookup uses.
 */
export function resolveDstTeam(name: string | null | undefined): string | null {
  if (!name) return null;
  const player = getDraftUniversePlayerByName(name);
  return player && player.pos === "DST" ? player.nflTeam : null;
}

/** The rostered D/ST name for a code ("DEN" -> "Denver Broncos", "GB" -> "GB Packers"). */
export function dstTeamFullName(code: string | null | undefined): string {
  return code ? (DST_BY_CODE.get(code)?.name ?? code) : "";
}

/**
 * The draft-universe player id for a code ("DEN" -> "dst-den"). A D/ST has no
 * Tank01 playerID, and this is the id every other surface bids with (the Free
 * Agents page passes the same universe id), so the card's FAAB bid has to carry
 * it -- submitFaabBid rejects an empty playerId.
 */
export function dstTeamPlayerId(code: string | null | undefined): string {
  return code ? (DST_BY_CODE.get(code)?.id ?? "") : "";
}
