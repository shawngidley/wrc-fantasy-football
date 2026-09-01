const TEAM_CODE_ALIASES: Record<string, string> = {
  JAX: "JAC",
  KAN: "KC",
  TAM: "TB",
  ARZ: "ARI",
  WAS: "WSH",
  WSN: "WSH",
  OAK: "LV",
  LA: "LAR",
};

export function normalizeNFLTeamCode(team: string | null | undefined): string {
  const code = (team ?? "").trim().toUpperCase();
  return TEAM_CODE_ALIASES[code] ?? code;
}
