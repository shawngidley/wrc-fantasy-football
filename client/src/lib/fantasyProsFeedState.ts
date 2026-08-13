export type FantasyProsFeedState = "loading" | "ready" | "unavailable" | "empty";

export function getFantasyProsFeedState({
  itemCount,
  isLoading,
  isError,
}: {
  itemCount: number;
  isLoading: boolean;
  isError: boolean;
}): FantasyProsFeedState {
  if (itemCount > 0) return "ready";
  if (isLoading) return "loading";
  if (isError) return "unavailable";
  return "empty";
}

export function retainLastSuccessfulItems<T>(freshItems: T[], lastSuccessfulItems: T[]): T[] {
  return freshItems.length > 0 ? freshItems : lastSuccessfulItems;
}
