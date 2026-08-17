import { normalizeNFLTeamCode } from "./nflTeamCodes";

/** Returns ESPN's official NFL team-mark asset for a canonical or upstream team code. */
export function getNflTeamLogoUrl(teamCode: string): string {
  const normalized = normalizeNFLTeamCode(teamCode);
  const espnCode = normalized === "JAC" ? "jax" : normalized.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnCode}.png`;
}
