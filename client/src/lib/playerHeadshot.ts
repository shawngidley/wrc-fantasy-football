export function getEspnHeadshotUrl(athleteId: string | number | null | undefined): string | null {
  const id = String(athleteId ?? "").trim();
  return id ? `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png` : null;
}
