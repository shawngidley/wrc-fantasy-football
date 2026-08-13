type RosterBriefingItem = { playerName: string };

export function getRosterBriefingPreview<T extends RosterBriefingItem>(items: T[], maxItems = 8, perPlayer = 2): T[] {
  const counts = new Map<string, number>();
  const preview: T[] = [];
  for (const item of items) {
    const key = item.playerName.toLowerCase();
    const count = counts.get(key) ?? 0;
    if (count >= perPlayer) continue;
    preview.push(item);
    counts.set(key, count + 1);
    if (preview.length === maxItems) break;
  }
  return preview;
}
