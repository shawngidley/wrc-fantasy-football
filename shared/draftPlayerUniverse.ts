import { normalizePlayerName } from "./playerNameMatch";
import {
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026,
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026_METADATA,
  type DraftUniversePlayer,
  type DraftUniversePosition,
} from "./currentDraftPlayerUniverse2026";

export {
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026,
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026_METADATA,
  type DraftUniversePlayer,
  type DraftUniversePosition,
};

// Delegates to the shared canonical normalizer (shared/playerNameMatch.ts)
// so suffix-stripping and known aliases stay in one place instead of
// drifting between this file's own copy and everywhere else in the app.
const canonical = normalizePlayerName;

export function findDraftUniversePlayer(input: {
  name: string;
  pos: string;
  nflTeam: string;
}): DraftUniversePlayer | null {
  const candidateName = canonical(input.name);
  const candidatePos = input.pos.toUpperCase() as DraftUniversePosition;
  const candidateTeam = input.nflTeam.toUpperCase();
  return CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(
    player => canonical(player.name) === candidateName
      && player.pos === candidatePos
      && player.nflTeam === candidateTeam,
  ) ?? null;
}

export function getDraftUniversePlayerByName(
  name: string,
  pool: readonly DraftUniversePlayer[] = CURRENT_DRAFT_PLAYER_UNIVERSE_2026,
): DraftUniversePlayer | null {
  const candidateName = canonical(name);
  return pool.find(player => canonical(player.name) === candidateName) ?? null;
}

export function getAvailableDraftUniversePlayers(input: {
  draftedNames: Iterable<string>;
  rosteredNames: Iterable<string>;
  pool?: readonly DraftUniversePlayer[];
}): DraftUniversePlayer[] {
  const drafted = new Set(Array.from(input.draftedNames, canonical));
  const rostered = new Set(Array.from(input.rosteredNames, canonical));
  return (input.pool ?? CURRENT_DRAFT_PLAYER_UNIVERSE_2026).filter(
    player => !drafted.has(canonical(player.name)) && !rostered.has(canonical(player.name)),
  );
}
