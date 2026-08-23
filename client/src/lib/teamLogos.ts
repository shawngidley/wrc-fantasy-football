/**
 * WRC Fantasy Football - Team Logo Mapping
 *
 * The original static logo images only ever existed on the previous host's
 * storage and were not recoverable during the Vercel/Supabase migration.
 * Returning null here lets TeamLogo.tsx fall back to its initials avatar;
 * any owner who re-uploads their real logo via Settings overrides this
 * automatically through the useTeamLogos() custom-logo path.
 */
export function getTeamLogo(_teamName: string): string | null {
  return null;
}
