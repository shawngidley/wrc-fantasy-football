import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import type { FantasyProsNewsItem } from "./fantasypros";

export const ARCHIVE_RETENTION_DAYS = 30;
export const ELIGIBLE_FANTASY_NEWS_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

type ArchiveRow = {
  source_item_id: string | null;
  player_id: number | null;
  player_name: string;
  team: string | null;
  position: string | null;
  title: string;
  description: string | null;
  impact: string | null;
  author: string | null;
  article_url: string | null;
  published_at: string;
};

export function isEligibleFantasyProsNews(item: FantasyProsNewsItem): boolean {
  return Boolean(item.playerName && item.title && item.position && ELIGIBLE_FANTASY_NEWS_POSITIONS.has(item.position));
}

export function fantasyProsArchiveKey(item: FantasyProsNewsItem): string {
  const stableSource = item.id || `${item.playerId ?? "no-player"}|${item.title}|${item.published}`;
  return createHash("sha256").update(`fantasypros|${stableSource}`).digest("hex");
}

function asDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function archiveRowToNews(row: ArchiveRow): FantasyProsNewsItem {
  return {
    id: Number(row.source_item_id ?? 0),
    playerId: row.player_id ?? null,
    playerName: row.player_name,
    team: row.team ?? "",
    position: row.position ?? undefined,
    title: row.title,
    description: row.description ?? "",
    impact: row.impact ?? "",
    author: row.author ?? "FantasyPros",
    published: row.published_at,
    link: row.article_url ?? "",
    categories: [],
  };
}

export function mergeFantasyProsNews(current: FantasyProsNewsItem[], archived: FantasyProsNewsItem[]): FantasyProsNewsItem[] {
  const byKey = new Map<string, FantasyProsNewsItem>();
  [...current, ...archived].forEach(item => {
    const key = fantasyProsArchiveKey(item);
    if (!byKey.has(key) || current.includes(item)) byKey.set(key, item);
  });
  return Array.from(byKey.values()).sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
}

export async function archiveFantasyProsNews(items: FantasyProsNewsItem[]): Promise<{ archived: number; pruned: number }> {
  const now = new Date();
  const rows = items
    .filter(isEligibleFantasyProsNews)
    .map(item => {
      const publishedAt = asDate(item.published);
      if (!publishedAt) return null;
      const expiresAt = new Date(publishedAt.getTime() + ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      if (expiresAt <= now) return null;
      return {
        archive_key: fantasyProsArchiveKey(item),
        source: "FantasyPros",
        source_item_id: item.id ? String(item.id) : null,
        player_id: item.playerId,
        player_name: item.playerName,
        team: item.team || null,
        position: item.position || null,
        title: item.title,
        description: item.description || null,
        impact: item.impact || null,
        author: item.author || null,
        article_url: item.link || null,
        published_at: publishedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        captured_at: now.toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length) {
    const { error } = await supabaseAdmin.from("fantasypros_news_archive").upsert(rows, { onConflict: "archive_key" });
    if (error) throw new Error(`Unable to archive FantasyPros news: ${error.message}`);
  }
  const { error: pruneError, count } = await supabaseAdmin
    .from("fantasypros_news_archive")
    .delete({ count: "exact" })
    .lt("expires_at", now.toISOString());
  if (pruneError) throw new Error(`Unable to prune FantasyPros archive: ${pruneError.message}`);
  const { error: configError } = await supabaseAdmin.from("fantasypros_news_archive_config").upsert({
    id: "rolling-archive",
    retention_days: ARCHIVE_RETENTION_DAYS,
    last_collected_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "id" });
  if (configError) throw new Error(`Unable to update FantasyPros archive schedule config: ${configError.message}`);
  return { archived: rows.length, pruned: count ?? 0 };
}

export async function getArchivedFantasyProsNews(): Promise<FantasyProsNewsItem[]> {
  const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabaseAdmin
    .from("fantasypros_news_archive")
    .select("source_item_id, player_id, player_name, team, position, title, description, impact, author, article_url, published_at")
    .gte("published_at", cutoff.toISOString())
    .order("published_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map(row => archiveRowToNews(row as ArchiveRow));
}

