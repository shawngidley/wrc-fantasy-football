/** Fetches custom logo URLs through the redacted public team procedure. */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export function useTeamLogos(): Record<string, string> {
  const teamsQuery = trpc.league.publicTeams.useQuery(undefined, { staleTime: 5 * 60_000 });
  return useMemo(() => Object.fromEntries(
    (teamsQuery.data ?? [])
      .filter(team => Boolean(team.logo_url))
      .map(team => [team.name, team.logo_url as string]),
  ), [teamsQuery.data]);
}
