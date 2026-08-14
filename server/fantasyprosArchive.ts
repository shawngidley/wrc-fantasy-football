import { createHash } from "node:crypto";
import { desc, gte, lt } from "drizzle-orm";
import { fantasyprosNewsArchive, fantasyprosNewsArchiveConfig } from "../drizzle/schema";
import { getDb } from "./db";
import type { FantasyProsNewsItem } from "./fantasypros";

export const ARCHIVE_RETENTION_DAYS = 30;
export const ELIGIBLE_FANTASY_NEWS_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

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

function archiveRowToNews(row: typeof fantasyprosNewsArchive.$inferSelect): FantasyProsNewsItem {
  return {
    id: Number(row.sourceItemId ?? 0),
    playerId: row.playerId ?? null,
    playerName: row.playerName,
    team: row.team ?? "",
    position: row.position ?? undefined,
    title: row.title,
    description: row.description ?? "",
    impact: row.impact ?? "",
    author: row.author ?? "FantasyPros",
    published: row.publishedAt.toISOString(),
    link: row.articleUrl ?? "",
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
  const db = await getDb();
  if (!db) throw new Error("Archive database is not available");

  const now = new Date();
  const rows = items
    .filter(isEligibleFantasyProsNews)
    .map(item => {
      const publishedAt = asDate(item.published);
      if (!publishedAt) return null;
      const expiresAt = new Date(publishedAt.getTime() + ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      if (expiresAt <= now) return null;
      return {
        archiveKey: fantasyProsArchiveKey(item),
        source: "FantasyPros",
        sourceItemId: item.id ? String(item.id) : null,
        playerId: item.playerId,
        playerName: item.playerName,
        team: item.team || null,
        position: item.position || null,
        title: item.title,
        description: item.description || null,
        impact: item.impact || null,
        author: item.author || null,
        articleUrl: item.link || null,
        publishedAt,
        expiresAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length) {
    await db.insert(fantasyprosNewsArchive).values(rows).onDuplicateKeyUpdate({
      set: {
        capturedAt: now,
      },
    });
  }
  const prunedResult = await db.delete(fantasyprosNewsArchive).where(lt(fantasyprosNewsArchive.expiresAt, now));
  await db.insert(fantasyprosNewsArchiveConfig).values({
    id: "rolling-archive",
    retentionDays: ARCHIVE_RETENTION_DAYS,
    lastCollectedAt: now,
  }).onDuplicateKeyUpdate({
    set: { lastCollectedAt: now, retentionDays: ARCHIVE_RETENTION_DAYS },
  });
  return { archived: rows.length, pruned: Number(prunedResult[0]?.affectedRows ?? 0) };
}

export async function getArchivedFantasyProsNews(): Promise<FantasyProsNewsItem[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(fantasyprosNewsArchive)
    .where(gte(fantasyprosNewsArchive.publishedAt, cutoff))
    .orderBy(desc(fantasyprosNewsArchive.publishedAt));
  return rows.map(archiveRowToNews);
}

export async function getArchiveScheduleTaskUid(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [config] = await db.select().from(fantasyprosNewsArchiveConfig).limit(1);
  return config?.scheduleCronTaskUid ?? null;
}

export async function setArchiveScheduleTaskUid(taskUid: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Archive database is not available");
  await db.insert(fantasyprosNewsArchiveConfig).values({
    id: "rolling-archive",
    scheduleCronTaskUid: taskUid,
    retentionDays: ARCHIVE_RETENTION_DAYS,
  }).onDuplicateKeyUpdate({ set: { scheduleCronTaskUid: taskUid } });
}
