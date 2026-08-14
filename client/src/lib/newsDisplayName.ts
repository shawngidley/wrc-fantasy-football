/**
 * News labels must preserve full canonical player names. Any source-specific
 * resolution happens before this display boundary; this helper only removes
 * incidental surrounding whitespace and never abbreviates a given name.
 */
export function getNewsDisplayName(playerName: string): string {
  return playerName.trim();
}
