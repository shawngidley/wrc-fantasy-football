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

function canonical(value: string): string {
  return value
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/\b(jr|sr)\.?(?=\s|$)/g, "")
    .replace(/\b(ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

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

export function getDraftUniversePlayerByName(name: string): DraftUniversePlayer | null {
  const candidateName = canonical(name);
  return CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(player => canonical(player.name) === candidateName) ?? null;
}

export function getAvailableDraftUniversePlayers(input: {
  draftedNames: Iterable<string>;
  rosteredNames: Iterable<string>;
}): DraftUniversePlayer[] {
  const drafted = new Set(Array.from(input.draftedNames, canonical));
  const rostered = new Set(Array.from(input.rosteredNames, canonical));
  return CURRENT_DRAFT_PLAYER_UNIVERSE_2026.filter(
    player => !drafted.has(canonical(player.name)) && !rostered.has(canonical(player.name)),
  );
}
