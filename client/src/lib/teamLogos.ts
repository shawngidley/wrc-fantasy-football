/**
 * WRC Fantasy Football - Team Logo Mapping
 * Maps every team name to its CDN-hosted logo URL.
 * Logos are square JPG/WebP images uploaded via manus-upload-file --webdev.
 */

export const TEAM_LOGOS: Record<string, string> = {
  // Jonas Pattie
  "The Super Snuffleupagus": "/manus-storage/super_aa541626.jpg",
  // Keith Cromer
  "HamSandwich": "/manus-storage/ham_48103cf7.jpg",
  // David R. (Heiden)
  "Heiden's Hardtimes": "/manus-storage/hardtimes_bfd66cb4.jpg",
  // Scott N. (Legion of Doom)
  "Legion of Doom": "/manus-storage/doom_e279cccc.jpg",
  // Jason (Millertime)
  "Millertime": "/manus-storage/millertime_0177d5ab.webp",
  // Bill (Billy Goats Gruff)
  "Billy Goats Gruff": "/manus-storage/goats_4d0eaf02.jpg",
  // Jamie (The Four Horsemen)
  "The Four Horsemen": "/manus-storage/four_22105b5d.jpg",
  // Dan (Xavier Musketeers)
  "Xavier Musketeers": "/manus-storage/xavier_2fffb3f2.webp",
  // Scott M. (Legends)
  "Legends": "/manus-storage/legends_07a1557b.jpg",
  // David S. (Vipers)
  "Vipers": "/manus-storage/vipers_78d5a630.jpg",
  // Shawn (The Boys of Fall)
  "The Boys of Fall": "/manus-storage/fall_99284b97.jpg",
  // Greg (Larry "Bud" Melman123)
  'Larry "Bud" Melman123': "/manus-storage/larry_60cbe4cd.jpg",
};

/**
 * Returns the logo URL for a given team name.
 * Falls back to a generic football emoji placeholder if not found.
 */
export function getTeamLogo(teamName: string): string | null {
  return TEAM_LOGOS[teamName] ?? null;
}
